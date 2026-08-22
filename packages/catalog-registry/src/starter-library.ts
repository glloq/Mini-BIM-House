import { type Material } from '@house-technical-designer/materials';
import {
  materialSnapshot,
  rawGenericMaterialEntries,
} from '@house-technical-designer/materials/catalog';
import { type Assembly } from '@house-technical-designer/assemblies';
import {
  assemblySnapshot,
  rawGenericAssemblyEntries,
} from '@house-technical-designer/assemblies/catalog';
import {
  projectOpeningFromCatalog,
  rawGenericOpeningEntries,
} from '@house-technical-designer/opening-catalog';

/**
 * The library a new project starts with.
 *
 * A blank project used to be handed the whole shelf — fifty-nine materials,
 * thirty-five build-ups and thirty-four menuiseries, none of them chosen by
 * anybody, in a project where nothing is drawn yet. Ninety-two kilobytes per
 * empty project, and the three catalogues in the first payload the browser
 * fetches, because creating a project is something the application must be
 * able to do before anything is loaded.
 *
 * A basket, then, and not the shelf: one build-up per kind of surface a house
 * shell is made of, the materials those build-ups name, and the two
 * menuiseries a first wall gets pierced by. Everything else is picked from the
 * catalogue, which is what a catalogue is for.
 */
export const STARTER_ASSEMBLIES: readonly string[] = [
  'generic-wall-block-external-insulation',
  'generic-partition-stud',
  'generic-floor-slab-on-ground',
  'generic-floor-intermediate-timber',
  'generic-roof-timber-insulated',
  'generic-ceiling-insulated',
];

export const STARTER_OPENINGS: readonly string[] = [
  'generic-window-casement-double',
  'generic-entrance-door',
  'generic-internal-door',
];

/** Why each part of the basket is in it, printed by the generator. */
export const STARTER_REASONS: Readonly<Record<string, string>> = {
  compositions:
    'une par sorte de surface : mur, cloison, dalle, plancher, toiture, plafond',
  matériaux: 'exactement ceux que ces compositions nomment, et rien d’autre',
  menuiseries: 'une fenêtre, une porte d’entrée, une porte intérieure',
};

export interface StarterLibrary {
  readonly materials: readonly Material[];
  readonly assemblies: readonly Assembly[];
  readonly openingTypes: readonly ReturnType<
    typeof projectOpeningFromCatalog
  >[];
}

/**
 * The basket, built from the catalogue.
 *
 * Not shipped as it stands: a script writes it to `data/starter-library.json`
 * and the application reads that file, so that creating a project costs the
 * basket and not the shelf. This function stays the definition of what the
 * basket is, and a gate compares the two.
 */
export function starterLibrary(): StarterLibrary {
  const assemblies = STARTER_ASSEMBLIES.map((id) => {
    const entry = rawGenericAssemblyEntries().find((held) => held.id === id);
    if (entry === undefined)
      throw new RangeError(`la composition ${id} n’est pas au catalogue`);
    return assemblySnapshot(entry);
  });
  // The materials are not chosen: they are what the build-ups are made of. A
  // starter library naming a layer nothing ships is a wall that draws, costs
  // nothing and insulates nothing.
  const needed = new Set<string>(
    assemblies.flatMap(({ layers }) =>
      layers.map(({ materialId }) => String(materialId)),
    ),
  );
  const materials = rawGenericMaterialEntries()
    .filter(({ id }) => needed.has(id))
    .map(materialSnapshot);
  const missing = [...needed].filter(
    (id) => !materials.some((material) => material.id === id),
  );
  if (missing.length > 0)
    throw new RangeError(
      `matériaux absents du catalogue : ${missing.join(', ')}`,
    );
  const openingTypes = STARTER_OPENINGS.map((id) => {
    const entry = rawGenericOpeningEntries().find((held) => held.id === id);
    if (entry === undefined)
      throw new RangeError(`la menuiserie ${id} n’est pas au catalogue`);
    return projectOpeningFromCatalog(entry);
  });
  return { materials, assemblies, openingTypes };
}
