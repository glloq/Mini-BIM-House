import type { FamilyDefinition } from './families.js';
import {
  validateProperties,
  type PropertySchema,
  type PropertyValue,
} from './property-schemas.js';
import { validateProvenance, type ProvenanceCandidate } from './provenance.js';
import { hasCapability } from './capabilities.js';

/**
 * A material as its data file states it, before anything has been checked.
 *
 * The material catalogue was the last of the seven registries still living in
 * TypeScript, and the only one no gate had ever read: a coefficient of 1,4
 * where absorption stops at 1, a density in the wrong unit, a family that does
 * not exist — none of it could be reported, because nothing compared the file
 * to anything.
 */
export interface MaterialEntryCandidate {
  readonly id: string;
  readonly familyId: string;
  readonly category?: string;
  readonly name: string;
  readonly version?: string;
  readonly properties: Readonly<Record<string, PropertyValue>>;
  readonly provenance?: ProvenanceCandidate;
  readonly sources?: readonly {
    readonly property: string;
    readonly sourceType: string;
    readonly reference: string;
  }[];
}

/** An opening as its data file states it, before anything has been checked. */
export interface OpeningEntryCandidate {
  readonly id: string;
  readonly familyId: string;
  readonly category?: string;
  readonly name: string;
  readonly version?: string;
  readonly properties: Readonly<Record<string, PropertyValue>>;
  readonly provenance?: ProvenanceCandidate;
  readonly manufacturer?: string;
}

/** A build-up as its data file states it, before anything has been checked. */
export interface AssemblyEntryCandidate {
  readonly id: string;
  readonly familyId: string;
  readonly category?: string;
  readonly name: string;
  readonly version?: string;
  readonly provenance?: ProvenanceCandidate;
  readonly layers: readonly {
    readonly id: string;
    readonly materialId: string;
    readonly thicknessM: number;
    readonly role?: string;
  }[];
}

export interface MaterialIssue {
  readonly entryId: string;
  readonly path: string;
  readonly message: string;
}

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

export interface MaterialKnowledge {
  readonly family: (id: string) => FamilyDefinition | undefined;
  readonly schema: (id: string) => PropertySchema | undefined;
}

/**
 * Everything wrong with one material, measured against the family it claims.
 *
 * The same gate the equipment catalogue goes through, asking the same
 * questions: does the family exist, does it hold the properties this entry
 * states, are they in range, and does the entry say where its figures come
 * from. Sixteen entries can be proof-read by eye; five hundred cannot, and the
 * point of writing them down as data was to stop having to.
 */
export function validateMaterialEntry(
  entry: MaterialEntryCandidate,
  known: MaterialKnowledge,
): readonly MaterialIssue[] {
  const issues: MaterialIssue[] = [];
  const at = (path: string, message: string) =>
    issues.push({ entryId: entry.id, path, message });
  if (entry.id.trim() === '') at('id', 'must not be empty');
  if (entry.name.trim() === '') at('name', 'must not be empty');
  if (entry.version === undefined) at('version', 'must state a version');
  else if (!SEMVER.test(entry.version))
    at('version', `${entry.version} is not a version of the form 1.0.0`);

  const family = known.family(entry.familyId);
  if (family === undefined) {
    at('familyId', `unknown family ${entry.familyId}`);
    return issues;
  }
  if (family.registry !== 'MATERIAL')
    at('familyId', `${family.id} is not a material family`);
  // Which is what makes it usable as a layer of a build-up at all.
  if (!hasCapability(family, 'LAYERED'))
    at('familyId', `${family.id} cannot be a layer of an assembly`);
  if (family.category === undefined)
    at('familyId', `${family.id} has entries and states no category`);
  // The entry carries the family's grouping so that a screen can sort ten
  // thousand materials without loading five hundred families to do it. It is a
  // snapshot, which is only true while something compares the two.
  else if (entry.category === undefined)
    at('category', `must carry ${family.id}'s category, ${family.category}`);
  else if (entry.category !== family.category)
    at(
      'category',
      `says ${entry.category} where ${family.id} says ${family.category}`,
    );
  const schema =
    family.propertySchema === undefined
      ? undefined
      : known.schema(family.propertySchema);
  if (family.propertySchema !== undefined && schema === undefined)
    at(
      'familyId',
      `${family.id} names an unknown schema ${family.propertySchema}`,
    );
  if (schema !== undefined)
    for (const issue of validateProperties(
      schema,
      entry.properties,
      'DEFINITION',
    ))
      at(`properties/${issue.path}`, issue.message);

  // A figure whose own source differs from the entry's says so; a source for a
  // property the entry does not state is a sentence about nothing.
  for (const [index, source] of (entry.sources ?? []).entries()) {
    if (entry.properties[source.property] === undefined)
      at(`sources/${index}`, `${source.property} is sourced and not stated`);
    for (const issue of validateProvenance(
      { type: source.sourceType, reference: source.reference },
      `sources/${index}`,
    ))
      at(issue.path, issue.message);
  }
  for (const issue of validateProvenance(entry.provenance))
    at(issue.path, issue.message);
  return issues;
}

