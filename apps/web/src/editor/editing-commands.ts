import type {
  Opening,
  Project,
  ProjectFile,
  Wall,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import {
  AddWallCommand,
  DeleteOpeningCommand,
  DeleteWallCommand,
  ProjectEditorCommand,
  createOpeningInsertionCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';

/** How far from a wall axis an opening may be dropped, in millimetres. */
const MAXIMUM_HOST_DISTANCE_MM = 600;

export interface WallToolDraft {
  readonly assemblyId: string;
  readonly role: Wall['role'];
}

export interface OpeningToolDraft {
  readonly openingType: 'DOOR' | 'WINDOW';
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
}

function levelOf(project: Project, levelId: string | undefined) {
  return levelId === undefined
    ? project.building.levels[0]
    : project.building.levels.find(({ id }) => id === levelId);
}

export type EditingCommandResult =
  | { readonly status: 'OK'; readonly command: ProjectCommand }
  | { readonly status: 'ERROR'; readonly message: string };

/** Builds the command that adds a wall between two drafted points. */
export function addWallCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: WallToolDraft,
  wallId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 2)
    return { status: 'ERROR', message: 'Un mur demande deux points.' };
  const assembly = (file.project.assemblies ?? []).find(
    ({ id }) => id === draft.assemblyId,
  );
  if (assembly === undefined)
    return {
      status: 'ERROR',
      message: `Assemblage inconnu : ${draft.assemblyId || 'aucun'}.`,
    };
  const wall: Wall = {
    id: entityId<'Wall'>(wallId),
    type: 'WALL',
    levelId: level.id,
    path: { points: [points[0]!, points[points.length - 1]!] },
    referenceSide: 'CENTER',
    assemblyId: assembly.id,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: level.defaultStoreyHeightMm,
    role: draft.role,
  };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-wall:${wall.id}`,
      'Ajouter un mur',
      level.id,
      new AddWallCommand(`add-wall:${wall.id}`, wall),
    ),
  };
}

/**
 * Builds the command that inserts an opening.
 *
 * The point is projected onto the nearest wall, so the user drops the opening
 * roughly where they want it and the model keeps it hosted exactly on the wall.
 */
export function addOpeningCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: OpeningToolDraft,
  openingId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const command = createOpeningInsertionCommand(point, level.walls, {
    maximumHostDistanceMm: MAXIMUM_HOST_DISTANCE_MM,
    commandId: () => `add-opening:${openingId}`,
    createOpening: (placement): Opening => ({
      id: entityId<'Opening'>(openingId),
      type: 'OPENING',
      openingType: draft.openingType,
      hostElementId: placement.host.id,
      offsetAlongHostMm: Math.max(
        0,
        Math.round(placement.offsetAlongHostMm - draft.widthMm / 2),
      ),
      sillHeightMm: draft.sillHeightMm,
      widthMm: draft.widthMm,
      heightMm: draft.heightMm,
    }),
  });
  if (command === undefined)
    return {
      status: 'ERROR',
      message: 'Aucun mur assez proche pour héberger cette ouverture.',
    };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-opening:${openingId}`,
      'Ajouter une ouverture',
      level.id,
      command,
    ),
  };
}

/** Builds the command that deletes whichever object the selection names. */
export function deleteObjectCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (level.openings.some(({ id }) => id === objectId))
    return {
      status: 'OK',
      command: new ProjectEditorCommand(
        `delete-opening:${objectId}`,
        'Supprimer une ouverture',
        level.id,
        new DeleteOpeningCommand(
          `delete-opening:${objectId}`,
          entityId<'Opening'>(objectId),
        ),
      ),
    };
  if (level.walls.some(({ id }) => id === objectId))
    return {
      status: 'OK',
      command: new ProjectEditorCommand(
        `delete-wall:${objectId}`,
        'Supprimer un mur',
        level.id,
        new DeleteWallCommand(
          `delete-wall:${objectId}`,
          entityId<'Wall'>(objectId),
        ),
      ),
    };
  return {
    status: 'ERROR',
    message: `Cet objet ne peut pas être supprimé depuis le plan : ${objectId}.`,
  };
}
