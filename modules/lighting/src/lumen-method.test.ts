import { describe, expect, it } from 'vitest';
import {
  calculateLumenMethod,
  createLuminaireElectricalLoad,
  createRectangularLuminaireGrid,
  proposeLuminaireQuantity,
  type LuminaireDefinition,
} from './lumen-method.js';

const luminaire: LuminaireDefinition = {
  id: 'panel',
  name: 'LED panel',
  luminousFluxLm: 2_000,
  electricalPowerW: 20,
  powerFactor: 0.95,
  source: { sourceType: 'MANUFACTURER', reference: 'datasheet-v1' },
};

function placements(quantity: number) {
  return createRectangularLuminaireGrid({
    roomId: 'room',
    luminaireId: luminaire.id,
    quantity,
    origin: { x: 0, y: 0 },
    widthMm: 4_000,
    depthMm: 5_000,
  });
}

describe('lumen lighting method', () => {
  it('implements LIGHT-001: doubling quantity doubles average lux', () => {
    const one = calculateLumenMethod({
      roomId: 'room',
      roomAreaM2: 20,
      utilizationFactor: 0.6,
      maintenanceFactor: 0.8,
      placements: placements(1),
      luminaires: [luminaire],
    });
    const two = calculateLumenMethod({
      roomId: 'room',
      roomAreaM2: 20,
      utilizationFactor: 0.6,
      maintenanceFactor: 0.8,
      placements: placements(2),
      luminaires: [luminaire],
    });
    expect(two.averageIlluminanceLux).toBe(one.averageIlluminanceLux * 2);
  });

  it('implements LIGHT-002: doubling area halves average lux', () => {
    const result = (area: number) =>
      calculateLumenMethod({
        roomId: 'room',
        roomAreaM2: area,
        utilizationFactor: 0.6,
        maintenanceFactor: 0.8,
        placements: placements(2),
        luminaires: [luminaire],
      });
    expect(result(40).averageIlluminanceLux).toBe(
      result(20).averageIlluminanceLux / 2,
    );
  });

  it('implements LIGHT-003 by rejecting UF and MF outside (0, 1]', () => {
    expect(() =>
      calculateLumenMethod({
        roomId: 'room',
        roomAreaM2: 20,
        utilizationFactor: 0,
        maintenanceFactor: 0.8,
        placements: placements(1),
        luminaires: [luminaire],
      }),
    ).toThrow(/utilization factor/);
    expect(() =>
      proposeLuminaireQuantity(200, 20, luminaire, 0.6, 1.1),
    ).toThrow(/maintenance factor/);
  });

  it('implements LIGHT-004 by summing luminaire electrical powers', () => {
    const result = calculateLumenMethod({
      roomId: 'room',
      roomAreaM2: 20,
      utilizationFactor: 0.6,
      maintenanceFactor: 0.8,
      placements: placements(3),
      luminaires: [luminaire],
    });
    expect(result.installedPowerW).toBe(60);
    expect(result.powerDensityWm2).toBe(3);
  });

  it('proposes the smallest integer quantity reaching an external target', () => {
    const proposal = proposeLuminaireQuantity(200, 20, luminaire, 0.6, 0.8);
    expect(proposal.quantity).toBe(5);
    expect(proposal.achievedAverageIlluminanceLux).toBe(240);
  });

  it('creates deterministic millimetre grid placements', () => {
    const grid = placements(4);
    expect(grid.map(({ position }) => position)).toEqual([
      { x: 1_000, y: 1_250 },
      { x: 3_000, y: 1_250 },
      { x: 1_000, y: 3_750 },
      { x: 3_000, y: 3_750 },
    ]);
  });

  it('adapts each placement into an electrical load without inventing demand', () => {
    const load = createLuminaireElectricalLoad(placements(1)[0]!, luminaire);
    expect(load).toEqual({
      loadId: 'lighting:room:luminaire:1',
      name: 'LED panel',
      activePowerW: 20,
      powerFactor: 0.95,
    });
    expect(load.demandFactor).toBeUndefined();
  });

  it('rejects missing catalog references and cross-room placements', () => {
    expect(() =>
      calculateLumenMethod({
        roomId: 'other-room',
        roomAreaM2: 20,
        utilizationFactor: 0.6,
        maintenanceFactor: 0.8,
        placements: placements(1),
        luminaires: [luminaire],
      }),
    ).toThrow(/another room/);
    expect(() =>
      calculateLumenMethod({
        roomId: 'room',
        roomAreaM2: 20,
        utilizationFactor: 0.6,
        maintenanceFactor: 0.8,
        placements: [{ ...placements(1)[0]!, luminaireId: 'missing' }],
        luminaires: [luminaire],
      }),
    ).toThrow(/does not exist/);
    expect(() =>
      calculateLumenMethod({
        roomId: '',
        roomAreaM2: 20,
        utilizationFactor: 0.6,
        maintenanceFactor: 0.8,
        placements: [],
        luminaires: [],
      }),
    ).toThrow(/Room ID/);
  });
});