/**
 * Everything wrong with one build-up, measured against its family and the
 * materials it is made of.
 *
 * A layer naming a material nothing ships is the defect that matters: it draws
 * a wall, it costs nothing, it insulates nothing, and every calculation reading
 * it quietly skips a layer.
 */
export function validateAssemblyEntry(
  entry: AssemblyEntryCandidate,
  known: MaterialKnowledge & { readonly materials: ReadonlySet<string> },
): readonly MaterialIssue[] {
  const issues: MaterialIssue[] = [];
  const at = (path: string, message: string) =>
    issues.push({ entryId: entry.id, path, message });
  if (entry.id.trim() === '') at('id', 'must not be empty');
  if (entry.name.trim() === '') at('name', 'must not be empty');
  if (entry.version === undefined) at('version', 'must state a version');
  else if (!SEMVER.test(entry.version))
    at('version', `${entry.version} is not a version of the form 1.0.0`);

  const family = known.family(entry.familyId);
  if (family === undefined) {
    at('familyId', `unknown family ${entry.familyId}`);
  } else {
    if (family.registry !== 'ASSEMBLY')
      at('familyId', `${family.id} is not an assembly family`);
    if (family.category === undefined)
      at('familyId', `${family.id} has entries and states no category`);
    else if (entry.category === undefined)
      at('category', `must carry ${family.id}'s category, ${family.category}`);
    else if (entry.category !== family.category)
      at(
        'category',
        `says ${entry.category} where ${family.id} says ${family.category}`,
      );
  }

  if (entry.layers.length === 0) at('layers', 'a build-up has layers');
  const seen = new Set<string>();
  for (const [index, layer] of entry.layers.entries()) {
    const where = `layers/${index}`;
    if (seen.has(layer.id)) at(where, `${layer.id} is declared more than once`);
    seen.add(layer.id);
    if (!known.materials.has(layer.materialId))
      at(`${where}/materialId`, `unknown material ${layer.materialId}`);
    if (!Number.isFinite(layer.thicknessM) || layer.thicknessM <= 0)
      at(
        `${where}/thicknessM`,
        'must be a thickness in metres, greater than zero',
      );
    // Metres, and the file says so in its name. A layer of 140 would be a
    // hundred and forty metres of polystyrene, and would read as valid.
    else if (layer.thicknessM > 2)
      at(
        `${where}/thicknessM`,
        `${layer.thicknessM} m is thicker than any layer of a building; thicknesses are in metres`,
      );
  }
  for (const issue of validateProvenance(entry.provenance))
    at(issue.path, issue.message);
  return issues;
}

/**
 * Everything wrong with one opening, measured against the family it claims.
 *
 * The pointer was there and the catalogue was not: `Opening.definitionId`
 * named an entry, thirty-four families of opening were declared, and nothing
 * shipped one — so every window in every project had its Uw typed in by hand
 * or was counted as an unknown.
 */
export function validateOpeningEntry(
  entry: OpeningEntryCandidate,
  known: MaterialKnowledge,
): readonly MaterialIssue[] {
  const issues: MaterialIssue[] = [];
  const at = (path: string, message: string) =>
    issues.push({ entryId: entry.id, path, message });
  if (entry.id.trim() === '') at('id', 'must not be empty');
  if (entry.name.trim() === '') at('name', 'must not be empty');
  if (entry.version === undefined) at('version', 'must state a version');
  else if (!SEMVER.test(entry.version))
    at('version', `${entry.version} is not a version of the form 1.0.0`);

  const family = known.family(entry.familyId);
  if (family === undefined) {
    at('familyId', `unknown family ${entry.familyId}`);
    return issues;
  }
  if (family.registry !== 'OPENING')
    at('familyId', `${family.id} is not an opening family`);
  if (family.category === undefined)
    at('familyId', `${family.id} has entries and states no category`);
  else if (entry.category === undefined)
    at('category', `must carry ${family.id}'s category, ${family.category}`);
  else if (entry.category !== family.category)
    at(
      'category',
      `says ${entry.category} where ${family.id} says ${family.category}`,
    );

  const schema =
    family.propertySchema === undefined
      ? undefined
      : known.schema(family.propertySchema);
  if (family.propertySchema !== undefined && schema === undefined)
    at(
      'familyId',
      `${family.id} names an unknown schema ${family.propertySchema}`,
    );
  if (schema !== undefined)
    for (const issue of validateProperties(
      schema,
      entry.properties,
      'DEFINITION',
    ))
      at(`properties/${issue.path}`, issue.message);

  // A window that pierces a wall has to say how big the hole is; a shutter
  // fitted over one does not, and asking it would be asking the wrong object.
  if (hasCapability(family, 'PIERCING')) {
    const uw = entry.properties.uw;
    if (typeof uw !== 'number')
      at(
        'properties/uw',
        'an opening in the envelope states the transmittance its datasheet gives, which no stack of layers reproduces',
      );
  }

  for (const issue of validateProvenance(entry.provenance))
    at(issue.path, issue.message);
  return issues;
}
