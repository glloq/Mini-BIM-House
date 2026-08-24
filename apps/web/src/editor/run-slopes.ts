/**
 * La pente d'un tronçon, écrite sur le tronçon.
 *
 * Une évacuation horizontale est une évacuation qui ne s'écoule pas, et rien
 * ne le disait sur le plan : il fallait sélectionner le tronçon et lire une
 * propriété. Or c'est en le traçant qu'on veut le savoir.
 *
 * Rien n'est stocké : `routeFall` calcule la chute des deux bouts et du
 * parcours, et refuse d'être une seconde réponse à la même question. Ce
 * fichier la met en mots et en place.
 *
 * Seules les disciplines qui coulent en portent une. Un câble n'a pas de
 * pente, une gaine non plus, et leur en écrire une serait inventer une
 * exigence que personne n'a.
 */
import { routeFall } from '@house-technical-designer/editor-core';
import type {
  NetworkDiscipline,
  Project,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

/** Les disciplines dont la pente est une question. */
const GRAVITY: readonly NetworkDiscipline[] = ['WASTEWATER', 'RAINWATER'];

export interface RunSlope {
  readonly id: string;
  /** Le milieu du tronçon, où l'étiquette se pose. */
  readonly at: Point2D;
  readonly slopePercent: number;
  /** Ce qu'une évacuation demande, quand elle demande quelque chose. */
  readonly tooFlat: boolean;
}

/** La pente en dessous de laquelle une évacuation ne s'écoule plus. */
export const MINIMUM_FALL_PERCENT = 1;

export function runSlopes(
  project: Project,
  options: { readonly selection?: readonly string[] } = {},
): readonly RunSlope[] {
  const selected = new Set(options.selection ?? []);
  const slopes: RunSlope[] = [];
  for (const network of project.systems ?? []) {
    if (!GRAVITY.includes(network.discipline)) continue;
    for (const edge of network.edges) {
      if (selected.size > 0 && !selected.has(edge.id)) continue;
      const fall = routeFall(edge.path);
      if (fall.slopePercent === undefined) continue;
      const middle = edge.path[Math.floor(edge.path.length / 2)];
      const before =
        edge.path[Math.max(0, Math.floor(edge.path.length / 2) - 1)];
      if (middle === undefined || before === undefined) continue;
      slopes.push({
        id: edge.id,
        at: { x: (middle.x + before.x) / 2, y: (middle.y + before.y) / 2 },
        slopePercent: fall.slopePercent,
        tooFlat: fall.slopePercent < MINIMUM_FALL_PERCENT,
      });
    }
  }
  return slopes;
}

/** La pente, écrite comme un plombier la dit. */
export function slopeLabel(slopePercent: number): string {
  return `${slopePercent.toFixed(1).replace('.', ',')} %`;
}
