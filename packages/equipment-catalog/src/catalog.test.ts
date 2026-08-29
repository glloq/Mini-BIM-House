import { describe, expect, it } from 'vitest';
import {
  equipmentProperty,
  interpolatePerformance,
  queryEquipment,
  resolvePlacedEquipment,
  validateEquipmentCatalog,
  validateEquipmentDefinition,
} from './catalog.js';
import {
  GENERIC_EQUIPMENT_REFERENCE,
  genericEquipment,
  genericEquipmentCatalog,
} from './generic-catalog.js';
import type { EquipmentDefinition, PlacedEquipment } from './types.js';

const pump = () => genericEquipment('generic-circulator-pump')!;

describe('generic equipment catalogue', () => {
  it('ships the equipment families the MVP needs to place and connect', () => {
    const families = new Set(
      genericEquipmentCatalog().map(({ familyId }) => familyId),
    );
    // « Ce dont le MVP a besoin » is a floor, not an inventory: the catalogue
    // grows past this list wave after wave, and asserting equality would have
    // turned every new fiche into an edit here.
    for (const needed of [
      'CIRCULATOR',
      'BALANCED_VENTILATION_UNIT',
      'EXTRACT_VENTILATION_UNIT',
      'EXTRACT_TERMINAL',
      'RADIATOR',
      'HEAT_PUMP_AIR_WATER_MONOBLOC',
      'ELECTRIC_DHW_TANK',
      'PV_MODULE',
      'STRING_INVERTER',
      'BATTERY_PACK',
      'CEILING_LIGHT',
      'SOCKET_16A',
      'MAIN_DISTRIBUTION_BOARD',
      'MCB',
      'KITCHEN_SINK',
      'SHOWER',
      'WASHBASIN',
      'WC',
      'RAINWATER_TANK',
    ])
      expect(families.has(needed), needed).toBe(true);
  });

  it('states no category of its own, because the family states it', () => {
    // Three taxonomies for one thing — `familyId`, `kind`, `category` — had
    // already parted company at nineteen entries: `generic-pv-module` said
    // `PHOTOVOLTAIC` in one field and `PV_MODULE` in the other. The family is
    // the single statement now, and `categoryOfFamily` stamps it on the way
    // out; an entry read straight from its file carries none.
    for (const definition of genericEquipmentCatalog())
      expect(definition.category).toBeUndefined();
  });

  it('validates cleanly and sources every property as generic data', () => {
    const catalog = genericEquipmentCatalog();
    expect(validateEquipmentCatalog(catalog)).toEqual([]);
    for (const definition of catalog) {
      expect(definition.catalogKind).toBe('GENERIC');
      expect(definition.manufacturer).toBeUndefined();
      for (const key of Object.keys(definition.properties))
        expect(
          definition.sources.find(({ property }) => property === key)
            ?.reference,
        ).toBe(GENERIC_EQUIPMENT_REFERENCE);
    }
  });

  it('makes every definition say what it connects by, empty included', () => {
    // It used to demand at least one port of every fiche, which held while
    // every fiche was a technical device. A bed connects to nothing, and an
    // empty list is how it says so — « unstated » and « none » must not be
    // the same thing. That a fiche whose family requires a connection has one
    // is the gate's business, and `validateCatalog` proves it there.
    for (const definition of genericEquipmentCatalog()) {
      expect(Array.isArray(definition.ports), definition.id).toBe(true);
      for (const port of definition.ports) {
        expect(port.id, definition.id).not.toBe('');
        expect(port.portTypeId, definition.id).toBeDefined();
      }
    }
    expect(
      genericEquipmentCatalog().filter(({ ports }) => ports.length > 0).length,
    ).toBeGreaterThan(0);
  });

  it('situe chaque raccordement depuis l’origine de l’appareil, donc dans son volume', () => {
    /*
     * Le repère, tenu par le catalogue entier et non par une phrase.
     *
     * `EquipmentPortDefinition.position` dit d'où part le décalage :
     * l'origine de l'appareil, celle que la pose situe — centre de l'emprise
     * en x et y, dessous en z. Il s'ensuit qu'un raccordement est dans le
     * volume que la fiche déclare, et c'est vérifiable ; c'est même la seule
     * raison de préférer ce repère-là à celui du centre de la boîte, que le
     * catalogue tenait sans que personne l'ait écrit.
     *
     * Ce que ce contrôle aurait dit avant la reprise : 288 raccordements de
     * 175 fiches sous leur propre appareil — l'eau froide d'un ballon de
     * 1 500 mm à −740, le départ d'un radiateur de 600 mm à −280, la sortie du
     * WC 350 mm sous sa cuvette. Aucun n'était une faute d'un auteur : tous
     * comptaient depuis le centre, faute d'un repère énoncé.
     */
    let checked = 0;
    for (const definition of genericEquipmentCatalog())
      for (const port of definition.ports) {
        const { x, y, z } = port.position;
        const where = `${definition.id}/${port.id}`;
        const { widthMm, depthMm, heightMm } = definition.dimensions ?? {};
        checked += 1;
        // Sous l'origine, c'est sous l'appareil : la borne basse ne demande
        // aucune dimension pour être vraie.
        expect(z, where).toBeGreaterThanOrEqual(0);
        if (heightMm !== undefined)
          expect(z, where).toBeLessThanOrEqual(heightMm);
        if (widthMm !== undefined)
          expect(Math.abs(x), where).toBeLessThanOrEqual(widthMm / 2);
        if (depthMm !== undefined)
          expect(Math.abs(y), where).toBeLessThanOrEqual(depthMm / 2);
      }
    // Un contrôle qui ne regarde rien passe : le catalogue en compte 799.
    expect(checked).toBe(799);
  });
});

