/**
 * Ce que valent aligner et répartir, mesuré au millimètre.
 *
 * Les trois gestes tiennent en de l'arithmétique sur des boîtes, et c'est
 * précisément ce qui les rend vérifiables sans projet, sans niveau, sans
 * session et sans React : chaque cas ci-dessous est une poignée de rectangles
 * dont on sait où ils doivent finir. Les deux derniers cas ne sont pas des
 * rectangles inventés mais la maison de référence, parce qu'un rangement qui
 * marche sur des nombres ronds et pas sur la maquette ne range rien.
 */
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import {
  ALIGN_INTENT_LABELS,
  alignDeltas,
  centreOf,
  distributeDeltas,
  type ArrangedObject,
  type ArrangementOutcome,
} from './arrangement.js';
import { boundsOf } from './object-editors.js';

/** Un rectangle nommé, posé par son coin et sa taille. */
function box(
  objectId: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
): ArrangedObject {
  return {
    objectId,
    bounds: { min: { x, y }, max: { x: x + width, y: y + height } },
  };
}

/** Les écarts d'un rangement, ou l'échec du test si le rangement a refusé. */
function deltasOf(outcome: ArrangementOutcome): ReadonlyMap<string, unknown> {
  if (outcome.status === 'REFUSED') throw new Error(outcome.message);
  return outcome.deltas;
}

/** Un objet déplacé de son écart, pour vérifier où il arrive. */
function moved(
  object: ArrangedObject,
  outcome: ArrangementOutcome,
): ArrangedObject {
  if (outcome.status === 'REFUSED') throw new Error(outcome.message);
  const delta = outcome.deltas.get(object.objectId) ?? { x: 0, y: 0 };
  return {
    objectId: object.objectId,
    bounds: {
      min: {
        x: object.bounds.min.x + delta.x,
        y: object.bounds.min.y + delta.y,
      },
      max: {
        x: object.bounds.max.x + delta.x,
        y: object.bounds.max.y + delta.y,
      },
    },
  };
}

describe('aligner', () => {
  const left = box('a', 0, 0, 200, 100);
  const middle = box('b', 500, 300, 100, 400);
  const right = box('c', 1200, 50, 300, 100);
  const three = [left, middle, right];

  it('amène tout le monde sur l’objet le plus extrême, pas sur le premier désigné', () => {
    // La référence à gauche est l'abscisse 0 de « a », que « a » soit désigné
    // en premier ou en dernier. C'est tout l'enjeu : un alignement dont la
    // référence suit l'ordre de la sélection se refait trois fois.
    const inOrder = alignDeltas(three, 'LEFT');
    const shuffled = alignDeltas([right, left, middle], 'LEFT');
    expect(deltasOf(inOrder)).toEqual(deltasOf(shuffled));
    expect(moved(middle, inOrder).bounds.min.x).toBe(0);
    expect(moved(right, inOrder).bounds.min.x).toBe(0);
    // Et « a », qui est déjà la référence, n'est pas déplacé de zéro.
    expect(deltasOf(inOrder).has('a')).toBe(false);
  });

  it('aligne sur chacun des quatre bords, et sur celui-là seulement', () => {
    expect(moved(left, alignDeltas(three, 'RIGHT')).bounds.max.x).toBe(1500);
    expect(moved(right, alignDeltas(three, 'TOP')).bounds.min.y).toBe(0);
    expect(moved(left, alignDeltas(three, 'BOTTOM')).bounds.max.y).toBe(700);
  });

  it('ne déplace que sur l’axe demandé', () => {
    // Aligner à gauche ne monte ni ne descend personne : un alignement qui
    // corrigerait les deux axes à la fois est deux gestes, et on n'en a
    // demandé qu'un.
    for (const delta of deltasOf(alignDeltas(three, 'LEFT')).values())
      expect(delta).toMatchObject({ y: 0 });
    for (const delta of deltasOf(alignDeltas(three, 'TOP')).values())
      expect(delta).toMatchObject({ x: 0 });
  });

  it('déplace sans redimensionner : aligner, c’est déplacer', () => {
    const outcome = alignDeltas(three, 'RIGHT');
    for (const object of three) {
      const after = moved(object, outcome);
      expect(after.bounds.max.x - after.bounds.min.x).toBe(
        object.bounds.max.x - object.bounds.min.x,
      );
      expect(after.bounds.max.y - after.bounds.min.y).toBe(
        object.bounds.max.y - object.bounds.min.y,
      );
    }
  });

  it('centre sur le milieu de l’ensemble, et non sur la moyenne des centres', () => {
    // Cinq objets serrés à gauche et un seul à droite : la moyenne des centres
    // tomberait dans le paquet de gauche, ce qui n'est « au milieu » pour
    // personne. Le milieu de l'étendue ne dépend pas du nombre d'objets.
    const crowd = [
      box('p0', 0, 0),
      box('p1', 10, 0),
      box('p2', 20, 0),
      box('p3', 30, 0),
      box('p4', 40, 0),
      box('far', 1000, 0),
    ];
    const outcome = alignDeltas(crowd, 'CENTRE_X');
    const centres = crowd.map(
      (object) => centreOf(moved(object, outcome).bounds).x,
    );
    // Étendue des centres : de 50 (p0) à 1050 (far) ; le milieu est 550.
    for (const centre of centres) expect(centre).toBeCloseTo(550, 9);
    const average = (50 + 60 + 70 + 80 + 90 + 1050) / 6;
    expect(centres[0]).not.toBeCloseTo(average, 3);
  });

  it('centre verticalement sans rien changer en largeur', () => {
    const outcome = alignDeltas(three, 'CENTRE_Y');
    const centres = three.map((object) =>
      centreOf(moved(object, outcome).bounds),
    );
    // Centres en y : 50, 500 et 100 ; le milieu de leur étendue est 275.
    for (const centre of centres) expect(centre.y).toBeCloseTo(275, 9);
    expect(centres.map(({ x }) => x)).toEqual(
      three.map((object) => centreOf(object.bounds).x),
    );
  });

  it('refuse d’aligner un objet sur lui-même, et le dit', () => {
    const outcome = alignDeltas([left], 'LEFT');
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.status === 'REFUSED' && outcome.message).toMatch(
      /au moins deux objets/,
    );
  });

  it('refuse quand tout est déjà aligné, plutôt que de rendre une carte vide', () => {
    // Une carte vide serait un succès silencieux : l'appelant écrirait une
    // entrée d'historique qui ne déplace rien.
    const outcome = alignDeltas([box('a', 0, 0), box('b', 0, 900)], 'LEFT');
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.status === 'REFUSED' && outcome.message).toMatch(/déjà/);
  });

  it('refuse ce qui ne se mesure pas, sans le confondre avec un objet seul', () => {
    const ghost: ArrangedObject = {
      objectId: 'ghost',
      bounds: { min: { x: Number.NaN, y: 0 }, max: { x: Number.NaN, y: 0 } },
    };
    const outcome = alignDeltas([left, ghost], 'LEFT');
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.status === 'REFUSED' && outcome.message).toMatch(
      /ne se mesurent pas/,
    );
  });

  it('nomme les six intentions en français', () => {
    expect(Object.values(ALIGN_INTENT_LABELS)).toHaveLength(6);
    for (const label of Object.values(ALIGN_INTENT_LABELS))
      expect(label).toMatch(/^(Aligner|Centrer)/);
  });
});

