import { describe, expect, it } from 'vitest';
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import { PROJECT_CALCULATION_MODULE_IDS } from '@house-technical-designer/calculation-adapters';
import {
  genericEquipment,
  genericEquipmentCatalog,
  rawGenericEquipmentEntries,
} from '@house-technical-designer/equipment-catalog';
import {
  DATA_REGISTRIES,
  FAMILY_REGISTRY,
  CONNECTION_CLASSES,
  PORT_MEDIA,
  PORT_SERVICES,
  PORT_TYPES,
  connectionRefusal,
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
  portType,
  productsOfFamily,
  validateCatalog,
  validateNetworkProducts,
  portsConnect,
  propertySchema,
  schemaOfFamily,
  validateProperties,
  validateFamily,
  familyReviews,
  familyStatus,
  MEASURED_AXES,
  validateProvenance,
  PROPERTY_DEFINITION_REGISTRY,
  propertyDefinition,
  validatePropertyDefinitions,
  validatePropertySchema,
  validateRegistry,
  validateSchemas,
  CLEARANCE_ZONES,
  clearanceConflicts,
  clearanceRefusal,
  clearanceZones,
  clearancesShare,
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

  it.each([
    ['WATER_COLD', 'WATER_HOT'],
    ['WATER_COLD', 'WATER_NON_POTABLE'],
    ['WATER_HOT', 'WATER_RECIRCULATION'],
    ['DRAIN_VENT', 'AIR_SUPPLY'],
    ['AIR_EXHAUST', 'COMBUSTION_AIR'],
    ['AIR_SUPPLY', 'AIR_EXTRACT'],
    ['PV_DC', 'BATTERY_DC'],
    ['HEATING_FLOW', 'PRIMARY_RETURN'],
    ['REFRIGERANT_LIQUID', 'REFRIGERANT_GAS'],
    ['WASTEWATER', 'SOILWATER'],
    ['RAINWATER_OUT', 'RAINWATER_OVERFLOW_INLET'],
  ])('refuses %s ↔ %s, which share a medium and nothing else', (from, to) => {
    // Deciding on the medium alone let cold water reach hot water and a
    // photovoltaic string reach a battery — connections that cannot exist,
    // offered by a tool meant to check connections.
    expect(portsConnect(from, to), `${from} ↔ ${to}`).toBe(false);
    expect(connectionRefusal(from, to)).toBeDefined();
  });

  it('sends a heating flow to a return and never to another flow', () => {
    expect(portsConnect('HEATING_FLOW', 'HEATING_RETURN')).toBe(true);
    expect(portsConnect('HEATING_FLOW', 'HEATING_FLOW')).toBe(false);
  });

  it('joins what serves the same thing through the same fitting', () => {
    expect(portsConnect('WATER_COLD', 'WATER_COLD')).toBe(true);
    expect(portsConnect('AIR_SUPPLY', 'AIR_SUPPLY_INLET')).toBe(true);
    expect(portsConnect('WASTEWATER', 'WASTEWATER_INLET')).toBe(true);
    expect(portsConnect('FLUE_GAS', 'FLUE_GAS_INLET')).toBe(true);
  });

  it('says why, in words, rather than only saying no', () => {
    expect(connectionRefusal('WATER_COLD', 'WATER_HOT')).toContain(
      'ne sont pas le même service',
    );
    expect(connectionRefusal('WATER_COLD', 'ELECTRICAL_AC')).toContain(
      'ne rejoint pas',
    );
    expect(connectionRefusal('WATER_COLD', 'IMAGINARY')).toContain(
      'n’est pas un type de port connu',
    );
  });

  it('says nothing about a port nobody declared', () => {
    expect(portsConnect('WATER_COLD', 'IMAGINARY')).toBe(false);
  });

  it('describes every port fully, so nothing decides by default', () => {
    for (const type of PORT_TYPES) {
      expect(type.label.length, type.id).toBeGreaterThan(0);
      expect(PORT_MEDIA, type.id).toContain(type.medium);
      expect(PORT_SERVICES, type.id).toContain(type.service);
      expect(CONNECTION_CLASSES, type.id).toContain(type.connectionClass);
    }
  });

  it('gives every service somewhere to go', () => {
    // A service whose ports can never be joined to anything is a service that
    // cannot be routed: either a facing port is missing, or the service is.
    for (const type of PORT_TYPES) {
      const reachable = PORT_TYPES.some(
        (other) => other.id !== type.id && portsConnect(type.id, other.id),
      );
      const selfJoining = portsConnect(type.id, type.id);
      expect(reachable || selfJoining, type.id).toBe(true);
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
  const reviews = familyReviews({
    symbols: KNOWN.symbols,
    entries: genericEquipmentCatalog(),
  });

  it('counts every family on every axis', () => {
    const counts = axisCounts(reviews);
    expect(counts).toHaveLength(STATUS_AXES.length);
    for (const { axis, counts: byValue } of counts) {
      const total = Object.values(byValue).reduce((sum, one) => sum + one, 0);
      expect(total, axis).toBe(FAMILY_REGISTRY.length);
    }
  });

  it('says how far each trade has got, and none of it is finished', () => {
    const progress = domainProgress(reviews);
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
    const pending = pendingOfWave(reviews, 1);
    expect(pending.length).toBeGreaterThan(0);
    // Least advanced first: the queue starts where there is most to do.
    const scores = pending.map(({ status }) => completeness(status));
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

describe('the generic catalogue, checked against its own families', () => {
  const symbols = KNOWN.symbols;

  it('still holds every definition it held as code', () => {
    expect(genericEquipmentCatalog().length).toBe(19);
  });

  it('agrees with the family and the schema each entry names', () => {
    // The battery pack named `BATTERY_DEVICE` and carried `maxChargePowerKW`
    // where the schema says `maximumChargePowerW`. Both files were valid on
    // their own, the family said GENERIC_DATA: READY, and the integration was
    // green — because nothing compared the two.
    expect(validateCatalog(rawGenericEquipmentEntries(), symbols)).toEqual([]);
  });

  it('ties every entry to a family of the nomenclature', () => {
    for (const definition of genericEquipmentCatalog())
      expect(family(definition.familyId), definition.id).toBeDefined();
  });

  it('gives every port of every entry a kind the registry knows', () => {
    for (const definition of genericEquipmentCatalog())
      for (const port of definition.ports)
        expect(
          portType(port.portTypeId),
          `${definition.id}/${port.id}`,
        ).toBeDefined();
  });

  it('keeps the provenance the file states, generic included', () => {
    // The loader used to write STANDARD over everything, so a value declared
    // GENERIC became a standard figure at runtime.
    for (const definition of genericEquipmentCatalog())
      for (const source of definition.sources)
        expect(source.sourceType, definition.id).toBe('GENERIC');
  });

  it('measures the families it feeds rather than believing them', () => {
    // Seventy-one families claimed a plan symbol was ready and not one of them
    // named a symbol. A status that can be measured is measured, and a family
    // nobody has written an entry for cannot claim otherwise.
    const known = { symbols, entries: genericEquipmentCatalog() };
    for (const definition of genericEquipmentCatalog()) {
      const status = familyStatus(definition.familyId, known);
      expect(status.GENERIC_DATA, definition.familyId).toBe('READY');
      expect(status.PORTS, definition.familyId).toBe('VALIDATED');
      // Not TESTS: a fiche that passes the gate is what GENERIC_DATA says,
      // and calling it « tested » was the same measurement wearing a stronger
      // word. A family is tested when a fixture is made of it.
      expect(status.TESTS, definition.familyId).toBe('NONE');
      expect(status.PLAN_SYMBOL, definition.familyId).toBe('READY');
    }
    const untouched = familyStatus('FLUE_PIPE', known);
    expect(untouched.GENERIC_DATA).toBe('NONE');
    expect(untouched.TESTS).toBe('NONE');
    expect(untouched.PORTS).not.toBe('VALIDATED');
  });

  it('refuses a family that writes a measured axis down by hand', () => {
    const [entry] = FAMILY_REGISTRY;
    expect(
      validateFamily(
        { ...entry!, status: { PORTS: 'READY' } },
        {
          symbols: KNOWN.symbols,
          propertySchemas: new Set(
            PROPERTY_SCHEMA_REGISTRY.map(({ family: id }) => id),
          ),
          calculators: KNOWN.calculators,
        },
      ).map(({ message }) => message),
    ).toContain('is measured from the registries and must not be written down');
  });

  it('leaves no measured axis declared anywhere in the data', () => {
    for (const entry of FAMILY_REGISTRY)
      for (const axis of MEASURED_AXES)
        expect(entry.status?.[axis], `${entry.id} ${axis}`).toBeUndefined();
  });

  it('refuses an entry whose properties are not its family’s', () => {
    const [entry] = genericEquipmentCatalog();
    const wrong = {
      ...entry!,
      properties: { ...entry!.properties, inventedField: 1 },
    };
    expect(validateCatalog([wrong], symbols).length).toBeGreaterThan(0);
  });

  it('refuses an entry missing a connection its family declares', () => {
    const pump = genericEquipment('generic-air-water-heat-pump')!;
    const crippled = { ...pump, ports: [] };
    expect(
      validateCatalog([crippled], symbols)
        .map(({ message }) => message)
        .join(' '),
    ).toContain('which this entry does not declare');
  });
});

describe('the schemas everything else is measured against', () => {
  it('agrees with itself', () => {
    // A schema that is wrong is the one thing no entry can reveal, because the
    // entries are checked by it.
    expect(validateSchemas()).toEqual([]);
  });

  it('refuses a key declared twice, which would silently keep the second', () => {
    const defined = () => ({
      id: 'a',
      label: 'A',
      type: 'number' as const,
      unit: 'W',
    });
    expect(
      validatePropertySchema(
        {
          family: 'X',
          properties: [
            { key: 'a', source: 'DEFINITION' },
            { key: 'a', source: 'DEFINITION' },
          ],
        },
        defined,
      ).map(({ message }) => message),
    ).toContain('is declared more than once');
  });

  it('refuses a family naming a property nothing defines', () => {
    // Two hundred and forty-six keys over forty-four schemas had drifted
    // eleven times; a key now means one thing, and a family says which keys it
    // uses rather than inventing one.
    expect(
      validatePropertySchema(
        {
          family: 'X',
          properties: [{ key: 'invented', source: 'DEFINITION' }],
        },
        () => undefined,
      ).map(({ message }) => message),
    ).toContain('names no property this application defines');
  });

  it('refuses a range nothing satisfies and a list of the wrong kind', () => {
    const issues = validatePropertySchema(
      {
        family: 'X',
        properties: [
          { key: 'b', source: 'DEFINITION', minimum: 10, maximum: 1 },
          { key: 'b', source: 'DEFINITION', options: ['x'] },
        ],
      },
      () => ({ id: 'b', label: 'B', type: 'number' as const, unit: 'W' }),
    ).map(({ message }) => message);
    expect(issues).toContain(
      'has a minimum above its maximum, which nothing can satisfy',
    );
    expect(issues).toContain('number values cannot be listed');
  });

  it('refuses a definition whose unit and quantity disagree', () => {
    // A power measured in millimetres is a property nobody can convert and
    // nobody can check.
    expect(
      validatePropertyDefinitions([
        { id: 'a', label: 'A', type: 'number', unit: 'mm', quantity: 'POWER' },
      ]).map(({ message }) => message),
    ).toContain(
      'says it measures POWER and is written in mm, which measures LENGTH',
    );
  });

  it('refuses a unit this application does not write', () => {
    // `KW`, `kw` and `kW` are three spellings of one unit and only one of them
    // is the symbol.
    expect(
      validatePropertyDefinitions([
        { id: 'a', label: 'A', type: 'number', unit: 'KW' },
      ]).map(({ message }) => message),
    ).toContain('KW is not one of the units this application writes');
  });

  it('lets a file written with an older spelling still open', () => {
    // Cleaning up a key is otherwise a choice between breaking every file that
    // used it and never cleaning it up.
    const schema = {
      family: 'X',
      properties: [
        {
          key: 'maxChargePowerKw',
          label: 'Puissance de charge',
          type: 'number' as const,
          unit: 'kW',
          source: 'DEFINITION' as const,
          aliases: ['maxChargePowerKW'],
        },
      ],
    };
    expect(
      validateProperties(schema, { maxChargePowerKW: 2.5 }, 'DEFINITION').map(
        ({ message }) => message,
      ),
    ).toEqual(['maxChargePowerKW is an older spelling of maxChargePowerKw']);
    expect(
      validateProperties(schema, { maxChargePowerKw: 2.5 }, 'DEFINITION'),
    ).toEqual([]);
  });

  it('carries the unit and what it measures down to the form that shows it', () => {
    const schema = propertySchema('BATTERY_DEVICE')!;
    const power = schema.properties.find(
      ({ key }) => key === 'maxChargePowerKW',
    );
    expect(power?.unit).toBe('kW');
    expect(power?.quantity).toBe('POWER');
    expect(power?.label).toBe('Puissance de charge maximale');
  });

  it('defines every key exactly once, for the whole application', () => {
    // `cost` meant a cost, a cost per square metre, a cost per metre and a
    // cost per cubic metre; `pressureDrop` was stored in one schema and
    // derived in another, which is how a derived figure ends up in a file.
    const keys = PROPERTY_DEFINITION_REGISTRY.map(({ id }) => id);
    expect(new Set(keys).size).toBe(keys.length);
    for (const schema of PROPERTY_SCHEMA_REGISTRY)
      for (const property of schema.properties)
        expect(propertyDefinition(property.key), property.key).toBeDefined();
  });

  it('refuses a key defined twice and a number with no unit', () => {
    const issues = validatePropertyDefinitions([
      { id: 'a', label: 'A', type: 'number', unit: 'W' },
      { id: 'a', label: 'A bis', type: 'number', unit: 'W' },
      { id: 'b', label: 'B', type: 'number' },
    ]).map(({ message }) => message);
    expect(issues).toContain('is defined more than once');
    expect(issues).toContain('is a number and states no unit');
  });
});

describe('the room a thing needs around it', () => {
  const placement = {
    objectId: 'pump',
    position: { x: 0, y: 0 },
    elevationMm: 0,
    rotationDeg: 0,
    widthMm: 1000,
    depthMm: 400,
    heightMm: 800,
  };

  it('puts each zone on the side the entry asks for, turned with the object', () => {
    const zone = clearanceZones(placement, [
      { zone: 'AIR_EXHAUST', frontMm: 2000 },
    ]).find(({ zone: kind }) => kind === 'AIR_EXHAUST');
    // Front is the object's own forward direction: at rest it points east, so
    // the exhaust reaches 2.2 m along x and nothing behind.
    expect(Math.max(...zone!.footprint.map(({ x }) => x))).toBeCloseTo(2200);
    expect(Math.min(...zone!.footprint.map(({ x }) => x))).toBeCloseTo(-200);
    const turned = clearanceZones({ ...placement, rotationDeg: 90 }, [
      { zone: 'AIR_EXHAUST', frontMm: 2000 },
    ]).find(({ zone: kind }) => kind === 'AIR_EXHAUST');
    expect(Math.max(...turned!.footprint.map(({ y }) => y))).toBeCloseTo(2200);
  });

  it('measures height from the underside of the thing', () => {
    const zone = clearanceZones(placement, [
      { zone: 'SERVICE', aboveMm: 500, belowMm: 100 },
    ]).find(({ zone: kind }) => kind === 'SERVICE');
    expect(zone!.baseMm).toBe(-100);
    expect(zone!.topMm).toBe(1300);
  });

  it('always draws the volume the thing itself occupies', () => {
    // An object occupies its own dimensions; asking an entry to state that
    // would be asking it to repeat what it already says.
    const physical = clearanceZones(placement, []).find(
      ({ zone }) => zone === 'PHYSICAL',
    );
    expect(physical?.known).toBe(true);
    expect(Math.max(...physical!.footprint.map(({ x }) => x))).toBeCloseTo(200);
    expect(physical?.topMm).toBe(800);
  });

  it('says when a zone is required and nobody has measured it', () => {
    // « Nobody has said » is not « none »: drawing it as zero would put a
    // machine against a wall and call the plan checked.
    const zones = clearanceZones(placement, [], ['MAINTENANCE', 'AIR_INTAKE']);
    expect(zones.filter(({ known }) => !known).map(({ zone }) => zone)).toEqual(
      ['MAINTENANCE', 'AIR_INTAKE'],
    );
  });

  it('never tests a volume nobody has measured', () => {
    const first = clearanceZones(placement, [], ['AIR_EXHAUST']);
    const second = clearanceZones(
      { ...placement, objectId: 'other', position: { x: 5000, y: 0 } },
      [],
      ['AIR_INTAKE'],
    );
    expect(clearanceConflicts([...first, ...second])).toEqual([]);
  });

  it('lets two people share the space in front of two appliances', () => {
    // One person stands there, and never in both at once.
    expect(clearancesShare('MAINTENANCE', 'USAGE')).toBe(true);
    expect(clearancesShare('SERVICE', 'ACCESSIBILITY')).toBe(true);
  });

  it('refuses an intake and an exhaust in the same volume', () => {
    expect(clearanceRefusal('AIR_INTAKE', 'AIR_EXHAUST')).toContain(
      'respirerait',
    );
    expect(clearanceRefusal('AIR_EXHAUST', 'AIR_INTAKE')).toBeDefined();
  });

  it('refuses anything at all inside another object’s own volume', () => {
    for (const zone of CLEARANCE_ZONES)
      expect(clearancesShare('PHYSICAL', zone), zone).toBe(false);
  });

  it('says the same thing whichever way round the pair is asked', () => {
    for (const first of CLEARANCE_ZONES)
      for (const second of CLEARANCE_ZONES)
        expect(clearancesShare(first, second), `${first} / ${second}`).toBe(
          clearancesShare(second, first),
        );
  });

  it('finds two machines breathing each other’s air, and not a machine’s own zones', () => {
    const first = clearanceZones(placement, [
      { zone: 'AIR_EXHAUST', frontMm: 2000 },
      { zone: 'PHYSICAL' },
    ]);
    const second = clearanceZones(
      {
        ...placement,
        objectId: 'other',
        position: { x: 2000, y: 0 },
        rotationDeg: 180,
      },
      [{ zone: 'AIR_INTAKE', frontMm: 2000 }, { zone: 'PHYSICAL' }],
    );
    const conflicts = clearanceConflicts([...first, ...second]);
    expect(conflicts.map(({ message }) => message).join(' ')).toContain(
      'respirerait',
    );
    // Its own volume sits inside its own zones by construction; reporting that
    // would bury the case that matters.
    expect(clearanceConflicts(first)).toEqual([]);
  });

  it('leaves two machines far enough apart alone', () => {
    const first = clearanceZones(placement, [
      { zone: 'AIR_EXHAUST', frontMm: 500 },
    ]);
    const second = clearanceZones(
      { ...placement, objectId: 'other', position: { x: 9000, y: 0 } },
      [{ zone: 'AIR_INTAKE', frontMm: 500 }],
    );
    expect(clearanceConflicts([...first, ...second])).toEqual([]);
  });

  it('leaves two machines on different storeys alone', () => {
    const first = clearanceZones(placement, [
      { zone: 'AIR_EXHAUST', frontMm: 2000 },
    ]);
    const second = clearanceZones(
      { ...placement, objectId: 'other', elevationMm: 3000 },
      [{ zone: 'AIR_INTAKE', frontMm: 2000 }],
    );
    expect(clearanceConflicts([...first, ...second])).toEqual([]);
  });

  it('gives the golden entries real distances rather than a list of names', () => {
    const pump = genericEquipment('generic-air-water-heat-pump')!;
    const exhaust = pump.clearances?.find(({ zone }) => zone === 'AIR_EXHAUST');
    expect(exhaust?.frontMm).toBeGreaterThan(0);
    expect(exhaust?.reason).toBeDefined();
  });
});
