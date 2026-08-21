import electrical from '../data/equipment/electrical/generic.json' with { type: 'json' };
import heating from '../data/equipment/heating/generic.json' with { type: 'json' };
import lighting from '../data/equipment/lighting/generic.json' with { type: 'json' };
import plumbing from '../data/equipment/plumbing/generic.json' with { type: 'json' };
import rainwater from '../data/equipment/rainwater/generic.json' with { type: 'json' };
import solar from '../data/equipment/solar/generic.json' with { type: 'json' };
import storage from '../data/equipment/storage/generic.json' with { type: 'json' };
import ventilation from '../data/equipment/ventilation/generic.json' with { type: 'json' };
import type {
  EquipmentDefinition,
  EquipmentPropertySource,
  EquipmentPropertyValue,
  PropertySourceType,
} from './types.js';

/**
 * Reference for every value in the generic catalogue.
 *
 * These are indicative sizes and performances for early design. They are not
 * manufacturer data, and a definition that needs to represent a real product
 * must be created as `PRODUCT` with its own declaration.
 */
export const GENERIC_EQUIPMENT_REFERENCE =
  'Valeurs de dimensionnement génériques — ne provient d’aucun fabricant';

/**
 * One catalogue entry as its data file states it.
 *
 * The catalogue was a list of objects written in TypeScript, which works at
 * fifteen entries. At five hundred it becomes a file nobody reads, that two
 * people cannot edit at once, and that no tool can check: a folder of JSON, one
 * file per trade, can be filled by several people and validated by a script.
 * What stays in TypeScript is the shape an entry must have.
 */
interface CatalogFile {
  readonly definitions: readonly RawCatalogEntry[];
}

/**
 * One entry exactly as its file states it, before anything has been checked.
 *
 * The types say `PropertySourceType`; a JSON file says `string`, and the
 * difference between the two is what validation earns. The loader used to
 * close that gap on its own — a provenance of `GENRIC` became `OTHER` on the
 * way in — so a typo was repaired into a valid value before any gate could see
 * it. The gate now reads this, and the normalised object is what comes out the
 * other side.
 */
export type RawCatalogEntry = Omit<
  EquipmentDefinition,
  'catalogKind' | 'sources' | 'provenance'
> & {
  readonly provenance: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
};

const FILES = [
  heating,
  ventilation,
  plumbing,
  electrical,
  lighting,
  solar,
  storage,
  rainwater,
] as readonly CatalogFile[];

const SOURCE_TYPES: readonly PropertySourceType[] = [
  'GENERIC',
  'STANDARD',
  'MANUFACTURER',
  'DATABASE',
  'USER',
  'CALCULATED',
  'OTHER',
];

/**
 * What a file says about where its values come from, kept as it says it.
 *
 * The loader used to write `STANDARD` over everything, so a value declared
 * `GENERIC` in the file became a standard figure at runtime — the one thing
 * the traceability rule exists to prevent. A provenance this list does not
 * hold becomes `OTHER`, which says « something else » rather than promoting it.
 */
function sourceTypeOf(declared: string): PropertySourceType {
  return SOURCE_TYPES.includes(declared as PropertySourceType)
    ? (declared as PropertySourceType)
    : 'OTHER';
}

function sources(
  properties: Readonly<Record<string, EquipmentPropertyValue>>,
  provenance: CatalogFile['definitions'][number]['provenance'],
): readonly EquipmentPropertySource[] {
  return Object.keys(properties).map((property) => ({
    property,
    sourceType: sourceTypeOf(provenance.type),
    reference: provenance.reference,
    ...(provenance.url === undefined ? {} : { url: provenance.url }),
    ...(provenance.validAt === undefined
      ? {}
      : { validAt: provenance.validAt }),
  }));
}

/**
 * Every entry as the files state it, unchecked and unrepaired.
 *
 * What the gate reads. Anything that normalises before validating is a gate
 * that inspects its own repairs.
 */
export function rawGenericEquipmentEntries(): readonly RawCatalogEntry[] {
  return FILES.flatMap(({ definitions }) => definitions);
}

/** Builds the generic equipment catalogue shipped with the application. */
export function genericEquipmentCatalog(): readonly EquipmentDefinition[] {
  return rawGenericEquipmentEntries().map(({ provenance, ...entry }) => ({
    ...entry,
    catalogKind: 'GENERIC' as const,
    // The version is the file's, never the loader's. Written here as `1.0.0`
    // for every entry, a fiche corrected to 1.1.0 in its own JSON would have
    // gone on announcing 1.0.0 at runtime — and every project pinning it would
    // have pinned a version that no longer meant anything.
    version: entry.version,
    provenance: {
      ...provenance,
      type: sourceTypeOf(provenance.type),
    },
    sources: sources(entry.properties, provenance),
  }));
}

/** Looks a generic definition up by identifier. */
export function genericEquipment(id: string): EquipmentDefinition | undefined {
  return genericEquipmentCatalog().find((definition) => definition.id === id);
}
