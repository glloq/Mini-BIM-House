import { describe, expect, it } from 'vitest';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { collectedVolumeL, simulateRainwater } from './simulation.js';

const climate: ClimateDataset = {
  id: 'rain-daily',
  location: { latitude: 48, longitude: 2, timezone: 'Europe/Paris' },
  resolution: 'DAILY',
  source: { id: 'station', provider: 'TEST' },
  samples: [
    { timestamp: '2025-01-01', precipitationMm: 1 },
    { timestamp: '2025-01-02', precipitationMm: 0 },
    { timestamp: '2025-01-03', precipitationMm: 20 },
  ],
};

const base = {
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
  demands: [{ useType: 'WC', demandSeriesL: [5, 5, 5] }],
  mainsTopUpSeriesL: [0, 0, 0],
  tank: { nominalVolumeL: 100, initialVolumeL: 0 },
} as const;

describe('rainwater time-step simulation', () => {
  it('implements RAIN-001: 1 mm × 1 m² = 1 L', () => {
    expect(
      collectedVolumeL(1, [{ ...base.surfaces[0], projectedAreaM2: 1 }]),
    ).toBe(1);
  });

  it('implements RAIN-002/003 and never creates served water', () => {
    const result = simulateRainwater({
      ...base,
      climate: { ...climate, samples: climate.samples.slice(1, 2) },
      demands: [{ useType: 'garden', demandSeriesL: [0] }],
      mainsTopUpSeriesL: [0],
      tank: { nominalVolumeL: 100, initialVolumeL: 12 },
    });
    expect(result.steps[0]).toMatchObject({ servedL: 0, storageL: 12 });
  });

  it('implements RAIN-004 and records overflow at tank capacity', () => {
    const result = simulateRainwater(base);
    expect(result.steps.map(({ storageL }) => storageL)).toEqual([5, 0, 100]);
    expect(result.steps[2]?.overflowL).toBe(95);
  });

  it('implements RAIN-005 mass conservation including explicit top-up', () => {
    const result = simulateRainwater({ ...base, mainsTopUpSeriesL: [2, 3, 4] });
    const initial = base.tank.initialVolumeL;
    const indicators = result.indicators!;
    const final = result.steps.at(-1)!.storageL;
    expect(initial + indicators.collectedL + indicators.mainsTopUpL).toBe(
      final + indicators.servedL + indicators.overflowL,
    );
  });

  it('preserves the configured minimum tank volume', () => {
    const result = simulateRainwater({
      ...base,
      climate: { ...climate, samples: climate.samples.slice(1, 2) },
      demands: [{ useType: 'WC', demandSeriesL: [20] }],
      mainsTopUpSeriesL: [0],
      tank: { nominalVolumeL: 100, initialVolumeL: 25, minimumVolumeL: 10 },
    });
    expect(result.steps[0]).toMatchObject({
      servedL: 15,
      shortageL: 5,
      storageL: 10,
    });
    expect(result.indicators?.utilizationRatio).toBeUndefined();
  });

  it('propagates missing precipitation and initial storage as UNKNOWN', () => {
    const result = simulateRainwater({
      ...base,
      climate: { ...climate, samples: [{ timestamp: '2025-01-01' }] },
      demands: [{ useType: 'WC', demandSeriesL: [5] }],
      mainsTopUpSeriesL: [0],
      tank: { nominalVolumeL: 100 },
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.steps).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'RAIN_MISSING_INITIAL_VOLUME',
      'RAIN_MISSING_PRECIPITATION',
    ]);
  });

  it('rejects invalid coefficients and mismatched series', () => {
    expect(
      simulateRainwater({
        ...base,
        surfaces: [{ ...base.surfaces[0], runoffCoefficient: 1.1 }],
        mainsTopUpSeriesL: [0],
      }).status,
    ).toBe('INVALID');
  });
});
