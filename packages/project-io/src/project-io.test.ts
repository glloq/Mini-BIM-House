import { describe, expect, it } from 'vitest';
import { ENTITY_FAMILIES } from '@house-technical-designer/core-domain';
import {
  DEFAULT_PROJECT_IMPORT_LIMITS,
  loadProjectJson,
  serializeProjectFile,
} from './project-io.js';

const fixture = {
  format: 'house-technical-designer-project' as const,
  schemaVersion: '1.3.0',
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

const populatedFixture = {
  ...fixture,
  project: {
    ...fixture.project,
    materialLibrary: {
      materials: [
        {
          id: 'material',
          name: 'Insulation',
          kind: 'GENERIC',
          properties: { lambdaWmK: 0.04 },
        },
      ],
    },
    assemblies: [
      {
        id: 'assembly',
        name: 'Wall assembly',
        category: 'WALL',
        layers: [{ id: 'layer', materialId: 'material', thicknessM: 0.2 }],
      },
    ],
    building: {
      ...fixture.project.building,
      levels: [
        {
          ...fixture.project.building.levels[0]!,
          walls: [
            {
              id: 'wall',
              type: 'WALL',
              levelId: 'ground',
              assemblyId: 'assembly',
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 5000, y: 0 },
                ],
              },
              referenceSide: 'CENTER',
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
          ],
          openings: [
            {
              id: 'window',
              type: 'OPENING',
              openingType: 'WINDOW',
              host: { kind: 'WALL', id: 'wall' },
              offsetAlongHostMm: 1000,
              sillHeightMm: 900,
              widthMm: 1200,
              heightMm: 1000,
            },
          ],
        },
      ],
    },
  },
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
  it('round-trips a populated typed project canonically', () => {
    const serialized = serializeProjectFile(populatedFixture);
    const loaded = loadProjectJson(serialized);
    expect(loaded.status).toBe('OK');
    if (loaded.status === 'OK')
      expect(serializeProjectFile(loaded.file)).toBe(serialized);
  });
  it('rejects broken cross-contract references after schema validation', () => {
    const broken = structuredClone(populatedFixture);
    broken.project.assemblies[0]!.layers[0]!.materialId = 'missing';
    expect(loadProjectJson(JSON.stringify(broken))).toMatchObject({
      status: 'INVALID_PROJECT',
      issues: [
        expect.objectContaining({
          path: '/project/assemblies/0/layers/0/materialId',
        }),
      ],
    });
  });
  it.each([
    [
      'equipment',
      {
        equipment: [
          { id: 'pump', kind: 'PUMP', catalogKind: 'INVALID', properties: {} },
        ],
      },
    ],
    [
      'network',
      {
        systems: [
          {
            id: 'water',
            discipline: 'WATER',
            systemType: 'COLD',
            nodes: [],
            ports: [
              { id: 'port', nodeId: 'missing', role: 'OUT', direction: 'OUT' },
            ],
            edges: [],
          },
        ],
      },
    ],
    [
      'scenario',
      {
        scenarios: [
          {
            id: 'scenario',
            name: 'Option',
            baseProjectRevision: '1',
            overrides: [{ path: '/project', operation: 'INVALID' }],
          },
        ],
      },
    ],
  ] as const)('rejects malformed nested %s contracts', (_name, addition) => {
    const invalid = {
      ...fixture,
      project: { ...fixture.project, ...addition },
    };
    expect(loadProjectJson(JSON.stringify(invalid))).toMatchObject({
      status: 'INVALID_PROJECT',
    });
  });
  it('refuses non-finite values before JSON can coerce them to null', () => {
    expect(() =>
      serializeProjectFile({
        ...fixture,
        project: { ...fixture.project, site: { northAngleDeg: Number.NaN } },
      }),
    ).toThrow('/project/site/northAngleDeg');
  });
  it('rejects malformed nested first-class building elements', () => {
    const level = fixture.project.building.levels[0]!;
    const invalid = {
      ...fixture,
      project: {
        ...fixture.project,
        building: {
          ...fixture.project.building,
          levels: [
            {
              ...level,
              walls: [
                {
                  id: 'wall',
                  type: 'WALL',
                  levelId: 'ground',
                  assemblyId: 'assembly',
                  path: { points: [{ x: 0, y: 0 }] },
                  referenceSide: 'CENTER',
                  baseOffsetMm: 0,
                  heightMode: 'EXPLICIT',
                  heightMm: -1,
                  role: 'EXTERIOR',
                },
              ],
            },
          ],
        },
      },
    };
    expect(loadProjectJson(JSON.stringify(invalid))).toMatchObject({
      status: 'INVALID_PROJECT',
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining('/walls/0/path/points'),
        }),
        expect.objectContaining({
          path: expect.stringContaining('/walls/0/heightMm'),
        }),
      ]),
    });
  });
});

