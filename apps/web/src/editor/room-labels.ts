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

export interface RoomLabel {
  /** Ce qui l'identifie d'un rendu à l'autre. */
  readonly id: string;
  /** Le nom de la pièce, quand le contour en porte une. */
  readonly name?: string;
  readonly areaM2: number;
  /** Le point du modèle où l'étiquette se pose. */
  readonly at: Point2D;
  /** L'espace qui couvre déjà ce contour, s'il y en a un. */
  readonly spaceId?: string;
}

/** La surface, écrite comme un plan l'écrit. */
export function areaLabel(areaM2: number): string {
  return `${areaM2.toFixed(2).replace('.', ',')} m²`;
}

/** Le centre du contour, où l'étiquette se pose. */
function centreOf(points: readonly Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  return points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
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
      return {
        id: room.existingSpaceId ?? `contour-${index}`,
        ...(name === undefined || name === '' ? {} : { name }),
        areaM2: room.areaM2,
        at: centreOf(room.polygon.outer),
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
