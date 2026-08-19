import { describe, expect, it } from 'vitest';
import {
  calculateNodeContinuity,
  calculatePipeHydraulics,
  calculateTerminalPressure,
  circularAreaM2,
  elevationPressureLossPa,
  type HydraulicContext,
} from './hydraulics.js';

const context: HydraulicContext = {
  fluidDensityKgM3: 998,
  dynamicViscosityPaS: 0.001,
  gravityMs2: 9.81,
  methodId: 'darcy-weisbach-haaland-v1',
};

function pipe(lengthM: number, internalDiameterM = 0.02) {
  return calculatePipeHydraulics(
    {
      segmentId: 'pipe',
      lengthM,
      internalDiameterM,
      flowM3s: 0.0001,
      roughnessM: 0.000_001_5,
      localLossCoefficient: 0,
    },
    context,
  );
}

describe('water hydraulics', () => {
  it('WATER-001 calculates circular area', () => {
    expect(circularAreaM2(0.02)).toBeCloseTo(Math.PI * 0.0001);
  });

  it('WATER-002 raises velocity when diameter decreases at constant flow', () => {
    const large = pipe(5, 0.02);
    const small = pipe(5, 0.01);
    expect(required(small.velocityMs)).toBeGreaterThan(
      required(large.velocityMs),
    );
    expect(required(small.velocityMs)).toBeCloseTo(
      required(large.velocityMs) * 4,
    );
  });

  it('WATER-003 doubles the linear term when length doubles', () => {
    const first = pipe(5);
    const second = pipe(10);
    expect(required(second.linearPressureLossPa)).toBeCloseTo(
      required(first.linearPressureLossPa) * 2,
    );
  });

  it('WATER-004 calculates rho*g*dz and preserves its sign', () => {
    expect(elevationPressureLossPa(3, context)).toBeCloseTo(998 * 9.81 * 3);
    expect(elevationPressureLossPa(-2, context)).toBeCloseTo(-998 * 9.81 * 2);
  });

  it('WATER-006 reports node flow conservation residuals', () => {
    const results = calculateNodeContinuity(
      ['source', 'junction', 'a', 'b'],
      [
        {
          segmentId: 's',
          fromNodeId: 'source',
          toNodeId: 'junction',
          flowM3s: 0.003,
        },
        {
          segmentId: 'a',
          fromNodeId: 'junction',
          toNodeId: 'a',
          flowM3s: 0.001,
        },
        {
          segmentId: 'b',
          fromNodeId: 'junction',
          toNodeId: 'b',
          flowM3s: 0.002,
        },
      ],
    );
    expect(results.find(({ nodeId }) => nodeId === 'junction')).toMatchObject({
      status: 'OK',
      inflowM3s: 0.003,
      outflowM3s: 0.003,
      residualM3s: 0,
    });
  });

  it('WATER-005 leaves pressure unknown for a disconnected terminal', () => {
    const result = calculateTerminalPressure(
      'sink',
      false,
      300_000,
      [pipe(5)],
      1,
      context,
    );
    expect(result).toEqual({
      fixtureId: 'sink',
      status: 'PARTIAL',
      warning: 'WATER_DISCONNECTED_FIXTURE',
    });
    expect(result.availablePressurePa).toBeUndefined();
  });

  it('subtracts path and elevation losses from source pressure', () => {
    const segment = pipe(5);
    const result = calculateTerminalPressure(
      'sink',
      true,
      300_000,
      [segment],
      2,
      context,
    );
    expect(result.availablePressurePa).toBeCloseTo(
      300_000 -
        required(segment.totalPressureLossPa) -
        elevationPressureLossPa(2, context),
    );
  });

  it('keeps missing flow and local losses unknown', () => {
    const missingFlow = calculatePipeHydraulics(
      { segmentId: 'unknown-flow', lengthM: 5, internalDiameterM: 0.02 },
      context,
    );
    const missingLocalLoss = calculatePipeHydraulics(
      {
        segmentId: 'unknown-k',
        lengthM: 5,
        internalDiameterM: 0.02,
        flowM3s: 0.0001,
        roughnessM: 0.000_001_5,
      },
      context,
    );
    expect(missingFlow.velocityMs).toBeUndefined();
    expect(missingLocalLoss.linearPressureLossPa).toBeDefined();
    expect(missingLocalLoss.localPressureLossPa).toBeUndefined();
    expect(missingLocalLoss.totalPressureLossPa).toBeUndefined();
  });

  it('keeps continuity unknown when any connected flow is unknown', () => {
    const [node] = calculateNodeContinuity(
      ['junction'],
      [{ segmentId: 'pipe', fromNodeId: 'source', toNodeId: 'junction' }],
    );
    expect(node).toEqual({ nodeId: 'junction', status: 'UNKNOWN' });
  });
});

function required(value: number | undefined): number {
  if (value === undefined) throw new Error('Expected a known hydraulic value');
  return value;
}
