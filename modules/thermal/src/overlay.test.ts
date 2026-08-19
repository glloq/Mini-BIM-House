import { describe, expect, it } from 'vitest';
import { createThermalOverlay } from './overlay.js';
import { calculateElementTransmission, type ThermalMethod } from './thermal.js';

const method: ThermalMethod = {
  id: 'test',
  version: '1',
  insideSurfaceResistanceM2KW: 0.13,
  outsideSurfaceResistanceM2KW: 0.04,
};
const known = calculateElementTransmission(
  'known',
  10,
  [
    {
      layerId: 'layer',
      materialId: 'material',
      thicknessM: 0.2,
      lambdaWmK: 0.04,
    },
  ],
  method,
);
const unknown = calculateElementTransmission(
  'unknown',
  10,
  [
    {
      layerId: 'layer',
      materialId: 'material',
      thicknessM: 0.2,
    },
  ],
  method,
);

describe('thermal analysis overlay', () => {
  it('creates a U-value overlay with explicit unknown values and legend unit', () => {
    const overlay = createThermalOverlay([unknown, known], {
      id: 'thermal-u',
      mode: 'U_VALUE',
    });
    expect(overlay.metric).toBe('U_VALUE');
    expect(overlay.unit).toBe('W/(m²·K)');
    expect(Object.keys(overlay.values)).toEqual(['known', 'unknown']);
    expect(overlay.values.unknown).toBeNull();
    expect(overlay.scale?.minimum).toBeCloseTo(required(known.uValueWm2K));
  });

  it('creates a heat-loss overlay in watts from an explicit delta T', () => {
    const overlay = createThermalOverlay([known], {
      id: 'thermal-loss',
      mode: 'HEAT_LOSS',
      temperatureDifferenceK: 20,
    });
    expect(overlay.unit).toBe('W');
    expect(overlay.values.known).toBeCloseTo(
      required(known.heatTransferCoefficientWK) * 20,
    );
  });

  it('rejects a heat-loss overlay without a temperature difference', () => {
    expect(() =>
      createThermalOverlay([known], {
        id: 'invalid',
        mode: 'HEAT_LOSS',
      }),
    ).toThrow(/temperature difference/);
  });
});

function required(value: number | undefined): number {
  if (value === undefined) throw new Error('Expected a known test result');
  return value;
}
