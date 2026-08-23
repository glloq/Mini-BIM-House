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
