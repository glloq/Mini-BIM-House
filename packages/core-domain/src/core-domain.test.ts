import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createBuilding,
  createEntityId,
  createLevel,
  createProjectMetadata,
  createSite,
  entityId,
  type LevelId,
  type ProjectFile,
  type ProjectId,
} from './index';

describe('branded entity IDs', () => {
  it('round-trips as a JSON string', () => {
    const id: ProjectId = entityId<'Project'>('project-1');
    expect(JSON.parse(JSON.stringify({ id }))).toEqual({ id: 'project-1' });
  });

  it('rejects empty identities', () => {
    expect(() => entityId('   ')).toThrow(TypeError);
  });

  it('uses an identity factory rather than an index', () => {
    expect(createEntityId<'Level'>(() => 'stable-generated-id')).toBe(
      'stable-generated-id',
    );
  });

  it('keeps domain identity types distinct', () => {
    expectTypeOf<ProjectId>().not.toEqualTypeOf<LevelId>();
  });
});

describe('core project entities', () => {
  it('creates a schema-compatible empty level and validates height', () => {
    const level = createLevel(entityId<'Level'>('ground'), 'Ground', 0, 2500);
    expect(level).toMatchObject({ elevationMm: 0, walls: [], spaces: [] });
    expect(() => createLevel(entityId<'Level'>('bad'), 'Bad', 0, 0)).toThrow(
      RangeError,
    );
  });

  it('does not invent timestamps', () => {
    const timestamp = '2026-08-18T20:00:00Z';
    expect(createProjectMetadata('House', timestamp)).toEqual({
      name: 'House',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it('serializes the project file contract without derived data', () => {
    const timestamp = '2026-08-18T20:00:00Z';
    const file: ProjectFile = {
      format: 'house-technical-designer-project',
      schemaVersion: '1.1.0',
      project: {
        id: entityId<'Project'>('project-1'),
        metadata: createProjectMetadata('House', timestamp),
        site: createSite(),
        building: createBuilding([
          createLevel(entityId<'Level'>('ground'), 'Ground', 0, 2500),
        ]),
        materialLibrary: { materials: [] },
        assemblies: [],
        equipment: [],
        systems: [],
        scenarios: [],
        drawingViews: [],
        calculationSettings: {},
        regulatoryContext: { country: 'FR', enabledRulePacks: [] },
      },
      extensions: { 'htd.example': { enabled: true } },
    };

    const serialized = JSON.parse(JSON.stringify(file)) as {
      project: { site: { northAngleDeg: number } };
    };
    expect(serialized.project.site.northAngleDeg).toBe(0);
    expect(serialized).not.toHaveProperty('project.building.levels.0.area');
  });
});
