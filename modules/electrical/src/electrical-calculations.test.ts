import { describe, expect, it } from 'vitest';
import {
  calculateDesignCurrentA,
  calculateElectricalCircuit,
  electricalPathLengthM,
} from './electrical-calculations.js';
import type {
  ElectricalCable,
  ElectricalCircuit,
  ElectricalLoad,
} from './electrical-domain.js';

const circuit: ElectricalCircuit = {
  id: 'heating',
  purpose: 'POWER',
  boardId: 'main',
  voltageV: 230,
  voltageReference: 'PHASE_NEUTRAL',
  phases: 1,
  conductorSectionMm2: 2.5,
  loadIds: ['heater'],
};
const load: ElectricalLoad = {
  loadId: 'heater',
  name: 'Heater',
  activePowerW: 2_300,
  powerFactor: 1,
  demandFactor: 0.8,
};

function cable(id: string, startMm: number, endMm: number): ElectricalCable {
  return {
    id,
    kind: 'CABLE',
    fromPortId: `${id}-from`,
    toPortId: `${id}-to`,
    path: [
      { x: startMm, y: 0, z: 0 },
      { x: endMm, y: 0, z: 0 },
    ],
    properties: { circuitId: 'heating', conductorCount: 3 },
  };
}

describe('electrical circuit calculations', () => {
  it('implements ELEC-001: 2300 W at 230 V and PF 1 gives 10 A', () => {
    expect(calculateDesignCurrentA(2_300, 230, 1, 1, 'PHASE_NEUTRAL')).toBe(10);
  });

  it('uses the declared voltage reference for balanced three-phase current', () => {
    expect(
      calculateDesignCurrentA(6_900, 400, 1, 3, 'PHASE_PHASE'),
    ).toBeCloseTo(6_900 / (Math.sqrt(3) * 400));
    expect(calculateDesignCurrentA(6_900, 230, 1, 3, 'PHASE_NEUTRAL')).toBe(10);
  });

  it('implements ELEC-002 by separating installed and design power', () => {
    const result = calculateElectricalCircuit({
      circuit,
      loads: [load],
      cables: [
        { cable: cable('cable', 0, 10_000), conductorResistanceOhmPerM: 0.007 },
      ],
    });
    expect(result).toMatchObject({
      status: 'OK',
      installedPowerW: 2_300,
      designPowerW: 1_840,
      designApparentPowerVA: 1_840,
      designCurrentA: 8,
    });
  });

  it('implements ELEC-003: path drop equals the sum of cable drops', () => {
    const split = calculateElectricalCircuit({
      circuit,
      loads: [load],
      cables: [
        { cable: cable('a', 0, 5_000), conductorResistanceOhmPerM: 0.007 },
        { cable: cable('b', 5_000, 10_000), conductorResistanceOhmPerM: 0.007 },
      ],
    });
    const single = calculateElectricalCircuit({
      circuit,
      loads: [load],
      cables: [
        { cable: cable('all', 0, 10_000), conductorResistanceOhmPerM: 0.007 },
      ],
    });
    expect(split.voltageDropV).toBeCloseTo(single.voltageDropV!);
    expect(split.voltageDropV).toBeCloseTo(
      split.cables.reduce((total, result) => total + result.voltageDropV!, 0),
    );
  });

  it('derives cable length from persisted millimetre geometry', () => {
    expect(
      electricalPathLengthM([
        { x: 0, y: 0, z: 0 },
        { x: 3_000, y: 4_000, z: 0 },
      ]),
    ).toBe(5);
  });

  it('does not sum disconnected or branched cable paths as a series path', () => {
    const result = calculateElectricalCircuit({
      circuit,
      loads: [load],
      cables: [
        {
          cable: cable('branch-a', 0, 5_000),
          conductorResistanceOhmPerM: 0.007,
        },
        {
          cable: cable('branch-b', 0, 4_000),
          conductorResistanceOhmPerM: 0.007,
        },
      ],
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.voltageDropV).toBeUndefined();
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'ELEC_UNSUPPORTED_CONFIGURATION' }),
    );
  });

  it('keeps missing demand, power factor, and resistance unknown', () => {
    const result = calculateElectricalCircuit({
      circuit,
      loads: [{ loadId: 'heater', name: 'Heater', activePowerW: 2_300 }],
      cables: [{ cable: cable('cable', 0, 10_000) }],
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.installedPowerW).toBe(2_300);
    expect(result.designPowerW).toBeUndefined();
    expect(result.designCurrentA).toBeUndefined();
    expect(result.voltageDropV).toBeUndefined();
    expect(result.warnings.map(({ code }) => code)).toEqual([
      'ELEC_UNKNOWN_DEMAND_FACTOR',
    ]);
  });

  it('requires catalog resistance instead of hard-coding conductor data', () => {
    const result = calculateElectricalCircuit({
      circuit,
      loads: [load],
      cables: [{ cable: cable('cable', 0, 10_000) }],
    });
    expect(result.voltageDropV).toBeUndefined();
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'ELEC_UNKNOWN_RESISTANCE' }),
    );
  });

  it('rejects calculation inputs belonging to another circuit', () => {
    expect(() =>
      calculateElectricalCircuit({
        circuit,
        loads: [{ ...load, loadId: 'other' }],
        cables: [],
      }),
    ).toThrow(/exactly match/);
    expect(() =>
      calculateElectricalCircuit({
        circuit,
        loads: [load],
        cables: [
          {
            cable: {
              ...cable('foreign', 0, 1_000),
              properties: { circuitId: 'other', conductorCount: 3 },
            },
          },
        ],
      }),
    ).toThrow(/reference that circuit/);
  });
});
