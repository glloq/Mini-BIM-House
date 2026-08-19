import { describe, expect, it } from 'vitest';
import {
  calculateAirflowContinuity,
  calculateDuctAirflow,
  ductPathLengthM,
  findCriticalVentilationBranch,
  type AirflowMethod,
} from './airflow.js';
import type { DuctSegment } from './ventilation-domain.js';

const method: AirflowMethod = {
  methodId: 'darcy-weisbach-haaland-air-v1',
  airDensityKgM3: 1.2,
  dynamicViscosityPaS: 0.000_018,
};

function duct(id: string, diameterM: number, endXmm = 10_000): DuctSegment {
  return {
    id,
    kind: 'DUCT',
    fromPortId: `${id}-in`,
    toPortId: `${id}-out`,
    path: [
      { x: 0, y: 0, z: 0 },
      { x: endXmm, y: 0, z: 0 },
    ],
    properties: {
      airRole: 'SUPPLY',
      shape: 'ROUND',
      diameterM,
      roughnessM: 0.000_09,
      localLossCoefficient: 0,
    },
  };
}

describe('ventilation airflow and losses', () => {
  it('derives SI path length explicitly from millimetre geometry', () => {
    expect(
      ductPathLengthM([
        { x: 0, y: 0, z: 0 },
        { x: 3_000, y: 4_000, z: 0 },
      ]),
    ).toBe(5);
  });

  it('implements VENT-001 flow conservation and unknown propagation', () => {
    const known = calculateAirflowContinuity(
      ['junction'],
      [
        {
          ductId: 'in',
          fromNodeId: 'source',
          toNodeId: 'junction',
          flowM3h: 90,
        },
        { ductId: 'a', fromNodeId: 'junction', toNodeId: 'a', flowM3h: 30 },
        { ductId: 'b', fromNodeId: 'junction', toNodeId: 'b', flowM3h: 60 },
      ],
    );
    expect(known[0]).toEqual({
      nodeId: 'junction',
      status: 'OK',
      inflowM3h: 90,
      outflowM3h: 90,
      residualM3h: 0,
    });
    expect(
      calculateAirflowContinuity(
        ['junction'],
        [{ ductId: 'in', fromNodeId: 'source', toNodeId: 'junction' }],
      )[0],
    ).toEqual({ nodeId: 'junction', status: 'UNKNOWN' });
  });

  it('implements VENT-002: a smaller section increases velocity', () => {
    const large = calculateDuctAirflow(
      { duct: duct('large', 0.2), flowM3h: 100 },
      method,
    );
    const small = calculateDuctAirflow(
      { duct: duct('small', 0.1), flowM3h: 100 },
      method,
    );
    expect(small.velocityMs).toBeCloseTo(large.velocityMs! * 4);
  });

  it('implements VENT-003: doubling length doubles linear loss', () => {
    const short = calculateDuctAirflow(
      { duct: duct('short', 0.15, 5_000), flowM3h: 100 },
      method,
    );
    const long = calculateDuctAirflow(
      { duct: duct('long', 0.15, 10_000), flowM3h: 100 },
      method,
    );
    expect(long.linearPressureLossPa).toBeCloseTo(
      short.linearPressureLossPa! * 2,
    );
  });

  it('keeps missing physical inputs partial rather than assuming values', () => {
    const noSection = calculateDuctAirflow(
      {
        duct: {
          ...duct('unknown', 0.1),
          properties: { airRole: 'SUPPLY', shape: 'ROUND' },
        },
        flowM3h: 100,
      },
      method,
    );
    const noFlow = calculateDuctAirflow({ duct: duct('no-flow', 0.1) }, method);
    expect(noSection.warnings[0]?.code).toBe('VENT_UNKNOWN_SECTION');
    expect(noFlow.warnings[0]?.code).toBe('VENT_UNKNOWN_FLOW');
    expect(noSection.velocityMs).toBeUndefined();
  });

  it('implements VENT-004 and refuses a critical branch when a loss is unknown', () => {
    const first = calculateDuctAirflow(
      { duct: duct('a', 0.15, 5_000), flowM3h: 100 },
      method,
    );
    const second = calculateDuctAirflow(
      { duct: duct('b', 0.15, 10_000), flowM3h: 100 },
      method,
    );
    expect(
      findCriticalVentilationBranch(
        [
          { branchId: 'short', ductIds: ['a'], additionalPressureLossPa: 0 },
          { branchId: 'long', ductIds: ['b'], additionalPressureLossPa: 10 },
        ],
        [first, second],
      ),
    ).toMatchObject({ status: 'OK', branchId: 'long' });

    const partial = calculateDuctAirflow(
      { duct: duct('partial', 0.15) },
      method,
    );
    expect(
      findCriticalVentilationBranch(
        [
          {
            branchId: 'partial',
            ductIds: ['partial'],
            additionalPressureLossPa: 0,
          },
        ],
        [partial],
      ).status,
    ).toBe('UNKNOWN');
    expect(
      findCriticalVentilationBranch(
        [{ branchId: 'empty', ductIds: [], additionalPressureLossPa: 0 }],
        [first],
      ).status,
    ).toBe('UNKNOWN');
  });
});
