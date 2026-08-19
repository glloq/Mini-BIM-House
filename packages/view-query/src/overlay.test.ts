import { describe, expect, it } from 'vitest';
import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import { overlayLegend, overlayPrimitives } from './overlay.js';

function wall(id: string): ScenePrimitive {
  return {
    id: `wall:${id}`,
    sourceObjectId: id,
    semanticRole: 'WALL_CUT',
    geometry: {
      kind: 'POLYGON',
      polygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 1000, y: 300 },
          { x: 0, y: 300 },
        ],
      },
    },
    layer: 'architecture.walls',
    zIndex: 20,
    discipline: 'ARCHITECTURE',
  };
}

const overlay: AnalysisOverlay = {
  id: 'thermal-u',
  metric: 'U_VALUE',
  unit: 'W/(m²·K)',
  values: { a: 0.1, b: 0.5, c: 0.9, d: null },
  scale: { kind: 'CONTINUOUS', minimum: 0.1, maximum: 0.9, clamp: true },
};

describe('analysis overlay projection', () => {
  it('bands each object by where its value sits on the scale', () => {
    const primitives = overlayPrimitives(
      [wall('a'), wall('b'), wall('c'), wall('d')],
      overlay,
    );
    expect(primitives.map(({ semanticRole }) => semanticRole)).toEqual([
      'ANALYSIS_LOW',
      'ANALYSIS_MEDIUM',
      'ANALYSIS_HIGH',
      'ANALYSIS_UNKNOWN',
    ]);
    expect(primitives[0]?.metadata).toMatchObject({
      metric: 'U_VALUE',
      unit: 'W/(m²·K)',
      value: 0.1,
    });
  });

  it('never colours an unknown value as if it were a number', () => {
    const [unknown] = overlayPrimitives([wall('d')], overlay);
    expect(unknown?.semanticRole).toBe('ANALYSIS_UNKNOWN');
    expect(unknown?.metadata?.value).toBeNull();
  });

  it('ignores objects the overlay does not cover and non-polygon geometry', () => {
    expect(overlayPrimitives([wall('zzz')], overlay)).toEqual([]);
    const line: ScenePrimitive = {
      ...wall('a'),
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          closed: false,
        },
      },
    };
    expect(overlayPrimitives([line], overlay)).toEqual([]);
  });

  it('draws one overlay shape per object even when several primitives share it', () => {
    const primitives = overlayPrimitives(
      [wall('a'), { ...wall('a'), id: 'wall-layer:a' }],
      overlay,
    );
    expect(primitives).toHaveLength(1);
  });

  it('builds a legend with the range and the count of each band', () => {
    const legend = overlayLegend(overlay);
    expect(legend.metric).toBe('U_VALUE');
    expect(legend.unknownCount).toBe(1);
    expect(legend.entries.map(({ objectCount }) => objectCount)).toEqual([
      1, 1, 1,
    ]);
    expect(legend.entries[0]?.minimum).toBeCloseTo(0.1, 9);
    expect(legend.entries.at(-1)?.maximum).toBeCloseTo(0.9, 9);
  });

  it('reports a uniform metric as a single band rather than three equal ones', () => {
    const legend = overlayLegend({
      id: 'uniform',
      metric: 'U_VALUE',
      unit: 'W/(m²·K)',
      values: { a: 0.2, b: 0.2 },
      scale: { kind: 'CONTINUOUS', minimum: 0.2, maximum: 0.2, clamp: true },
    });
    expect(legend.entries).toHaveLength(1);
    expect(legend.entries[0]).toMatchObject({
      label: 'Valeur uniforme',
      objectCount: 2,
    });
  });
});
