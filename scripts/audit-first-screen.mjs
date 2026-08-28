/**
 * Ce que le premier écran emporte, et par où.
 *
 * Le budget de bundle dit **combien** pèse le premier chargement ; il ne dit
 * jamais **quoi**, ni pourquoi. Deux fois de suite, du code qu'un commentaire
 * annonçait comme chargé à la demande s'est révélé y être depuis toujours :
 *
 *   - le validateur compilé par Ajv, quatre cent trente-huit kilo-octets de
 *     règles de schéma, parce qu'un `export *` le portait jusqu'à
 *     `applyProjectScenario` ;
 *   - les dix-sept moteurs de calcul, parce que l'écran des réglages importait
 *     le barillet des adaptateurs pour y lire un libellé.
 *
 * Les deux ont été trouvés par accident, en cherchant autre chose, et chacun
 * pesait plus que la moitié de ce qu'une refonte d'interface économise. Cet
 * outil les cherche exprès : il part de `main.tsx`, ne suit que les
 * importations **statiques**, et dit ce qui arrive, groupé par paquet, avec la
 * chaîne d'importations qui l'y a amené.
 *
 * `import('…')` n'est pas suivi : c'est la frontière que ce dépôt trace entre
 * ce qu'on télécharge pour ouvrir un plan et ce qu'on télécharge quand on
 * clique. Tout ce que cet outil rapporte est donc, par construction, du poids
 * que quelqu'un paie avant d'avoir rien demandé.
 *
 *     npm run audit:first-screen
 *     npm run audit:first-screen -- @house-technical-designer/quantities
 *
 * Avec un nom de paquet ou un bout de chemin, il rend la chaîne la plus courte
 * qui y mène — la réponse à « mais qu'est-ce qui importe ça ? ».
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = join(ROOT, 'apps/web/src/main.tsx');

/** Les paquets de l'espace de travail, par nom, avec leur table d'exports. */
function workspacePackages() {
  const found = new Map();
  for (const area of ['apps', 'packages', 'modules']) {
    const base = join(ROOT, area);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const manifest = join(base, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
      found.set(parsed.name, {
        directory: join(base, name),
        exports: parsed.exports ?? { '.': './src/index.ts' },
      });
    }
  }
  return found;
}

const PACKAGES = workspacePackages();

/** Le fichier qui existe pour un chemin sans extension, ou avec `.js`. */
function realFile(candidate) {
  const attempts = [
    candidate,
    candidate.replace(/\.js$/u, '.ts'),
    candidate.replace(/\.js$/u, '.tsx'),
    `${candidate}.ts`,
    `${candidate}.tsx`,
    join(candidate, 'index.ts'),
    join(candidate, 'index.tsx'),
  ];
  for (const attempt of attempts)
    if (existsSync(attempt) && statSync(attempt).isFile()) return attempt;
  return undefined;
}

/**
 * Ce qu'un spécificateur d'import désigne, quand il désigne un fichier d'ici.
 *
 * Rend `undefined` pour tout ce qui vient de `node_modules` : ce poids est
 * réel, mais il ne se règle pas en déplaçant une ligne d'import, et le mêler
 * au reste noierait ce qui est actionnable.
 */
function resolveImport(specifier, from) {
  if (specifier.startsWith('.'))
    return realFile(resolve(dirname(from), specifier));
  const parts = specifier.split('/');
  const name = specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0];
  const held = PACKAGES.get(name);
  if (held === undefined) return undefined;
  const subpath = `.${specifier.slice(name.length)}`;
  const table = held.exports;
  const target =
    typeof table === 'string'
      ? table
      : (table[subpath] ?? table[subpath === '.' ? '.' : subpath]);
  if (typeof target !== 'string') return undefined;
  return realFile(resolve(held.directory, target));
}

