import {
  createBuilding,
  createProjectMetadata,
  createSite,
  DESIGN_DOMAIN_IDS,
  type Project,
  type ProjectId,
  type ProjectScope,
} from '@house-technical-designer/core-domain';
import { CALCULATION_MODULES } from '@house-technical-designer/calculation-adapters';
import { describe, expect, it } from 'vitest';

import {
  domainsInPlay,
  domainsSetAside,
  moduleInScope,
  partitionModules,
} from './scope-filter.js';

function project(scope?: ProjectScope, over: Partial<Project> = {}): Project {
  return {
    id: 'p' as unknown as ProjectId,
    metadata: createProjectMetadata('Maison', '2026-01-01T00:00:00.000Z'),
    site: createSite(),
    building: createBuilding(),
    ...(scope === undefined ? {} : { scope }),
    ...over,
  };
}

const NARROW: ProjectScope = {
  intent: 'NEW_BUILD',
  enabledDomains: ['ARCHITECTURE'],
};

describe('what a scope sets aside', () => {
  it('offers everything to a project that never stated a scope', () => {
    expect([...domainsInPlay(project())].sort()).toEqual(
      [...DESIGN_DOMAIN_IDS].sort(),
    );
    expect(domainsSetAside(project())).toEqual([]);
  });

  it('sets aside a trade the scope drops and the project does not hold', () => {
    expect(domainsSetAside(project(NARROW))).toContain('ELECTRICAL');
    expect(moduleInScope(project(NARROW), 'photovoltaic')).toBe(false);
  });

  it('never sets aside a trade the project actually holds', () => {
    const wired = project(NARROW, {
      systems: [
        {
          id: 'net-1',
          discipline: 'ELECTRICAL',
          systemType: 'LIGHTING_CIRCUIT',
          nodes: [],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(domainsInPlay(wired).has('ELECTRICAL')).toBe(true);
    expect(domainsSetAside(wired)).not.toContain('ELECTRICAL');
    expect(moduleInScope(wired, 'electrical')).toBe(true);
  });

  it('keeps architecture whatever the scope says', () => {
    const empty = project({ intent: 'STUDY', enabledDomains: [] });
    expect(domainsInPlay(empty).has('ARCHITECTURE')).toBe(true);
    expect(moduleInScope(empty, 'thermal')).toBe(true);
  });

  it('splits a list of modules without losing one', () => {
    const modules = CALCULATION_MODULES.map(({ id }) => ({ moduleId: id }));
    const { offered, setAside } = partitionModules(project(NARROW), modules);
    expect(offered.length + setAside.length).toBe(modules.length);
    expect(offered.map(({ moduleId }) => moduleId)).toContain('thermal');
    expect(setAside.map(({ moduleId }) => moduleId)).toContain('photovoltaic');
    // Nothing is dropped: a module set aside is still in the list, in its own
    // group.
    expect(
      [...offered, ...setAside].map(({ moduleId }) => moduleId).sort(),
    ).toEqual(modules.map(({ moduleId }) => moduleId).sort());
  });
});
