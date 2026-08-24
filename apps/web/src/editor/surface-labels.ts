/**
 * Ce que chaque surface dessinée porte, écrit dessus.
 *
 * Une parcelle fermée ne montrait qu'un trait pointillé pâle : pas d'aire, pas
 * de nom, rien. L'écran redevenait blanc au moment même où l'objet venait
 * d'exister, et la seule façon de savoir ce qu'on avait tracé était de le
 * sélectionner pour lire l'inspecteur — c'est-à-dire de deviner qu'il y avait
 * quelque chose à sélectionner.
 *
 * Les étiquettes de pièces (`room-labels.ts`) répondent à « ce que les murs
 * enferment » ; celles-ci répondent à « ce que j'ai tracé ». Ce sont deux
 * questions et deux dessins, et la seconde n'existait pas.
 *
 * ## Ce qui est écrit, et ce qui ne l'est pas
 *
 * Le terrain, toujours : la parcelle et ce qui la borde **sont** le contenu de
 * cet espace, et une parcelle sans son aire n'apprend rien.
 *
 * Les dalles, les toitures et les trémies, seulement quand elles sont
 * désignées : une maison en porte plusieurs, superposées, et trois nombres
 * empilés au milieu du séjour se lisent moins bien qu'aucun.
 *
 * Rien n'est calculé ici : `polygonSurface` dit où sont les contours et
 * `polygonFacts` ce qu'ils mesurent.
 */
import type { Project } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

import { areaLabel } from './room-labels.js';
import { polygonFacts } from './polygon-edits.js';
import { polygonSurface, surfaceIds } from './polygon-surface.js';

export interface SurfaceLabel {
  readonly objectId: string;
  /** Le nom de l'objet — « Parcelle », « Dalle », « Trémie ». */
  readonly label: string;
  readonly areaM2: number;
  /** Le point du modèle où l'étiquette se pose. */
  readonly at: Point2D;
  /** Vrai quand elle est là parce qu'on a désigné son objet. */
  readonly selected: boolean;
}

function centreOf(points: readonly Point2D[]): Point2D {
  return points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

/** L'aire écrite comme un plan l'écrit, précédée de ce que c'est. */
export function surfaceMeasureLabel(surface: SurfaceLabel): string {
  return `${surface.label} · ${areaLabel(surface.areaM2)}`;
}

export function surfaceLabels(
  project: Project,
  levelId: string | undefined,
  selection: readonly string[],
  options: { readonly minimumAreaM2?: number } = {},
): readonly SurfaceLabel[] {
  const minimum = options.minimumAreaM2 ?? 0.25;
  const chosen = new Set(selection);
  const labels: SurfaceLabel[] = [];
  for (const objectId of surfaceIds(project, levelId)) {
    const surface = polygonSurface(project, levelId, objectId);
    if (surface === undefined) continue;
    const selected = chosen.has(objectId);
    // Le terrain se lit toujours ; le reste, quand on le désigne.
    if (!selected && surface.kind !== 'SITE') continue;
    const facts = polygonFacts(surface.outline);
    if (facts === undefined || facts.areaM2 < minimum) continue;
    labels.push({
      objectId,
      label: surface.label,
      areaM2: facts.areaM2,
      at: centreOf(surface.outline),
      selected,
    });
  }
  return labels;
}
