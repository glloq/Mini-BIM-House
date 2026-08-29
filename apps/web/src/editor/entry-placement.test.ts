import { describe, expect, it } from 'vitest';
import {
  connectablePorts,
  openPorts,
} from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import { designStateOf } from '../ux/design-state.js';
import { declaredTools, toolCreates } from './entry-kinds.js';
import { placeEntry, type EntryAim } from './entry-placement.js';
import { allToolboxEntries, availabilityOf } from './toolbox.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);

/**
 * La maison de démonstration, avec un bout de chaque réseau détaché.
 *
 * Ses réseaux sont **finis** : tous les ports sont reliés, donc aucun tracé
 * nouveau n'y a sa place, et éprouver « Tracer un tronçon » dessus
 * n'éprouverait que le refus de relier ce qui l'est déjà. Détacher le dernier
 * tronçon rend l'état d'un réseau qu'on est en train de faire — celui où l'on
 * trace — et ses deux ports sont **compatibles par construction**, puisqu'ils
 * étaient reliés il y a un instant.
 */
const DETACHED = new Map<string, readonly [string, string]>();
const file = {
  ...demo.file,
  project: {
    ...demo.file.project,
    systems: (demo.file.project.systems ?? []).map((network) => {
      const last = network.edges[network.edges.length - 1];
      if (network.edges.length < 2 || last === undefined) return network;
      DETACHED.set(network.id, [last.fromPortId, last.toPortId]);
      return { ...network, edges: network.edges.slice(0, -1) };
    }),
  },
};
const project = file.project;
const level = project.building.levels[0]!;

/**
 * Deux ports **libres** du réseau que l'entrée a choisi.
 *
 * C'est ce que quelqu'un clique : deux bouts qui ne sont pas déjà reliés. En
 * reprendre deux au hasard éprouverait le refus de relier ce qui l'est déjà,
 * qui est juste et qui n'est pas la question.
 */
function twoPorts(networkId: string): readonly (string | undefined)[] {
  const detached = DETACHED.get(networkId);
  if (detached !== undefined) return detached;
  const network = (project.systems ?? []).find(({ id }) => id === networkId);
  if (network === undefined) return [];
  for (const from of openPorts(network)) {
    const to = connectablePorts(network, from.id).find(
      ({ id }) => id !== from.id,
    );
    if (to !== undefined) return [from.id, to.id];
  }
  return [];
}

/**
 * Le premier tronçon d'un réseau : ce qu'on vise pour dériver.
 *
 * Dériver ne demande pas quel réseau — le tronçon le dit — donc l'outil n'a
 * pas d'option « Réseau » à lire : on nomme le réseau ici.
 */
function firstEdge(networkId: string): readonly (string | undefined)[] {
  const network = (project.systems ?? []).find(({ id }) => id === networkId);
  return [network?.edges[0]?.id];
}

/** Le milieu du premier tronçon : là où l'on clique pour le dériver. */
function onEdge(networkId: string): { readonly x: number; readonly y: number } {
  const network = (project.systems ?? []).find(({ id }) => id === networkId);
  const points = network?.edges[0]?.path ?? [];
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return { x: 0, y: 0 };
  return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
}

const wall = level.walls[0]!;
const corner = wall.path.points[0]!;
const otherEnd = wall.path.points[wall.path.points.length - 1]!;

/**
 * Ce que quelques outils demandent en plus d'un endroit où cliquer.
 *
 * Un tracé part d'un port et arrive sur un port ; une cote se rattache à deux
 * extrémités ; une annotation a un texte. Ce sont des choses qu'une personne
 * fournit en visant ou en tapant, et ne pas les fournir n'éprouverait que le
 * refus. Chacune est écrite ici, avec sa raison.
 */
