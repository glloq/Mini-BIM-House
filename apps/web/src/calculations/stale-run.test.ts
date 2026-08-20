import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  climateSignature,
  isCurrentRun,
  type CalculationRun,
} from './calculation-runner.js';

function project(revision: string): Project {
  return {
    id: 'project' as Project['id'],
    metadata: {
      name: 'Révisions',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      projectRevision: revision,
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
  };
}

function dataset(id: string, temperatureC: number): ClimateDataset {
  return {
    id,
    location: {
      latitude: 48,
      longitude: -4,
      altitudeM: 50,
      timezone: 'Europe/Paris',
    },
    resolution: 'MONTHLY',
    source: { id: 'test', provider: 'Test' },
    samples: [{ timestamp: '2026-01', airTemperatureC: temperatureC }],
  };
}

function run(
  project: Project,
  climate: readonly ClimateDataset[],
): CalculationRun {
  return {
    runs: [],
    missing: [],
    provenance: [],
    projectRevision: project.metadata.projectRevision ?? '',
    climateFingerprint: climateSignature(climate),
    startedAt: '2026-01-01T00:00:00Z',
    completedAt: '2026-01-01T00:00:01Z',
  };
}

describe('results that no longer describe the project', () => {
  it('accepts a run computed on the revision on screen', () => {
    const current = project('20');
    const climate = [dataset('brest', 11)];
    expect(isCurrentRun(run(current, climate), current, climate)).toBe(true);
  });

  it('withholds a run computed on an earlier revision', () => {
    const climate = [dataset('brest', 11)];
    const old = run(project('20'), climate);
    // The house was edited twenty times since; those numbers describe another
    // building.
    expect(isCurrentRun(old, project('35'), climate)).toBe(false);
  });

  it('withholds a run computed with another climate file', () => {
    const before = [dataset('brest', 11)];
    const stale = run(project('20'), before);
    // Same identifier, different content: the answers would differ.
    expect(isCurrentRun(stale, project('20'), [dataset('brest', 14)])).toBe(
      false,
    );
    expect(isCurrentRun(stale, project('20'), [])).toBe(false);
  });

  it('has nothing to show before the first run', () => {
    expect(isCurrentRun(undefined, project('1'), [])).toBe(false);
  });

  it('does not depend on the order the datasets were loaded in', () => {
    const first = [dataset('brest', 11), dataset('rennes', 12)];
    const second = [dataset('rennes', 12), dataset('brest', 11)];
    expect(climateSignature(first)).toBe(climateSignature(second));
  });
});
