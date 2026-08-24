/**
 * Ce que le tracé en cours mesure déjà.
 *
 * On traçait une parcelle en aveugle : les sommets se posaient, et la surface
 * n'apparaissait qu'une fois l'objet créé — donc on créait, on lisait, on
 * annulait, on recommençait. Une surface se dessine pour une aire ; l'aire
 * doit être là pendant qu'on la dessine.
 *
 * Rien n'est mémorisé : les points en attente sont dans l'état de l'éditeur,
 * et ces lignes ne font que les lire. Le sommet sous le curseur compte comme
 * s'il était posé — c'est la question qu'on se pose en le déplaçant.
 */
import {
  polygonArea,
  ringPerimeter,
  type Point2D,
} from '@house-technical-designer/geometry';

import type { CompletionMode } from './tool-registry.js';

export interface DraftMeasures {
  /** Le contour parcouru, en mm : fermé pour une surface, ouvert sinon. */
  readonly perimeterMm: number;
  /** L'aire, en m², et seulement quand le contour se referme. */
  readonly areaM2?: number;
}

/**
 * Les mesures du tracé, curseur compris.
 *
 * Deux points ne font pas une surface, et trois n'en font une que s'ils ne
 * sont pas alignés : une aire nulle ne s'écrit pas, parce qu'un « 0,00 m² »
 * se lit comme une panne alors que c'est un contour qui n'existe pas encore.
 */
export function draftMeasures(
  points: readonly Point2D[],
  mode: CompletionMode,
): DraftMeasures | undefined {
  if (points.length < 2) return undefined;
  if (mode === 'FINISH_PATH') {
    let total = 0;
    for (let index = 1; index < points.length; index += 1)
      total += Math.hypot(
        points[index]!.x - points[index - 1]!.x,
        points[index]!.y - points[index - 1]!.y,
      );
    return total > 0 ? { perimeterMm: total } : undefined;
  }
  const perimeterMm = ringPerimeter(points);
  // Deux sommets au même endroit ne mesurent rien : « 0,00 m » à côté du
  // curseur se lit comme une panne, pas comme un contour qui n'existe pas.
  if (perimeterMm <= 0) return undefined;
  if (points.length < 3) return { perimeterMm };
  const areaMm2 = polygonArea({ outer: points });
  if (areaMm2 <= 0) return { perimeterMm };
  return { perimeterMm, areaM2: areaMm2 / 1e6 };
}

/** Une longueur en mètres, écrite comme on l'écrit sur un plan. */
export function lengthLabel(millimetres: number): string {
  return `${(millimetres / 1000).toFixed(2).replace('.', ',')} m`;
}

/** Ce qui s'écrit à côté du curseur pendant qu'on trace. */
export function draftMeasureLabel(measures: DraftMeasures): string {
  const perimeter = lengthLabel(measures.perimeterMm);
  return measures.areaM2 === undefined
    ? perimeter
    : `${measures.areaM2.toFixed(2).replace('.', ',')} m² · ${perimeter}`;
}
