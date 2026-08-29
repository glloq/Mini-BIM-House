/**
 * Où une étiquette se pose dans un contour.
 *
 * Elle se posait à la moyenne des sommets du contour. Ce n'est même pas le
 * centre de gravité de la surface : c'est celui des sommets, ce qui n'est pas
 * la même chose et n'a aucune raison d'être au milieu de quoi que ce soit. Les
 * deux erreurs que ça produit ne sont pas de même gravité.
 *
 * La première se voit. Dès qu'un côté porte plus de sommets que les autres —
 * un refend qui vient buter sur un mur et le scinde, une ouverture qui coupe
 * une paroi, un décrochement — la moyenne penche de ce côté. Mesuré sur un
 * rectangle de 6 × 4 m dont le mur nord est scindé en six segments : le point
 * tombe à 889 mm du mur nord, au lieu des 2 000 mm du milieu. L'étiquette a
 * glissé de 1,1 m vers un mur sans que rien de ce que l'utilisateur voit ait
 * bougé — on a seulement posé une cloison ailleurs.
 *
 * La seconde est grave. Sur un contour non convexe, ce point sort de la pièce.
 * Mesuré sur une pièce en L de 8 × 8 m à retour de 2,4 m : la moyenne des
 * sommets tombe 1 067 mm **à l'extérieur** du contour ; sur une pièce en U de
 * 9 × 7 m, 1 500 mm à l'extérieur. À l'extérieur d'une pièce, dans un plan, il
 * y a une autre pièce : on lit « Séjour · 24,30 m² » écrit dans la cuisine, et
 * un nom posé dans la mauvaise pièce est pire qu'un nom absent, parce qu'il se
 * croit.
 *
 * Ce qu'un plan d'architecte fait à la place : le point le plus au large, le
 * plus éloigné de tout bord — son « pôle d'inaccessibilité ». Il est intérieur
 * par construction, c'est celui qui laisse le plus de place au texte, et il ne
 * bouge pas quand on scinde un mur.
 *
 * La recherche elle-même n'est pas ici. `interiorLabelPoint`, dans
 * `packages/geometry`, la fait déjà — le rendu papier (`plan-view.ts`) s'en
 * sert depuis le début, et c'est précisément pour ça que le dessin exporté
 * posait les noms correctement pendant que l'éditeur les posait de travers.
 * Ce fichier ne fait que ce que la géométrie ne peut pas décider à notre
 * place : jusqu'où pousser la recherche, puisqu'elle tourne à chaque dessin,
 * et quoi répondre quand elle ne répond pas.
 */
import {
  boundingBox2D,
  interiorLabelPoint,
} from '@house-technical-designer/geometry';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';

/**
 * La finesse de la recherche, en millimètres : le centimètre.
 *
 * D'où vient ce nombre : c'est le premier barreau de la règle du plan. Le
 * `LADDER` de `model-grid.ts` commence à 10 mm, donc le centimètre est la plus
 * petite longueur que l'éditeur sache jamais montrer comme un pas distinct. En
 * viser une plus fine, c'est payer pour une différence que personne ne peut
 * regarder.
 *
 * Ce que la borne coûte, mesuré contre une recherche de référence à 0,25 mm :
 *
 * — sur les quinze contours des deux maisons de référence, le point trouvé à
 *   10 mm est **exactement** celui trouvé à 0,25 mm — 0,00 mm d'écart. Les
 *   pièces sont rectilignes, leur pôle tombe sur un point que le quadrillage
 *   atteint dès les premières subdivisions, et affiner ne trouve rien de plus ;
 * — sur un pentagone volontairement oblique, où pas un côté ne s'aligne sur le
 *   quadrillage — le pire cas pour une recherche par carreaux — le point
 *   s'écarte de 8,96 mm et perd 2,38 mm de dégagement sur 800, soit trois
 *   millièmes de la place disponible ;
 * — le niveau de la maison graphique, onze contours, se place en 4,8 ms à
 *   10 mm, contre 24,3 ms à 2 mm et 1,1 ms à 50 mm. La détection des contours
 *   qui tourne juste avant, elle, coûte 0,4 ms : la pose reste le poste le
 *   plus cher des deux, et c'est pour ça qu'elle est bornée plutôt que laissée
 *   au défaut relatif de `interiorLabelPoint`.
 */
