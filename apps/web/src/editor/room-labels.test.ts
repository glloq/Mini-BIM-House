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
