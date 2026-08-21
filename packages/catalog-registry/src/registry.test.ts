import { describe, expect, it } from 'vitest';
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import { PROJECT_CALCULATION_MODULE_IDS } from '@house-technical-designer/calculation-adapters';
import {
  genericEquipmentCatalog,
  genericEquipmentFamilies,
} from '@house-technical-designer/equipment-catalog';
import {
  DATA_REGISTRIES,
  FAMILY_REGISTRY,
  PORT_TYPES,
  PROPERTY_SCHEMA_REGISTRY,
  STATUS_AXES,
  axisCounts,
  completeness,
  domainProgress,
  family,
  familiesOfRegistry,
  familiesOfWave,
  invalidBore,
  networkProduct,
  pendingOfWave,
  productsOfFamily,
  validateNetworkProducts,
  portsConnect,
  propertySchema,
  schemaOfFamily,
  validateProperties,
  validateProvenance,
  validateRegistry,
} from './index.js';

const KNOWN = {
  symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
  calculators: new Set<string>(PROJECT_CALCULATION_MODULE_IDS),
};

describe('the master nomenclature', () => {
  it('holds every family, and says nothing twice', () => {
    const ids = FAMILY_REGISTRY.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    // The list is the point: five hundred families is the size of the work,
    // and a nomenclature that quietly shrank would be a plan nobody notices
    // losing a trade.
    expect(FAMILY_REGISTRY.length).toBeGreaterThan(400);
  });

  it('is coherent with the ports, the symbols and the modules', () => {
    // A family naming a port nobody defined fails at the moment it is used,
    // which is months later and in front of someone.
    expect(validateRegistry(KNOWN)).toEqual([]);
  });

  it('divides the data into the seven registries and no others', () => {
    const used = new Set(FAMILY_REGISTRY.map(({ registry }) => registry));
    for (const registry of used) expect(DATA_REGISTRIES).toContain(registry);
    // A pipe is not a heat pump and a window is not a piece of furniture: each
    // of the registries that describes objects actually holds some.
    for (const registry of [
      'MATERIAL',
      'ASSEMBLY',
      'OPENING',
      'EQUIPMENT',
      'NETWORK_PRODUCT',
    ] as const)
      expect(familiesOfRegistry(registry).length, registry).toBeGreaterThan(0);
  });

  it('gives every placed family somewhere to be placed', () => {
    for (const entry of FAMILY_REGISTRY)
      if (entry.registry === 'EQUIPMENT' || entry.registry === 'OPENING')
        expect(entry.placement?.allowedHosts.length, entry.id).toBeGreaterThan(
          0,
        );
  });

  it('orders the work in waves, and none of them is empty', () => {
    for (const wave of [1, 2, 3, 4, 5, 6])
      expect(familiesOfWave(wave).length, `vague ${wave}`).toBeGreaterThan(0);
  });

  it('says of every family what reads it', () => {
    const withoutCalculators = FAMILY_REGISTRY.filter(
      ({ calculators }) => (calculators ?? []).length === 0,
    );
    expect(withoutCalculators.map(({ id }) => id)).toEqual([]);
  });
});

describe('what a port may be joined to', () => {
  it('never joins two different media', () => {
    expect(portsConnect('WATER_COLD', 'ELECTRICAL_AC')).toBe(false);
    expect(portsConnect('AIR_SUPPLY', 'WASTEWATER')).toBe(false);
  });

  it('sends a heating flow to a return and never to another flow', () => {
    expect(portsConnect('HEATING_FLOW', 'HEATING_RETURN')).toBe(true);
    expect(portsConnect('HEATING_FLOW', 'HEATING_FLOW')).toBe(false);
  });

  it('lets a two-way port join anything of its own medium', () => {
    expect(portsConnect('WATER_COLD', 'WATER_COLD')).toBe(true);
  });

  it('says nothing about a port nobody declared', () => {
    expect(portsConnect('WATER_COLD', 'IMAGINARY')).toBe(false);
  });

  it('gives every port a medium and a direction', () => {
    for (const type of PORT_TYPES) {
      expect(type.medium.length, type.id).toBeGreaterThan(0);
      expect(type.label.length, type.id).toBeGreaterThan(0);
    }
  });
});

describe('what a family says its properties are', () => {
  it('describes every schema a family names', () => {
    for (const entry of FAMILY_REGISTRY)
      if (entry.propertySchema !== undefined)
        expect(propertySchema(entry.propertySchema), entry.id).toBeDefined();
  });

  it('gives each property a unit or a reason not to have one', () => {
    for (const schema of PROPERTY_SCHEMA_REGISTRY)
      for (const property of schema.properties)
        if (property.type === 'number' || property.type === 'integer')
          expect(
            property.unit,
            `${schema.family}.${property.key}`,
          ).toBeDefined();
  });

  it('refuses a derived value someone tried to store', () => {
    // A design flow written into a catalogue entry is a second answer to a
    // question the model already answers.
    const schema = schemaOfFamily('HEAT_PUMP_AIR_WATER_MONOBLOC')!;
    const issues = validateProperties(
      schema,
      { ratedHeatingPower: 8000, designFlow: 1.4 },
      'DEFINITION',
    );
    expect(issues.map(({ path }) => path)).toContain('designFlow');
  });

  it('refuses a property the family never declared', () => {
    const schema = schemaOfFamily('WINDOW_CASEMENT')!;
    expect(
      validateProperties(
        schema,
        { width: 1200, height: 1400, colour: 'blue' },
        'DEFINITION',
      ),
    ).toContainEqual({
      path: 'colour',
      message: 'WINDOW declares no property colour',
    });
  });

  it('asks for what it says is required, and only in the right place', () => {
    const schema = schemaOfFamily('WINDOW_CASEMENT')!;
    expect(
      validateProperties(schema, { width: 1200 }, 'DEFINITION').map(
        ({ path }) => path,
      ),
    ).toEqual(['height']);
    // A sill height belongs to the window in this wall, not to the model.
    expect(
      validateProperties(schema, { sillHeight: 900 }, 'INSTANCE').every(
        ({ path }) => path !== 'sillHeight',
      ),
    ).toBe(true);
  });

  it('checks the type and the range of what it is given', () => {
    const schema = schemaOfFamily('WINDOW_CASEMENT')!;
    const issues = validateProperties(
      schema,
      { width: 1200, height: 1400, gValue: 1.4 },
      'DEFINITION',
    );
    expect(issues.map(({ path }) => path)).toEqual(['gValue']);
  });
});

