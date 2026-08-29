import { describe, expect, it } from 'vitest';
import { detectRooms } from '@house-technical-designer/editor-core';
import { polygonContains } from '@house-technical-designer/geometry';
import type { Point2D } from '@house-technical-designer/geometry';
import type { Project } from '@house-technical-designer/core-domain';

import { loadDemoProject } from '../demo-project.js';
import {
  areaLabel,
  measureLabel,
  roomLabels,
  roomMeasures,
} from './room-labels.js';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

/**
 * La maison de référence, ses murs remplacés par ceux qu'on lui donne.
 *
 * On part d'elle plutôt que d'un objet écrit à la main pour que ces contours
 * traversent exactement le même chemin que les vrais — `detectRooms`, ses
 * scissions aux intersections, son filtre d'aire — et non un raccourci qui ne
 * prouverait rien du produit.
 */
function houseWalledBy(
  outline: readonly (readonly [Point2D, Point2D])[],
): Project {
  const project = house();
  const ground = project.building.levels[0]!;
  const model = ground.walls[0]!;
  return {
    ...project,
    building: {
      ...project.building,
      levels: [
        {
          ...ground,
          spaces: [],
          openings: [],
          walls: outline.map(([start, end], index) => ({
            ...model,
            id: `mur-${index}` as (typeof model)['id'],
            path: { points: [start, end] },
          })),
        },
      ],
      zones: [],
    },
  };
}

/** Le tour d'un contour, sommet à sommet, pour le donner en murs. */
function ring(
  points: readonly Point2D[],
): readonly (readonly [Point2D, Point2D])[] {
  return points.map((point, index) => [
    point,
    points[(index + 1) % points.length]!,
  ]);
}

/** Un écart franc, assez grand pour qu'aucun arrondi ne le fasse passer. */
const ECART: Point2D = { x: -640, y: 900 };

/** La même maison, une de ses pièces portant l'écart qu'on lui donne. */
function withOffset(
  project: Project,
  spaceId: string,
  labelOffsetMm: Point2D,
): Project {
  return {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level) => ({
        ...level,
        spaces: level.spaces.map((space) =>
          space.id === spaceId ? { ...space, labelOffsetMm } : space,
        ),
      })),
    },
  };
}

/**
 * La même maison, tous ses murs poussés vers l'est.
 *
 * Le niveau entier plutôt qu'un mur : ce qu'on veut mesurer est qu'une pièce
 * qui bouge emmène son étiquette, et déplacer un seul mur changerait aussi la
 * forme du contour — donc le point le plus au large — ce qui mélangerait deux
 * effets dans une seule mesure.
 */
function shiftedEast(project: Project, byMm: number): Project {
  return {
    ...project,
    building: {
      ...project.building,
      levels: project.building.levels.map((level) => ({
        ...level,
        walls: level.walls.map((wall) => ({
          ...wall,
          path: {
            ...wall.path,
            points: wall.path.points.map(({ x, y }) => ({ x: x + byMm, y })),
          },
        })),
      })),
    },
  };
}

