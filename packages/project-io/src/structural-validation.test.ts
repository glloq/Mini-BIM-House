import { describe, expect, it } from 'vitest';
import { loadProjectJson, serializeProjectFile } from './project-io.js';

const level = {
  id: 'ground',
  name: 'Ground',
  elevationMm: 0,
  defaultStoreyHeightMm: 2500,
  walls: [] as unknown[],
  slabs: [] as unknown[],
  roofs: [] as unknown[],
  openings: [] as unknown[],
  stairs: [] as unknown[],
  spaces: [] as unknown[],
  annotations: [] as unknown[],
};

function wall(id: string, levelId: string): Record<string, unknown> {
  return {
    id,
    type: 'WALL',
    levelId,
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
  };
}

function file(levels: readonly unknown[], extra: object = {}) {
  return {
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
      building: { levels, zones: [] },
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
      equipment: [],
      systems: [],
      scenarios: [],
      drawingViews: [],
      calculationSettings: {},
      regulatoryContext: { country: 'FR', enabledRulePacks: [] },
      ...extra,
    },
    references: {},
    extensions: {},
  };
}

function issues(candidate: object): readonly string[] {
  const result = loadProjectJson(JSON.stringify(candidate));
  return result.status === 'INVALID_PROJECT'
    ? result.issues.map(({ path, message }) => `${path} ${message}`)
    : [];
}

describe('structural validation of a project file', () => {
  it('accepts a coherent two-level project', () => {
    const ok = file([
      { ...level, walls: [wall('wall-ground', 'ground')] },
      {
        ...level,
        id: 'first',
        name: 'First',
        elevationMm: 2500,
        walls: [wall('wall-first', 'first')],
      },
    ]);
    expect(issues(ok)).toEqual([]);
    expect(() => serializeProjectFile(ok)).not.toThrow();
  });

  it('refuses an element stored on one level and declaring another', () => {
    // The wall exists and the level exists; what is wrong is where it is kept.
    const misplaced = file([
      { ...level, walls: [wall('wall-ground', 'first')] },
      { ...level, id: 'first', name: 'First', elevationMm: 2500 },
    ]);
    expect(issues(misplaced)).toEqual([
      '/project/building/levels/0/walls/0/levelId is stored on level ground but declares level first',
    ]);
  });

  it('refuses an opening hosted by a wall of another level', () => {
    const crossLevel = file([
      { ...level, walls: [wall('wall-ground', 'ground')] },
      {
        ...level,
        id: 'first',
        name: 'First',
        elevationMm: 2500,
        openings: [
          {
            id: 'window',
            type: 'OPENING',
            openingType: 'WINDOW',
            hostElementId: 'wall-ground',
            offsetAlongHostMm: 1000,
            sillHeightMm: 900,
            widthMm: 1200,
            heightMm: 1000,
          },
        ],
      },
    ]);
    expect(issues(crossLevel)).toEqual([
      '/project/building/levels/1/openings/0/hostElementId is stored on level first but hosted by wall wall-ground of another level',
    ]);
  });

  it('refuses the same identifier declared twice', () => {
    const twice = file([
      { ...level, walls: [wall('wall', 'ground'), wall('wall', 'ground')] },
    ]);
    expect(issues(twice)).toContain(
      '/project/walls declares wall wall more than once',
    );
  });

  it('refuses a network node placed in a space the project does not hold', () => {
    const dangling = file([level], {
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:sink',
              kind: 'FIXTURE',
              position: { x: 0, y: 0, z: 0 },
              spaceId: 'kitchen',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(dangling)).toEqual([
      '/project/systems/0/nodes/0/spaceId references unknown space kitchen',
    ]);
  });

  it('refuses a network node bound to equipment the project does not hold', () => {
    const dangling = file([level], {
      systems: [
        {
          id: 'heating',
          discipline: 'HEATING',
          systemType: 'RADIATOR_LOOP',
          nodes: [
            {
              id: 'heating:boiler',
              kind: 'GENERATOR',
              position: { x: 0, y: 0, z: 0 },
              equipmentId: 'boiler-1',
            },
          ],
          ports: [],
          edges: [],
        },
      ],
    });
    expect(issues(dangling)).toEqual([
      '/project/systems/0/nodes/0/equipmentId references unknown equipment boiler-1',
    ]);
  });
});
