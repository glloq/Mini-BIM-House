/**
 * Tout ce qu'on peut ajouter, espace par espace — et ce qu'on ne peut pas.
 *
 * `entry-placement.test.ts` répond « chaque entrée pose-t-elle vraiment ce
 * qu'elle annonce ». C'est la moitié de la question. L'autre moitié est
 * « qu'est-ce qui manque » : une nomenclature de six cent cinquante fiches
 * derrière une boîte à outils de cent cinquante-sept boutons laisse
 * forcément des choses qu'on ne peut poser qu'en fouillant la bibliothèque.
 *
 *   npm run audit:entries            le tableau, espace par espace
 *   npm run audit:entries -- --gaps  seulement ce qui manque
 *
 * Rien n'est écrit deux fois : le tableau est lu du même registre que l'écran,
 * les disponibilités du même `DesignState`, les familles du même catalogue.
 *
 * Il vit **dans l'application** et non dans `scripts/`, parce qu'il lit le
 * registre de l'application : un script Node qui atteint le code du navigateur
 * est une frontière franchie, et elle se payait en `--jsx is not set` sur un
 * fichier qu'il n'ouvrait même pas.
 */
import {
  FAMILY_REGISTRY,
  hasCapability,
  type FamilyDefinition,
} from '@house-technical-designer/catalog-registry';

import { loadDemoProject } from '../src/demo-project.js';
import { createBlankProject } from '../src/project-workspace.js';
import { entryCreates, toolCreates } from '../src/editor/entry-kinds.js';
import {
  allToolboxEntries,
  availabilityOf,
  entryFicheInstalled,
  sectionsOfStage,
  type ToolboxEntry,
} from '../src/editor/toolbox.js';
import { CREATION_STAGES, creationStage } from '../src/ux/creation-stages.js';
import { designStateOf } from '../src/ux/design-state.js';
import type { ObjectKind } from '../src/editor/object-editors.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;
// Un projet neuf tel que l'application en fabrique un : c'est devant celui-là
// qu'un bouton inerte doit dire ce qui manque.
const blank = createBlankProject('2026-01-01T00:00:00.000Z').project;

const houseState = designStateOf(house, house.building.levels[0]?.id ?? '');
const blankState = designStateOf(blank, blank.building.levels[0]?.id ?? '');

const gapsOnly = process.argv.includes('--gaps');

/** Ce qu'une entrée vaut devant une maison : « oui », ou la raison du non. */
function verdict(entry: ToolboxEntry, state: typeof houseState): string {
  const available = availabilityOf(entry, state);
  if (available.recommended) return '★';
  if (available.enabled) return '·';
  const reason = available.requirement?.reason ?? 'sans raison écrite';
  return `✗ ${reason}`;
}

function pad(text: string, width: number): string {
  return text.length >= width
    ? text.slice(0, width)
    : text + ' '.repeat(width - text.length);
}

const entries = allToolboxEntries();

if (!gapsOnly) {
  for (const stage of CREATION_STAGES) {
    const sections = sectionsOfStage(stage);
    if (sections.length === 0) continue;
    console.log('');
    console.log(`## ${creationStage(stage).label}`);
    for (const section of sections) {
      console.log('');
      console.log(`### ${section.label}`);
      for (const entry of section.entries) {
        const creates = entryCreates(entry).join(', ') || '—';
        console.log(
          `  ${pad(entry.label, 22)} ${pad(entry.toolId, 16)} ${pad(
            entry.family ?? '',
            22,
          )} ${pad(verdict(entry, blankState), 34)} ${pad(
            verdict(entry, houseState),
            34,
          )} ${creates}`,
        );
      }
    }
  }
  console.log('');
  console.log('★ recommandée · disponible ✗ inerte (neuf | maison de démo)');
}

/*
 * Ce que le modèle sait tenir et qu'aucun bouton ne pose.
 *
 * Une famille d'objets sans entrée est une fonction qui n'existe que pour
 * celui qui connaît la palette de commandes.
 */
const KINDS: readonly ObjectKind[] = [
  'WALL',
  'OPENING',
  'SPACE',
  'SLAB',
  'SLAB_HOLE',
  'ROOF',
  'ROOF_STRUCTURE',
  'STAIR',
  'STRUCTURE',
  'COMPONENT',
  'NETWORK_NODE',
  'NETWORK_EDGE',
  'SITE',
  'DIMENSION',
  'NOTE',
];
const placed = new Set(entries.flatMap((entry) => entryCreates(entry)));
const orphanKinds = KINDS.filter((kind) => !placed.has(kind));