describe('where a value comes from', () => {
  it('refuses an entry that does not say', () => {
    expect(validateProvenance(undefined)).toHaveLength(1);
  });

  it('refuses a manufacturer figure with no date', () => {
    expect(
      validateProvenance({
        type: 'MANUFACTURER',
        reference: 'Fiche technique',
      }),
    ).toHaveLength(1);
  });

  it('accepts a generic design value, which is a statement and not a gap', () => {
    expect(
      validateProvenance({
        type: 'GENERIC',
        reference: 'Valeur de dimensionnement générique',
      }),
    ).toEqual([]);
  });
});

describe('the state of the work, measured', () => {
  it('counts every family on every axis', () => {
    const counts = axisCounts(FAMILY_REGISTRY);
    expect(counts).toHaveLength(STATUS_AXES.length);
    for (const { axis, counts: byValue } of counts) {
      const total = Object.values(byValue).reduce((sum, one) => sum + one, 0);
      expect(total, axis).toBe(FAMILY_REGISTRY.length);
    }
  });

  it('says how far each trade has got, and none of it is finished', () => {
    const progress = domainProgress(FAMILY_REGISTRY);
    expect(progress.length).toBeGreaterThan(5);
    for (const { domain, completeness: done } of progress) {
      expect(done, domain).toBeGreaterThanOrEqual(0);
      expect(done, domain).toBeLessThan(1);
    }
  });

  it('treats an axis nobody mentioned as an axis nobody started', () => {
    expect(completeness({})).toBe(0);
  });

  it('hands out a queue anybody can pick up', () => {
    const pending = pendingOfWave(FAMILY_REGISTRY, 1);
    expect(pending.length).toBeGreaterThan(0);
    // Least advanced first: the queue starts where there is most to do.
    const scores = pending.map(({ status }) => completeness(status ?? {}));
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });

  it('knows a family by name', () => {
    expect(family('HEAT_PUMP_AIR_WATER_MONOBLOC')?.domain).toBe('HEATING');
    expect(family('NOWHERE')).toBeUndefined();
  });
});

describe('the products a network is made of', () => {
  it('agrees with the families it claims to belong to', () => {
    // Three hundred tubes will have a typo in them, and a network sized on a
    // tube whose bore is wrong by four millimetres is wrong quietly.
    expect(validateNetworkProducts()).toEqual([]);
  });

  it('holds something for every trade that routes anything', () => {
    for (const familyId of [
      'WATER_PIPE',
      'HEATING_PIPE',
      'WASTEWATER_PIPE',
      'RAINWATER_PIPE',
      'ROUND_DUCT',
      'ELECTRICAL_CABLE',
      'FLUE_PIPE',
    ])
      expect(productsOfFamily(familyId).length, familyId).toBeGreaterThan(0);
  });

  it('never lets a bore disagree with its own walls', () => {
    expect(
      invalidBore({
        outerDiameterMm: 16,
        wallThicknessMm: 1.5,
        innerDiameterMm: 13,
      }),
    ).toBeUndefined();
    expect(
      invalidBore({
        outerDiameterMm: 16,
        wallThicknessMm: 1.5,
        innerDiameterMm: 12,
      }),
    ).toBeDefined();
    // A product that states only two of the three says nothing to disagree with.
    expect(invalidBore({ outerDiameterMm: 16 })).toBeUndefined();
  });

  it('knows a product by name', () => {
    expect(networkProduct('pipe-pex-16x1.5')?.domain).toBe('PLUMBING');
    expect(networkProduct('nowhere')).toBeUndefined();
  });
});

describe('the generic catalogue, now that it is data', () => {
  it('still holds every definition it held as code', () => {
    expect(genericEquipmentCatalog().length).toBe(19);
  });

  it('ties every entry to a family of the nomenclature', () => {
    for (const [definitionId, familyId] of genericEquipmentFamilies())
      expect(family(familyId), definitionId).toBeDefined();
  });

  it('says of every entry where its values come from', () => {
    for (const definition of genericEquipmentCatalog())
      expect(definition.sources.length, definition.id).toBe(
        Object.keys(definition.properties).length,
      );
  });

  it('marks the families it feeds as having generic data', () => {
    for (const familyId of genericEquipmentFamilies().values())
      expect(family(familyId)?.status?.GENERIC_DATA, familyId).toBe('READY');
  });
});
