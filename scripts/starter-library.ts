/**
 * Writes the library a new project starts with.
 *
 * Generated rather than hand-written so it cannot drift from the entries it
 * names: `validate:catalog` rebuilds it and refuses a file that no longer says
 * what the catalogue says.
 */
import { writeFileSync } from 'node:fs';
import {
  STARTER_REASONS,
  starterLibrary,
} from '../packages/catalog-registry/src/starter-library.js';

const OUT = 'packages/catalog-registry/data/starter-library.json';
const library = starterLibrary();
writeFileSync(OUT, `${JSON.stringify(library, undefined, 2)}\n`, 'utf8');

console.log('');
console.log('Panier de départ');
for (const [what, why] of Object.entries(STARTER_REASONS))
  console.log(`  ${what.padEnd(14)} ${why}`);
console.log('');
console.log(
  `  ${library.materials.length} matériaux, ${library.assemblies.length} compositions, ${library.openingTypes.length} menuiseries`,
);
console.log(`  écrit dans ${OUT}`);
