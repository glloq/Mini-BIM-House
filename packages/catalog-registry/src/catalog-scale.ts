import type { DataRegistry } from '@house-technical-designer/technical-types';
import type { CatalogSummary } from './catalog-index.js';
import { DEFAULT_LIFECYCLE } from './catalog-identity.js';
import { capabilitiesOf } from './capabilities.js';
import { FAMILY_REGISTRY, family, schemaOfFamily } from './registry.js';
import { portRequirement } from '@house-technical-designer/technical-types';
import type { PropertyValue } from './property-schemas.js';

/**
 * A catalogue the size the real one will be, made up on the spot.
 *
 * Everything in this repository is measured against nineteen entries, sixteen
 * materials and sixty-six tubes. The decisions that matter — a summary rather
 * than an entry, an index rather than a scan, a repository that can fetch
 * later — are decisions about ten thousand, and a design defended only at a
 * hundred is a design nobody has tested the argument for.
 *
 * Deterministic on purpose: the same count gives the same catalogue every
 * time, so a benchmark compares two versions of the code rather than two
 * draws. Nothing here is random, and nothing here is shipped — it exists to be
 * measured against.
 */
export function syntheticSummaries(count: number): readonly CatalogSummary[] {
  const families = FAMILY_REGISTRY.filter(
    (entry) => entry.registry === 'EQUIPMENT' || entry.registry === 'MATERIAL',
  );
  const words = [
    'compact',
    'mural',
    'encastré',
    'à condensation',
    'triphasé',
    'réversible',
    'à haute température',
    'silencieux',
  ];
  return Array.from({ length: count }, (_, index) => {
    const owner = families[index % families.length]!;
    const registry: DataRegistry = owner.registry;
    const id = `synthetic-${owner.id.toLowerCase().replace(/_/gu, '-')}-${index}`;
    const version = `1.${Math.floor(index / 100)}.${index % 100}`;
    return {
      ref: { registry, id, version },
      registry,
      id,
      version,
      label: `${owner.label} ${words[index % words.length]!} ${index}`,
      familyId: owner.id,
      ...(owner.category === undefined ? {} : { category: owner.category }),
      domain: owner.domain,
      lifecycle: DEFAULT_LIFECYCLE,
      capabilities: capabilitiesOf(owner),
      // One entry in eleven states a maker, which is roughly what an imported
      // catalogue looks like beside a generic one.
      ...(index % 11 === 0 ? { manufacturer: `Fabricant ${index % 37}` } : {}),
    };
  });
}

/**
 * Entries the gate can be run over, at any size.
 *
 * They belong to real families and carry the properties those families
 * declare, so passing the gate means something: a generator producing entries
 * the gate ignores would measure the speed of doing nothing.
 */
export interface SyntheticEntry {
  readonly id: string;
  readonly familyId: string;
  readonly version: string;
  readonly properties: Readonly<Record<string, PropertyValue>>;
  readonly ports: readonly {
    readonly id: string;
    readonly portTypeId: string;
  }[];
  readonly provenance: { readonly type: string; readonly reference: string };
}

/** A value the property's own type and range accept. */
function plausible(property: {
  readonly type: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly options?: readonly string[];
}): PropertyValue | undefined {
  switch (property.type) {
    case 'number':
    case 'integer': {
      const low = property.minimum ?? 1;
      const high = property.maximum ?? low + 100;
      const middle = (low + high) / 2;
      return property.type === 'integer' ? Math.round(middle) : middle;
    }
    case 'boolean':
      return true;
    case 'enum':
      return property.options?.[0];
    case 'string':
      return property.options?.[0] ?? 'générique';
    default:
      // A spectrum needs bands, and a generator inventing an acoustic
      // signature would be inventing data rather than exercising a gate.
      return undefined;
  }
}

export function syntheticEntries(count: number): readonly SyntheticEntry[] {
  return syntheticSummaries(count).map((entry) => {
    const schema = schemaOfFamily(entry.familyId ?? '');
    const properties: Record<string, PropertyValue> = {};
    for (const property of schema?.properties ?? []) {
      if (property.source !== 'DEFINITION' || property.required !== true)
        continue;
      const value = plausible(property);
      if (value !== undefined) properties[property.key] = value;
    }
    // What the family says such a thing is always connected by. A generator
    // that skipped this would produce ten thousand entries the gate rejects
    // for one reason, and measure that reason rather than the catalogue.
    const owner = family(entry.familyId ?? '');
    const ports = (owner?.ports ?? []).flatMap((candidate, index) => {
      const requirement = portRequirement(candidate);
      const kind = requirement.anyOf[0];
      return kind === undefined
        ? []
        : Array.from(
            { length: Math.max(1, requirement.minCount) },
            (_, at) => ({
              id: `port-${index}-${at}`,
              portTypeId: kind,
            }),
          );
    });
    return {
      id: entry.id,
      familyId: entry.familyId ?? '',
      version: entry.version,
      properties,
      ports,
      provenance: {
        type: 'GENERIC',
        reference: 'Catalogue de mesure — ne provient d’aucun fabricant',
      },
    };
  });
}
