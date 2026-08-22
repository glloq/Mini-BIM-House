import { describe, expect, it } from 'vitest';
import type { RegulatoryContext } from './types.js';
import { rulePackSelections, validateRegulatoryContext } from './types.js';

const FR: RegulatoryContext = { country: 'FR', enabledRulePacks: [] };

describe('the texts a project is judged against', () => {
  it('reads a pack a file names as a bare string', () => {
    // What every file written before selections carried a version holds.
    expect(
      rulePackSelections({ ...FR, enabledRulePacks: ['rainwater-fr'] }),
    ).toEqual([{ id: 'rainwater-fr' }]);
  });

  it('reads a pack pinned at the version it was checked with', () => {
    const selection = { id: 'rainwater-fr', version: '1.2.0' };
    expect(
      rulePackSelections({ ...FR, enabledRulePacks: [selection] }),
    ).toEqual([selection]);
  });

  it('treats no pack as no pack, never as a default one', () => {
    // A project checked against nothing is checked against nothing. Applying a
    // national reference nobody asked for is how an application ends up
    // claiming a compliance it never assessed.
    expect(rulePackSelections(FR)).toEqual([]);
    expect(rulePackSelections(undefined)).toEqual([]);
    expect(validateRegulatoryContext(FR)).toEqual([]);
  });

  it('refuses a country nobody stated and a date nobody can read', () => {
    expect(validateRegulatoryContext({ ...FR, country: ' ' })).toEqual([
      'country must not be empty',
    ]);
    expect(
      validateRegulatoryContext({ ...FR, referenceDate: 'un jour' }),
    ).toEqual(['referenceDate must be a date']);
  });

  it('refuses a selection that names no pack', () => {
    expect(
      validateRegulatoryContext({ ...FR, enabledRulePacks: [''] }),
    ).toEqual(['enabledRulePacks/0 must name a pack']);
    expect(
      validateRegulatoryContext({
        ...FR,
        enabledRulePacks: [{ id: '' }],
      }),
    ).toEqual(['enabledRulePacks/0/id must not be empty']);
  });
});
