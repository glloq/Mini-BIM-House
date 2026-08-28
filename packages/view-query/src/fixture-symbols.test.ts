import { describe, expect, it } from 'vitest';

import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import {
  GENERIC_PLAN_SYMBOL,
  architecturalFixtureSymbol,
} from './fixture-symbols.js';

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

describe('la table de familles sortie du code', () => {
  it('rend exactement ce que la table écrite à la main rendait', () => {
    // La migration est un déplacement, pas une refonte : les trente-neuf
    // familles que le TypeScript nommait doivent recevoir le même glyphe,
    // faute de quoi tous les plans de référence du dépôt changent en silence.
    const avant = {
      WC: 'architecture.fixture.wc',
      WALL_HUNG_WC: 'architecture.fixture.wc',
      BIDET: 'architecture.fixture.basin',
      WASHBASIN: 'architecture.fixture.washbasin',
      DOUBLE_WASHBASIN: 'architecture.fixture.double-washbasin',
      BASIN: 'architecture.fixture.basin',
      BATHTUB: 'architecture.fixture.bathtub',
      SHOWER: 'architecture.fixture.shower',
      SHOWER_TRAY: 'architecture.fixture.shower',
      WALK_IN_SHOWER: 'architecture.fixture.shower',
      KITCHEN_SINK: 'architecture.fixture.kitchen-sink',
      UTILITY_SINK: 'architecture.fixture.kitchen-sink',
      DOUBLE_SINK: 'architecture.fixture.double-sink',
      HOB: 'architecture.fixture.hob',
      DISHWASHER: 'architecture.fixture.dishwasher',
      WASHING_MACHINE: 'architecture.fixture.washing-machine',
      ELECTRIC_DHW_TANK: 'architecture.fixture.dhw-tank',
      INDIRECT_TANK: 'architecture.fixture.dhw-tank',
      SOLAR_DHW_TANK: 'architecture.fixture.dhw-tank',
      BUFFER_DHW: 'architecture.fixture.dhw-tank',
      BUFFER_TANK: 'architecture.fixture.dhw-tank',
      HEAT_PUMP_DHW: 'architecture.fixture.dhw-tank',
      HEAT_PUMP_AIR_WATER_SPLIT: 'architecture.fixture.heat-pump-indoor',
      HEAT_PUMP_WATER_WATER: 'architecture.fixture.heat-pump-indoor',
      HEAT_PUMP_GROUND_WATER: 'architecture.fixture.heat-pump-indoor',
      EXHAUST_AIR_HEAT_PUMP: 'architecture.fixture.heat-pump-indoor',
      REVERSIBLE_HEAT_PUMP: 'architecture.fixture.heat-pump-indoor',
      OUTDOOR_HEAT_PUMP: 'architecture.fixture.heat-pump-outdoor',
      HEAT_PUMP_AIR_WATER_MONOBLOC: 'architecture.fixture.heat-pump-outdoor',
      HEAT_PUMP_AIR_AIR: 'architecture.fixture.heat-pump-outdoor',
      BALANCED_VENTILATION_UNIT: 'architecture.fixture.ventilation-unit',
      EXTRACT_VENTILATION_UNIT: 'architecture.fixture.ventilation-unit',
      MAIN_DISTRIBUTION_BOARD: 'architecture.fixture.distribution-board',
      SUB_DISTRIBUTION_BOARD: 'architecture.fixture.distribution-board',
      RADIATOR: 'architecture.fixture.radiator',
      TOWEL_RADIATOR: 'architecture.fixture.radiator',
      WOOD_STOVE: 'architecture.fixture.stove',
      PELLET_STOVE: 'architecture.fixture.stove',
      BOILER_STOVE: 'architecture.fixture.stove',
    };
    for (const [family, symbolId] of Object.entries(avant))
      expect(architecturalFixtureSymbol(family)).toBe(symbolId);
  });

  it('a gagné les familles que seule la fiche dessinait', () => {
    // Cent vingt-sept fiches nommaient déjà un glyphe de plan, et le plan les
    // lisait au second passage. La déclaration est remontée à la famille, ce
    // qui les dessine même sans fiche installée.
    expect(architecturalFixtureSymbol('DOWNLIGHT')).toBe('symbol-luminaire');
    expect(architecturalFixtureSymbol('MAIN_VALVE')).toBe('water.valve');
    expect(architecturalFixtureSymbol('RCBO')).toBe('symbol-circuit-breaker');
  });

  it('tient une famille par sa catégorie dès qu’on la lui donne', () => {
    // Le deuxième maillon marche ; l'appelant ne le sollicite pas encore.
    // Un robinet extérieur n'a pas son dessin, sa catégorie en a un.
    expect(architecturalFixtureSymbol('OUTDOOR_TAP')).toBeUndefined();
    expect(architecturalFixtureSymbol('OUTDOOR_TAP', 'SANITARY_FIXTURE')).toBe(
      'architecture.fixture.washbasin',
    );
  });

  it('laisse le carré au plan plutôt que de le repasser par la bibliothèque', () => {
    // Le générique est nommé — il existe, la chaîne est complète — mais le
    // rendre ici ferait passer trois cents familles par un second chemin pour
    // obtenir le même carré, à la largeur de la fiche près.
    expect(SYMBOL_LIBRARY_V1.definitions[GENERIC_PLAN_SYMBOL]).toBeDefined();
    expect(architecturalFixtureSymbol('TRAP', 'DRAINAGE')).toBeUndefined();
  });
});