describe('equipment definition validation', () => {
  it('refuses a product definition without a manufacturer', () => {
    const product: EquipmentDefinition = {
      ...pump(),
      catalogKind: 'PRODUCT',
      manufacturer: '  ',
    };
    expect(
      validateEquipmentDefinition(product).map(({ code }) => code),
    ).toContain('EQUIPMENT_PRODUCT_WITHOUT_MANUFACTURER');
  });

  it('escalates an unsourced property to an error for a product', () => {
    const base = pump();
    const generic: EquipmentDefinition = {
      ...base,
      properties: { ...base.properties, undocumented: 12 },
    };
    expect(
      validateEquipmentDefinition(generic).find(
        ({ code }) => code === 'EQUIPMENT_UNSOURCED_PROPERTY',
      )?.severity,
    ).toBe('WARNING');
    expect(
      validateEquipmentDefinition({
        ...generic,
        catalogKind: 'PRODUCT',
        manufacturer: 'Fabricant',
      }).find(({ code }) => code === 'EQUIPMENT_UNSOURCED_PROPERTY')?.severity,
    ).toBe('ERROR');
  });

  it('rejects duplicate identifiers, duplicate ports and impossible dimensions', () => {
    const base = pump();
    expect(
      validateEquipmentCatalog([base, base]).map(({ code }) => code),
    ).toContain('EQUIPMENT_DUPLICATE_ID');
    expect(
      validateEquipmentDefinition({
        ...base,
        ports: [base.ports[0]!, base.ports[0]!],
      }).map(({ code }) => code),
    ).toContain('EQUIPMENT_DUPLICATE_PORT');
    expect(
      validateEquipmentDefinition({
        ...base,
        dimensions: { widthMm: 0 },
      }).map(({ code }) => code),
    ).toContain('EQUIPMENT_INVALID_DIMENSION');
  });

  it('refuse un raccordement placé hors du volume de l’appareil', () => {
    /*
     * Les trois façons de sortir de l'appareil, et la seule qui se juge sans
     * dimension.
     *
     * Les chiffres ne sont pas inventés : ce sont ceux que `generic-wc`
     * portait — une sortie 350 mm sous une cuvette de 800 mm de haut, parce
     * qu'elle était comptée depuis le centre de la boîte. Sur la maison de
     * référence, cela mettait l'évacuation au radier du regard, et le
     * raccordement était refusé par « rien ne s'écoule vers le haut ».
     */
    const base = pump();
    const withPort = (
      position: { x: number; y: number; z: number },
      dimensions?: EquipmentDefinition['dimensions'],
    ): EquipmentDefinition => ({
      ...base,
      ...(dimensions === undefined ? {} : { dimensions }),
      ports: [{ ...base.ports[0]!, position }],
    });
    const codes = (definition: EquipmentDefinition) =>
      validateEquipmentDefinition(definition).map(({ code }) => code);

    const body = { widthMm: 380, depthMm: 700, heightMm: 800 };
    expect(codes(withPort({ x: 0, y: 250, z: -350 }, body))).toContain(
      'EQUIPMENT_PORT_OUTSIDE_BODY',
    );
    expect(codes(withPort({ x: 0, y: 250, z: 900 }, body))).toContain(
      'EQUIPMENT_PORT_OUTSIDE_BODY',
    );
    expect(codes(withPort({ x: 300, y: 0, z: 50 }, body))).toContain(
      'EQUIPMENT_PORT_OUTSIDE_BODY',
    );
    expect(codes(withPort({ x: 0, y: 400, z: 50 }, body))).toContain(
      'EQUIPMENT_PORT_OUTSIDE_BODY',
    );
    // Le raccordement corrigé — 50 mm au-dessus du plancher — passe.
    expect(codes(withPort({ x: 0, y: 250, z: 50 }, body))).not.toContain(
      'EQUIPMENT_PORT_OUTSIDE_BODY',
    );
    // Une fiche sans corps ne borne rien vers le haut, et borne toujours vers
    // le bas : six fiches déclarent des ports sans déclarer de hauteur, et
    // « sous l'origine » reste faux pour elles.
    const { dimensions: _stated, ...bodiless } = base;
    const somewhere = (z: number): EquipmentDefinition => ({
      ...bodiless,
      ports: [{ ...base.ports[0]!, position: { x: 0, y: 0, z } }],
    });
    expect(codes(somewhere(100_000))).not.toContain(
      'EQUIPMENT_PORT_OUTSIDE_BODY',
    );
    expect(codes(somewhere(-100))).toContain('EQUIPMENT_PORT_OUTSIDE_BODY');
  });

  it('rejects a curve whose points do not match its axes', () => {
    const base = pump();
    const curve = base.performanceCurves![0]!;
    expect(
      validateEquipmentDefinition({
        ...base,
        performanceCurves: [
          { ...curve, points: [{ inputs: [1, 2], output: 3 }] },
        ],
      }).map(({ code }) => code),
    ).toContain('EQUIPMENT_INVALID_CURVE');
  });
});

