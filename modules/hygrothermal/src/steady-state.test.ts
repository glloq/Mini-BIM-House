import { describe, expect, it } from 'vitest';

import {
  assessInteriorSurfaceRisk,
  assessSteadyStateHygrothermal,
  equivalentAirLayerThicknessM,
  saturationVaporPressurePa,
  vaporPressurePa,
  type SteadyStateHygrothermalInput,
} from './steady-state.js';

const input: SteadyStateHygrothermalInput = {
  assemblyId: 'wall-1',
  period: 'January',
  indoorTemperatureC: 20,
  indoorRelativeHumidity: 0.5,
  outdoorTemperatureC: 0,
  outdoorRelativeHumidity: 0.8,
  interiorSurfaceResistanceM2KW: 0.13,
  exteriorSurfaceResistanceM2KW: 0.04,
  layers: [
    { id: 'insulation', thicknessM: 0.1, thermalResistanceM2KW: 2.5, mu: 2 },
    { id: 'board', thicknessM: 0.0125, thermalResistanceM2KW: 0.05, sdM: 1.25 },
  ],
};

describe('steady-state hygrothermal assessment', () => {
  it('HYG-001 calculates Sd from mu and thickness', () => {
    expect(equivalentAirLayerThicknessM(10, 0.2)).toBeCloseTo(2);
  });

  it('HYG-002 and HYG-003 preserve RH boundaries and pressure anchors', () => {
    expect(vaporPressurePa(20, 0)).toBe(0);
    expect(vaporPressurePa(20, 1)).toBeCloseTo(saturationVaporPressurePa(20));
    expect(saturationVaporPressurePa(0)).toBeCloseTo(610.5, 1);
    expect(saturationVaporPressurePa(20)).toBeCloseTo(2337, 0);
  });

  it('HYG-004 layer order changes profiles but not totals', () => {
    const first = assessSteadyStateHygrothermal(input);
    const reversed = assessSteadyStateHygrothermal({
      ...input,
      layers: [...input.layers].reverse(),
    });
    expect(first.totalSdM).toBeCloseTo(reversed.totalSdM!);
    expect(first.totalThermalResistanceM2KW).toBeCloseTo(
      reversed.totalThermalResistanceM2KW!,
    );
    expect(first.interfaces[1]!.temperatureC).not.toBeCloseTo(
      reversed.interfaces[1]!.temperatureC,
    );
    expect(first.interfaces[1]!.vaporPressurePa).not.toBeCloseTo(
      reversed.interfaces[1]!.vaporPressurePa,
    );
  });

  it('HYG-005 keeps a missing vapor property unknown', () => {
    const { mu: _mu, ...layerWithoutVaporProperty } = input.layers[0]!;
    const result = assessSteadyStateHygrothermal({
      ...input,
      layers: [layerWithoutVaporProperty],
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.applicability).toBe('NOT_APPLICABLE');
    expect(result.interfaces).toEqual([]);
  });

  it('HYG-006 matches an independent two-layer calculation', () => {
    const result = assessSteadyStateHygrothermal(input);
    const expectedT = 20 - 20 * (2.63 / 2.72);
    const indoorPv = 0.5 * 610.5 * Math.exp((17.2694 * 20) / 257.29);
    const expectedPv = indoorPv + (0.8 * 610.5 - indoorPv) * (0.2 / 1.45);
    expect(result.interfaces[1]!.temperatureC).toBeCloseTo(expectedT);
    expect(result.interfaces[1]!.vaporPressurePa).toBeCloseTo(expectedPv);
  });

  it('exposes limitations and surface condensation without assumed defaults', () => {
    const limited = assessSteadyStateHygrothermal({
      ...input,
      layers: [{ ...input.layers[0]!, limitations: ['HYGROSCOPIC_MATERIAL'] }],
    });
    expect(limited.applicability).toBe('LIMITED');
    expect(limited.diagnostics[0]?.code).toBe('HYG_METHOD_LIMITATION');
    expect(assessInteriorSurfaceRisk(undefined, 20, 0.5).status).toBe(
      'UNKNOWN',
    );
    expect(assessInteriorSurfaceRisk(5, 20, 0.8).status).toBe('HIGH_RISK');
  });

  it('rejects invalid humidity and duplicate layer identifiers', () => {
    expect(() => vaporPressurePa(20, 1.1)).toThrow(RangeError);
    const result = assessSteadyStateHygrothermal({
      ...input,
      layers: [input.layers[0]!, input.layers[0]!],
    });
    expect(result.status).toBe('INVALID');
  });

  it('reports conflicting documented Sd and derived mu values', () => {
    const result = assessSteadyStateHygrothermal({
      ...input,
      layers: [{ ...input.layers[0]!, sdM: 4 }],
    });
    expect(result.applicability).toBe('LIMITED');
    expect(result.totalSdM).toBe(4);
    expect(result.diagnostics[0]?.code).toBe('HYG_VAPOR_PROPERTY_MISMATCH');
  });
});
