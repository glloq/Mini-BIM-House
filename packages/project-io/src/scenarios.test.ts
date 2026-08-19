import { describe, expect, it } from 'vitest';
import type { Project, Scenario } from '@house-technical-designer/core-domain';
import {
  applyProjectScenario,
  applyScenario,
  listScenarios,
} from './scenarios.js';

function baseProject(): Project {
  return {
    id: 'project' as Project['id'],
    metadata: {
      name: 'Scenario fixture',
      createdAt: '2026-08-19T00:00:00Z',
      updatedAt: '2026-08-19T00:00:00Z',
      projectRevision: 'rev-1',
    },
    site: { northAngleDeg: 0, climateProfileId: 'climate' },
    building: { levels: [], zones: [] },
    equipment: [
      {
        id: 'pv',
        kind: 'PHOTOVOLTAIC',
        catalogKind: 'GENERIC',
        properties: { installedPowerWp: 4000 },
      },
    ],
    scenarios: [
      {
        id: 'pv-6kwp',
        name: 'PV 6 kWp',
        baseProjectRevision: 'rev-1',
        overrides: [
          {
            path: 'equipment/0/properties/installedPowerWp',
            operation: 'SET',
            value: 6000,
          },
        ],
      },
    ],
  };
}

const scenario = (overrides: Scenario['overrides']): Scenario => ({
  id: 'variant',
  name: 'Variant',
  baseProjectRevision: 'rev-1',
  overrides,
});

describe('project scenarios', () => {
  it('derives a variant without mutating the base project', () => {
    const project = baseProject();
    const result = applyProjectScenario(project, 'pv-6kwp');
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.project.equipment?.[0]?.properties.installedPowerWp).toBe(
      6000,
    );
    expect(project.equipment?.[0]?.properties.installedPowerWp).toBe(4000);
    expect(result.issues).toEqual([]);
  });

  it('adds to and removes from existing collections', () => {
    const added = applyScenario(
      baseProject(),
      scenario([
        {
          path: 'equipment',
          operation: 'ADD',
          value: {
            id: 'battery',
            kind: 'BATTERY',
            catalogKind: 'GENERIC',
            properties: { usableCapacityKWh: 10 },
          },
        },
      ]),
    );
    expect(added.status).toBe('OK');
    if (added.status === 'OK') expect(added.project.equipment).toHaveLength(2);

    const removed = applyScenario(
      baseProject(),
      scenario([{ path: 'equipment/0', operation: 'REMOVE' }]),
    );
    expect(removed.status).toBe('OK');
    if (removed.status === 'OK')
      expect(removed.project.equipment).toHaveLength(0);
  });

  it('replaces a reference only when the project already declares one', () => {
    const replaced = applyScenario(
      baseProject(),
      scenario([
        {
          path: 'site/climateProfileId',
          operation: 'REPLACE_REFERENCE',
          value: 'other-climate',
        },
      ]),
    );
    expect(replaced.status).toBe('OK');
    if (replaced.status === 'OK')
      expect(replaced.project.site.climateProfileId).toBe('other-climate');

    const missing = applyScenario(
      baseProject(),
      scenario([
        {
          path: 'site/unknownReference',
          operation: 'REPLACE_REFERENCE',
          value: 'x',
        },
      ]),
    );
    expect(missing.status).toBe('INVALID');
  });

  it('never creates missing project nodes on the way to a path', () => {
    const result = applyScenario(
      baseProject(),
      scenario([
        {
          path: 'building/levels/0/walls/0/heightMm',
          operation: 'SET',
          value: 3000,
        },
      ]),
    );
    expect(result.status).toBe('INVALID');
    if (result.status === 'INVALID')
      expect(result.issues.map(({ code }) => code)).toEqual([
        'SCENARIO_PATH_NOT_FOUND',
      ]);
  });

  it('rejects an empty path and a value-less SET', () => {
    const empty = applyScenario(
      baseProject(),
      scenario([{ path: '', operation: 'SET', value: 1 }]),
    );
    expect(empty.status).toBe('INVALID');
    const valueless = applyScenario(
      baseProject(),
      scenario([{ path: 'site/altitudeM', operation: 'SET' }]),
    );
    expect(valueless.status).toBe('INVALID');
    if (valueless.status === 'INVALID')
      expect(valueless.issues[0]?.code).toBe('SCENARIO_MISSING_VALUE');
  });

  it('reports a revision mismatch without discarding the variant', () => {
    const result = applyScenario(baseProject(), {
      ...scenario([{ path: 'site/altitudeM', operation: 'SET', value: 120 }]),
      baseProjectRevision: 'rev-0',
    });
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.issues.map(({ code }) => code)).toEqual([
      'SCENARIO_REVISION_MISMATCH',
    ]);
    expect(result.project.site.altitudeM).toBe(120);
  });

  it('reports an unknown scenario identifier and lists the known ones', () => {
    const project = baseProject();
    expect(listScenarios(project).map(({ id }) => id)).toEqual(['pv-6kwp']);
    const result = applyProjectScenario(project, 'nope');
    expect(result.status).toBe('INVALID');
    if (result.status === 'INVALID')
      expect(result.issues[0]?.code).toBe('SCENARIO_UNKNOWN_ID');
  });
});
