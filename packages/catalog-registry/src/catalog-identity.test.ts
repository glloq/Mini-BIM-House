import { describe, expect, it } from 'vitest';
import {
  CATALOG_CAPABILITIES,
  CATALOG_WAVES,
  DECLARED_CAPABILITIES,
  DERIVED_CAPABILITIES,
  FAMILY_REGISTRY,
  capabilitiesOf,
  catalogRefEquals,
  categoryOfFamily,
  familiesWithCapability,
  familyCapabilities,
  familyHasCapability,
  familyIsOfferable,
  formatCatalogRef,
  genericCatalog,
  isCatalogWave,
  parseCatalogRef,
  validateCapabilities,
  validateCatalogIdentity,
  type CatalogIdentityCandidate,
} from './index.js';
import { rawGenericEquipmentEntries } from '@house-technical-designer/equipment-catalog';

const identity = (
  patch: Partial<CatalogIdentityCandidate> = {},
): CatalogIdentityCandidate => ({
  id: 'generic-air-water-heat-pump',
  registry: 'EQUIPMENT',
  version: '1.1.0',
  label: 'Pompe à chaleur air/eau',
  provenance: { type: 'GENERIC', reference: 'Valeurs génériques' },
  ...patch,
});

describe('one reference, said the same way in every registry', () => {
  it('writes and reads a reference back unchanged', () => {
    const ref = {
      registry: 'EQUIPMENT' as const,
      id: 'generic-wc',
      version: '1.1.0',
    };
    expect(formatCatalogRef(ref)).toBe('EQUIPMENT:generic-wc@1.1.0');
    expect(parseCatalogRef(formatCatalogRef(ref))).toEqual(ref);
    expect(
      catalogRefEquals(parseCatalogRef('EQUIPMENT:generic-wc@1.1.0')!, ref),
    ).toBe(true);
  });

  it('refuses a registry nothing declares, rather than inventing one', () => {
    expect(parseCatalogRef('WIDGETS:generic-wc@1.1.0')).toBeUndefined();
    expect(parseCatalogRef('generic-wc')).toBeUndefined();
    expect(parseCatalogRef('EQUIPMENT:generic-wc')).toBeUndefined();
  });
});

describe('what every record of every registry has to say about itself', () => {
  it('accepts a record that says all of it', () => {
    expect(validateCatalogIdentity(identity())).toEqual([]);
  });

  it('refuses a version that cannot be compared to another', () => {
    expect(validateCatalogIdentity(identity({ version: 'v1' }))).toEqual([
      { path: 'version', message: 'v1 is not a version of the form 1.0.0' },
    ]);
  });

  it('refuses an identifier that admits a second spelling of itself', () => {
    const issues = validateCatalogIdentity(identity({ id: 'Generic_WC' }));
    expect(issues.map(({ path }) => path)).toEqual(['id']);
  });

  it('will not let a record leave service without saying what to use instead', () => {
    expect(
      validateCatalogIdentity(identity({ lifecycle: 'DEPRECATED' })).map(
        ({ path }) => path,
      ),
    ).toEqual(['lifecycle']);
    expect(
      validateCatalogIdentity(
        identity({ lifecycle: 'DEPRECATED', replacedBy: 'generic-wc' }),
      ),
    ).toEqual([]);
    expect(
      validateCatalogIdentity(
        identity({ lifecycle: 'DEPRECATED', retiredReason: 'plus fabriqué' }),
      ),
    ).toEqual([]);
  });

  it('refuses a replacement for a record still in service', () => {
    expect(
      validateCatalogIdentity(identity({ replacedBy: 'generic-wc' })).map(
        ({ path }) => path,
      ),
    ).toEqual(['replacedBy']);
  });

  it('refuses a replacement that does not exist', () => {
    expect(
      validateCatalogIdentity(
        identity({ lifecycle: 'WITHDRAWN', replacedBy: 'generic-nothing' }),
        { records: new Set(['generic-wc']) },
      ).map(({ message }) => message),
    ).toEqual(['unknown record generic-nothing']);
  });

  it('refuses a wave nobody planned for', () => {
    expect(isCatalogWave(9)).toBe(false);
    expect(
      validateCatalogIdentity(identity({ wave: 9 })).map(({ path }) => path),
    ).toEqual(['wave']);
    for (const wave of CATALOG_WAVES) expect(isCatalogWave(wave)).toBe(true);
  });

  it('asks every record where its values come from', () => {
    const { provenance: _dropped, ...without } = identity();
    expect(
      validateCatalogIdentity(without as CatalogIdentityCandidate).map(
        ({ path }) => path,
      ),
    ).toEqual(['provenance']);
  });
});