describe('répartir', () => {
  it('ne bouge pas les deux extrêmes — c’est ce qui la distingue d’un alignement', () => {
    const posts = [
      box('p1', 0, 0),
      box('p2', 130, 0),
      box('p3', 900, 0),
      box('p4', 1900, 0),
    ];
    const outcome = distributeDeltas(posts, 'X');
    expect(deltasOf(outcome).has('p1')).toBe(false);
    expect(deltasOf(outcome).has('p4')).toBe(false);
    expect(moved(posts[0]!, outcome).bounds.min.x).toBe(0);
    expect(moved(posts[3]!, outcome).bounds.min.x).toBe(1900);
  });

  it('rend des intervalles égaux entre les centres', () => {
    const posts = [
      box('p1', 0, 0),
      box('p2', 130, 0),
      box('p3', 900, 0),
      box('p4', 1900, 0, 400), // large, pour que « entre centres » se distingue
    ];
    const outcome = distributeDeltas(posts, 'X');
    const centres = posts
      .map((object) => centreOf(moved(object, outcome).bounds).x)
      .sort((a, b) => a - b);
    const gaps = centres
      .slice(1)
      .map((value, index) => value - centres[index]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 9);
    // Étendue des centres : 50 → 2100, soit trois intervalles de 683,33 mm.
    expect(gaps[0]).toBeCloseTo((2100 - 50) / 3, 9);
  });

  it('suit l’ordre du plan, jamais l’ordre de la sélection', () => {
    // On ne désigne pas quatre poteaux de gauche à droite ; on les prend à la
    // bande. Une répartition qui suivrait cet ordre-là les échangerait de
    // place au lieu de les espacer.
    const posts = [
      box('p1', 0, 0),
      box('p2', 130, 0),
      box('p3', 900, 0),
      box('p4', 1900, 0),
    ];
    const asDrawn = distributeDeltas(posts, 'X');
    const asClicked = distributeDeltas(
      [posts[2]!, posts[0]!, posts[3]!, posts[1]!],
      'X',
    );
    expect(deltasOf(asClicked)).toEqual(deltasOf(asDrawn));
    // Et personne ne s'est croisé : l'ordre en x est celui d'avant.
    const after = posts.map((object) => moved(object, asDrawn).bounds.min.x);
    expect(after).toEqual([...after].sort((a, b) => a - b));
  });

  it('répartit aussi en hauteur, sur l’axe demandé et lui seul', () => {
    const sockets = [box('s1', 0, 0), box('s2', 40, 250), box('s3', 80, 1000)];
    const outcome = distributeDeltas(sockets, 'Y');
    expect(deltasOf(outcome).get('s2')).toEqual({ x: 0, y: 250 });
    expect(moved(sockets[1]!, outcome).bounds.min.x).toBe(40);
  });

  it('refuse en dessous de trois objets, parce qu’un intervalle est déjà régulier', () => {
    const outcome = distributeDeltas([box('a', 0, 0), box('b', 500, 0)], 'X');
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.status === 'REFUSED' && outcome.message).toMatch(
      /au moins trois objets/,
    );
  });

  it('refuse une portée nulle plutôt que d’empiler les intermédiaires', () => {
    const outcome = distributeDeltas(
      [box('a', 0, 0), box('b', 0, 400), box('c', 0, 900)],
      'X',
    );
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.status === 'REFUSED' && outcome.message).toMatch(/portée/);
  });

  it('refuse quand c’est déjà régulier, sans écrire dans l’historique', () => {
    const outcome = distributeDeltas(
      [box('a', 0, 0), box('b', 1000, 0), box('c', 2000, 0)],
      'X',
    );
    expect(outcome.status).toBe('REFUSED');
    expect(outcome.status === 'REFUSED' && outcome.message).toMatch(/déjà/);
  });

  it('départage deux objets au même endroit par leur identifiant, pas par le tri', () => {
    // Deux fois le même calcul doit rendre deux fois la même chose, même
    // quand deux centres coïncident.
    const stack = [
      box('a', 0, 0),
      box('m2', 500, 0),
      box('m1', 500, 0),
      box('z', 2000, 0),
    ];
    const once = distributeDeltas(stack, 'X');
    const twice = distributeDeltas([...stack].reverse(), 'X');
    expect(deltasOf(once)).toEqual(deltasOf(twice));
  });
});

