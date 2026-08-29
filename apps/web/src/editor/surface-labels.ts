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
 * Le terrain, dans le Terrain : la parcelle et ce qui la borde **sont** le
 * contenu de cet espace, et une parcelle sans son aire n'apprend rien. C'est
 * là, et seulement là, qu'on se demande combien elle fait.
 *
 * Ailleurs, rien. « Parcelle · 742 m² » restait écrit en travers du dessin
 * dans les sept espaces, y compris ceux où la parcelle n'est qu'un cadre
 * qu'on ne peut pas toucher : au milieu du plan du bâtiment, l'aire du terrain
 * répond à une question que personne n'a posée, et elle la répond par-dessus
 * les pièces. Une sélection ne la ramène pas non plus — l'inspecteur donne
 * l'aire de ce qu'on désigne, et c'est lui qu'on regarde quand on a désigné
 * quelque chose.
 *
 * Les dalles, les toitures et les trémies, seulement quand elles sont
 * désignées : une maison en porte plusieurs, superposées, et trois nombres
 * empilés au milieu du séjour se lisent moins bien qu'aucun.
 *
 * Rien n'est calculé ici, et rien n'est retenu : `polygonSurface` dit où sont
 * les contours, `polygonFacts` ce qu'ils mesurent, et l'aire est refaite à
 * chaque appel. Une surface écrite dans le modèle serait fausse au premier
 * sommet déplacé.
 */
import type { Project } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

import type { CreationStageId } from '../ux/creation-stages.js';

import { labelAnchor } from './label-placement.js';
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

/** L'aire écrite comme un plan l'écrit, précédée de ce que c'est. */
export function surfaceMeasureLabel(surface: SurfaceLabel): string {
  return `${surface.label} · ${areaLabel(surface.areaM2)}`;
}

export interface SurfaceLabelOptions {
  /**
   * L'espace ouvert.
   *
   * Exigé, et non deviné : ces étiquettes sont écrites sur le dessin, et une
   * fonction qui se passe de l'espace écrit l'aire du terrain dans les sept.
   * Le paramètre est là pour qu'un appelant qui l'ignore ne compile pas.
   */
  readonly stage: CreationStageId;
  readonly minimumAreaM2?: number;
}

export function surfaceLabels(
  project: Project,
  levelId: string | undefined,
  selection: readonly string[],
  options: SurfaceLabelOptions,
): readonly SurfaceLabel[] {
  const minimum = options.minimumAreaM2 ?? 0.25;
  const chosen = new Set(selection);
  const labels: SurfaceLabel[] = [];
  for (const objectId of surfaceIds(project, levelId)) {
    const surface = polygonSurface(project, levelId, objectId);
    if (surface === undefined) continue;
    const selected = chosen.has(objectId);
    /*
     * Le terrain se lit dans le Terrain, et nulle part ailleurs ; le reste,
     * quand on le désigne.
     *
     * Les deux conditions ne se cumulent pas : la parcelle ne revient pas
     * parce qu'on l'a sélectionnée depuis le Bâtiment. C'est ce que veut dire
     * « elle appartient au Terrain » — ailleurs, elle est du contexte, et le
     * contexte ne s'annote pas.
     */
    if (surface.kind === 'SITE') {
      if (options.stage !== 'SITE') continue;
    } else if (!selected) continue;
    const facts = polygonFacts(surface.outline);
    if (facts === undefined || facts.areaM2 < minimum) continue;
    labels.push({
      objectId,
      label: surface.label,
      areaM2: facts.areaM2,
      /*
       * Le point le plus au large, comme pour une pièce.
       *
       * C'était la moyenne des sommets, qui n'est le centre de rien : une
       * parcelle en L écrivait son aire hors de la parcelle, et une dalle
       * dont un côté porte plus de sommets que les autres — ce qui arrive dès
       * qu'on en scinde un — voyait son étiquette dériver vers ce côté.
       *
       * `outline` est un anneau nu, d'où l'enveloppe. Réserve à lever un
       * jour : `polygon-surface.ts` ne rend que le contour extérieur d'une
       * dalle, si bien qu'une trémie qui la perce est déjà perdue avant
       * d'arriver ici. L'étiquette se pose donc au large du contour sans
       * savoir qu'il est percé — mieux qu'avant, pas encore juste.
       */
      at: labelAnchor({ outer: surface.outline }),
      selected,
    });
  }
  return labels;
}