describe('catalogue queries and instances', () => {
  it('filters by search, category and catalogue kind', () => {
    const catalog = genericEquipmentCatalog();
    expect(
      queryEquipment(catalog, { search: 'circulateur' }).map(({ id }) => id),
    ).toEqual(['generic-circulator-pump']);
    // Read from the catalogue rather than listed: every wave brings more
    // pumps, and the property under test is that the search finds them all.
    expect(
      new Set(queryEquipment(catalog, { search: 'pompe' }).map(({ id }) => id)),
    ).toEqual(
      new Set(
        catalog
          .filter(({ name }) => name.toLowerCase().includes('pompe'))
          .map(({ id }) => id),
      ),
    );
    // Filtering by category needs entries somebody has resolved: the files
    // state none, so an unresolved catalogue answers nothing rather than
    // answering everything.
    expect(
      queryEquipment(catalog, { categories: ['SANITARY_FIXTURE'] }),
    ).toEqual([]);
    expect(
      queryEquipment(
        catalog.map((entry) =>
          entry.familyId === 'WC'
            ? { ...entry, category: 'SANITARY_FIXTURE' as const }
            : entry,
        ),
        { categories: ['SANITARY_FIXTURE'] },
      ).map(({ id }) => id),
    ).toEqual(['generic-wc']);
    expect(queryEquipment(catalog, { catalogKinds: ['PRODUCT'] })).toEqual([]);
    // Accent-insensitive search keeps French names findable: « evier » has to
    // find every « Évier », and there is more than one of them now.
    expect(
      new Set(queryEquipment(catalog, { search: 'evier' }).map(({ id }) => id)),
    ).toEqual(
      new Set(
        catalog
          .filter(({ name }) => name.toLowerCase().includes('évier'))
          .map(({ id }) => id),
      ),
    );
    expect(
      queryEquipment(catalog, { search: 'evier' }).map(({ id }) => id),
    ).toContain('generic-kitchen-sink');
  });

  it('resolves a placement and lets it override a definition property', () => {
    const definition = pump();
    const placed: PlacedEquipment = {
      id: 'pump-1',
      definitionId: definition.id,
      definitionVersion: definition.version,
      properties: { nominalPowerW: 60 },
    };
    const resolved = resolvePlacedEquipment(placed, [definition]);
    expect(resolved.status).toBe('OK');
    expect(resolved.issues).toEqual([]);
    expect(equipmentProperty(definition, placed, 'nominalPowerW')).toBe(60);
    expect(equipmentProperty(definition, undefined, 'nominalPowerW')).toBe(45);
  });

  it('leaves the definition alone when the placement holds no scalar', () => {
    // The model stores anything a file can hold on an instance; a list where a
    // power is expected is not a power, and reading it would put something no
    // calculation can use where it expects a number.
    const definition = pump();
    expect(
      equipmentProperty(
        definition,
        { id: 'pump-1', properties: { nominalPowerW: [60] } },
        'nominalPowerW',
      ),
    ).toBe(45);
  });

  it('warns when the catalogue has moved past the pinned version', () => {
    const definition = pump();
    const resolved = resolvePlacedEquipment(
      {
        id: 'pump-1',
        definitionId: definition.id,
        definitionVersion: '0.9.0',
      },
      [definition],
    );
    expect(resolved.issues.map(({ code }) => code)).toEqual([
      'EQUIPMENT_DEFINITION_VERSION_MISMATCH',
    ]);
  });

  it('warns when a placement pins nothing at all', () => {
    const definition = pump();
    const resolved = resolvePlacedEquipment(
      { id: 'pump-1', definitionId: definition.id },
      [definition],
    );
    expect(resolved.status).toBe('OK');
    expect(resolved.issues.map(({ code }) => code)).toEqual([
      'EQUIPMENT_UNPINNED_DEFINITION',
    ]);
  });

  it('reports an unknown definition instead of falling back', () => {
    const resolved = resolvePlacedEquipment(
      { id: 'pump-1', definitionId: 'nope', definitionVersion: '1.0.0' },
      genericEquipmentCatalog(),
    );
    expect(resolved.status).toBe('UNKNOWN');
  });
});

describe('performance curves', () => {
  it('interpolates inside the tabulated domain', () => {
    const curve = pump().performanceCurves![0]!;
    const result = interpolatePerformance(curve, 1.5);
    expect(result.status).toBe('OK');
    if (result.status === 'OK') expect(result.value).toBeCloseTo(4.55, 9);
  });

  it('returns the tabulated value on a point', () => {
    const curve = pump().performanceCurves![0]!;
    const result = interpolatePerformance(curve, 2);
    expect(result).toEqual({ status: 'OK', value: 3.9 });
  });

  it('never extrapolates outside the domain', () => {
    const curve = pump().performanceCurves![0]!;
    for (const input of [-1, 10]) {
      const result = interpolatePerformance(curve, input);
      expect(result.status).toBe('OUT_OF_RANGE');
      if (result.status === 'OUT_OF_RANGE')
        expect(result.issue.code).toBe('EQUIPMENT_PERFORMANCE_OUT_OF_RANGE');
    }
  });
});
