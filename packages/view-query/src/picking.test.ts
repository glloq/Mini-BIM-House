import { describe, expect, it } from 'vitest';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import {
  boundsOfObjects,
  distanceToPrimitive,
  pickPrimitive,
} from './picking.js';

const wall: ScenePrimitive = {
  id: 'wall:w1',
  sourceObjectId: 'w1',
  semanticRole: 'WALL_CUT',
  geometry: {
    kind: 'POLYGON',
    polygon: {
      outer: [
        { x: 0, y: -150 },
        { x: 5000, y: -150 },
        { x: 5000, y: 150 },
        { x: 0, y: 150 },
      ],
    },
  },
  layer: 'architecture.walls',
  zIndex: 20,
  discipline: 'ARCHITECTURE',
};

const label: ScenePrimitive = {
  id: 'space-label:s1',
  sourceObjectId: 's1',
  semanticRole: 'ANNOTATION',
  geometry: { kind: 'TEXT', anchor: { x: 2500, y: 0 }, text: 'Séjour' },
  layer: 'architecture.space-labels',
  zIndex: 60,
  discipline: 'ARCHITECTURE',
};

const pipe: ScenePrimitive = {
  id: 'network-edge:water:p1',
  sourceObjectId: 'p1',
  semanticRole: 'WATER_COLD',
  geometry: {
    kind: 'POLYLINE',
    polyline: {
      points: [
        { x: 0, y: 2000 },
        { x: 5000, y: 2000 },
      ],
      closed: false,
    },
  },
  layer: 'water.pipes',
  zIndex: 40,
  discipline: 'WATER',
};

describe('picking', () => {
  it('picks a polygon the point falls inside', () => {
    expect(pickPrimitive([wall], { x: 2000, y: 0 }, 50)?.objectId).toBe('w1');
    expect(distanceToPrimitive(wall, { x: 2000, y: 0 }, 50)).toBe(0);
  });

  it('picks a polygon edge within the tolerance and misses beyond it', () => {
    expect(pickPrimitive([wall], { x: 2000, y: 180 }, 50)?.objectId).toBe('w1');
    expect(pickPrimitive([wall], { x: 2000, y: 400 }, 50)).toBeUndefined();
  });

  it('picks a polyline within the tolerance', () => {
    expect(pickPrimitive([pipe], { x: 2500, y: 2020 }, 50)?.objectId).toBe(
      'p1',
    );
    expect(pickPrimitive([pipe], { x: 2500, y: 2400 }, 50)).toBeUndefined();
  });

  it('prefers the object drawn on top when several overlap', () => {
    const picked = pickPrimitive([wall, label], { x: 2500, y: 0 }, 60);
    expect(picked?.objectId).toBe('s1');
  });

  it('ignores primitives that belong to no project object', () => {
    const { sourceObjectId: _owned, ...decoration } = wall;
    expect(pickPrimitive([decoration], { x: 2000, y: 0 }, 50)).toBeUndefined();
  });

  it('computes the bounding box of a selection', () => {
    expect(boundsOfObjects([wall, pipe], ['w1'])).toEqual({
      min: { x: 0, y: -150 },
      max: { x: 5000, y: 150 },
    });
    expect(boundsOfObjects([wall], ['missing'])).toBeUndefined();
  });
});
