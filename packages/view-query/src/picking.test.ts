import { describe, expect, it } from 'vitest';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import {
  boundsOfObjects,
  distanceToPrimitive,
  objectsInBox,
  pickCandidates,
  pickPrimitive,
  selectionBoxOf,
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

describe('what a rubber band catches', () => {
  const scene = [wall, label, pipe];

  it('reads the direction of the drag as the question being asked', () => {
    expect(selectionBoxOf({ x: 0, y: 0 }, { x: 100, y: 100 }).mode).toBe(
      'WINDOW',
    );
    expect(selectionBoxOf({ x: 100, y: 0 }, { x: 0, y: 100 }).mode).toBe(
      'CROSSING',
    );
    // Either direction describes the same rectangle.
    expect(selectionBoxOf({ x: 100, y: 100 }, { x: 0, y: 0 }).box).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 100, y: 100 },
    });
  });

  it('takes only what lies entirely inside, dragged rightwards', () => {
    const { box, mode } = selectionBoxOf(
      { x: -500, y: -500 },
      { x: 6000, y: 500 },
    );
    // The wall fits; the pipe at y = 2000 does not, and neither does half of it.
    expect(objectsInBox(scene, box, mode)).toEqual(['w1', 's1']);
  });

  it('takes everything it touches, dragged leftwards', () => {
    const { box, mode } = selectionBoxOf(
      { x: 3000, y: 2500 },
      { x: 2000, y: -500 },
    );
    expect([...objectsInBox(scene, box, mode)].sort()).toEqual([
      'p1',
      's1',
      'w1',
    ]);
  });

  it('refuses an object a window band only half covers', () => {
    const { box, mode } = selectionBoxOf(
      { x: -500, y: -500 },
      { x: 2000, y: 500 },
    );
    expect(objectsInBox(scene, box, mode)).not.toContain('w1');
  });

  it('catches a filled shape a crossing band is drawn inside', () => {
    const { box, mode } = selectionBoxOf(
      { x: 2100, y: 50 },
      { x: 2000, y: -50 },
    );
    expect(objectsInBox(scene, box, mode)).toContain('w1');
  });

  it('ignores decoration that belongs to no object', () => {
    const { sourceObjectId: _owned, ...decoration } = wall;
    const { box, mode } = selectionBoxOf(
      { x: -500, y: -500 },
      { x: 6000, y: 3000 },
    );
    expect(objectsInBox([decoration as ScenePrimitive], box, mode)).toEqual([]);
  });
});

describe('everything under one point', () => {
  it('offers what is under the pointer, topmost first', () => {
    // A label drawn over a wall: picking only the topmost would make the wall
    // unreachable where the two overlap.
    const found = pickCandidates([wall, label], { x: 2500, y: 0 }, 60);
    expect(found.map(({ objectId }) => objectId)).toEqual(['s1', 'w1']);
  });

  it('names each object once, however many primitives draw it', () => {
    const outline: ScenePrimitive = {
      ...wall,
      id: 'wall-outline:w1',
      zIndex: 21,
    };
    expect(
      pickCandidates([wall, outline], { x: 2500, y: 0 }, 60).filter(
        ({ objectId }) => objectId === 'w1',
      ),
    ).toHaveLength(1);
  });

  it('offers nothing where nothing is', () => {
    expect(pickCandidates([wall], { x: 40_000, y: 0 }, 10)).toEqual([]);
  });

  it('agrees with the single pick on what comes first', () => {
    const point = { x: 2500, y: 0 };
    expect(pickCandidates([wall, label], point, 60)[0]?.objectId).toBe(
      pickPrimitive([wall, label], point, 60)?.objectId,
    );
  });
});
