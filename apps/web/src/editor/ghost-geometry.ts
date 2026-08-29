import type { SceneGeometry } from '@house-technical-designer/drawing-engine';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import {
  transformPoint,
  transformedPolygon,
  type PlanTransform,
} from './object-transform.js';

/**
 * The shape a dragged object would have once dropped.
 *
 * The ghost and the command must never describe two different things: a
 * stairwell left behind by the preview and carried by the edit would be a
 * drawing the user cannot trust. The outlines go through the very function the
 * command uses, so they cannot drift apart.
 */
export function carriedGeometry(
  geometry: SceneGeometry,
  delta: Point2D,
): SceneGeometry {
  return transformedGeometry(geometry, { kind: 'TRANSLATE', deltaMm: delta });
}

/**
 * La même chose pour un déplacement, une rotation ou un miroir.
 *
 * Tourner une sélection ne se voyait pas : l'outil Pivoter demande un centre
 * et deux directions, et l'on découvrait le résultat au troisième clic. Un
 * geste dont on ne voit le résultat qu'une fois fait est un geste qu'on
 * refait, ce qui est le contraire de ce que trois clics coûtent.
 *
 * Le fantôme passe par `transformPoint`, c'est-à-dire par la fonction même
 * que la commande de transformation applique, et non par une rotation
 * réécrite ici : deux façons de tourner un point finiraient par tourner
 * différemment, et l'aperçu recommencerait à promettre ce qui ne sera pas.
 */
export function transformedGeometry(
  geometry: SceneGeometry,
  transform: PlanTransform,
): SceneGeometry {
  const moved = (point: Point2D): Point2D => transformPoint(transform, point);
  if (geometry.kind === 'POLYGON')
    return {
      ...geometry,
      polygon: transformedPolygon(geometry.polygon, transform),
    };
  if (geometry.kind === 'POLYLINE')
    return {
      ...geometry,
      polyline: {
        ...geometry.polyline,
        points: geometry.polyline.points.map(moved),
      },
    };
  if (geometry.kind === 'POINT')
    return { ...geometry, point: moved(geometry.point) };
  return { ...geometry, anchor: moved(geometry.anchor) };
}

/**
 * L'emprise que l'objet occupera, dessinée avant qu'on clique.
 *
 * Un composant se posait sans qu'on ait rien vu : l'outil n'a qu'un clic, et
 * l'aperçu du canvas ne se construit qu'à partir du deuxième point. On
 * découvrait donc la taille d'un lit une fois le lit posé, et l'on recommençait
 * — ce qui est la définition d'une interface qu'on subit.
 *
 * Le rectangle est celui que la fiche déclare, tourné de l'angle que son
 * support impose. Pas un carré de convention : un lit fait deux mètres sur un
 * mètre quarante et une prise huit centimètres sur quatre, et c'est justement
 * cette différence qu'on veut voir avant de choisir l'endroit.
 *
 * Rien n'est dessiné quand la fiche ne dit pas ses deux dimensions au sol.
 * Compléter la manquante par l'autre inventerait un chiffre, et un fantôme qui
 * ment sur la taille est pire que pas de fantôme : on l'a cru.
 */
export function componentGhostOutline(
  centre: Point2D,
  dimensions:
    { readonly widthMm?: number; readonly depthMm?: number } | undefined,
  rotationDeg: number,
): Polygon2D | undefined {
  const widthMm = dimensions?.widthMm;
  const depthMm = dimensions?.depthMm;
  if (
    widthMm === undefined ||
    depthMm === undefined ||
    !Number.isFinite(widthMm) ||
    !Number.isFinite(depthMm) ||
    widthMm <= 0 ||
    depthMm <= 0
  )
    return undefined;
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = widthMm / 2;
  const halfDepth = depthMm / 2;
  // La largeur court le long de l'objet, la profondeur en travers : c'est ce
  // que la fiche entend par ces deux mots, et c'est ce qui fait qu'un radiateur
  // posé contre un mur le longe au lieu de le percer.
  const corner = (alongWidth: number, alongDepth: number): Point2D => ({
    x: centre.x + alongWidth * halfWidth * cos - alongDepth * halfDepth * sin,
    y: centre.y + alongWidth * halfWidth * sin + alongDepth * halfDepth * cos,
  });
  return {
    outer: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)],
  };
}

/**
 * La taille de l'emprise, écrite comme le reste du dessin l'écrit.
 *
 * Le mètre à deux décimales est la forme que portent déjà la longueur d'un mur
 * en cours de tracé et l'aire d'une surface qu'on referme ; une deuxième forme
 * pour la même grandeur ferait deux façons de lire le même plan.
 */
export function footprintLabel(widthMm: number, depthMm: number): string {
  return `${(widthMm / 1000).toFixed(2)} × ${(depthMm / 1000).toFixed(2)} m`;
}
