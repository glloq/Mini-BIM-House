import type {
  Dimension,
  DimensionType,
  Opening,
  Project,
  ProjectFile,
  Wall,
} from '@house-technical-designer/core-domain';
import { dimensionId, entityId } from '@house-technical-designer/core-domain';
import {
  AddDimensionCommand,
  AddWallCommand,
  DeleteDimensionCommand,
  DeleteOpeningCommand,
  DeleteWallCommand,
  ProjectEditorCommand,
  createOpeningInsertionCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';

/** How far from a wall axis an opening may be dropped, in millimetres. */
const MAXIMUM_HOST_DISTANCE_MM = 600;

/** How far from a wall endpoint a dimension click may land, in millimetres. */
const MAXIMUM_ENDPOINT_DISTANCE_MM = 1200;

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

export interface DimensionToolDraft {
  readonly dimensionType: DimensionType;
}

interface EndpointHit {
  readonly reference: Dimension['first'];
  readonly point: Point2D;
  readonly distanceMm: number;
}

/** The wall endpoint a click landed on, if one is close enough to have been meant. */
function nearestWallEndpoint(
  walls: readonly Wall[],
  point: Point2D,
): EndpointHit | undefined {
  const candidates: EndpointHit[] = [];
  for (const wall of walls) {
    const ends = [
      { endpoint: 'START' as const, point: wall.path.points[0] },
      { endpoint: 'END' as const, point: wall.path.points.at(-1) },
    ];
    for (const end of ends) {
      if (end.point === undefined) continue;
      candidates.push({
        reference: {
          kind: 'WALL_ENDPOINT',
          wallId: wall.id,
          endpoint: end.endpoint,
        },
        point: end.point,
        distanceMm: Math.hypot(end.point.x - point.x, end.point.y - point.y),
      });
    }
  }
  return candidates
    .filter(({ distanceMm }) => distanceMm <= MAXIMUM_ENDPOINT_DISTANCE_MM)
    .sort((first, second) => first.distanceMm - second.distanceMm)[0];
}

/**
 * Builds the command that adds a dimension between two wall endpoints.
 *
 * The two first points name what is measured; the third sets how far the
 * dimension line sits from it. The offset is signed, so the user places the
 * line on the side they clicked rather than on a side the application chose.
 */
export function addDimensionCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: DimensionToolDraft,
  id: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 3)
    return {
      status: 'ERROR',
      message: 'Une cote demande deux extrémités puis un point de décalage.',
    };
  const first = nearestWallEndpoint(level.walls, points[0]!);
  const second = nearestWallEndpoint(level.walls, points[1]!);
  if (first === undefined || second === undefined)
    return {
      status: 'ERROR',
      message:
        'Une cote se rattache à deux extrémités de murs : cliquez plus près des angles.',
    };
  if (
    first.reference.wallId === second.reference.wallId &&
    first.reference.endpoint === second.reference.endpoint
  )
    return {
      status: 'ERROR',
      message: 'Une cote demande deux extrémités distinctes.',
    };
  const dimension: Dimension = {
    id: dimensionId(id),
    kind: 'DIMENSION',
    type: draft.dimensionType,
    first: first.reference,
    second: second.reference,
    offsetMm: signedOffsetMm(first.point, second.point, points[2]!),
  };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-dimension:${dimension.id}`,
      'Ajouter une cote',
      level.id,
      new AddDimensionCommand(`add-dimension:${dimension.id}`, dimension),
    ),
  };
}

/** Distance from the measured line to the third click, signed by its side. */
function signedOffsetMm(
  first: Point2D,
  second: Point2D,
  target: Point2D,
): number {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return 0;
  return Math.round(
    ((target.x - first.x) * -dy + (target.y - first.y) * dx) / length,
  );
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
  if (level.annotations.some(({ id }) => id === objectId))
    return {
      status: 'OK',
      command: new ProjectEditorCommand(
        `delete-dimension:${objectId}`,
        'Supprimer une cote',
        level.id,
        new DeleteDimensionCommand(
          `delete-dimension:${objectId}`,
          dimensionId(objectId),
        ),
      ),
    };
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
