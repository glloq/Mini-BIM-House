import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { projectChecks } from '../checks/checks-model.js';
import {
  DEFAULT_SHELL_NAVIGATION,
  activeTab,
  navigationFor,
} from './navigation-state.js';
import { describeTarget, isEmptyTarget, targetReach } from './ui-target.js';
import { workspaceOfLegacyTab } from './workspaces.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

describe('what a finding can ask the interface to do', () => {
  const checks = projectChecks(project, undefined);

  it('never points nowhere', () => {
    for (const check of checks) {
      if (check.fix === undefined) continue;
      const target = {
        workspace: workspaceOfLegacyTab(check.fix.tab),
        ...(check.fix.objectIds?.[0] === undefined
          ? {}
          : { objectId: check.fix.objectIds[0] }),
        ...(check.fix.propertyPath === undefined
          ? {}
          : { propertyPath: check.fix.propertyPath }),
      };
      expect(isEmptyTarget(target)).toBe(false);
      expect(describeTarget(target)).not.toBe('nulle part');
    }
  });

  it('sends every fix to a space that exists', () => {
    for (const check of checks) {
      if (check.fix === undefined) continue;
      const navigation = navigationFor(DEFAULT_SHELL_NAVIGATION, {
        workspace: workspaceOfLegacyTab(check.fix.tab),
      });
      expect(activeTab(navigation)).toBeDefined();
    }
  });

  it('names an object the project actually holds', () => {
    const known = new Set<string>();
    for (const level of project.building.levels)
      for (const entity of [
        ...level.walls,
        ...level.openings,
        ...level.slabs,
        ...level.roofs,
        ...level.spaces,
        ...level.stairs,
        ...(level.components ?? []),
        ...(level.structure ?? []),
      ])
        known.add(entity.id);
    for (const network of project.systems ?? [])
      for (const entity of [...network.nodes, ...network.edges])
        known.add(entity.id);
    for (const check of checks)
      for (const objectId of check.fix?.objectIds ?? [])
        expect(known.has(objectId), `${check.id} → ${objectId}`).toBe(true);
  });

  it('measures how far a target is going, so nothing is animated for nothing', () => {
    const here = { workspace: 'BUILD' as const, levelId: 'ground' };
    expect(targetReach(here, { workspace: 'BUILD', levelId: 'ground' })).toBe(
      'NONE',
    );
    expect(targetReach(here, { levelId: 'level-1' })).toBe('LEVEL');
    expect(targetReach(here, { propertyPath: 'Giron' })).toBe('SELECTION');
  });
});
