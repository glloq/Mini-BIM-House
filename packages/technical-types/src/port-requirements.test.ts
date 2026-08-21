import { describe, expect, it } from 'vitest';
import {
  portRequirement,
  unmetRequirements,
  unknownPortKinds,
} from './port-requirements.js';

describe('how many ports of which kinds a thing is connected by', () => {
  it('reads a bare kind as exactly one of it', () => {
    expect(portRequirement('HEATING_FLOW')).toEqual({
      anyOf: ['HEATING_FLOW'],
      minCount: 1,
      maxCount: 1,
    });
  });

  it('refuses to let one port answer for two requirements', () => {
    // `HEATING_FLOW` and `HEATING_RETURN` carry the same water and share a
    // service, so matching by service let a machine with a return alone pass
    // for one with a flow and a return.
    const issues = unmetRequirements(
      [portRequirement('HEATING_FLOW'), portRequirement('HEATING_RETURN')],
      ['HEATING_RETURN'],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toContain('Départ chauffage');
  });

  it('is satisfied when both are actually there', () => {
    expect(
      unmetRequirements(
        [portRequirement('HEATING_FLOW'), portRequirement('HEATING_RETURN')],
        ['HEATING_RETURN', 'HEATING_FLOW'],
      ),
    ).toEqual([]);
  });

  it('counts what comes in numbers', () => {
    // Two MPPT inputs, twelve ways on a board, three outgoing circuits.
    const inputs = portRequirement({
      anyOf: ['PV_DC_INPUT'],
      minCount: 2,
      maxCount: 4,
    });
    expect(unmetRequirements([inputs], ['PV_DC_INPUT'])).toHaveLength(1);
    expect(unmetRequirements([inputs], ['PV_DC_INPUT', 'PV_DC_INPUT'])).toEqual(
      [],
    );
    expect(
      unmetRequirements(
        [inputs],
        Array.from({ length: 5 }, () => 'PV_DC_INPUT'),
      )[0]?.message,
    ).toContain('at most');
  });

  it('accepts what is genuinely interchangeable, once it is written down', () => {
    const either = portRequirement({ anyOf: ['WASTEWATER', 'SOILWATER'] });
    expect(unmetRequirements([either], ['SOILWATER'])).toEqual([]);
    expect(unmetRequirements([either], ['WATER_COLD'])).toHaveLength(1);
  });

  it('serves the most constrained requirement first', () => {
    // One port able to answer either must not be spent on the requirement that
    // had another way out.
    const exact = portRequirement('SOILWATER');
    const either = portRequirement({ anyOf: ['WASTEWATER', 'SOILWATER'] });
    expect(
      unmetRequirements([either, exact], ['SOILWATER', 'WASTEWATER']),
    ).toEqual([]);
  });

  it('names a kind the registry does not know', () => {
    expect(unknownPortKinds(portRequirement('NOWHERE'))).toEqual(['NOWHERE']);
    expect(unknownPortKinds(portRequirement('WATER_COLD'))).toEqual([]);
  });
});
