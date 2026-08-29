/**
 * Ce qu'un outil fabrique, en familles d'objets.
 *
 * Le registre dit ce qu'un outil **fait** — combien de clics, quelles options,
 * quelle commande — et jamais ce qu'il **laisse derrière lui**. C'est pourtant
 * la question qu'il faut poser pour savoir ce qu'un espace a le droit de
 * désigner : celui qui pose des murs prend des murs.
 *
 * La table est écrite, et elle est **vérifiée** : `entry-placement.test.ts`
 * pose chaque entrée pour de bon et compare ce que le projet a gagné à ce qui
 * est déclaré ici. Une table écrite qu'un test confronte au réel vaut mieux
 * qu'une dérivation qui ferait tourner deux cent quarante commandes à chaque
 * rendu.
 */
import type { ObjectKind } from './object-editors.js';
import type { ToolboxEntry } from './toolbox.js';

const TOOL_CREATES: Readonly<Record<string, readonly ObjectKind[]>> = {
  WALL: ['WALL'],
  WALL_RUN: ['WALL'],
  WALL_RECTANGLE: ['WALL'],
  OPENING: ['OPENING'],
  // Une fenêtre de toit est une ouverture comme une autre pour qui la
  // désigne : ce qui change est ce qu'elle perce, pas ce qu'elle est.
  ROOF_OPENING: ['OPENING'],
  SPACE: ['SPACE'],
  MERGE_SPACES: ['SPACE'],
  SLAB: ['SLAB'],
  SLAB_HOLE: ['SLAB_HOLE'],
  // Une toiture décrite par son contour dessine aussi ses pans : le test de
  // pose l'a dit avant nous.
  ROOF: ['ROOF', 'ROOF_STRUCTURE'],
  STAIR: ['STAIR'],
  COLUMN: ['STRUCTURE'],
  BEAM: ['STRUCTURE'],
  COMPONENT: ['COMPONENT'],
  // Les nœuds et les tronçons sont une seule famille pour l'éditeur : prendre
  // l'un veut dire pouvoir prendre l'autre.
  NETWORK: ['NETWORK_NODE', 'NETWORK_EDGE'],
  NETWORK_ROUTE: ['NETWORK_NODE', 'NETWORK_EDGE'],
  NETWORK_BRANCH: ['NETWORK_NODE', 'NETWORK_EDGE'],
  SITE: ['SITE'],
  // L'arbre, la haie, la clôture et le portail sont du terrain comme la
  // parcelle : ce qui les distingue est le geste qui les pose, pas la famille
  // d'objet qu'ils laissent derrière eux.
  SITE_TREE: ['SITE'],
  SITE_HEDGE: ['SITE'],
  SITE_FENCE: ['SITE'],
  SITE_GATE: ['SITE'],
  DIMENSION: ['DIMENSION'],
  NOTE: ['NOTE'],
  // Les outils qui reprennent ce qui existe : ils ne fabriquent pas une
  // famille nouvelle, ils travaillent celle qu'ils touchent.
  JOIN: ['WALL'],
  TRIM: ['WALL'],
  SPLIT: ['WALL'],
  OFFSET: ['WALL'],
  ROTATE: [],
  MIRROR: [],
  SELECT: [],
  MEASURE: [],
};

/** Ce que cette entrée laisse derrière elle. */
export function entryCreates(entry: ToolboxEntry): readonly ObjectKind[] {
  return TOOL_CREATES[entry.toolId] ?? [];
}

/** La même question, posée à un outil. */
export function toolCreates(toolId: string): readonly ObjectKind[] {
  return TOOL_CREATES[toolId] ?? [];
}

/** Les outils dont on a écrit ce qu'ils fabriquent. */
export function declaredTools(): readonly string[] {
  return Object.keys(TOOL_CREATES);
}
