import { describe, expect, it } from 'vitest';
import {
  entityId,
  type Level,
  type Project,
} from '@house-technical-designer/core-domain';
import { assemblyId } from '@house-technical-designer/assemblies';
import {
  DuplicateLevelCommand,
  RemoveLevelCommand,
  UpdateLevelCommand,
} from './building-commands.js';
import { ProjectCommandDispatcher } from './project-commands.js';

function level(
  id: string,
  elevationMm: number,
  extra: Partial<Level> = {},
): Level {
  return {
    id: entityId<'Level'>(id),
    name: id,
    elevationMm,
    defaultStoreyHeightMm: 2500,
    walls: [],
    openings: [],
    slabs: [],
    spaces: [],
    stairs: [],
    annotations: [],
    roofs: [
      {
        id: entityId<'RoofPlane'>(`${id}-roof`),
        type: 'ROOF_PLANE' as const,
        levelId: entityId<'Level'>(id),
        footprint: {
          outer: [
            { x: 0, y: 0 },
            { x: 5000, y: 0 },
            { x: 5000, y: 4000 },
            { x: 0, y: 4000 },
          ],
        },
        assemblyId: assemblyId('roof'),
        slopeDeg: 30,
        azimuthDeg: 180,
        // Absolute in the project: the top of this storey.
        baseElevationMm: elevationMm + 2500,
      },
    ],
    ...extra,
  };
}

function project(extra: Partial<Level> = {}): Project {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Niveaux',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [level('ground', 0, extra)], zones: [] },
    assemblies: [
      { id: assemblyId('roof'), name: 'Toiture', category: 'ROOF', layers: [] },
    ],
  };
}

const roofOf = (source: Project, levelId: string): number | undefined =>
  source.building.levels.find(({ id }) => id === levelId)?.roofs[0]
    ?.baseElevationMm;

describe('heights that are absolute in the project', () => {
  it('raises a duplicated roof to the storey it is copied to', () => {
    const commands = new ProjectCommandDispatcher(project());
    expect(
      commands.dispatch(
        new DuplicateLevelCommand('ground', {
          id: 'first',
          name: 'Étage',
          elevationMm: 2500,
          defaultStoreyHeightMm: 2500,
        }),
      ).status,
    ).toBe('APPLIED');
    expect(roofOf(commands.project, 'ground')).toBe(2500);
    // Copied one storey up, so the roof is one storey higher — not left at the
    // height of the storey it was copied from.
    expect(roofOf(commands.project, 'first')).toBe(5000);
  });

  it('moves the roofs of a level when the level itself moves', () => {
    const commands = new ProjectCommandDispatcher(project());
    commands.dispatch(new UpdateLevelCommand('ground', { elevationMm: 400 }));
    expect(roofOf(commands.project, 'ground')).toBe(2900);
  });

  it('leaves them alone when only the name changes', () => {
    const commands = new ProjectCommandDispatcher(project());
    commands.dispatch(new UpdateLevelCommand('ground', { name: 'Rez' }));
    expect(roofOf(commands.project, 'ground')).toBe(2500);
  });
});

describe('objects this version cannot edit', () => {
  const withStair = { stairs: [{ id: 'stair-1', kind: 'STRAIGHT' }] };

  it('refuses to duplicate a level carrying a stair rather than dropping it', () => {
    const commands = new ProjectCommandDispatcher(project(withStair));
    const result = commands.dispatch(
      new DuplicateLevelCommand('ground', {
        id: 'first',
        name: 'Étage',
        elevationMm: 2500,
        defaultStoreyHeightMm: 2500,
      }),
    );
    expect(result.status).toBe('REJECTED');
    if (result.status !== 'REJECTED') return;
    expect(result.errors[0]).toContain('escalier');
    expect(commands.project.building.levels).toHaveLength(1);
  });

  it('counts a stair as content when a level is deleted', () => {
    const source = project(withStair);
    const commands = new ProjectCommandDispatcher({
      ...source,
      building: {
        ...source.building,
        levels: [
          ...source.building.levels,
          {
            ...level('first', 2500),
            roofs: [],
          },
        ],
      },
    });
    const result = commands.dispatch(new RemoveLevelCommand('ground'));
    expect(result.status).toBe('REJECTED');
    if (result.status !== 'REJECTED') return;
    expect(result.errors[0]).toContain('objet(s)');
  });
});

describe('what sits on a level when the level moves', () => {
  function withNetwork(): Project {
    const source = project();
    return {
      ...source,
      systems: [
        {
          id: 'water',
          discipline: 'WATER',
          systemType: 'POTABLE_COLD',
          nodes: [
            {
              id: 'water:source',
              kind: 'SOURCE',
              levelId: 'ground',
              position: { x: 0, y: 0, z: 0 },
            },
            {
              id: 'water:legacy',
              kind: 'FIXTURE',
              spaceId: 'kitchen',
              position: { x: 1000, y: 0, z: 400 },
            },
            {
              id: 'water:elsewhere',
              kind: 'FIXTURE',
              levelId: 'first',
              position: { x: 2000, y: 0, z: 3000 },
            },
          ],
          ports: [],
          edges: [],
        },
      ],
      building: {
        ...source.building,
        levels: source.building.levels.map((entry) => ({
          ...entry,
          spaces: [
            {
              id: entityId<'Space'>('kitchen'),
              type: 'SPACE' as const,
              levelId: entry.id,
              name: 'Cuisine',
              category: 'KITCHEN',
              boundaryMode: 'AUTOMATIC' as const,
            },
          ],
        })),
      },
    } as unknown as Project;
  }

  const nodeZ = (source: Project, id: string): number | undefined =>
    source.systems?.[0]?.nodes.find((node) => node.id === id)?.position.z;

  it('raises the nodes that belong to it', () => {
    const commands = new ProjectCommandDispatcher(withNetwork());
    commands.dispatch(new UpdateLevelCommand('ground', { elevationMm: 500 }));
    expect(nodeZ(commands.project, 'water:source')).toBe(500);
  });

  it('places a node written before levels were named by the space it serves', () => {
    const commands = new ProjectCommandDispatcher(withNetwork());
    commands.dispatch(new UpdateLevelCommand('ground', { elevationMm: 500 }));
    expect(nodeZ(commands.project, 'water:legacy')).toBe(900);
  });

  it('leaves the nodes of another storey where they are', () => {
    const commands = new ProjectCommandDispatcher(withNetwork());
    commands.dispatch(new UpdateLevelCommand('ground', { elevationMm: 500 }));
    expect(nodeZ(commands.project, 'water:elsewhere')).toBe(3000);
  });
});
