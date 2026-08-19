import { describe, expect, it } from 'vitest';
import {
  createSemanticScene,
  drawingViewId,
  graphicProfileId,
  type DrawingView,
  type ScenePrimitive,
} from './scene.js';

const view: DrawingView = {
  id: drawingViewId('ground-plan'),
  type: 'PLAN',
  levelId: 'ground',
  scale: 50,
  viewport: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
  visibleDisciplines: ['ARCHITECTURE'],
  graphicProfileId: graphicProfileId('technical'),
};
const primitive = (
  id: string,
  zIndex: number,
  x: number,
  discipline: ScenePrimitive['discipline'] = 'ARCHITECTURE',
): ScenePrimitive => ({
  id,
  semanticRole: 'WALL_CUT',
  geometry: { kind: 'POINT', point: { x, y: 0 } },
  layer: 'walls',
  zIndex,
  discipline,
});

describe('semantic scene', () => {
  it('filters by discipline and viewport then sorts deterministically', () => {
    expect(
      createSemanticScene(view, [
        primitive('top', 2, 2),
        primitive('hidden', 0, 2, 'WATER'),
        primitive('outside', 0, 2000),
        primitive('bottom', 1, 1),
      ]).primitives.map(({ id }) => id),
    ).toEqual(['bottom', 'top']);
  });
  it('rejects invalid drawing scales', () => {
    expect(() => createSemanticScene({ ...view, scale: 0 }, [])).toThrow(
      RangeError,
    );
  });
  it('rejects an inverted viewport', () => {
    expect(() =>
      createSemanticScene(
        {
          ...view,
          viewport: { min: { x: 2, y: 0 }, max: { x: 1, y: 1 } },
        },
        [],
      ),
    ).toThrow(RangeError);
  });
  it('keeps semantic roles free of SVG style declarations', () => {
    const scene = createSemanticScene(view, [primitive('wall', 1, 1)]);
    expect(scene.primitives[0]).not.toHaveProperty('stroke');
  });
});