/*
 * Les familles de la nomenclature qu'aucune entrée ne nomme.
 *
 * Elles restent atteignables — la bibliothèque les tient toutes — mais les
 * atteindre demande de savoir qu'elles existent, ce qui est exactement ce que
 * la boîte à outils est là pour éviter.
 */
const named = new Set(
  entries.map(({ family }) => family).filter((family) => family !== undefined),
);
/*
 * Celles qu'un bouton pourrait poser, et non toutes.
 *
 * Une nomenclature tient aussi des matériaux, des produits de conduite et des
 * menuiseries : un isolant est une couche d'assemblage, un coude est de quoi
 * une conduite est faite, et une fenêtre se perce dans un mur. Aucun des trois
 * ne se pose en cliquant, et leur donner un bouton serait promettre un geste
 * qui n'existe pas. `PLACEABLE` est la question, et c'est le registre qui y
 * répond — il le dérive de ce que la famille déclare.
 */
const inService = FAMILY_REGISTRY.filter(
  (family: FamilyDefinition) =>
    (family.lifecycle === undefined || family.lifecycle === 'ACTIVE') &&
    hasCapability(family, 'PLACEABLE'),
);
const unnamed = inService.filter(({ id }) => !named.has(id));

/** Et les entrées qui nomment une famille que la nomenclature ne tient pas. */
const ghosts = [...named].filter(
  (family) => !FAMILY_REGISTRY.some(({ id }) => id === family),
);

/** Les entrées qu'un projet neuf ne peut pas poser faute de fiche installée. */
const uninstalled = entries.filter(
  (entry) => entry.family !== undefined && !entryFicheInstalled(blank, entry),
);

console.log('');
console.log('## Ce qui manque');
console.log('');
console.log(`Entrées : ${entries.length}`);
console.log(`Outils déclarés posant quelque chose : ${placed.size} familles`);
console.log(
  `Familles posables en service : ${inService.length}, dont ${
    inService.filter(({ id }) => named.has(id)).length
  } nommées par une entrée`,
);
console.log('');

if (orphanKinds.length > 0) {
  console.log('Familles d’objets qu’aucune entrée ne pose :');
  for (const kind of orphanKinds) console.log(`  - ${kind}`);
} else console.log('Toutes les familles d’objets ont au moins une entrée.');
console.log('');

if (ghosts.length > 0) {
  console.log('Entrées nommant une famille inconnue de la nomenclature :');
  for (const family of ghosts) console.log(`  - ${family}`);
  console.log('');
}

if (uninstalled.length > 0) {
  console.log(
    'Entrées dont le panier de départ ne tient pas la fiche (elles l’installent au clic) :',
  );
  for (const entry of uninstalled)
    console.log(`  - ${entry.id} (${entry.family})`);
  console.log('');
}

const byDomain = new Map<string, FamilyDefinition[]>();
for (const family of unnamed) {
  const held = byDomain.get(family.domain);
  if (held === undefined) byDomain.set(family.domain, [family]);
  else held.push(family);
}
console.log(`Familles posables qu’aucun bouton ne propose : ${unnamed.length}`);
for (const [domain, families] of [...byDomain].sort(
  ([, left], [, right]) => right.length - left.length,
)) {
  console.log(`  ${domain} — ${families.length}`);
  for (const family of families.slice(0, gapsOnly ? families.length : 12))
    console.log(`    ${pad(family.id, 34)} ${family.label}`);
  if (!gapsOnly && families.length > 12)
    console.log(`    … et ${families.length - 12} autres`);
}

/** Et ce que la table des outils déclare sans qu'aucune entrée ne le porte. */
const carried = new Set(entries.map(({ toolId }) => toolId));
const idle = [...new Set(entries.map(({ toolId }) => toolId))].filter(
  (toolId) => toolCreates(toolId).length === 0,
);
console.log('');
console.log(
  `Outils portés par une entrée : ${carried.size}, dont ${idle.length} qui ne posent rien (sélection, mesure, transformations).`,
);
