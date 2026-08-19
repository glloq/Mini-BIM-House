import { describe, expect, it } from 'vitest';
import type { ScenePrimitive } from './scene.js';
import { applyAnalysisOverlay } from './analysis.js';

const primitives: readonly ScenePrimitive[] = [
  {
    id: 'edge-graphic',
    sourceObjectId: 'edge',
    semanticRole: 'NETWORK',
    geometry: {
      kind: 'POLYLINE',
      polyline: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        closed: false,
      },
    },
    layer: 'network',
    zIndex: 1,
    discipline: 'WATER',
  },
  {
    id: 'wall-graphic',
    sourceObjectId: 'wall',
    semanticRole: 'WALL_CUT',
    geometry: {
      kind: 'POLYLINE',
      polyline: {
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 100 },
        ],
        closed: false,
      },
    },
    layer: 'architecture',
    zIndex: 0,
    discipline: 'ARCHITECTURE',
  },
];

describe('analysis scene projection', () => {
  it('annotates matching geometry without changing its semantic role', () => {
    const projected = applyAnalysisOverlay(primitives, {
      id: 'velocity',
      metric: 'VELOCITY',
      unit: 'm/s',
      values: { edge: 1.5 },
      states: { edge: 'WARNING' },
    });
    expect(projected[0]).toMatchObject({
      semanticRole: 'NETWORK',
      state: 'WARNING',
      metadata: {
        analysisMetric: 'VELOCITY',
        analysisUnit: 'm/s',
        analysisValue: 1.5,
      },
    });
    expect(projected[1]).toBe(primitives[1]);
  });

  it('renders explicit unknown values as ghosted geometry', () => {
    const projected = applyAnalysisOverlay(primitives, {
      id: 'pressure',
      metric: 'PRESSURE',
      unit: 'Pa',
      values: { edge: null },
    });
    expect(projected[0]?.state).toBe('GHOST');
    expect(projected[0]?.metadata?.analysisValue).toBeNull();
  });
});
