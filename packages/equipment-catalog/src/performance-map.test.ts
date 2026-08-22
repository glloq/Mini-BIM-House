import { describe, expect, it } from 'vitest';
import {
  MAXIMUM_PERFORMANCE_AXES,
  lookupPerformance,
  validatePerformanceMap,
} from './performance-map.js';
import type { PerformanceCurve } from './types.js';

const oneAxis = (patch: Partial<PerformanceCurve> = {}): PerformanceCurve => ({
  id: 'cop-vs-outdoor-temperature',
  inputAxes: [{ id: 'outdoorTemperatureC', unit: '°C' }],
  output: 'cop',
  outputUnit: '-',
  interpolation: 'LINEAR',
  points: [
    { inputs: [-15], output: 2 },
    { inputs: [7], output: 4.2 },
    { inputs: [15], output: 5 },
  ],
  ...patch,
});

/** A compressor map: what it delivers at each outdoor and flow temperature. */
const grid = (patch: Partial<PerformanceCurve> = {}): PerformanceCurve => ({
  id: 'capacity-vs-outdoor-and-flow',
  inputAxes: [
    { id: 'outdoorTemperatureC', unit: '°C' },
    { id: 'supplyTemperatureC', unit: '°C' },
  ],
  output: 'nominalHeatingCapacityW',
  outputUnit: 'W',
  interpolation: 'BILINEAR',
  points: [
    { inputs: [-7, 35], output: 6000 },
    { inputs: [-7, 55], output: 5000 },
    { inputs: [7, 35], output: 9000 },
    { inputs: [7, 55], output: 8000 },
  ],
  ...patch,
});

describe('reading a performance map', () => {
  it('interpolates between two tabulated points on one axis', () => {
    const found = lookupPerformance(oneAxis(), [11]);
    expect(found.status).toBe('OK');
    expect(found.status === 'OK' && found.value).toBeCloseTo(4.6, 10);
  });

  it('answers a tabulated point with the point itself', () => {
    const found = lookupPerformance(oneAxis(), [7]);
    expect(found).toEqual({ status: 'OK', value: 4.2 });
  });

  it('extrapolates nothing, on either side', () => {
    // A compressor asked for its output below the manufacturer's last measured
    // point has not got a straight line down there: it has a cut-out.
    for (const outside of [-30, 40]) {
      const found = lookupPerformance(oneAxis(), [outside]);
      expect(found.status).toBe('OUT_OF_RANGE');
      expect(found.status === 'OUT_OF_RANGE' && found.issue.message).toContain(
        '-15-15',
      );
    }
  });

  it('walks the rectangle of a two-axis grid', () => {
    // Halfway along both axes: the average of the four corners.
    const middle = lookupPerformance(grid(), [0, 45]);
    expect(middle.status).toBe('OK');
    expect(middle.status === 'OK' && middle.value).toBeCloseTo(7000, 6);
    // On one edge, the grid reduces to a single interpolation.
    const edge = lookupPerformance(grid(), [-7, 45]);
    expect(edge.status === 'OK' && edge.value).toBeCloseTo(5500, 6);
  });

  it('refuses to leave the grid on either axis', () => {
    expect(lookupPerformance(grid(), [12, 45]).status).toBe('OUT_OF_RANGE');
    expect(lookupPerformance(grid(), [0, 60]).status).toBe('OUT_OF_RANGE');
  });

  it('says nothing between the points of a table that is only a table', () => {
    const stepped = oneAxis({ interpolation: 'TABLE' });
    expect(lookupPerformance(stepped, [7])).toEqual({
      status: 'OK',
      value: 4.2,
    });
    expect(lookupPerformance(stepped, [11]).status).toBe('OUT_OF_RANGE');
  });

  it('says so when it is asked with the wrong number of inputs', () => {
    expect(lookupPerformance(oneAxis(), [7, 35]).status).toBe('UNREADABLE');
    expect(lookupPerformance(grid(), [7]).status).toBe('UNREADABLE');
  });
});

describe('what a performance map has to be before anything reads it', () => {
  const messages = (curve: PerformanceCurve) =>
    validatePerformanceMap(curve, '/curve').map(({ message }) => message);

  it('accepts the two shapes this version reads', () => {
    expect(messages(oneAxis())).toEqual([]);
    expect(messages(grid())).toEqual([]);
  });

  it('refuses more axes than anything can read', () => {
    const three = grid({
      inputAxes: [
        { id: 'outdoorTemperatureC', unit: '°C' },
        { id: 'supplyTemperatureC', unit: '°C' },
        { id: 'flowM3h', unit: 'm³/h' },
      ],
    });
    expect(messages(three)).toEqual([
      `Curve capacity-vs-outdoor-and-flow declares 3 axes; nothing reads more than ${MAXIMUM_PERFORMANCE_AXES}.`,
    ]);
  });

  it('refuses an interpolation the axes do not support', () => {
    expect(messages(oneAxis({ interpolation: 'BILINEAR' }))).toEqual([
      'Curve cop-vs-outdoor-temperature interpolates by BILINEAR over 1 axis or axes.',
    ]);
  });

  it('refuses a grid with a hole in it', () => {
    // It reads as a rectangle right up to the hole, and then answers with a
    // corner that is not there.
    const holed = grid({ points: grid().points.slice(0, 3) });
    expect(messages(holed)).toEqual([
      'Curve capacity-vs-outdoor-and-flow tabulates 3 of the 4 points its 2 by 2 grid needs.',
    ]);
  });

  it('refuses two answers at the same place', () => {
    const twice = oneAxis({
      points: [...oneAxis().points, { inputs: [7], output: 3 }],
    });
    expect(messages(twice)).toEqual([
      'Point 3 of curve cop-vs-outdoor-temperature repeats a point already tabulated.',
    ]);
  });

  it('refuses a single point to interpolate between', () => {
    expect(
      messages(oneAxis({ points: [{ inputs: [7], output: 4.2 }] })),
    ).toEqual([
      'Curve cop-vs-outdoor-temperature interpolates between fewer than two points.',
    ]);
  });

  it('refuses the same axis named twice', () => {
    expect(
      messages(
        grid({
          inputAxes: [
            { id: 'outdoorTemperatureC', unit: '°C' },
            { id: 'outdoorTemperatureC', unit: '°C' },
          ],
        }),
      ),
    ).toEqual([
      'Curve capacity-vs-outdoor-and-flow names the same axis twice.',
    ]);
  });
});
