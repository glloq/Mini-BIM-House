import { describe, expect, it } from 'vitest';
import {
  calculateDwh,
  equivalentStorageVolumeL,
  sensibleEnergyKWh,
  type DwhMethod,
} from './domestic-hot-water.js';

const method: DwhMethod = {
  id: 'test-water',
  version: '1.0.0',
  waterDensityKgM3: 1_000,
  waterSpecificHeatJKgK: 4_180,
};
const completeInput = {
  dailyUseVolumeL: 100,
  coldWaterTemperatureC: 10,
  useTemperatureC: 40,
  storageTemperatureC: 60,
  tankVolumeL: 120,
  usefulHeatingPowerW: 2_000,
  annualOperatingDays: 365,
} as const;

describe('domestic hot water', () => {
  it('DHW-001 applies Q = m × cp × delta T', () => {
    expect(sensibleEnergyKWh(100, 30, method)).toBeCloseTo(3.4833333333);
    const result = calculateDwh(completeInput, method);
    expect(result.dailyUsefulEnergyKWh).toBeCloseTo(3.4833333333);
    expect(result.annualUsefulEnergyKWh).toBeCloseTo(3.4833333333 * 365);
  });

  it('DHW-002 halves ideal reheating time when useful power doubles', () => {
    const first = calculateDwh(completeInput, method);
    const second = calculateDwh(
      { ...completeInput, usefulHeatingPowerW: 4_000 },
      method,
    );
    expect(second.reheatingTimeH).toBeCloseTo((first.reheatingTimeH ?? 0) / 2);
  });

  it('DHW-003 conserves energy in the ideal mixing balance', () => {
    expect(equivalentStorageVolumeL(100, 10, 40, 60)).toBe(60);
    expect(calculateDwh(completeInput, method).requiredStorageL).toBe(60);
  });

  it('preserves missing values as unknown with structured diagnostics', () => {
    const result = calculateDwh({}, method);
    expect(result.status).toBe('PARTIAL');
    expect(result.dailyUsefulEnergyKWh).toBeUndefined();
    expect(result.requiredStorageL).toBeUndefined();
    expect(result.reheatingTimeH).toBeUndefined();
    expect(result.diagnostics).toHaveLength(7);
  });

  it('rejects impossible temperatures and non-positive heating power', () => {
    expect(() =>
      calculateDwh({ coldWaterTemperatureC: 20, useTemperatureC: 10 }, method),
    ).toThrow(RangeError);
    expect(() => calculateDwh({ usefulHeatingPowerW: 0 }, method)).toThrow(
      RangeError,
    );
    expect(() => equivalentStorageVolumeL(100, 10, 60, 50)).toThrow(RangeError);
  });
});