/** La moyenne des sommets : ce que la pose faisait avant. */
function vertexAverage(points: readonly Point2D[]): Point2D {
  return points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

describe('what the plan writes on a closed contour', () => {
  it('writes a surface the way a plan writes it', () => {
    expect(areaLabel(12.4242)).toBe('12,42 m²');
    expect(areaLabel(8)).toBe('8,00 m²');
  });

  it('names the rooms the house already holds', () => {
    const labels = roomLabels(house(), undefined);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label.areaM2).toBeGreaterThan(0);
    // La maison de référence porte ses pièces : chacune est nommée, et aucune
    // n'attend qu'on la crée.
    expect(labels.every(({ spaceId }) => spaceId !== undefined)).toBe(true);
    expect(labels.some(({ name }) => name !== undefined)).toBe(true);
  });

  it('offers the room a closed contour does not carry yet', () => {
    // Les mêmes murs, sans les pièces : la surface reste lisible, et c'est
    // exactement le moment où le plan doit proposer d'en faire une pièce.
    const project = house();
    const ground = project.building.levels[0]!;
    const roomless = {
      ...project,
      building: {
        ...project.building,
        levels: [{ ...ground, spaces: [] }],
        zones: [],
      },
    };
    const labels = roomLabels(roomless, ground.id);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.spaceId).toBeUndefined();
      expect(label.name).toBeUndefined();
    }
  });

  it("écrit le nom d'une pièce en L dans la pièce, et non chez la voisine", () => {
    /*
     * Le cas qui a motivé UX-20. La moyenne des sommets d'un contour en L
     * tombe dans le creux du L — 1 067 mm hors du contour sur celui-ci — et le
     * creux d'un L, dans un plan, c'est la pièce d'à côté. « Séjour ·
     * 24,30 m² » écrit dans la cuisine se croit, et c'est pire que rien.
     */
    const outline: readonly Point2D[] = [
      { x: 0, y: 0 },
      { x: 8_000, y: 0 },
      { x: 8_000, y: 2_400 },
      { x: 2_400, y: 2_400 },
      { x: 2_400, y: 8_000 },
      { x: 0, y: 8_000 },
    ];
    const project = houseWalledBy(ring(outline));
    const ground = project.building.levels[0]!;
    const rooms = detectRooms(project, ground.id);
    expect(rooms).toHaveLength(1);
    const contour = rooms[0]!.polygon;
    expect(polygonContains(contour, vertexAverage(contour.outer))).toBe(false);

    const labels = roomLabels(project, ground.id);
    expect(labels).toHaveLength(1);
    expect(polygonContains(contour, labels[0]!.at)).toBe(true);
  });

  it("ne déplace pas une étiquette parce qu'un mur a été scindé", () => {
    /*
     * Deux fois la même pièce : un rectangle de 6 × 4 m dont le mur nord est
     * tracé d'un trait, puis le même dont le mur nord est tracé en six. C'est
     * ce que la détection produit dès que des refends viennent buter dessus —
     * la pièce n'a pas changé, seulement son nombre de sommets.
     *
     * La moyenne des sommets glissait alors de 2 000 mm du mur nord à 889 mm,
     * soit 1,1 m de dérive pour un mur posé ailleurs. Le point le plus au
     * large, lui, ne sait pas compter les sommets.
     */
    const corners: readonly Point2D[] = [
      { x: 0, y: 0 },
      { x: 6_000, y: 0 },
      { x: 6_000, y: 4_000 },
      { x: 0, y: 4_000 },
    ];
    const plain = houseWalledBy(ring(corners));
    const split = houseWalledBy([
      ...[0, 1_000, 2_000, 3_000, 4_000, 5_000].map(
        (x) =>
          [
            { x, y: 0 },
            { x: x + 1_000, y: 0 },
          ] as const,
      ),
      ...ring(corners).slice(1),
    ]);
    const here = roomLabels(plain, plain.building.levels[0]!.id)[0]!.at;
    const there = roomLabels(split, split.building.levels[0]!.id)[0]!.at;
    // Dix millimètres : la finesse que `label-placement.ts` s'autorise.
    expect(Math.hypot(here.x - there.x, here.y - there.y)).toBeLessThanOrEqual(
      10,
    );
    // Et il faut bien que l'ancienne pose, elle, dérive : sinon on ne mesure
    // rien du tout.
    const splitContour = detectRooms(split, split.building.levels[0]!.id)[0]!;
    expect(
      Math.abs(vertexAverage(splitContour.polygon.outer).y - here.y),
    ).toBeGreaterThan(1_000);
  });

  it("pose l'étiquette au point calculé plus l'écart que la pièce porte", () => {
    /*
     * Le cas que la mesure a trouvé : sur les deux maisons de référence, cinq
     * étiquettes sur dix-sept tombent à l'intérieur d'un objet déjà dessiné —
     * quatre sur le symbole d'un luminaire de plafond, une sur le débattement
     * de la porte des WC. Aucun calcul ne tranche : la pièce porte donc
     * l'écart qu'une personne a demandé, et la pose l'ajoute au point calculé.
     */
    const before = roomLabels(house(), undefined).find(
      ({ spaceId }) => spaceId !== undefined,
    )!;
    expect(before.offsetMm).toBeUndefined();
    expect(before.at).toEqual(before.anchorAt);

    const moved = roomLabels(
      withOffset(house(), before.spaceId!, ECART),
      undefined,
    ).find(({ spaceId }) => spaceId === before.spaceId)!;
    expect(moved.anchorAt).toEqual(before.anchorAt);
    expect(moved.offsetMm).toEqual(ECART);
    expect(moved.at).toEqual({
      x: before.anchorAt.x + ECART.x,
      y: before.anchorAt.y + ECART.y,
    });
  });

  it("garde l'étiquette déplacée avec sa pièce quand un mur bouge", () => {
    /*
     * Le cœur du sujet, et la raison pour laquelle c'est un **écart** qui est
     * enregistré et non une position.
     *
     * On déplace le niveau entier d'un mètre vers l'est : chaque pièce s'en va
     * avec ses murs, et l'étiquette déplacée doit s'en aller avec elle. Une
     * position absolue enregistrée resterait exactement où elle était — c'est
     * ce que la dernière assertion mesure, en comparant à la position d'avant
     * le déplacement.
     */
    const spaceId = roomLabels(house(), undefined).find(
      ({ spaceId: id }) => id !== undefined,
    )!.spaceId!;
    const before = roomLabels(
      withOffset(house(), spaceId, ECART),
      undefined,
    ).find((label) => label.spaceId === spaceId)!;
    const after = roomLabels(
      shiftedEast(withOffset(house(), spaceId, ECART), 1_000),
      undefined,
    ).find((label) => label.spaceId === spaceId)!;

    // L'étiquette a suivi la pièce, écart compris.
    expect(after.at.x - before.at.x).toBeCloseTo(1_000, 6);
    expect(after.at.y - before.at.y).toBeCloseTo(0, 6);
    expect(after.at).toEqual({
      x: after.anchorAt.x + ECART.x,
      y: after.anchorAt.y + ECART.y,
    });
    // L'écart, lui, n'a pas bougé : c'est une intention, pas une coordonnée.
    expect(after.offsetMm).toEqual(ECART);
    /*
     * Et il faut bien qu'une position enregistrée, elle, reste derrière :
     * sinon ce test ne mesure rien. `before.at` est exactement ce qu'un
     * champ « position de l'étiquette » aurait gardé dans le fichier — un
     * mètre à l'ouest de là où l'étiquette doit maintenant être.
     */
    expect(before.at.x).not.toBeCloseTo(after.at.x, 6);
  });

  it("ouvre un fichier écrit avant que l'écart existe", () => {
    /*
     * La maison de référence est un tel fichier : aucune de ses pièces ne
     * porte `labelOffsetMm`. Elle traverse la même validation qu'un fichier
     * importé — `loadDemoProject` passe par `loadProjectJson` — donc ce test
     * dit que le champ est bien facultatif dans le contrat persisté, et pas
     * seulement dans le type TypeScript.
     */
    const loaded = loadDemoProject();
    expect(loaded.status).toBe('OK');
    if (loaded.status !== 'OK') return;
    const spaces = loaded.file.project.building.levels.flatMap(
      (level) => level.spaces,
    );
    expect(spaces.length).toBeGreaterThan(0);
    for (const space of spaces)
      expect(Object.hasOwn(space, 'labelOffsetMm')).toBe(false);
    // Et le plan se lit quand même : chaque étiquette est posée au calcul.
    for (const label of roomLabels(loaded.file.project, undefined)) {
      expect(label.offsetMm).toBeUndefined();
      expect(label.at).toEqual(label.anchorAt);
    }
  });

  it('says nothing about a cupboard', () => {
    // Deux mots dans quarante centimètres se lisent moins bien qu'un vide.
    const big = roomLabels(house(), undefined, { minimumAreaM2: 1 }).length;
    expect(roomLabels(house(), undefined, { minimumAreaM2: 1000 })).toEqual([]);
    expect(big).toBeGreaterThan(0);
  });
});

