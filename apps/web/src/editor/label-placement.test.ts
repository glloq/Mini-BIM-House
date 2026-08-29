import { describe, expect, it } from 'vitest';
import {
  interiorLabelPoint,
  polygonContains,
} from '@house-technical-designer/geometry';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';

import {
  LABEL_PRECISION_MM,
  labelAnchor,
  labelPrecisionMm,
} from './label-placement.js';

/**
 * La moyenne des sommets : ce que la pose faisait avant, gardée ici.
 *
 * Chaque test ci-dessous la nomme, et chacun échoue si on la remet en place de
 * `labelAnchor` — c'est la seule façon de savoir qu'un test mesure autre chose
 * que sa propre indulgence.
 */
function vertexAverage(points: readonly Point2D[]): Point2D {
  return points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

/** La distance au bord le plus proche, trous compris ; négative dehors. */
function clearanceMm(polygon: Polygon2D, point: Point2D): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const ring of [polygon.outer, ...(polygon.holes ?? [])])
    for (const [index, from] of ring.entries()) {
      const to = ring[(index + 1) % ring.length]!;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const lengthSquared = dx * dx + dy * dy;
      const ratio =
        lengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((point.x - from.x) * dx + (point.y - from.y) * dy) /
                  lengthSquared,
              ),
            );
      nearest = Math.min(
        nearest,
        Math.hypot(
          point.x - (from.x + ratio * dx),
          point.y - (from.y + ratio * dy),
        ),
      );
    }
  return polygonContains(polygon, point) ? nearest : -nearest;
}

/** Une pièce en L de 8 × 8 m, à retour de 2,4 m. */
const ell: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 8_000, y: 0 },
    { x: 8_000, y: 2_400 },
    { x: 2_400, y: 2_400 },
    { x: 2_400, y: 8_000 },
    { x: 0, y: 8_000 },
  ],
};

/** Un couloir coudé en U, 9 × 7 m, dont le creux occupe le milieu. */
const horseshoe: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 9_000, y: 0 },
    { x: 9_000, y: 7_000 },
    { x: 6_000, y: 7_000 },
    { x: 6_000, y: 2_500 },
    { x: 3_000, y: 2_500 },
    { x: 3_000, y: 7_000 },
    { x: 0, y: 7_000 },
  ],
};

/** Un séjour de 8 × 8 m percé d'une trémie d'escalier de 3 × 3 m au milieu. */
const pierced: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 8_000, y: 0 },
    { x: 8_000, y: 8_000 },
    { x: 0, y: 8_000 },
  ],
  holes: [
    [
      { x: 2_500, y: 2_500 },
      { x: 5_500, y: 2_500 },
      { x: 5_500, y: 5_500 },
      { x: 2_500, y: 5_500 },
    ],
  ],
};

/** Un rectangle de 6 × 4 m, tel qu'un mur non coupé le rend. */
const plainRectangle: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 6_000, y: 0 },
    { x: 6_000, y: 4_000 },
    { x: 0, y: 4_000 },
  ],
};

/**
 * Le même rectangle, mur nord scindé en six.
 *
 * C'est ce que produit la détection dès que cinq refends viennent buter sur ce
 * mur : la pièce n'a pas changé de forme, seulement de nombre de sommets.
 */
const splitRectangle: Polygon2D = {
  outer: [
    { x: 0, y: 0 },
    { x: 1_000, y: 0 },
    { x: 2_000, y: 0 },
    { x: 3_000, y: 0 },
    { x: 4_000, y: 0 },
    { x: 5_000, y: 0 },
    { x: 6_000, y: 0 },
    { x: 6_000, y: 4_000 },
    { x: 0, y: 4_000 },
  ],
};

