import { assemblyId } from '@house-technical-designer/assemblies';
import { describe, expect, it } from 'vitest';

import { envelopeByRoom } from './room-envelope.js';
import { resolveEnvelope } from './envelope.js';
import {
  createBuilding,
  createProjectMetadata,
  createSite,
} from './factories.js';
import { entityId } from './ids.js';
import type { Level, Project } from './types.js';
import type { Wall } from './wall.js';

const WALL_ASSEMBLY = assemblyId('assembly-wall');

function wall(
  id: string,
  from: readonly [number, number],
  to: readonly [number, number],
  role: Wall['role'] = 'EXTERIOR',
): Wall {
  return {
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: entityId<'Level'>('ground'),
    path: {
      points: [
        { x: from[0], y: from[1] },
        { x: to[0], y: to[1] },
      ],
    },
    referenceSide: 'CENTER',
    assemblyId: WALL_ASSEMBLY,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: 2500,
    role,
  };
}

/**
 * Two rooms side by side, 4 m × 4 m each, in an 8 m × 4 m box.
 *
 * The west room is enclosed by three exterior walls; the east room by three as
 * well, but the partition between them belongs to neither as an envelope
 * element — it separates two heated rooms.
 */
function pair(): Project {
  const walls: Wall[] = [
    wall('south-west', [0, 0], [4000, 0]),
    wall('south-east', [4000, 0], [8000, 0]),
    wall('east', [8000, 0], [8000, 4000]),
    wall('north-east', [8000, 4000], [4000, 4000]),
    wall('north-west', [4000, 4000], [0, 4000]),
    wall('west', [0, 4000], [0, 0]),
    wall('partition', [4000, 0], [4000, 4000], 'INTERIOR'),
  ];
  const level: Level = {
    id: entityId<'Level'>('ground'),
    name: 'Rez-de-chaussée',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls,
    slabs: [],
    roofs: [],
    openings: [],
    stairs: [],
    annotations: [],
    spaces: [
      {
        id: entityId<'Space'>('space-west'),
        type: 'SPACE',
        levelId: entityId<'Level'>('ground'),
        name: 'Ouest',
        category: 'LIVING',
        boundaryMode: 'AUTO',
        anchor: { x: 2000, y: 2000 },
      },
      {
        id: entityId<'Space'>('space-east'),
        type: 'SPACE',
        levelId: entityId<'Level'>('ground'),
        name: 'Est',
        category: 'LIVING',
        boundaryMode: 'AUTO',
        anchor: { x: 6000, y: 2000 },
      },
    ],
  };
  return {
    id: entityId<'Project'>('p'),
    metadata: createProjectMetadata('Deux pièces', '2026-01-01T00:00:00.000Z'),
    site: createSite(),
    building: createBuilding([level]),
  };
}

describe('which parts of the envelope belong to which room', () => {
  it('gives each room the walls that enclose it, and only those', () => {
    const rooms = envelopeByRoom(pair());
    const west = rooms.find(({ spaceId }) => spaceId === 'space-west');
    const east = rooms.find(({ spaceId }) => spaceId === 'space-east');
    expect(west?.unresolved).toBeUndefined();
    expect(east?.unresolved).toBeUndefined();

    // Three exterior walls each; the partition is not an envelope element at
    // all, so neither room is charged for it.
    expect(west?.elementIds).toContain('envelope:wall:south-west');
    expect(west?.elementIds).toContain('envelope:wall:west');
    expect(west?.elementIds).not.toContain('envelope:wall:east');
    expect(east?.elementIds).toContain('envelope:wall:east');
    expect(east?.elementIds).not.toContain('envelope:wall:west');
    for (const room of rooms)
      expect(room.elementIds).not.toContain('envelope:wall:partition');
  });

  it('shares what is above and below by floor area', () => {
    const rooms = envelopeByRoom(pair());
    // Equal rooms, equal shares — and they add up to the whole storey.
    const total = rooms.reduce(
      (sum, { horizontalShare }) => sum + horizontalShare,
      0,
    );
    expect(total).toBeCloseTo(1, 6);
    for (const room of rooms) expect(room.horizontalShare).toBeCloseTo(0.5, 6);
  });

  it('says so rather than guessing when the walls enclose nothing', () => {
    const project = pair();
    const stripped: Project = {
      ...project,
      building: {
        ...project.building,
        levels: project.building.levels.map((level) => ({
          ...level,
          walls: level.walls.slice(0, 2),
        })),
      },
    };
    for (const room of envelopeByRoom(stripped)) {
      expect(room.unresolved).toBeDefined();
      // The horizontal elements are still shared: what is lost is the walls.
      expect(
        room.elementIds.every((id) => !id.startsWith('envelope:wall:')),
      ).toBe(true);
    }
  });

  it('never charges an element to nobody when the rooms are known', () => {
    const project = pair();
    const walls = resolveEnvelope(project).filter(
      ({ kind }) => kind === 'WALL_OPAQUE',
    );
    const charged = new Set(
      envelopeByRoom(project).flatMap(({ elementIds }) => elementIds),
    );
    for (const element of walls) expect(charged.has(element.id)).toBe(true);
  });
});