describe('the dimensions a plan carries without being asked', () => {
  it('writes a length the way a plan writes it', () => {
    expect(measureLabel(4000)).toBe('4,00 m');
    expect(measureLabel(3245)).toBe('3,25 m');
  });

  it('carries two per named room, and none in « Aucune »', () => {
    const project = house();
    const auto = roomMeasures(project, undefined, { mode: 'AUTO' });
    const named = roomLabels(project, undefined).filter(
      ({ spaceId }) => spaceId !== undefined,
    );
    expect(auto).toHaveLength(named.length * 2);
    expect(auto.filter(({ axis }) => axis === 'X')).toHaveLength(named.length);
    expect(roomMeasures(project, undefined, { mode: 'NONE' })).toEqual([]);
  });

  it('leaves an unrecognised contour alone in « Auto »', () => {
    /*
     * Un contour que personne n'a encore reconnu n'est pas encore une pièce :
     * il porte sa surface, pour qu'on puisse la voir, mais pas ses cotes.
     * « Toutes » les donne à qui les veut.
     */
    const project = house();
    const ground = project.building.levels[0]!;
    const roomless = {
      ...project,
      building: {
        ...project.building,
        levels: [{ ...ground, spaces: [] }],
        zones: [],
      },
    };
    expect(roomMeasures(roomless, ground.id, { mode: 'AUTO' })).toEqual([]);
    expect(
      roomMeasures(roomless, ground.id, { mode: 'ALL' }).length,
    ).toBeGreaterThan(0);
  });

  it('measures only what is selected in « Sélection »', () => {
    const project = house();
    const first = roomLabels(project, undefined).find(
      ({ spaceId }) => spaceId !== undefined,
    )!;
    const measures = roomMeasures(project, undefined, {
      mode: 'SELECTION',
      selection: [first.spaceId!],
    });
    expect(measures).toHaveLength(2);
    expect(roomMeasures(project, undefined, { mode: 'SELECTION' })).toEqual([]);
  });
});