const AIMS: Readonly<Record<string, EntryAim>> = {
  NETWORK_ROUTE: { picks: (option) => twoPorts(option('networkId')) },
  NETWORK_BRANCH: {
    picks: () => firstEdge('wastewater'),
    // Sur le tronçon, et non à côté : dériver coupe une conduite là où on la
    // vise, et viser à dix mètres ne coupe rien.
    points: [onEdge('wastewater')],
  },
  // Une cote se pose sur deux points du dessin, et le troisième clic dit où
  // passe sa ligne.
  DIMENSION: {
    points: [corner, otherEnd, { x: corner.x, y: corner.y - 1200 }],
  },
  NOTE: { drafts: { 'NOTE.text': 'Repère' } },
  // Joindre et ajuster demandent deux murs qui se rencontrent vraiment.
  JOIN: { picks: [level.walls[0]!.id, level.walls[1]!.id] },
  TRIM: { picks: [level.walls[0]!.id, level.walls[1]!.id] },
  SPLIT: { picks: [level.walls[0]!.id] },
  OFFSET: { picks: [level.walls[0]!.id] },
  // Répéter demande d'abord l'objet visé ; les deux points par défaut disent
  // le pas qui sépare l'original de sa première copie.
  REPEAT: { picks: [level.walls[0]!.id] },
  ROTATE: { selection: [level.walls[0]!.id] },
  MIRROR: { selection: [level.walls[0]!.id] },
  MERGE_SPACES: {
    picks: [level.spaces[0]!.id, level.spaces[1]?.id],
  },
  // Deux coins opposés, et non deux points d'un même côté.
  WALL_RECTANGLE: {
    points: [
      { x: corner.x + 20_000, y: corner.y + 20_000 },
      { x: corner.x + 26_000, y: corner.y + 25_000 },
    ],
  },
};

/**
 * Ce qu'une entrée pose là où la maison de démonstration l'a déjà.
 *
 * Trois gestes ne peuvent pas être éprouvés sur cette maison-là sans y faire
 * d'abord de la place, et ce qu'ils refusent est **juste** : le contour porte
 * déjà sa pièce, la parcelle existe, les murs qu'on joint sont déjà joints.
 * Les lister est une décision écrite, pas un oubli.
 */
const EXPECTED_REFUSALS: Readonly<Record<string, RegExp>> = {
  'building.space': /porte déjà la pièce/u,
  'common.join': /Segment endpoints|déjà/u,
  'common.trim': /Segment endpoints|déjà/u,
};

describe('tout ce qu’on peut ajouter se pose vraiment', () => {
  /*
   * Deux cent quarante boutons ne disent pas lesquels marchent.
   *
   * On les essayait un par un, à la main, et on n'en essayait pas deux cent
   * quarante : c'est ainsi que vingt et une entrées ont pu refuser pendant des
   * semaines tout ce qu'on leur demandait — les prises et les interrupteurs,
   * qui veulent un mur ; les puits et les bornes, qui veulent le terrain ; les
   * gouttières et les panneaux, qui veulent une toiture.
   *
   * Ce test les prend toutes, avec les options que l'entrée pré-remplit, la
   * même fabrique de commande et le même répartiteur qu'à l'écran.
   */
  const state = designStateOf(project, level.id);
  const entries = allToolboxEntries().filter(
    ({ toolId }) => toolId !== 'SELECT' && toolId !== 'MEASURE',
  );

  it('en tient assez pour que le test veuille dire quelque chose', () => {
    expect(entries.length).toBeGreaterThan(100);
  });

  it.each(entries.map((entry) => [entry.id, entry] as const))(
    '%s',
    (_id, entry) => {
      /*
       * Une entrée que la maison rend inerte n'a rien à poser.
       *
       * C'est le contrat des prédicats : une entrée qui ne sert pas encore
       * **dit pourquoi**. Ce qu'on refuse ici est qu'elle soit inerte en
       * silence, pas qu'elle soit inerte.
       */
      const available = availabilityOf(entry, state);
      if (!available.enabled) {
        expect(available.requirement?.reason, entry.id).toBeTruthy();
        return;
      }
      const placement = placeEntry(
        file,
        level.id,
        entry,
        AIMS[entry.id] ?? AIMS[entry.toolId],
      );
      const expected = EXPECTED_REFUSALS[entry.id];
      if (expected !== undefined) {
        expect(placement.refusal, entry.id).toMatch(expected);
        return;
      }
      expect(
        placement.refusal,
        `${entry.id} (${entry.toolId})`,
      ).toBeUndefined();
      // Une commande acceptée qui ne change rien est un bouton qui ne fait
      // rien : poser n'est pas toujours ajouter, mais c'est toujours changer.
      expect(placement.changed, `${entry.id} n’a rien changé`).toBe(true);
      /*
       * Et ce qu'elle a laissé derrière elle est bien ce qu'on a déclaré.
       *
       * `entry-kinds.ts` répond « qui a le droit de désigner quoi » sans
       * exécuter deux cent quarante commandes à chaque rendu ; ce test est ce
       * qui l'empêche de mentir.
       */
      for (const kind of placement.created)
        expect(
          toolCreates(entry.toolId),
          `${entry.toolId} a posé ${kind}`,
        ).toContain(kind);
    },
  );
});

