import { describe, expect, it } from 'vitest';
import {
  continuousScale,
  createNetworkAnalysisOverlay,
} from './analysis-overlay.js';

describe('analysis overlays', () => {
  it('builds a deterministic continuous legend scale', () => {
    expect(continuousScale([2, 0.5, 1])).toEqual({
      kind: 'CONTINUOUS',
      minimum: 0.5,
      maximum: 2,
      clamp: true,
    });
  });

  it('leaves a scale unknown when no numeric value exists', () => {
    expect(continuousScale([])).toBeUndefined();
  });

  it('supports large overlays without spreading values onto the call stack', () => {
    const values = Array.from({ length: 200_000 }, (_, index) => index);
    expect(continuousScale(values)).toMatchObject({
      minimum: 0,
      maximum: 199_999,
    });
  });

  it('creates deterministic network values, states, units, and scale', () => {
    const overlay = createNetworkAnalysisOverlay('flow', 'FLOW', 'm³/s', [
      { objectId: 'edge-b', value: 0.002, state: 'WARNING' },
      { objectId: 'edge-a', value: 0.001, state: 'NORMAL' },
      { objectId: 'edge-c', state: 'UNKNOWN' },
    ]);
    expect(Object.keys(overlay.values)).toEqual(['edge-a', 'edge-b', 'edge-c']);
    expect(overlay.values['edge-c']).toBeNull();
    expect(overlay.states?.['edge-b']).toBe('WARNING');
    expect(overlay.scale).toMatchObject({ minimum: 0.001, maximum: 0.002 });
  });

  it('rejects duplicate object results', () => {
    expect(() =>
      createNetworkAnalysisOverlay('velocity', 'VELOCITY', 'm/s', [
        { objectId: 'edge', value: 1, state: 'NORMAL' },
        { objectId: 'edge', value: 2, state: 'ERROR' },
      ]),
    ).toThrow(/Duplicate/);
  });
});
