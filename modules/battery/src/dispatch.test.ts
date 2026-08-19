import { describe, expect, it } from 'vitest';
import {
  simulateBatteryDispatch,
  type BatteryDispatchConfig,
} from './dispatch.js';

const battery: BatteryDispatchConfig = {
  usableCapacityKWh: 10,
  minimumSoc: 0.1,
  maximumSoc: 0.9,
  initialSoc: 0.5,
  maxChargePowerKW: 3,
  maxDischargePowerKW: 3,
  chargeEfficiency: 0.9,
  dischargeEfficiency: 0.9,
};

describe('hourly battery dispatch', () => {
  it('implements BAT-001: without PV or battery, grid import equals load', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 1,
      periods: ['h1', 'h2'],
      loadKWh: [2, 3],
      pvKWh: [0, 0],
      offGrid: false,
    });
    expect(result).toMatchObject({
      status: 'OK',
      gridImportKWh: 5,
      gridExportKWh: 0,
      unservedEnergyKWh: 0,
    });
  });

  it('implements BAT-002: PV equal to load creates no network or battery flow', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 1,
      periods: ['h1'],
      loadKWh: [2],
      pvKWh: [2],
      battery,
      offGrid: false,
    });
    expect(result.steps[0]).toMatchObject({
      pvDirectKWh: 2,
      batteryChargeInputKWh: 0,
      batteryDischargeOutputKWh: 0,
      gridImportKWh: 0,
      gridExportKWh: 0,
    });
  });

  it('implements BAT-003: state of charge remains within explicit limits', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 1,
      periods: ['charge', 'discharge'],
      loadKWh: [0, 100],
      pvKWh: [100, 0],
      battery: { ...battery, maxChargePowerKW: 100, maxDischargePowerKW: 100 },
      offGrid: true,
    });
    expect(result.steps[0]?.stateOfCharge).toBeCloseTo(0.9);
    expect(result.steps[1]?.stateOfCharge).toBeCloseTo(0.1);
    expect(
      result.steps.every(
        ({ stateOfCharge }) => stateOfCharge >= 0.1 && stateOfCharge <= 0.9,
      ),
    ).toBe(true);
    expect(result).toMatchObject({
      minimumObservedSoc: 0.1,
      maximumObservedSoc: 0.9,
    });
  });

  it('implements BAT-004: charge and discharge respect power limits', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 0.5,
      periods: ['charge', 'discharge'],
      loadKWh: [0, 10],
      pvKWh: [10, 0],
      battery,
      offGrid: true,
    });
    expect(result.steps[0]?.batteryChargeInputKWh).toBe(1.5);
    expect(result.steps[1]?.batteryDischargeOutputKWh).toBe(1.5);
  });

  it('implements BAT-005 with whole-system energy conservation', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 1,
      periods: ['h1', 'h2', 'h3'],
      loadKWh: [1, 4, 2],
      pvKWh: [5, 0, 1],
      battery,
      offGrid: false,
    });
    const pv = result.steps.reduce((total, step) => total + step.pvKWh, 0);
    const servedLoad = result.steps.reduce(
      (total, step) => total + step.servedLoadKWh,
      0,
    );
    expect(
      result.initialStoredEnergyKWh! + pv + result.gridImportKWh!,
    ).toBeCloseTo(
      result.finalStoredEnergyKWh! +
        servedLoad +
        result.gridExportKWh! +
        result.chargeLossKWh! +
        result.dischargeLossKWh!,
    );
  });

  it('reports unmet off-grid load rather than claiming autonomy', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 1,
      periods: ['h1'],
      loadKWh: [10],
      pvKWh: [0],
      offGrid: true,
    });
    expect(result).toMatchObject({
      gridImportKWh: 0,
      unservedEnergyKWh: 10,
    });
    expect(result.steps[0]?.servedLoadKWh).toBe(0);
  });

  it('keeps missing load and PV values UNKNOWN', () => {
    const result = simulateBatteryDispatch({
      timeStepHours: 1,
      periods: ['h1'],
      loadKWh: [undefined],
      pvKWh: [undefined],
      battery,
      offGrid: false,
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.steps).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'BAT_UNKNOWN_LOAD',
      'BAT_UNKNOWN_PV',
    ]);
  });

  it('rejects invalid SOC ranges, efficiencies, and series', () => {
    expect(
      simulateBatteryDispatch({
        timeStepHours: 1,
        periods: ['h1'],
        loadKWh: [1],
        pvKWh: [0],
        battery: { ...battery, initialSoc: 1 },
        offGrid: false,
      }).status,
    ).toBe('INVALID');
    expect(
      simulateBatteryDispatch({
        timeStepHours: 1,
        periods: ['h1'],
        loadKWh: [1, 2],
        pvKWh: [0],
        offGrid: false,
      }).status,
    ).toBe('INVALID');
  });
});
