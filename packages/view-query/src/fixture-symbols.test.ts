import { describe, expect, it } from 'vitest';

import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import { architecturalFixtureSymbol } from './fixture-symbols.js';

describe('the glyph a placed thing is drawn with', () => {
  it('covers the fixtures a house is actually made of', () => {
    // A bathroom that holds three identical squares says nothing about
    // whether anybody can stand in it.
    for (const family of [
      'WC',
      'WASHBASIN',
      'DOUBLE_WASHBASIN',
      'BASIN',
      'BATHTUB',
      'SHOWER',
      'KITCHEN_SINK',
      'DOUBLE_SINK',
      'HOB',
      'DISHWASHER',
      'WASHING_MACHINE',
      'ELECTRIC_DHW_TANK',
      'OUTDOOR_HEAT_PUMP',
      'HEAT_PUMP_AIR_WATER_SPLIT',
      'BALANCED_VENTILATION_UNIT',
      'MAIN_DISTRIBUTION_BOARD',
      'RADIATOR',
      'WOOD_STOVE',
    ])
      expect(architecturalFixtureSymbol(family)).toBeDefined();
  });

  it('names only glyphs the library actually holds', () => {
    for (const family of [
      'WC',
      'BATHTUB',
      'HOB',
      'RADIATOR',
      'WOOD_STOVE',
      'MAIN_DISTRIBUTION_BOARD',
    ])
      expect(
        SYMBOL_LIBRARY_V1.definitions[architecturalFixtureSymbol(family)!],
      ).toBeDefined();
  });

  it('answers nothing for a family it does not know', () => {
    // The caller then falls back on what the catalogue entry declares, and on
    // the plain mark after that: an unknown thing is still drawn.
    expect(architecturalFixtureSymbol('TELEPORTER')).toBeUndefined();
    expect(architecturalFixtureSymbol(undefined)).toBeUndefined();
  });

  it('draws every fixture at the size it is, in the model', () => {
    for (const family of ['BATHTUB', 'SHOWER', 'WC'])
      expect(
        SYMBOL_LIBRARY_V1.definitions[architecturalFixtureSymbol(family)!]
          ?.scaleRules.space,
      ).toBe('MODEL_SPACE');
  });
});
