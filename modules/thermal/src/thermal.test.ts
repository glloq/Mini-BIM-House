import { describe, expect, it } from 'vitest';
import {
  calculateElementTransmission,
  calculateThermalResistance,
  type ThermalMethod,
} from './thermal.js';

const method: ThermalMethod = {
  id: 'test-surface-resistances',
  version: '1.0.0',
  insideSurfaceResistanceM2KW: 0.13,
  outsideSurfaceResistanceM2KW: 0.04,
};
const insulation = [
  {
    layerId: 'insulation',
    materialId: 'wood-fibre',
    thicknessM: 0.2,
    lambdaWmK: 0.04,
  },
] as const;

describe('thermal envelope', () => {
  it('T-001 calculates layer, total resistance, and transmittance', () => {
    const result = calculateThermalResistance(insulation, method);
    expect(result.status).toBe('OK');
    expect(result.layers[0]?.resistanceM2KW).toBeCloseTo(5);
    expect(result.totalResistanceM2KW).toBeCloseTo(5.17);
    expect(result.uValueWm2K).toBeCloseTo(0.1934, 4);
  });

  it('T-002 doubles H with area without changing U', () => {
    const first = calculateElementTransmission('wall', 10, insulation, method);
    const second = calculateElementTransmission('wall', 20, insulation, method);
    expect(second.uValueWm2K).toBe(first.uValueWm2K);
    expect(second.heatTransferCoefficientWK).toBeCloseTo(
      required(first.heatTransferCoefficientWK) * 2,
    );
  });

  it('T-003 keeps the result unknown when conductivity is absent', () => {
    const result = calculateThermalResistance(
      [{ layerId: 'unknown', materialId: 'unknown', thicknessM: 0.2 }],
      method,
    );
    expect(result.status).toBe('PARTIAL');
    expect(result.layers[0]?.resistanceM2KW).toBeUndefined();
    expect(result.totalResistanceM2KW).toBeUndefined();
    expect(result.uValueWm2K).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('THERMAL_MISSING_LAMBDA');
  });

  it('T-004 uses the supplied net area after opening deductions', () => {
    const gross = calculateElementTransmission('wall', 20, insulation, method);
    const net = calculateElementTransmission('wall', 16, insulation, method);
    expect(net.heatTransferCoefficientWK).toBeCloseTo(
      required(gross.heatTransferCoefficientWK) * 0.8,
    );
  });

  it('uses a declared resistance in preference to conductivity', () => {
    const result = calculateThermalResistance(
      [
        {
          layerId: 'product',
          materialId: 'product',
          thicknessM: 0.1,
          lambdaWmK: 0.05,
          declaredResistanceM2KW: 3,
        },
      ],
      method,
    );
    expect(result.layers[0]).toMatchObject({
      resistanceM2KW: 3,
      resistanceSource: 'DECLARED',
    });
  });
});

function required(value: number | undefined): number {
  if (value === undefined) throw new Error('Expected a known thermal value');
  return value;
}
