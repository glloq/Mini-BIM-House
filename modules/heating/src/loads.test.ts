import { describe, expect, it } from 'vitest';
import { calculateHeatingLoads, type HeatingLoadMethod } from './loads.js';

const method: HeatingLoadMethod = {
  id: 'explicit-air-properties',
  version: '1.0.0',
  airDensityKgM3: 1.2,
  airSpecificHeatJKgK: 1_000,
};

describe('heating design loads', () => {
  it('HEAT-001 calculates transmission from H and design delta T', () => {
    const result = calculateHeatingLoads(
      [
        {
          roomId: 'room',
          transmissionHeatTransferCoefficientWK: 100,
          designTemperatureDifferenceK: 20,
          ventilationFlowM3s: 0,
          otherW: 0,
        },
      ],
      method,
    );
    expect(result.roomLoads[0]?.transmissionW).toBe(2_000);
    expect(result.designLoadW).toBe(2_000);
  });

  it('HEAT-002 building load equals the sum of complete room loads', () => {
    const result = calculateHeatingLoads(
      [
        {
          roomId: 'b',
          floorAreaM2: 20,
          transmissionHeatTransferCoefficientWK: 50,
          designTemperatureDifferenceK: 20,
          ventilationFlowM3s: 0.01,
          otherW: 100,
        },
        {
          roomId: 'a',
          transmissionHeatTransferCoefficientWK: 25,
          designTemperatureDifferenceK: 20,
          ventilationFlowM3s: 0,
          otherW: 0,
        },
      ],
      method,
    );
    expect(result.roomLoads.map(({ roomId }) => roomId)).toEqual(['a', 'b']);
    expect(result.designLoadW).toBeCloseTo(
      result.roomLoads.reduce((sum, room) => sum + (room.totalW ?? 0), 0),
    );
    expect(result.roomLoads[1]?.wattsPerM2).toBeCloseTo(67);
  });

  it('HEAT-003 applies heat recovery only to the ventilation term', () => {
    const base = {
      roomId: 'room',
      transmissionHeatTransferCoefficientWK: 100,
      designTemperatureDifferenceK: 20,
      ventilationFlowM3s: 0.1,
      otherW: 50,
    } as const;
    const without = calculateHeatingLoads([base], method).roomLoads[0];
    const withRecovery = calculateHeatingLoads(
      [{ ...base, heatRecoveryEfficiency: 0.5 }],
      method,
    ).roomLoads[0];
    expect(withRecovery?.transmissionW).toBe(without?.transmissionW);
    expect(withRecovery?.otherW).toBe(without?.otherW);
    expect(withRecovery?.ventilationW).toBeCloseTo(
      (without?.ventilationW ?? 0) / 2,
    );
  });

  it('keeps omitted values and totals unknown with structured diagnostics', () => {
    const result = calculateHeatingLoads([{ roomId: 'unknown' }], method);
    expect(result.status).toBe('PARTIAL');
    expect(result.designLoadW).toBeUndefined();
    expect(result.roomLoads[0]?.totalW).toBeUndefined();
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'HEATING_MISSING_TRANSMISSION',
      'HEATING_MISSING_TEMPERATURE_DIFFERENCE',
      'HEATING_MISSING_VENTILATION_FLOW',
      'HEATING_MISSING_OTHER_LOAD',
    ]);
  });

  it('keeps ventilation unknown when installed recovery efficiency is unknown', () => {
    const result = calculateHeatingLoads(
      [
        {
          roomId: 'room',
          transmissionHeatTransferCoefficientWK: 100,
          designTemperatureDifferenceK: 20,
          ventilationFlowM3s: 0.1,
          heatRecoveryPresent: true,
          otherW: 0,
        },
      ],
      method,
    );
    expect(result.roomLoads[0]?.ventilationW).toBeUndefined();
    expect(result.roomLoads[0]?.totalW).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe(
      'HEATING_MISSING_HEAT_RECOVERY_EFFICIENCY',
    );
  });

  it('rejects invalid physical values and duplicate room IDs', () => {
    expect(() =>
      calculateHeatingLoads(
        [{ roomId: 'room', heatRecoveryEfficiency: 1.1 }],
        method,
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculateHeatingLoads([{ roomId: 'room' }, { roomId: 'room' }], method),
    ).toThrow(TypeError);
  });
});
