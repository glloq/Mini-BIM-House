import { describe, expect, it } from 'vitest';
import { aggregateThermalEnvelope } from './aggregation.js';
import { calculateElementTransmission, type ThermalMethod } from './thermal.js';

const method: ThermalMethod = {
  id: 'test',
  version: '1',
  insideSurfaceResistanceM2KW: 0.13,
  outsideSurfaceResistanceM2KW: 0.04,
};
const layer = {
  layerId: 'layer',
  materialId: 'material',
  thicknessM: 0.2,
  lambdaWmK: 0.04,
} as const;
const source = {
  property: 'psiWmK',
  sourceType: 'USER',
  reference: 'junction study',
} as const;

describe('thermal envelope aggregation', () => {
  it('T-005 sums elements and thermal bridges at building level', () => {
    const wall = calculateElementTransmission('wall', 10, [layer], method);
    const roof = calculateElementTransmission('roof', 20, [layer], method);
    const result = aggregateThermalEnvelope({
      elements: [
        { result: wall, roomId: 'room-b', zoneId: 'zone', levelId: 'level' },
        { result: roof, roomId: 'room-a', zoneId: 'zone', levelId: 'level' },
      ],
      bridgeMode: 'MANUAL',
      linearBridges: [
        {
          id: 'junction',
          junctionType: 'wall-roof',
          lengthM: 5,
          psiWmK: 0.1,
          source,
        },
      ],
      pointBridges: [{ id: 'anchor', chiWK: 0.2, source }],
      designTemperatureDifferenceK: 20,
    });
    const elementSum = result.elements.reduce(
      (sum, element) => sum + required(element.heatTransferCoefficientWK),
      0,
    );
    const bridgeSum = result.bridges.reduce(
      (sum, bridge) => sum + bridge.heatTransferCoefficientWK,
      0,
    );
    expect(result.status).toBe('OK');
    expect(result.totalHeatTransferCoefficientWK).toBeCloseTo(
      elementSum + bridgeSum,
    );
    expect(result.designTransmissionLossW).toBeCloseTo(
      required(result.totalHeatTransferCoefficientWK) * 20,
    );
    expect(result.rooms.map(({ id }) => id)).toEqual(['room-a', 'room-b']);
    expect(result.zones[0]?.heatTransferCoefficientWK).toBeCloseTo(elementSum);
  });

  it('keeps group and building totals unknown when an element is incomplete', () => {
    const incomplete = calculateElementTransmission(
      'wall',
      10,
      [{ layerId: 'unknown', materialId: 'unknown', thicknessM: 0.2 }],
      method,
    );
    const result = aggregateThermalEnvelope({
      elements: [{ result: incomplete, roomId: 'room', zoneId: 'zone' }],
      bridgeMode: 'MANUAL',
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.totalHeatTransferCoefficientWK).toBeUndefined();
    expect(result.rooms[0]?.heatTransferCoefficientWK).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('THERMAL_MISSING_LAMBDA');
  });

  it('reports bridges that were explicitly not assessed', () => {
    const complete = calculateElementTransmission('wall', 10, [layer], method);
    const result = aggregateThermalEnvelope({
      elements: [{ result: complete }],
      bridgeMode: 'NONE',
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.totalHeatTransferCoefficientWK).toBeDefined();
    expect(result.diagnostics[0]?.code).toBe('THERMAL_BRIDGE_NOT_INCLUDED');
  });
});

function required(value: number | undefined): number {
  if (value === undefined) throw new Error('Expected a known test result');
  return value;
}
