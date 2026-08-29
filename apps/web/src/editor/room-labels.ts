/**
 * Ce que chaque contour fermé porte, écrit dessus.
 *
 * La surface d'une pièce était dans l'inspecteur, à une sélection de là, et un
 * contour fermé qui ne portait pas encore de pièce ne disait rien du tout : on
 * ne pouvait pas savoir, en regardant le plan, si les murs qu'on venait de
 * fermer étaient reconnus. C'est pourtant la question qu'on se pose à ce
 * moment-là, et le plan est l'endroit où la poser.
 *
 * Rien n'est calculé ici : `detectRooms` trouve les contours et leurs
 * surfaces depuis le début, `DesignState` les compte depuis V3-1. Ce fichier
 * les met en mots et en place.
 */
import { detectRooms } from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';
import type { Project } from '@house-technical-designer/core-domain';

import { labelAnchor } from './label-placement.js';

export interface RoomLabel {
  /** Ce qui l'identifie d'un rendu à l'autre. */
  readonly id: string;
  /** Le nom de la pièce, quand le contour en porte une. */
  readonly name?: string;
  readonly areaM2: number;
  /**
   * Le point du modèle où l'étiquette se pose : `anchorAt` plus `offsetMm`.
   *
   * **Rien de tout ça ne s'enregistre.** Ce point est recalculé à chaque
   * dessin, à partir du contour que la détection vient de trouver et de
   * l'écart que la pièce porte. C'est ce qui fait qu'un mur déplacé emmène
   * l'étiquette avec la pièce, écart compris : si la position absolue était
   * dans le fichier, elle resterait où elle a été posée — chez la voisine, si
   * la pièce a assez bougé.
   */
  readonly at: Point2D;
  /**
   * Le point que le calcul propose, sans l'écart.
   *
   * Le point le plus au large du contour, et non le milieu de sa boîte ni la
   * moyenne de ses sommets : `label-placement.ts` dit pourquoi, et de combien
   * les deux autres se trompent.
   *
   * Gardé à part de `at` parce que deux gestes en ont besoin : remettre
   * l'étiquette à sa place, et désigner le contour lui-même — une étiquette
   * qu'on a tirée sur le côté ne désigne plus la pièce qu'elle nomme, mais
   * ce point-ci, lui, est intérieur par construction.
   */
  readonly anchorAt: Point2D;
  /**
   * L'écart que la pièce porte, quand quelqu'un en a demandé un.
   *
   * Absent tant que personne n'a bougé l'étiquette : l'absence dit « le
   * calcul convient », ce qu'un `{ x: 0, y: 0 }` ne dirait pas. C'est aussi ce
   * qui permet de n'offrir de remise à zéro que là où elle veut dire quelque
   * chose.
   */
  readonly offsetMm?: Point2D;
  /** L'espace qui couvre déjà ce contour, s'il y en a un. */
  readonly spaceId?: string;
}

/** La surface, écrite comme un plan l'écrit. */
export function areaLabel(areaM2: number): string {
  return `${areaM2.toFixed(2).replace('.', ',')} m²`;
}

/**
 * Les étiquettes d'un niveau.
 *
 * Un contour trop petit n'en porte pas : deux mots dans un placard de
 * quarante centimètres se lisent moins bien qu'un placard vide.
 */