describe('sur la maison de référence', () => {
  const demo = loadDemoProject();
  if (demo.status === 'ERROR') throw new Error(demo.message);
  const house = demo.file.project;
  const ground = house.building.levels[0]!;

  /** Les objets d'un niveau, avec l'emprise que leur famille leur donne. */
  function arranged(objectIds: readonly string[]): readonly ArrangedObject[] {
    return objectIds.flatMap((objectId) => {
      const bounds = boundsOf(house, ground.id, objectId);
      return bounds === undefined ? [] : [{ objectId, bounds }];
    });
  }

  it('aligne les prises que la trame de 100 mm ne sait pas rejoindre', () => {
    // La maquette porte deux prises à x = 600 et x = 620, sur la même
    // ordonnée. Vingt millimètres : la trame n'offre que 600 et 700, donc
    // s'accrocher pour aligner sur celle de droite laisse 20 mm d'écart.
    const sockets = (ground.components ?? []).filter(
      ({ category }) => category === 'ELECTRICAL',
    );
    const pair = arranged(
      sockets
        .filter(({ position }) => Math.abs(position.x - 610) < 100)
        .map(({ id }) => id),
    );
    expect(pair).toHaveLength(2);
    const before = pair.map(({ bounds }) => bounds.min.x);
    expect(Math.max(...before) - Math.min(...before)).toBe(20);
    const outcome = alignDeltas(pair, 'RIGHT');
    const after = pair.map((object) => moved(object, outcome).bounds.max.x);
    // Après : zéro, exactement, et non « 20 mm, mais c'est peu ».
    expect(Math.max(...after) - Math.min(...after)).toBe(0);
  });

  it('répartit les équipements sanitaires sans déplacer les deux bouts', () => {
    const sanitary = arranged(
      (ground.components ?? [])
        .filter(({ category }) => category === 'SANITARY')
        .map(({ id }) => id),
    );
    expect(sanitary.length).toBeGreaterThanOrEqual(3);
    const outcome = distributeDeltas(sanitary, 'X');
    const xs = sanitary.map((object) => centreOf(object.bounds).x);
    const extremes = [Math.min(...xs), Math.max(...xs)];
    const after = sanitary
      .map((object) => centreOf(moved(object, outcome).bounds).x)
      .sort((a, b) => a - b);
    expect([after[0], after[after.length - 1]]).toEqual(extremes);
    const gaps = after.slice(1).map((value, index) => value - after[index]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 9);
  });

  it('mesure tout ce que la maison porte, murs et réseaux compris', () => {
    // La commande d'alignement d'hier ne mesurait que les murs, les dalles,
    // les toitures et les nœuds de réseau : sur les 140 objets du plan, 92 se
    // voyaient répondre « ces objets ne se mesurent pas ». Les familles, elles,
    // savent toutes répondre.
    const everything = [
      ...ground.walls.map(({ id }) => id as string),
      ...ground.slabs.map(({ id }) => id as string),
      ...ground.spaces.map(({ id }) => id as string),
      ...ground.stairs.map(({ id }) => id as string),
      ...(ground.components ?? []).map(({ id }) => id as string),
      ...(house.systems ?? []).flatMap((network) =>
        network.nodes.map(({ id }) => id),
      ),
    ];
    expect(arranged(everything).length).toBe(everything.length);
    expect(everything.length).toBeGreaterThan(50);
  });
});
