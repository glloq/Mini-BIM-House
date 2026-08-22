import {
  DESIGN_DOMAIN_IDS,
  type Project,
  type ProjectScope,
} from '@house-technical-designer/core-domain';
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { workspaceOfDomain } from '../ux/workspaces.js';
import { networksOfDomain, technicalDomains } from './discipline-scope.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

const ARCHITECTURE_ONLY: ProjectScope = {
  intent: 'NEW_BUILD',
  enabledDomains: ['ARCHITECTURE'],
};

describe('the disciplines Systèmes reads the plan through', () => {
  it('only offers trades that belong to that space', () => {
    for (const id of technicalDomains(project))
      expect(workspaceOfDomain(id)).toBe('SYSTEMS');
  });

  it('counts what the project holds of each', () => {
    const drawn = technicalDomains(project).filter(
      (id) => networksOfDomain(project, id) > 0,
    );
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).toContain('ELECTRICAL');
  });

  it('keeps a trade the scope dropped when the project practises it', () => {
    const narrowed: Project = { ...project, scope: ARCHITECTURE_ONLY };
    expect(technicalDomains(narrowed)).toContain('ELECTRICAL');
    // And drops the ones it does not: the scope is what stops the list from
    // being sixteen entries on every project.
    expect(technicalDomains(narrowed).length).toBeLessThan(
      DESIGN_DOMAIN_IDS.length,
    );
  });

  it('offers nothing technical on a project that draws nothing technical', () => {
    const bare: Project = {
      ...project,
      scope: ARCHITECTURE_ONLY,
      systems: [],
      building: {
        ...project.building,
        levels: project.building.levels.map((level) => ({
          ...level,
          components: [],
        })),
      },
    };
    expect(technicalDomains(bare)).toEqual([]);
  });
});
