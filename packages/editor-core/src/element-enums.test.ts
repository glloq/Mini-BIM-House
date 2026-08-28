import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import {
  validateWall,
  validateSlab,
} from '@house-technical-designer/core-domain';
import {
  ProjectCommandDispatcher,
  UpdateDimensionCommand,
  UpdateOpeningCommand,
  UpdateSlabCommand,
  UpdateWallCommand,
} from './index.js';

const wall = {
  id: 'wall',
  type: 'WALL',
  levelId: 'ground',
  path: {
    points: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
    ],
  },
  referenceSide: 'CENTER',
  assemblyId: 'assembly',
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
};

const slab = {
  id: 'slab',
  type: 'SLAB',
  levelId: 'ground',
  polygon: {
    outer: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ],
  },
  assemblyId: 'assembly',
  elevationOffsetMm: 0,
  role: 'FLOOR',
};

function project(): Project {
  return {
    metadata: { name: 'x', createdAt: 'a', updatedAt: 'b' },
    site: { northAngleDeg: 0 },
    assemblies: [
      {
        id: 'assembly',
        name: 'Mur',
        category: 'WALL',
        layers: [{ id: 'layer', materialId: 'material', thicknessM: 0.2 }],
      },
    ],
    building: {
      zones: [],
      levels: [
        {
          id: 'ground',
          name: 'RDC',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [wall],
          slabs: [slab],
          roofs: [],
          openings: [
            {
              id: 'opening',
              type: 'OPENING',
              openingType: 'WINDOW',
              host: { kind: 'WALL', id: 'wall' },
              offsetAlongHostMm: 500,
              sillHeightMm: 900,
              widthMm: 1000,
              heightMm: 1000,
            },
          ],
          stairs: [],
          spaces: [],
          annotations: [
            {
              id: 'dimension',
              kind: 'DIMENSION',
              type: 'ALIGNED',
              first: {
                kind: 'WALL_ENDPOINT',
                wallId: 'wall',
                endpoint: 'START',
              },
              second: {
                kind: 'WALL_ENDPOINT',
                wallId: 'wall',
                endpoint: 'END',
              },
              offsetMm: 500,
            },
          ],
        },
      ],
    },
  } as unknown as Project;
}

/**
 * These values cannot occur if every caller respects the types. They occur
 * anyway when an interface casts a string on its way out, which is exactly how
 * a wall once received a reference side the renderer does not know.
 */
describe('element enums are checked at the command boundary', () => {
  it('refuses a reference side the domain does not define', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    const result = dispatcher.dispatch(
      new UpdateWallCommand('ground', 'wall', {
        referenceSide: 'INTERIOR' as never,
      }),
    );
    expect(result.status).toBe('REJECTED');
    if (result.status === 'REJECTED')
      expect(result.errors[0]).toContain('INTERIOR');
  });

  it('accepts every reference side the domain does define', () => {
    for (const side of ['CENTER', 'LEFT', 'RIGHT'] as const) {
      const dispatcher = new ProjectCommandDispatcher(project());
      expect(
        dispatcher.dispatch(
          new UpdateWallCommand('ground', 'wall', { referenceSide: side }),
        ).status,
      ).toBe('APPLIED');
    }
  });

  it('refuses a wall role, a slab role, an opening type and a cote type it does not define', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new UpdateWallCommand('ground', 'wall', { role: 'BEARING' as never }),
      ).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateSlabCommand('ground', 'slab', { role: 'RAMP' as never }),
      ).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateOpeningCommand('ground', 'opening', {
          openingType: 'HATCH' as never,
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateDimensionCommand('ground', 'dimension', {
          type: 'RADIAL' as never,
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses a swing it could not draw, and one on what does not swing', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    // The fixture's opening is a window, and a window does not swing.
    expect(
      dispatcher.dispatch(
        new UpdateOpeningCommand('ground', 'opening', {
          swing: { hinge: 'START', opensTo: 'RIGHT_OF_HOST' },
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateOpeningCommand('ground', 'opening', {
          openingType: 'DOOR',
          swing: { hinge: 'MIDDLE' as never, opensTo: 'RIGHT_OF_HOST' },
        }),
      ).status,
    ).toBe('REJECTED');
    expect(
      dispatcher.dispatch(
        new UpdateOpeningCommand('ground', 'opening', {
          openingType: 'DOOR',
          swing: {
            hinge: 'END',
            opensTo: 'LEFT_OF_HOST',
            openingAngleDeg: 45,
          },
        }),
      ).status,
    ).toBe('APPLIED');
  });

  it('reports a bad value on a wall or slab that already carries one', () => {
    const assembly = project().assemblies![0]!;
    expect(
      validateWall(
        { ...wall, referenceSide: 'INTERIOR' } as never,
        assembly,
      ).map(({ code }) => code),
    ).toContain('INVALID_REFERENCE_SIDE');
    expect(
      validateWall({ ...wall, role: 'BEARING' } as never, assembly).map(
        ({ code }) => code,
      ),
    ).toContain('INVALID_ROLE');
    expect(
      validateSlab({ ...slab, role: 'RAMP' } as never).join(' '),
    ).toContain('role must be one of');
  });
});
