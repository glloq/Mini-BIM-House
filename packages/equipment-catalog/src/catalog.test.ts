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
    expect(families).toEqual(
      new Set([
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
      ]),
    );
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

  it('gives every definition ports a network can attach to', () => {
    for (const definition of genericEquipmentCatalog())
      expect(definition.ports.length).toBeGreaterThan(0);
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
    expect(
      queryEquipment(catalog, { search: 'pompe' }).map(({ id }) => id),
    ).toEqual(['generic-air-water-heat-pump']);
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
    // Accent-insensitive search keeps French names findable.
    expect(
      queryEquipment(catalog, { search: 'evier' }).map(({ id }) => id),
    ).toEqual(['generic-kitchen-sink']);
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