describe("où l'étiquette d'un contour se pose", () => {
  it('reste dans une pièce en L, là où la moyenne des sommets en sort', () => {
    /*
     * Le cas qui fait mal : la moyenne des sommets d'un L tombe dans le creux
     * du L, donc dans la pièce d'à côté. Elle en est ici à 1 067 mm dehors.
     */
    const average = vertexAverage(ell.outer);
    expect(polygonContains(ell, average)).toBe(false);
    expect(clearanceMm(ell, average)).toBeLessThan(-1_000);

    const anchor = labelAnchor(ell);
    expect(polygonContains(ell, anchor)).toBe(true);
    expect(clearanceMm(ell, anchor)).toBeGreaterThan(1_400);
  });

  it('reste dans un couloir coudé en U', () => {
    // Le creux d'un U est plus large que celui d'un L : la moyenne y est à
    // 1 500 mm dehors, et aucune tolérance ne la rattrape.
    const average = vertexAverage(horseshoe.outer);
    expect(polygonContains(horseshoe, average)).toBe(false);

    const anchor = labelAnchor(horseshoe);
    expect(polygonContains(horseshoe, anchor)).toBe(true);
    expect(clearanceMm(horseshoe, anchor)).toBeGreaterThan(1_500);
  });

  it('évite la trémie qui perce le contour', () => {
    /*
     * Un contour percé en son milieu est le cas où la moyenne des sommets est
     * exactement au pire endroit : au centre du trou. Elle y est ici à
     * 1 500 mm à l'intérieur du vide.
     */
    const average = vertexAverage(pierced.outer);
    expect(polygonContains(pierced, average)).toBe(false);

    const anchor = labelAnchor(pierced);
    expect(polygonContains(pierced, anchor)).toBe(true);
    // Entre le mur et la trémie il reste 2 500 mm : l'étiquette se pose au
    // milieu de cette bande, donc à 1 250 mm de chacun des deux bords.
    expect(clearanceMm(pierced, anchor)).toBeGreaterThan(1_200);
  });

  it('ne bouge pas quand un mur est scindé sans que la pièce change', () => {
    /*
     * L'invariance qui manquait. Scinder le mur nord en six ne change pas la
     * pièce : ni sa forme, ni sa surface, ni l'endroit où son nom se lit. La
     * moyenne des sommets, elle, glisse de 1 111 mm vers ce mur — de 2 000 mm
     * du bord à 889 mm.
     */
    const plainAverage = vertexAverage(plainRectangle.outer);
    const splitAverage = vertexAverage(splitRectangle.outer);
    expect(
      Math.hypot(
        plainAverage.x - splitAverage.x,
        plainAverage.y - splitAverage.y,
      ),
    ).toBeGreaterThan(1_000);

    const plain = labelAnchor(plainRectangle);
    const split = labelAnchor(splitRectangle);
    expect(
      Math.hypot(plain.x - split.x, plain.y - split.y),
    ).toBeLessThanOrEqual(LABEL_PRECISION_MM);
    expect(clearanceMm(splitRectangle, split)).toBeGreaterThan(
      2_000 - LABEL_PRECISION_MM,
    );
  });

  it('tient la garantie que sa borne annonce', () => {
    /*
     * Ce que la borne promet n'est pas « le point exact » mais « un point dont
     * le dégagement est à moins d'une finesse de l'optimum ». C'est ce qui se
     * vérifie, et c'est ce qui se casserait si quelqu'un desserrait la borne
     * pour gagner une milliseconde.
     *
     * Le pentagone est volontairement oblique : pas un de ses côtés ne
     * s'aligne sur le quadrillage de la recherche, ce qui est le pire cas pour
     * elle. Sur les contours rectilignes des maisons de référence, l'écart
     * mesuré est nul.
     */
    const oblique: Polygon2D = {
      outer: [
        { x: 137, y: 211 },
        { x: 5_311, y: 401 },
        { x: 6_133, y: 3_907 },
        { x: 3_001, y: 5_557 },
        { x: 401, y: 4_337 },
      ],
    };
    // 0,05 mm : quarante fois plus fin que la borne, donc l'optimum à l'échelle
    // où on le compare. Trop lent pour un rendu, ce qui est tout le sujet.
    const best = interiorLabelPoint(oblique, 0.05)!;
    const anchor = labelAnchor(oblique);
    expect(clearanceMm(oblique, anchor)).toBeGreaterThan(
      best.clearance - labelPrecisionMm(oblique),
    );
    // Et il faut bien que la moyenne des sommets, elle, échoue à cette
    // garantie : sinon le test ne mesure rien.
    expect(clearanceMm(oblique, vertexAverage(oblique.outer))).toBeLessThan(
      best.clearance - labelPrecisionMm(oblique),
    );
  });
});

describe('jusquoù la recherche descend', () => {
  it('vise le centimètre sur une pièce, et pas mieux sur un plateau', () => {
    /*
     * Le centimètre pour tout ce qui est une pièce ; au-delà de 5 m de petit
     * côté, un cinq-centième du contour, pour que le nombre de subdivisions ne
     * grandisse pas avec lui. Voir `label-placement.ts` : huit au plus, quel
     * que soit le contour.
     */
    expect(labelPrecisionMm(plainRectangle)).toBe(LABEL_PRECISION_MM);
    expect(labelPrecisionMm(ell)).toBe(8_000 / 500);
    const plateau: Polygon2D = {
      outer: [
        { x: 0, y: 0 },
        { x: 60_000, y: 0 },
        { x: 60_000, y: 40_000 },
        { x: 0, y: 40_000 },
      ],
    };
    expect(labelPrecisionMm(plateau)).toBe(40_000 / 500);
    // La borne relative n'a de sens que si elle plafonne le compte de
    // subdivisions : `log₂(petitCôté × √2 / 4 / finesse)` ne dépasse jamais 8.
    for (const polygon of [plainRectangle, ell, horseshoe, pierced, plateau]) {
      const xs = polygon.outer.map(({ x }) => x);
      const ys = polygon.outer.map(({ y }) => y);
      const shorter = Math.min(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
      const rounds = Math.log2(
        (shorter * Math.SQRT2) / 4 / labelPrecisionMm(polygon),
      );
      expect(rounds).toBeLessThanOrEqual(8);
    }
  });

  it("rend un point même pour un contour qui n'a pas d'intérieur", () => {
    // Deux sommets ne font pas un contour, et un contour plat n'a pas de
    // dedans : la pose doit rendre quelque chose plutôt que rien, parce que
    // l'appelant dessine une étiquette et n'a pas de branche « nulle part ».
    expect(labelAnchor({ outer: [] })).toEqual({ x: 0, y: 0 });
    expect(
      labelAnchor({
        outer: [
          { x: 0, y: 0 },
          { x: 1_000, y: 0 },
          { x: 2_000, y: 0 },
        ],
      }),
    ).toEqual({ x: 1_000, y: 0 });
  });
});
