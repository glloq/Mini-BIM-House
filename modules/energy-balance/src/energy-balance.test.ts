import { describe, expect, it } from 'vitest';
import {
  calculateEnergyBalance,
  calculatePrimaryEnergy,
  type EnergyBalanceInput,
} from './energy-balance.js';

const base: EnergyBalanceInput = {
  scenarioId: 'baseline',
  uses: [
    {
      id: 'heating-result',
      usage: 'HEATING',
      vector: 'ELECTRICITY',
      series: {
        timestepSeconds: 3_600,
        start: '2025-01-01T00:00:00Z',
        unit: 'Wh',
        values: [1_000, 2_000],
      },
    },
    {
      id: 'lighting-result',
      usage: 'LIGHTING',
      vector: 'ELECTRICITY',
      series: {
        timestepSeconds: 3_600,
        start: '2025-01-01T00:00:00Z',
        unit: 'Wh',
        values: [500, 500],
      },
    },
    {
      id: 'gas-dhw-result',
      usage: 'DHW',
      vector: 'GAS',
      series: {
        timestepSeconds: 3_600,
        start: '2025-01-01T00:00:00Z',
        unit: 'Wh',
        values: [2_000, 2_000],
      },
    },
  ],
  pvElectricity: {
    timestepSeconds: 3_600,
    start: '2025-01-01T00:00:00Z',
    unit: 'Wh',
    values: [2_000, 1_000],
  },
  offGrid: false,
};

describe('whole-building energy balance', () => {
  it('implements EN-001: usage sums equal total loads by vector', () => {
    const result = calculateEnergyBalance(base);
    expect(result).toMatchObject({
      status: 'OK',
      totalByUsageWh: {
        HEATING: 3_000,
        LIGHTING: 1_000,
        DHW: 4_000,
      },
      totalByVectorWh: { ELECTRICITY: 4_000, GAS: 4_000 },
      totalElectricLoadWh: 4_000,
      peakElectricPowerW: 2_500,
    });
  });

  it('implements EN-002 by rejecting misaligned time series', () => {
    const result = calculateEnergyBalance({
      ...base,
      pvElectricity: {
        ...base.pvElectricity!,
        timestepSeconds: 1_800,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ENERGY_MISALIGNED_SERIES' }),
    );
  });

  it('implements EN-003 by rejecting duplicate source result IDs', () => {
    const result = calculateEnergyBalance({
      ...base,
      uses: [...base.uses, { ...base.uses[0]! }],
    });
    expect(result.status).toBe('INVALID');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ENERGY_DUPLICATE_USE' }),
    );
  });

  it('implements EN-004 with PV, battery, grid, and storage conservation', () => {
    const result = calculateEnergyBalance({
      ...base,
      battery: {
        usableCapacityKWh: 5,
        minimumSoc: 0.1,
        maximumSoc: 0.9,
        initialSoc: 0.5,
        maxChargePowerKW: 2,
        maxDischargePowerKW: 2,
        chargeEfficiency: 0.9,
        dischargeEfficiency: 0.9,
      },
    });
    expect(result.status).toBe('OK');
    expect(result.conservationResidualWh).toBeCloseTo(0);
    expect(result.batteryDispatch?.status).toBe('OK');
  });

  it('implements EN-005: external factors do not alter physical energy', () => {
    const balance = calculateEnergyBalance(base);
    const snapshot = structuredClone(balance);
    const first = calculatePrimaryEnergy(balance, 'profile-a', {
      ELECTRICITY: 2,
      GAS: 1,
    });
    const second = calculatePrimaryEnergy(balance, 'profile-b', {
      ELECTRICITY: 3,
      GAS: 1.2,
    });
    expect(first.totalPrimaryEnergyWh).not.toBe(second.totalPrimaryEnergyWh);
    expect(balance).toEqual(snapshot);
    expect(balance.totalByVectorWh).toEqual({
      ELECTRICITY: 4_000,
      GAS: 4_000,
      WOOD: 0,
      DISTRICT_HEAT: 0,
      SOLAR: 0,
      OTHER: 0,
    });
  });

  it('keeps unknown module outputs unknown instead of zero', () => {
    const result = calculateEnergyBalance({
      scenarioId: base.scenarioId,
      uses: [
        {
          ...base.uses[0]!,
          series: { ...base.uses[0]!.series, values: [1_000, undefined] },
        },
      ],
      offGrid: base.offGrid,
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.totalElectricLoadWh).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ENERGY_UNKNOWN_VALUE' }),
    );
  });

  it('reports grid imports and exports without a configured battery', () => {
    const result = calculateEnergyBalance(base);
    expect(result).toMatchObject({
      gridImportWh: 1_500,
      gridExportWh: 500,
      totalPvWh: 3_000,
    });
  });

  it('returns INVALID for an invalid battery instead of throwing', () => {
    const result = calculateEnergyBalance({
      ...base,
      battery: {
        usableCapacityKWh: 5,
        minimumSoc: 0.9,
        maximumSoc: 0.1,
        initialSoc: 0.5,
        maxChargePowerKW: 2,
        maxDischargePowerKW: 2,
        chargeEfficiency: 0.9,
        dischargeEfficiency: 0.9,
      },
    });
    expect(result.status).toBe('INVALID');
    expect(result.diagnostics[0]?.path).toBe('battery');
  });
});
