import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import { assemblyId } from '@house-technical-designer/assemblies';
import { offsetAlongWall, openingAnchor } from './grips.js';
import { gripsFor } from './object-editors.js';

const wall = {
  id: entityId<'Wall'>('wall-north'),
  type: 'WALL' as const,
  levelId: entityId<'Level'>('ground'),
  assemblyId: assemblyId('wall'),
  path: {
    points: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
    ],
  },
  referenceSide: 'CENTER' as const,
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT' as const,
  heightMm: 2500,
  role: 'EXTERIOR' as const,
};

const opening = {
  id: entityId<'Opening'>('window'),
  type: 'OPENING' as const,
  openingType: 'WINDOW' as const,
  hostElementId: wall.id,
  offsetAlongHostMm: 2000,
  sillHeightMm: 900,
  widthMm: 1000,
  heightMm: 1200,
};

const slab = {
  id: entityId<'Slab'>('slab'),
  type: 'SLAB' as const,
  levelId: entityId<'Level'>('ground'),
  assemblyId: assemblyId('floor'),
  polygon: {
    outer: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
    ],
  },
  elevationOffsetMm: 0,
  role: 'FLOOR' as const,
};

const project = {
  id: entityId<'Project'>('project'),
  metadata: {
    name: 'Poignées',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  site: { northAngleDeg: 0 },
  building: {
    levels: [
      {
        id: entityId<'Level'>('ground'),
        name: 'Rez-de-chaussée',
        elevationMm: 0,
        defaultStoreyHeightMm: 2500,
        walls: [wall],
        openings: [opening],
        slabs: [slab],
        roofs: [],
        spaces: [],
        stairs: [],
        annotations: [],
      },
    ],
    zones: [],
  },
} as unknown as Project;

describe('the handles a selection offers', () => {
  it('gives a wall its two ends and a handle to move it whole', () => {
    const grips = gripsFor(project, 'ground', ['wall-north']);
    expect(grips.map(({ kind }) => kind)).toEqual([
      'WALL_POINT',
      'WALL_POINT',
      'WALL_BODY',
    ]);
    expect(grips[1]?.at).toEqual({ x: 6000, y: 0 });
    expect(grips[2]?.at).toEqual({ x: 3000, y: 0 });
  });

  it('puts the handle of an opening at its middle, on its wall', () => {
    const grips = gripsFor(project, 'ground', ['window']);
    expect(grips).toHaveLength(1);
    // Offset 2 000 plus half of a 1 000 wide window.
    expect(grips[0]?.at).toEqual({ x: 2500, y: 0 });
  });

  it('gives a footprint a handle per corner and one per side', () => {
    const grips = gripsFor(project, 'ground', ['slab']);
    expect(grips.filter(({ kind }) => kind === 'POLYGON_VERTEX')).toHaveLength(
      3,
    );
    expect(grips.filter(({ kind }) => kind === 'POLYGON_EDGE')).toHaveLength(3);
  });

  it('offers nothing while several objects are selected', () => {
    expect(gripsFor(project, 'ground', ['wall-north', 'window'])).toEqual([]);
    expect(gripsFor(project, 'ground', [])).toEqual([]);
  });
});

describe('reading a point back onto a wall', () => {
  it('measures how far along the axis it falls', () => {
    expect(offsetAlongWall(wall.path.points, { x: 1500, y: 400 })).toBe(1500);
  });

  it('answers nothing for a wall with no length', () => {
    const degenerate = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(offsetAlongWall(degenerate, { x: 10, y: 0 })).toBeUndefined();
    expect(openingAnchor(degenerate, 0, 800)).toBeUndefined();
  });
});