/**
 * Les importations statiques d'un fichier, celles qui pèsent.
 *
 * Trois choses n'en sont pas, et les compter donnerait un rapport qui affole
 * pour rien :
 *
 *   - `import(...)` n'a pas de `from`, donc n'est pas capté — c'est la
 *     frontière même qu'on mesure ;
 *   - `import type { … } from '…'` disparaît à la compilation : le fichier
 *     n'est jamais chargé, seule sa forme a servi. Une ligne entière annoncée
 *     `type` est donc ignorée, et c'est ce qui distingue « ce module est là »
 *     de « ce module a été lu par le compilateur » ;
 *   - les commentaires, retirés d'abord, parce que cette base en écrit
 *     beaucoup et que plusieurs citent des chemins.
 */
function staticImports(source) {
  const stripped = source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/(^|[^:])\/\/[^\n]*/gu, '$1');
  const found = new Set();
  for (const match of stripped.matchAll(
    /(?:^|\n)\s*(import|export)(\s+type)?\b[\s\S]*?\bfrom\s+'([^']+)'/gu,
  ))
    if (match[2] === undefined) found.add(match[3]);
  for (const match of stripped.matchAll(/^\s*(?:import|export)\s+'([^']+)'/gmu))
    found.add(match[1]);
  return [...found];
}

/**
 * Tout ce que le premier écran atteint, et par quel chemin.
 *
 * Exportée, parce que `first-screen.test.mjs` s'en sert pour interdire aux
 * seize moteurs de calcul d'y revenir. Un outil qu'on lance à la main trouve
 * une régression le jour où quelqu'un pense à le lancer.
 */
export function reachedFromFirstScreen() {
  const reached = new Map([[ENTRY, []]]);
  const queue = [ENTRY];
  while (queue.length > 0) {
    const file = queue.shift();
    const chain = reached.get(file);
    const source = readFileSync(file, 'utf8');
    for (const specifier of staticImports(source)) {
      const target = resolveImport(specifier, file);
      if (target === undefined || reached.has(target)) continue;
      reached.set(target, [...chain, file]);
      queue.push(target);
    }
  }
  return reached;
}

/** Le paquet auquel un fichier appartient, ou le dossier de l'application. */
function ownerOf(file) {
  const path = relative(ROOT, file);
  for (const [name, { directory }] of PACKAGES)
    if (file.startsWith(`${directory}/`)) return name;
  return path.split('/').slice(0, 2).join('/');
}

export { ownerOf };

if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // Importé par un test : la marche est offerte, le rapport ne s'imprime pas.
} else {
  report();
}

function report() {
  const reached = reachedFromFirstScreen();
  const wanted = process.argv
    .slice(2)
    .filter((value) => !value.startsWith('-'));

  if (wanted.length > 0) {
    for (const needle of wanted) {
      const hit = [...reached.keys()].find(
        (file) => ownerOf(file) === needle || file.includes(needle),
      );
      if (hit === undefined) {
        console.log(`\n${needle} n’arrive pas au premier écran.`);
        continue;
      }
      console.log(`\n${relative(ROOT, hit)} arrive par :`);
      for (const step of [...reached.get(hit), hit])
        console.log(`  ${relative(ROOT, step)}`);
    }
    return;
  }

  const byOwner = new Map();
  for (const file of reached.keys()) {
    const owner = ownerOf(file);
    const held = byOwner.get(owner) ?? { bytes: 0, files: 0 };
    held.bytes += statSync(file).size;
    held.files += 1;
    byOwner.set(owner, held);
  }

  const ordered = [...byOwner].sort(
    (first, second) => second[1].bytes - first[1].bytes,
  );
  const total = ordered.reduce((sum, [, { bytes }]) => sum + bytes, 0);

  console.log('\nCe que le premier écran emporte, source non compressée.\n');
  for (const [owner, { bytes, files }] of ordered)
    console.log(
      `${(bytes / 1024).toFixed(0).padStart(6)} kio  ${String(files).padStart(3)} fichier(s)  ${owner}`,
    );
  console.log(
    `\n${(total / 1024).toFixed(0)} kio de source, ${reached.size} fichiers du dépôt.`,
  );
  console.log(
    'Pour savoir ce qui amène l’un d’eux : npm run audit:first-screen -- <paquet ou chemin>',
  );
}