export function roomLabels(
  project: Project,
  levelId: string | undefined,
  options: { readonly minimumAreaM2?: number } = {},
): readonly RoomLabel[] {
  const level =
    levelId === undefined
      ? project.building.levels[0]
      : project.building.levels.find(({ id }) => id === levelId);
  if (level === undefined) return [];
  const minimum = options.minimumAreaM2 ?? 1;
  const spaces = new Map<string, (typeof level.spaces)[number]>(
    level.spaces.map((space) => [space.id as string, space]),
  );
  return detectRooms(project, level.id)
    .filter(({ areaM2 }) => areaM2 >= minimum)
    .map((room, index) => {
      const space =
        room.existingSpaceId === undefined
          ? undefined
          : spaces.get(room.existingSpaceId);
      const name = space?.name?.trim();
      /*
       * Le point calculé, puis l'écart qu'une personne a demandé.
       *
       * Deux natures différentes réunies au dernier moment : le premier est de
       * l'état dérivé — il se relit à chaque dessin et ne s'enregistre jamais
       * — le second est une donnée du projet, au même titre que le nom de la
       * pièce, parce qu'aucun calcul ne sait qu'un débattement de porte ou un
       * îlot de cuisine occupe déjà cet endroit-là. Ce qui est enregistré est
       * donc l'intention, et jamais son résultat.
       *
       * Un contour que rien ne couvre n'a pas de pièce, donc pas d'écart : le
       * calcul est tout ce qu'il a.
       */
      const anchorAt = labelAnchor(room.polygon);
      const offsetMm = space?.labelOffsetMm;
      return {
        id: room.existingSpaceId ?? `contour-${index}`,
        ...(name === undefined || name === '' ? {} : { name }),
        areaM2: room.areaM2,
        anchorAt,
        at:
          offsetMm === undefined
            ? anchorAt
            : { x: anchorAt.x + offsetMm.x, y: anchorAt.y + offsetMm.y },
        ...(offsetMm === undefined ? {} : { offsetMm }),
        ...(room.existingSpaceId === undefined
          ? {}
          : { spaceId: room.existingSpaceId }),
      };
    });
}

export interface RoomMeasure {
  readonly id: string;
  /** Les deux bouts de la cote, dans le modèle. */
  readonly from: Point2D;
  readonly to: Point2D;
  readonly lengthMm: number;
  readonly axis: 'X' | 'Y';
}

/** La longueur, écrite comme une cote de plan. */
export function measureLabel(lengthMm: number): string {
  return `${(lengthMm / 1000).toFixed(2).replace('.', ',')} m`;
}

/**
 * Les cotes qu'un plan porte sans qu'on les pose.
 *
 * Deux par contour : sa largeur et sa profondeur, prises sur ce que les murs
 * enferment — c'est-à-dire à l'intérieur, comme un plan d'architecte les
 * porte. Ce ne sont pas des objets du projet : elles se relisent à chaque
 * dessin et ne s'enregistrent jamais, exactement comme les surfaces.
 *
 * Ce qu'elles ne prétendent pas être : une cotation. Une pièce en L n'a ni
 * largeur ni profondeur, et ces deux traits en donnent une lecture
 * rectangulaire. L'outil Cotation reste là pour dire ce qu'on veut vraiment
 * dire.
 */
export function roomMeasures(
  project: Project,
  levelId: string | undefined,
  options: {
    readonly mode?: 'NONE' | 'SELECTION' | 'AUTO' | 'ALL';
    readonly selection?: readonly string[];
    readonly minimumAreaM2?: number;
  } = {},
): readonly RoomMeasure[] {
  const mode = options.mode ?? 'AUTO';
  if (mode === 'NONE') return [];
  const selected = new Set(options.selection ?? []);
  const measures: RoomMeasure[] = [];
  for (const label of roomLabels(project, levelId, options)) {
    if (mode === 'SELECTION' && !selected.has(label.spaceId ?? '')) continue;
    // En automatique, seules les pièces nommées portent leurs cotes : un
    // contour que personne n'a encore reconnu n'est pas encore une pièce.
    if (mode === 'AUTO' && label.spaceId === undefined) continue;
    const outline = outlineOf(project, levelId, label);
    if (outline === undefined) continue;
    const xs = outline.map(({ x }) => x);
    const ys = outline.map(({ y }) => y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    measures.push(
      {
        id: `${label.id}-x`,
        from: { x: left, y: top },
        to: { x: right, y: top },
        lengthMm: right - left,
        axis: 'X',
      },
      {
        id: `${label.id}-y`,
        from: { x: left, y: top },
        to: { x: left, y: bottom },
        lengthMm: bottom - top,
        axis: 'Y',
      },
    );
  }
  return measures;
}

/** Le contour d'une étiquette, retrouvé dans la détection. */
function outlineOf(
  project: Project,
  levelId: string | undefined,
  label: RoomLabel,
): readonly Point2D[] | undefined {
  const level =
    levelId === undefined
      ? project.building.levels[0]
      : project.building.levels.find(({ id }) => id === levelId);
  if (level === undefined) return undefined;
  return detectRooms(project, level.id).find(
    (room) =>
      room.existingSpaceId === label.spaceId &&
      Math.abs(room.areaM2 - label.areaM2) < 1e-6,
  )?.polygon.outer;
}
