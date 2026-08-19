import { describe, expect, it } from 'vitest';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  createRainwaterTankChartModel,
  solveRainwaterTankCapacities,
} from './tank-solver.js';

const climate: ClimateDataset = {
  id: 'solver-rain',
  location: { latitude: 48, longitude: 2, timezone: 'Europe/Paris' },
  resolution: 'DAILY',
  source: { id: 'test', provider: 'TEST' },
  samples: [
    { timestamp: '2025-01-01', precipitationMm: 20 },
    { timestamp: '2025-01-02', precipitationMm: 0 },
    { timestamp: '2025-01-03', precipitationMm: 0 },
  ],
};

const simulation = {
  climate,
  surfaces: [
    {
      surfaceId: 'roof',
      projectedAreaM2: 10,
      runoffCoefficient: 1,
      preFilterEfficiency: 1,
      enabled: true,
    },
  ],
  demands: [{ useType: 'WC', demandSeriesL: [80, 80, 80] }],
  mainsTopUpSeriesL: [0, 0, 0],
} as const;

describe('rainwater tank capacity solver', () => {
  it('sorts candidates and compares coverage, overflow, and shortage', () => {
    const result = solveRainwaterTankCapacities({
      simulation,
      candidateVolumesL: [200, 50, 100],
      initialFillRatio: 0,
    });
    expect(result.status).toBe('OK');
    expect(
      result.candidates.map(({ nominalVolumeL }) => nominalVolumeL),
    ).toEqual([50, 100, 200]);
    expect(result.candidates.map(({ coverageRatio }) => coverageRatio)).toEqual(
      [130 / 240, 180 / 240, 200 / 240],
    );
    expect(result.candidates[1]).toMatchObject({
      capacityDeltaL: 50,
      overflowL: 20,
      shortageL: 60,
    });
    expect(result.candidates[1]?.marginalCoverageGain).toBeCloseTo(50 / 240);
  });

  it('uses an explicit fill policy and builds a unit-bearing chart model', () => {
    const result = solveRainwaterTankCapacities({
      simulation,
      candidateVolumesL: [50, 100],
      initialFillRatio: 0.5,
    });
    expect(
      result.candidates.map(({ initialVolumeL }) => initialVolumeL),
    ).toEqual([25, 50]);
    expect(createRainwaterTankChartModel(result)).toMatchObject({
      capacityUnit: 'L',
      volumeUnit: 'L',
      ratioUnit: 'RATIO',
      points: [{ nominalVolumeL: 50 }, { nominalVolumeL: 100 }],
    });
  });

  it('rejects duplicate capacities and inconsistent fill ratios', () => {
    const duplicate = solveRainwaterTankCapacities({
      simulation,
      candidateVolumesL: [100, 100],
      initialFillRatio: 0,
    });
    expect(duplicate.status).toBe('INVALID');
    expect(createRainwaterTankChartModel(duplicate)).toBeUndefined();

    expect(
      solveRainwaterTankCapacities({
        simulation,
        candidateVolumesL: [100],
        initialFillRatio: 0.1,
        minimumVolumeRatio: 0.2,
      }).status,
    ).toBe('INVALID');
  });

  it('propagates unknown climate data to every candidate', () => {
    const result = solveRainwaterTankCapacities({
      simulation: {
        ...simulation,
        climate: {
          ...climate,
          samples: [{ timestamp: '2025-01-01' }],
        },
        demands: [{ useType: 'WC', demandSeriesL: [1] }],
        mainsTopUpSeriesL: [0],
      },
      candidateVolumesL: [100],
      initialFillRatio: 0,
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.candidates[0]?.simulation.diagnostics[0]?.code).toBe(
      'RAIN_MISSING_PRECIPITATION',
    );
  });
});