describe('import limits', () => {
  it('accepts a real project well below every bound', () => {
    expect(loadProjectJson(JSON.stringify(fixture)).status).toBe('OK');
  });

  it('refuses a file larger than the character bound before parsing it', () => {
    const result = loadProjectJson(JSON.stringify(fixture), undefined, {
      ...DEFAULT_PROJECT_IMPORT_LIMITS,
      maximumCharacters: 10,
    });
    expect(result).toMatchObject({
      status: 'TOO_LARGE',
      breach: { limit: 'maximumCharacters', maximum: 10 },
    });
  });

  it('names which count is out of bounds', () => {
    const walled = {
      ...fixture,
      project: {
        ...fixture.project,
        materialLibrary: {
          materials: [
            {
              id: 'material',
              name: 'Material',
              kind: 'GENERIC',
              properties: { lambdaWmK: 0.04 },
            },
          ],
        },
        assemblies: [
          {
            id: 'assembly',
            name: 'Wall assembly',
            category: 'WALL',
            layers: [{ id: 'layer', materialId: 'material', thicknessM: 0.2 }],
          },
        ],
        building: {
          ...fixture.project.building,
          levels: [
            {
              ...fixture.project.building.levels[0]!,
              walls: [
                {
                  id: 'wall',
                  type: 'WALL',
                  levelId: 'ground',
                  assemblyId: 'assembly',
                  path: {
                    points: [
                      { x: 0, y: 0 },
                      { x: 5000, y: 0 },
                    ],
                  },
                  referenceSide: 'CENTER',
                  baseOffsetMm: 0,
                  heightMode: 'EXPLICIT',
                  heightMm: 2500,
                  role: 'EXTERIOR',
                },
              ],
            },
          ],
        },
      },
    };
    const result = loadProjectJson(JSON.stringify(walled), undefined, {
      ...DEFAULT_PROJECT_IMPORT_LIMITS,
      maximumByFamily: { WALL: 0 },
    });
    expect(result).toMatchObject({
      status: 'TOO_LARGE',
      breach: { limit: 'WALL', label: 'murs', actual: 1, maximum: 0 },
    });
  });

  it('reports the first bound exceeded, not a generic refusal', () => {
    const result = loadProjectJson(JSON.stringify(fixture), undefined, {
      ...DEFAULT_PROJECT_IMPORT_LIMITS,
      maximumByFamily: { LEVEL: 0, WALL: 0 },
    });
    expect(result).toMatchObject({
      status: 'TOO_LARGE',
      breach: { limit: 'LEVEL' },
    });
  });

  it('bounds every family the model knows, not the seven somebody listed', () => {
    // Components, whole roofs, stairs, structural members, annotations,
    // obstacles, ports, scenarios, saved views and sheets were all unbounded:
    // a file was refused for its walls while a million placed appliances went
    // through.
    for (const family of ENTITY_FAMILIES) {
      if (family === 'PROJECT') continue;
      expect(
        DEFAULT_PROJECT_IMPORT_LIMITS.maximumByFamily[family],
        family,
      ).toBeGreaterThan(0);
    }
  });

  it('refuses a file with more objects than a house has, whatever they are', () => {
    const result = loadProjectJson(JSON.stringify(fixture), undefined, {
      ...DEFAULT_PROJECT_IMPORT_LIMITS,
      maximumByFamily: {},
      maximumEntities: 0,
    });
    expect(result).toMatchObject({
      status: 'TOO_LARGE',
      breach: { limit: 'maximumEntities', label: 'objets' },
    });
  });

  it('refuses a file whose outlines carry more points than anything can draw', () => {
    // A hundred objects each carrying a hundred thousand vertices is a small
    // project by every other count and a file nothing can draw.
    const outlined = {
      ...fixture,
      project: {
        ...fixture.project,
        site: {
          northAngleDeg: 0,
          parcelBoundary: {
            outer: Array.from({ length: 6 }, (_unused, index) => ({
              x: index * 1000,
              y: 0,
            })),
          },
        },
      },
    };
    const result = loadProjectJson(JSON.stringify(outlined), undefined, {
      ...DEFAULT_PROJECT_IMPORT_LIMITS,
      maximumByFamily: {},
      maximumGeometryPoints: 1,
    });
    expect(result).toMatchObject({
      status: 'TOO_LARGE',
      breach: { limit: 'maximumGeometryPoints', label: 'points de géométrie' },
    });
  });
});
