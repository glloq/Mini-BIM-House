import type { Material } from '@house-technical-designer/materials';
import type { Assembly } from '@house-technical-designer/assemblies';
import type { OpeningDefinition } from '@house-technical-designer/core-domain';
import held from '../data/starter-library.json' with { type: 'json' };

/**
 * The basket a new project starts with, as data.
 *
 * Its own module, importing nothing but the file: the barrel of this package
 * carries five hundred and twenty-seven families, and a blank project is
 * created before anything is drawn. Reaching for the nomenclature to hand
 * somebody six build-ups would put the whole of it in the first payload — the
 * very thing this basket exists to undo.
 *
 * The cast is the one place a shape is asserted rather than checked, and it is
 * checked elsewhere: `validate:catalog` rebuilds the file from the catalogue
 * with the same constructors a picked entry goes through, and refuses a file
 * that no longer says what the catalogue says.
 */
export const STARTER_LIBRARY = held as unknown as {
  readonly materials: readonly Material[];
  readonly assemblies: readonly Assembly[];
  readonly openingTypes: readonly OpeningDefinition[];
};
