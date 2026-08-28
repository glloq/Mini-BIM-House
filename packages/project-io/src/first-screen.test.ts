/**
 * Ce que le barillet du paquet ne doit plus porter.
 *
 * Le validateur compilé par Ajv est le plus gros fichier du dépôt, et il est
 * arrivé au premier écran pendant des mois sans que rien ne le dise : un
 * `export *` suffisait. Le budget l'a vu une fois, en gros, et il a fallu
 * lire le graphe de chunks pour comprendre d'où venait le poids.
 *
 * Ce test lit le graphe des importations **statiques** depuis chaque point
 * d'entrée du paquet et dit lequel atteint le validateur. Il n'a pas besoin
 * d'un build : la question — « qui touche quoi, sans qu'on l'ait demandé » —
 * se répond dans les sources, et une ligne rajoutée à `index.ts` la fait
 * échouer le jour même plutôt qu'au prochain relevé de budget.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * Les importations statiques d'un module, restreintes à ce paquet.
 *
 * Le nom rendu est celui du fichier qui existe : les sources sont en `.ts`,
 * sauf le validateur, qui est généré et livré en `.js`. Une feuille dont le
 * fichier n'existe sous aucune des deux formes est une importation qu'on
 * n'aurait pas su lire, et le test échoue plutôt que de l'ignorer.
 */
function localImports(module: string): readonly string[] {
  const source = readFileSync(`${here}${module}`, 'utf8');
  const found = new Set<string>();
  /*
   * `import … from './x.js'` et `export … from './x.js'`, et rien d'autre :
   * un `import('./x.js')` n'a pas de `from`, ce qui est précisément la
   * différence qu'on mesure. La forme est vérifiée par le fait qu'on lit
   * ensuite le fichier nommé — un nom inventé ferait échouer la lecture.
   */
  for (const match of source.matchAll(/\bfrom '\.\/([\w.-]+)\.js'/gu))
    found.add(`${match[1]!}.ts`);
  for (const match of source.matchAll(
    /^\s*(?:import|export) '\.\/([\w.-]+)\.js'/gmu,
  ))
    found.add(`${match[1]!}.ts`);
  return [...found].map((name) =>
    existsSync(`${here}${name}`) ? name : name.replace(/\.ts$/u, '.js'),
  );
}

/** Tout ce qu'un point d'entrée charge sans qu'on ait cliqué. */
function staticallyReachable(entry: string): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const module = queue.pop()!;
    if (seen.has(module)) continue;
    seen.add(module);
    queue.push(...localImports(module));
  }
  return seen;
}

const VALIDATOR = 'generated-project-validator.js';

describe('le validateur compilé', () => {
  it('n’est pas atteint par le barillet du paquet', () => {
    /*
     * `index.ts` est ce qu'importe quiconque écrit
     * `@house-technical-designer/project-io` : le modèle, les migrations, les
     * variantes, le zip. Aucun de ces quatre n'ouvre de fichier, donc aucun
     * n'a de raison de porter quatre cent trente-huit kilo-octets de règles
     * de schéma.
     */
    expect([...staticallyReachable('index.ts')]).not.toContain(VALIDATOR);
  });

  it('n’est pas atteint par la sauvegarde locale', () => {
    // Elle s'en sert, mais après une modification ou à une reprise : ses deux
    // usages sont dans des fonctions `async`, et le chargement y est dynamique.
    expect([...staticallyReachable('browser.ts')]).not.toContain(VALIDATOR);
  });

  it('est atteint par le sous-chemin qui existe pour lui', () => {
    // Le contraire des deux précédents : `files.ts` est l'endroit où le poids
    // est assumé, et un test qui ne vérifierait que des absences passerait
    // aussi bien si le validateur avait disparu du paquet.
    expect([...staticallyReachable('files.ts')]).toContain(VALIDATOR);
  });
});
