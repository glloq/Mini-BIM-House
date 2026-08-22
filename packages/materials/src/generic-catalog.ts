import { createMaterial, materialId } from './materials.js';
import generic from '../data/generic.json' with { type: 'json' };
import type {
  Material,
  MaterialProperties,
  MaterialSource,
  MaterialSourceType,
} from './types.js';

/**
 * A small library of generic construction materials, so a new project can draw a
 * wall without the user having to key in physical properties first.
 *
 * It used to be a list of objects written in TypeScript, which works at sixteen
 * entries and stops working at five hundred: nobody reads the file, two people
 * cannot edit it at once, and no gate can check it — the material catalogue was
 * the last of the seven registries still living in code, and it carried a
 * vocabulary of its own that nothing compared to the property registry.
 *
 * What stays in TypeScript is the shape an entry must have and the one table
 * that maps the registry's spelling of a property onto the field name the model
 * uses.
 */
export const GENERIC_MATERIAL_REFERENCE =
  'ISO 10456 typical design values for building materials';

/**
 * One material as its data file states it, before anything has been checked.
 *
 * The strict types say `MaterialSourceType`; a JSON file says `string`, and the
 * difference between the two is what validation earns. Nothing here is
 * repaired on the way in: a provenance the list does not hold has to reach the
 * gate as it was written, or the typo is mended before anything can see it.
 */
export interface RawMaterialEntry {
  readonly id: string;
  readonly familyId: string;
  /**
   * The coarse grouping, as the family states it.
   *
   * Written here too, and checked at the gate to say the same thing. Not a
   * second taxonomy: it is the same snapshot argument as an equipment copy's
   * `allowedHosts` — the interface groups sixteen, or ten thousand, materials
   * on the first screen it draws, and reaching for the five hundred families
   * of the nomenclature to do it would load all of them before anything
   * appears. An echo a gate compares is a snapshot; an echo nothing compares
   * is how `kind` and `category` came to disagree.
   */
  readonly category: string;
  readonly name: string;
  readonly version: string;
  readonly provenance: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
  readonly properties: Readonly<
    Record<string, number | string | boolean | Readonly<Record<string, number>>>
  >;
  readonly sources?: readonly {
    readonly property: string;
    readonly sourceType: string;
    readonly reference: string;
  }[];
}

interface CatalogFile {
  readonly formatVersion: string;
  readonly materials: readonly RawMaterialEntry[];
}

/**
 * The registry's name for a property, and the model's field for it.
 *
 * Two vocabularies for one quantity: the property registry calls it
 * `thermalConductivity`, `Material` stores it as `lambdaWmK`. The data file
 * speaks the registry's language — it is the one the gate, the schemas and the
 * performance maps all speak — and this table is the single, explicit place
 * where the two meet. The model keeps its own names because they are in every
 * project file already written; folding them together needs a format
 * migration, which is a decision of its own.
 */
const MODEL_FIELD: Readonly<Record<string, string>> = {
  thermalConductivity: 'lambdaWmK',
  density: 'densityKgM3',
  specificHeat: 'specificHeatJKgK',
  vaporResistanceFactor: 'mu',
  emissivity: 'emissivity',
  acousticAbsorption: 'acousticAbsorption',
};

const SOURCE_TYPES: readonly MaterialSourceType[] = [
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
 * A provenance this list does not hold becomes `OTHER`, which says « something
 * else » rather than promoting it to a standard's declared figure.
 */
function sourceTypeOf(declared: string): MaterialSourceType {
  return SOURCE_TYPES.includes(declared as MaterialSourceType)
    ? (declared as MaterialSourceType)
    : 'OTHER';
}

/** Every entry as the file states it, unchecked and unrepaired. */
export function rawGenericMaterialEntries(): readonly RawMaterialEntry[] {
  return (generic as CatalogFile).materials;
}

/** What the catalogue file itself is: its own shape has a version too. */
export const GENERIC_MATERIAL_FORMAT_VERSION = (generic as CatalogFile)
  .formatVersion;

function propertiesOf(entry: RawMaterialEntry): MaterialProperties {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry.properties))
    // A key the table does not know is kept under its own name rather than
    // dropped: the gate reports it, and dropping it would hide the very thing
    // that is wrong.
    properties[MODEL_FIELD[key] ?? key] = value;
  return properties as MaterialProperties;
}

function sourcesOf(entry: RawMaterialEntry): readonly MaterialSource[] {
  const stated = new Map(
    (entry.sources ?? []).map((source) => [source.property, source]),
  );
  return Object.keys(entry.properties).map((key) => {
    const own = stated.get(key);
    const field: string = MODEL_FIELD[key] ?? key;
    return own === undefined
      ? {
          property: field,
          sourceType: sourceTypeOf(entry.provenance.type),
          reference: entry.provenance.reference,
        }
      : {
          property: field,
          sourceType: sourceTypeOf(own.sourceType),
          reference: own.reference,
        };
  });
}

/**
 * Builds the generic catalogue. A fresh array is returned each time so callers
 * can copy entries into a project without sharing mutable references.
 */
export function genericMaterialCatalog(): readonly Material[] {
  return rawGenericMaterialEntries().map((entry) =>
    createMaterial({
      id: materialId(entry.id),
      name: entry.name,
      kind: 'GENERIC',
      category: entry.category,
      properties: propertiesOf(entry),
      sources: sourcesOf(entry),
    }),
  );
}

/** Looks a catalogue entry up by identifier. */
export function genericMaterial(id: string): Material | undefined {
  return genericMaterialCatalog().find((material) => material.id === id);
}

/** The categories the shipped materials fall into, for a filter menu. */
export function genericMaterialCategories(): readonly string[] {
  return [
    ...new Set(rawGenericMaterialEntries().map(({ category }) => category)),
  ].sort();
}

/** The family of the master nomenclature one generic material belongs to. */
export function genericMaterialFamily(id: string): string | undefined {
  return rawGenericMaterialEntries().find((entry) => entry.id === id)?.familyId;
}
