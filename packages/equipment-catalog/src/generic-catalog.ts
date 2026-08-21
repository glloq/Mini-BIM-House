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
  readonly definitions: readonly (Omit<
    EquipmentDefinition,
    'catalogKind' | 'version' | 'sources'
  > & {
    /** The family of the master nomenclature this entry is an entry of. */
    readonly familyId: string;
    readonly provenance: { readonly type: string; readonly reference: string };
  })[];
}

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

function sources(
  properties: Readonly<Record<string, EquipmentPropertyValue>>,
  reference: string,
): readonly EquipmentPropertySource[] {
  return Object.keys(properties).map((property) => ({
    property,
    sourceType: 'STANDARD' as const,
    reference,
  }));
}

/** Builds the generic equipment catalogue shipped with the application. */
export function genericEquipmentCatalog(): readonly EquipmentDefinition[] {
  return FILES.flatMap(({ definitions }) =>
    definitions.map(({ provenance, familyId: _family, ...entry }) => ({
      ...entry,
      catalogKind: 'GENERIC' as const,
      version: '1.0.0',
      sources: sources(entry.properties, provenance.reference),
    })),
  );
}

/** Which family of the nomenclature each generic entry belongs to. */
export function genericEquipmentFamilies(): ReadonlyMap<string, string> {
  return new Map(
    FILES.flatMap(({ definitions }) =>
      definitions.map(({ id, familyId }) => [id, familyId] as const),
    ),
  );
}

/** Looks a generic definition up by identifier. */
export function genericEquipment(id: string): EquipmentDefinition | undefined {
  return genericEquipmentCatalog().find((definition) => definition.id === id);
}
