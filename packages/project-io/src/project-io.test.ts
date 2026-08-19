import { describe, expect, it } from 'vitest';
import { loadProjectJson, serializeProjectFile } from './project-io.js';

const fixture = {
  format: 'house-technical-designer-project' as const,
  schemaVersion: '1.0.0',
  project: {
    id: 'project',
    metadata: {
      name: 'House',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: {
      levels: [
        {
          id: 'ground',
          name: 'Ground',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          stairs: [],
          spaces: [],
          annotations: [],
        },
      ],
      zones: [],
    },
    materialLibrary: { materials: [] },
    assemblies: [],
    equipment: [],
    systems: [],
    scenarios: [],
    drawingViews: [],
    calculationSettings: {},
    regulatoryContext: { country: 'FR', enabledRulePacks: [] },
  },
  references: {},
  extensions: {},
};

describe('project I/O', () => {
  it('loads a current project without mutating input data', () => {
    const source = JSON.stringify(fixture);
    const result = loadProjectJson(source);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.file).not.toBe(fixture);
  });
  it('rejects malformed and future files explicitly', () => {
    expect(loadProjectJson('{')).toMatchObject({ status: 'INVALID_JSON' });
    expect(
      loadProjectJson(JSON.stringify({ ...fixture, schemaVersion: '2.0.0' })),
    ).toEqual({ status: 'UNSUPPORTED_FUTURE_SCHEMA', schemaVersion: '2.0.0' });
  });
  it('never replaces missing required values with defaults', () => {
    const invalid = { ...fixture, project: { ...fixture.project, site: {} } };
    expect(loadProjectJson(JSON.stringify(invalid))).toMatchObject({
      status: 'INVALID_PROJECT',
      issues: expect.arrayContaining([
        expect.objectContaining({ path: '/project/site/northAngleDeg' }),
      ]),
    });
  });
  it('serializes canonically and round-trips', () => {
    const first = serializeProjectFile(fixture);
    const second = serializeProjectFile({
      ...fixture,
      extensions: {},
      references: {},
    });
    expect(first).toBe(second);
    expect(loadProjectJson(first)).toMatchObject({ status: 'OK' });
  });
  it('refuses non-finite values before JSON can coerce them to null', () => {
    expect(() =>
      serializeProjectFile({
        ...fixture,
        project: { ...fixture.project, site: { northAngleDeg: Number.NaN } },
      }),
    ).toThrow('/project/site/northAngleDeg');
  });
});