describe('ce que les outils laissent derrière eux', () => {
  it('est écrit pour chacun d’eux', () => {
    // Un outil absent de la table serait un outil dont aucun espace ne sait
    // s'il a le droit de désigner ce qu'il pose.
    const declared = new Set(declaredTools());
    for (const entry of allToolboxEntries())
      expect(declared.has(entry.toolId), entry.toolId).toBe(true);
  });
});

/**
 * Les entrées que la maison de démonstration rend inertes au rez-de-chaussée.
 *
 * La boucle du dessus travaille sur le premier niveau, et c'est le bon choix :
 * c'est là qu'on dessine. Une fenêtre de toit y est donc inerte à bon droit —
 * il n'y a pas de toiture — et la boucle se contente de vérifier qu'elle dit
 * pourquoi. Ce qu'elle ne vérifie pas est que l'entrée **pose** quelque chose
 * quand la condition est remplie, ce qui est exactement ce qu'un bouton doit
 * faire. La toiture de cette maison est à l'étage : on l'y éprouve.
 */
describe('ce qu’un étage sous les combles laisse poser', () => {
  const attic = project.building.levels.find(
    ({ roofs, roofStructures }) =>
      roofs.length > 0 || (roofStructures ?? []).length > 0,
  )!;

  it('la maison de démonstration a bien un niveau avec une toiture', () => {
    expect(attic).toBeDefined();
    expect(designStateOf(project, attic.id).roofSurfaceCount).toBeGreaterThan(
      0,
    );
  });

  it.each(['building.roof-window', 'building.roof-void'])(
    '%s pose une ouverture dans un pan',
    (entryId) => {
      const entry = allToolboxEntries().find(({ id }) => id === entryId)!;
      const state = designStateOf(project, attic.id);
      expect(availabilityOf(entry, state).enabled, entryId).toBe(true);
      const plane = attic.roofs[0]!;
      // Au milieu du pan : un clic ordinaire, ni sur l'égout ni au faîtage.
      const centre = plane.footprint.outer.reduce(
        (total, point) => ({
          x: total.x + point.x / plane.footprint.outer.length,
          y: total.y + point.y / plane.footprint.outer.length,
        }),
        { x: 0, y: 0 },
      );
      const placement = placeEntry(file, attic.id, entry, {
        points: [centre],
      });
      expect(placement.refusal, entryId).toBeUndefined();
      expect(placement.changed, entryId).toBe(true);
      expect(placement.created, entryId).toEqual(['OPENING']);
    },
  );

  it('refuse un clic hors de toute toiture, et le dit', () => {
    const entry = allToolboxEntries().find(
      ({ id }) => id === 'building.roof-window',
    )!;
    const placement = placeEntry(file, attic.id, entry, {
      points: [{ x: -50_000, y: -50_000 }],
    });
    expect(placement.refusal).toMatch(/pan de toiture/u);
  });
});