describe('what may be done with a thing, rather than what it is called', () => {
  it('reads a family’s capabilities from what it already declares', () => {
    const pump = FAMILY_REGISTRY.find(
      ({ id }) => id === 'HEAT_PUMP_AIR_WATER_MONOBLOC',
    )!;
    expect(capabilitiesOf(pump)).toContain('PLACEABLE');
    expect(capabilitiesOf(pump)).toContain('CONNECTABLE');
    expect(capabilitiesOf(pump)).toContain('PERFORMANCE_MAPPED');
    expect(
      familyHasCapability('HEAT_PUMP_AIR_WATER_MONOBLOC', 'CONNECTABLE'),
    ).toBe(true);
  });

  it('refuses a capability written down that is already read', () => {
    expect(
      validateCapabilities({ ports: [{}], capabilities: ['CONNECTABLE'] }).map(
        ({ message }) => message,
      ),
    ).toEqual([
      'CONNECTABLE is read from what the family already declares and must not be written down',
    ]);
  });

  it('refuses a capability the application has no behaviour for', () => {
    expect(
      validateCapabilities({ capabilities: ['TELEPORTABLE'] }).map(
        ({ message }) => message,
      ),
    ).toEqual(['unknown capability TELEPORTABLE']);
  });

  it('divides the closed list between what is read and what is stated', () => {
    expect([...DERIVED_CAPABILITIES, ...DECLARED_CAPABILITIES].sort()).toEqual(
      [...CATALOG_CAPABILITIES].sort(),
    );
  });

  it('finds every family something may be done to, without naming any of them', () => {
    const connectable = familiesWithCapability('CONNECTABLE');
    expect(connectable.length).toBeGreaterThan(100);
    for (const entry of connectable)
      expect(familyCapabilities(entry.id)).toContain('CONNECTABLE');
    // Every network product family carries runs, by being one — nothing had to
    // list them.
    for (const entry of familiesWithCapability('RUN_MATERIAL'))
      expect(entry.registry).toBe('NETWORK_PRODUCT');
  });

  it('says a family in service may be offered and an unknown one may not', () => {
    expect(familyIsOfferable('HEAT_PUMP_AIR_WATER_MONOBLOC')).toBe(true);
    expect(familyIsOfferable('NOTHING_AT_ALL')).toBe(false);
  });
});

describe('one taxonomy, projected rather than restated', () => {
  it('takes the coarse grouping from the family and nowhere else', () => {
    expect(categoryOfFamily('HEAT_PUMP_AIR_WATER_MONOBLOC')).toBe('HEAT_PUMP');
    expect(categoryOfFamily('PV_MODULE')).toBe('PV_MODULE');
    expect(categoryOfFamily('NOTHING_AT_ALL')).toBeUndefined();
  });

  it('leaves no entry stating a kind or a category of its own', () => {
    // `generic-pv-module` said `kind: PHOTOVOLTAIC` beside `category:
    // PV_MODULE`. Both files were valid; nothing compared them.
    for (const entry of rawGenericEquipmentEntries()) {
      expect(entry).not.toHaveProperty('kind');
      expect(entry).not.toHaveProperty('category');
      for (const port of entry.ports) {
        expect(port).not.toHaveProperty('discipline');
        expect(port).not.toHaveProperty('role');
      }
    }
  });

  it('stamps the family’s category on every resolved entry', () => {
    const resolved = genericCatalog();
    expect(resolved).toHaveLength(19);
    for (const entry of resolved)
      expect(entry.category).toBe(categoryOfFamily(entry.familyId));
    expect(
      resolved.find(({ id }) => id === 'generic-pv-module')?.category,
    ).toBe('PV_MODULE');
  });
});
