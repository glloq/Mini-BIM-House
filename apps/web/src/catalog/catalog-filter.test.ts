import { describe, expect, it } from 'vitest';

import { axisValues, matchesQuery, plain } from './catalog-filter.js';

const ENTRIES = [
  {
    text: ['Béton armé', 'generic-concrete', 'Lafarge'],
    domain: 'MINERAL',
    family: 'STRUCTURE',
  },
  {
    text: ['Laine de roche', 'generic-rock-wool', undefined],
    domain: 'MINERAL',
    family: 'ISOLATION',
    incomplete: true,
  },
  {
    text: ['Plaque de plâtre', 'generic-gypsum-board'],
    domain: 'MINERAL',
    family: 'FINITION',
  },
];

describe('one way of asking a catalogue « lequel »', () => {
  it('ignores accents and case, because people type what they hear', () => {
    expect(plain('Béton armé')).toBe('beton arme');
    expect(matchesQuery(ENTRIES[0]!, { search: 'beton' })).toBe(true);
    expect(matchesQuery(ENTRIES[0]!, { search: 'BÉTON' })).toBe(true);
  });

  it('takes the words in any order', () => {
    // « plaque platre » finds it without anybody guessing the order the
    // catalogue happens to write things in.
    expect(matchesQuery(ENTRIES[2]!, { search: 'platre plaque' })).toBe(true);
    expect(matchesQuery(ENTRIES[2]!, { search: 'plaque bois' })).toBe(false);
  });

  it('reads everything the entry says about itself', () => {
    expect(matchesQuery(ENTRIES[0]!, { search: 'lafarge' })).toBe(true);
    expect(matchesQuery(ENTRIES[0]!, { search: 'generic-concrete' })).toBe(
      true,
    );
    // A missing field is not a match and not a crash.
    expect(matchesQuery(ENTRIES[1]!, { search: 'lafarge' })).toBe(false);
  });

  it('narrows by trade and by family', () => {
    expect(matchesQuery(ENTRIES[0]!, { family: 'STRUCTURE' })).toBe(true);
    expect(matchesQuery(ENTRIES[0]!, { family: 'ISOLATION' })).toBe(false);
    expect(matchesQuery(ENTRIES[0]!, { domain: 'MINERAL' })).toBe(true);
    // An empty filter filters nothing, which is what an untouched menu means.
    expect(matchesQuery(ENTRIES[0]!, { family: '', domain: '' })).toBe(true);
  });

  it('keeps only what is missing something, when asked', () => {
    expect(matchesQuery(ENTRIES[1]!, { incompleteOnly: true })).toBe(true);
    expect(matchesQuery(ENTRIES[0]!, { incompleteOnly: true })).toBe(false);
  });

  it('lists the values of an axis in the order they were met', () => {
    expect(axisValues(ENTRIES, 'family')).toEqual([
      'STRUCTURE',
      'ISOLATION',
      'FINITION',
    ]);
    expect(axisValues(ENTRIES, 'domain')).toEqual(['MINERAL']);
  });

  it('answers yes to a query that asks nothing', () => {
    for (const entry of ENTRIES) expect(matchesQuery(entry, {})).toBe(true);
  });
});
