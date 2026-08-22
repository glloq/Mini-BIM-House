import { describe, expect, it } from 'vitest';
import type { NetworkPort } from './network.js';
import {
  connectionRefusalBetween,
  portCompatibility,
  portsConnectable,
} from './network.js';

function port(
  id: string,
  nodeId: string,
  direction: 'IN' | 'OUT',
  rest: Partial<NetworkPort> = {},
): NetworkPort {
  return { id, nodeId, role: 'FLOW', direction, ...rest };
}

const coldOut = port('out', 'source', 'OUT', { portTypeId: 'WATER_COLD' });
const coldIn = port('in', 'sink', 'IN', { portTypeId: 'WATER_COLD' });
const wasteIn = port('waste', 'drain', 'IN', {
  portTypeId: 'WASTEWATER_GRAVITY',
});
const silentOut = port('silent-out', 'a', 'OUT');
const silentIn = port('silent-in', 'b', 'IN');

describe('whether two ports may be joined', () => {
  it('says yes when both name the same kind', () => {
    expect(portCompatibility(coldOut, coldIn)).toEqual({
      status: 'COMPATIBLE',
    });
    expect(portsConnectable(coldOut, coldIn)).toBe(true);
    expect(connectionRefusalBetween(coldOut, coldIn)).toBeUndefined();
  });

  it('says no when the two kinds do not join', () => {
    const verdict = portCompatibility(coldOut, wasteIn);
    expect(verdict.status).toBe('INCOMPATIBLE');
    expect(portsConnectable(coldOut, wasteIn)).toBe(false);
    expect(connectionRefusalBetween(coldOut, wasteIn)).toBeDefined();
  });

  it('says it cannot tell when neither end names a kind', () => {
    // This used to answer « rien ne s’y oppose », which the editor read as
    // « compatible » : two ports saying nothing were joined, and a run whose
    // fluid nobody had checked looked exactly like a checked one.
    const verdict = portCompatibility(silentOut, silentIn);
    expect(verdict.status).toBe('UNKNOWN');
    expect(portsConnectable(silentOut, silentIn)).toBe(false);
    // And it is not a refusal: an old file keeps the runs it already holds.
    expect(connectionRefusalBetween(silentOut, silentIn)).toBeUndefined();
  });

  it('says it cannot tell when only one end names a kind', () => {
    const verdict = portCompatibility(coldOut, silentIn);
    expect(verdict.status).toBe('UNKNOWN');
    if (verdict.status !== 'UNKNOWN') return;
    expect(verdict.reason).toContain('WATER_COLD');
    expect(verdict.reason).toContain('silent-in');
  });

  it('still refuses two ends facing the same way', () => {
    expect(
      portCompatibility(coldOut, { ...coldIn, direction: 'OUT' }).status,
    ).toBe('INCOMPATIBLE');
    expect(
      portCompatibility(coldIn, { ...coldOut, direction: 'IN' }).status,
    ).toBe('INCOMPATIBLE');
  });

  it('still refuses a run from a node to itself', () => {
    expect(
      portCompatibility(silentOut, { ...silentIn, nodeId: 'a' }).status,
    ).toBe('INCOMPATIBLE');
  });

  it('lets an old file refuse on what it does state', () => {
    // A legacy pair can still disagree; what it cannot do is certify.
    const copper = port('a-out', 'a', 'OUT', { connectionType: 'COMPRESSION' });
    const welded = port('b-in', 'b', 'IN', { connectionType: 'WELDED' });
    expect(portCompatibility(copper, welded).status).toBe('INCOMPATIBLE');
    const agreeing = port('c-in', 'c', 'IN', { connectionType: 'COMPRESSION' });
    expect(portCompatibility(copper, agreeing).status).toBe('UNKNOWN');
  });
});