export const LABEL_PRECISION_MM = 10;

/**
 * Le plafond de finesse relative : jamais mieux qu'un cinq-centième du petit
 * côté du contour.
 *
 * Une borne uniquement absolue laisserait le nombre de subdivisions croître
 * avec la taille du contour : un plateau de 40 m coûterait deux tours de plus
 * qu'une chambre de 3 m, et rien ne garantirait qu'un contour absurdement
 * grand ne bloque pas le dessin. Avec ce rapport, le compte est borné une fois
 * pour toutes, et il se calcule.
 *
 * La recherche part de cellules dont la demi-largeur vaut `petitCôté / 4`,
 * puis les divise en quatre à chaque tour ; elle cesse de descendre dès que la
 * demi-diagonale d'une cellule, `demi × √2`, passe sous la finesse demandée.
 * Le nombre de subdivisions vaut donc au plus
 * `log₂(petitCôté × √2 / 4 / finesse)`, et comme `finesse` ne descend jamais
 * sous `petitCôté / 500`, cette expression plafonne à
 * `log₂(500 × √2 / 4) ≈ 7,47` : **huit subdivisions au plus, quel que soit le
 * contour**. Un contour de 3 m en demande cinq, un de 5 m huit, un de 40 m
 * huit aussi.
 */
const PRECISION_RATIO = 500;

/**
 * La finesse à demander pour ce contour-ci, en millimètres.
 *
 * Exportée parce que c'est la borne, et qu'une borne qu'aucun test ne peut
 * lire n'est pas une borne : c'est un commentaire.
 */
export function labelPrecisionMm(polygon: Polygon2D): number {
  const box = boundingBox2D(polygon.outer);
  if (box === undefined) return LABEL_PRECISION_MM;
  const shorterSideMm = Math.min(box.max.x - box.min.x, box.max.y - box.min.y);
  return Math.max(LABEL_PRECISION_MM, shorterSideMm / PRECISION_RATIO);
}

/**
 * Le point du contour où poser son étiquette.
 *
 * Le polygone est passé entier, trous compris. `detectSpaceBoundaries` ne
 * construit aujourd'hui que des contours pleins — elle écrit `{ outer: cycle }`
 * et ne renseigne jamais `holes` — mais `Polygon2D` en porte, un espace décrit
 * à la main en porte, et `interiorLabelPoint` sait déjà les éviter : leur
 * bord compte dans la distance, et leur intérieur compte comme dehors. Ne rien
 * filtrer ici, c'est faire que le jour où un contour percé arrive — une trémie
 * dans un séjour, un patio — l'étiquette l'évite sans qu'on ait à revenir.
 */
export function labelAnchor(polygon: Polygon2D): Point2D {
  const found = interiorLabelPoint(polygon, labelPrecisionMm(polygon));
  if (found !== undefined) return found.point;
  /*
   * Le repli, et pourquoi il ne trahit personne.
   *
   * `interiorLabelPoint` ne rend rien quand le contour n'a pas trois sommets,
   * quand sa boîte est plate, ou quand aucune cellule sondée ne tombe dedans —
   * c'est-à-dire pour des contours qui n'ont pas d'intérieur à parler d'.
   * Sur un tel contour, aucun point n'est meilleur qu'un autre : la moyenne
   * des sommets vaut ce que vaut n'importe quoi d'autre, et elle a le mérite
   * d'exister toujours. Ce qui serait faux, c'est de la garder pour les
   * contours qui, eux, ont un intérieur.
   */
  return vertexAverage(polygon.outer);
}

function vertexAverage(points: readonly Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  return points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}
