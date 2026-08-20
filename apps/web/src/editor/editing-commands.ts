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
  AddOpeningCommand,
  AddRoofCommand,
  AddSlabCommand,
  AddWallCommand,
  DeleteDimensionCommand,
  DeleteOpeningCommand,
  DeleteWallCommand,
  MoveWallCommand,
  MoveWallPointCommand,
  ProjectEditorCommand,
  ProjectTransactionCommand,
  SetWallPathCommand,
  SplitWallCommand,
  TransactionCommand,
  UpdateNetworkNodeCommand,
  UpdateOpeningCommand,
  UpdateRoofCommand,
  UpdateSlabCommand,
  createOpeningInsertionCommand,
  withInsertedVertex,
  withMovedVertex,
  withoutVertex,
  type EditorCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import type { GeometryEdit } from './grips.js';

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

/** The editor command that deletes one object, whatever kind it is. */
function deleteCommandFor(
  level: NonNullable<ReturnType<typeof levelOf>>,
  objectId: string,
): EditorCommand | undefined {
  if (level.annotations.some(({ id }) => id === objectId))
    return new DeleteDimensionCommand(
      `delete-dimension:${objectId}`,
      dimensionId(objectId),
    );
  if (level.openings.some(({ id }) => id === objectId))
    return new DeleteOpeningCommand(
      `delete-opening:${objectId}`,
      entityId<'Opening'>(objectId),
    );
  if (level.walls.some(({ id }) => id === objectId))
    return new DeleteWallCommand(
      `delete-wall:${objectId}`,
      entityId<'Wall'>(objectId),
    );
  return undefined;
}

/**
 * Builds the single command that deletes everything the selection names.
 *
 * One user action is one command: deleting three walls either happens or does
 * not, and Ctrl+Z brings all three back. Running one command per object could
 * leave the model half-deleted when the third one is refused.
 */
export function deleteObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  const commands: EditorCommand[] = [];
  for (const objectId of objectIds) {
    const command = deleteCommandFor(level, objectId);
    if (command === undefined)
      return {
        status: 'ERROR',
        message: `Cet objet ne peut pas être supprimé depuis le plan : ${objectId}.`,
      };
    commands.push(command);
  }
  const id = `delete:${objectIds.join(',')}`;
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      id,
      objectIds.length === 1
        ? 'Supprimer un objet'
        : `Supprimer ${objectIds.length} objets`,
      level.id,
      commands.length === 1
        ? commands[0]!
        : new TransactionCommand(id, 'Supprimer la sélection', commands),
    ),
  };
}

/** A polygon carried elsewhere, holes included. */
function translated(polygon: Polygon2D, delta: Point2D): Polygon2D {
  const move = (point: Point2D): Point2D => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  });
  return {
    outer: polygon.outer.map(move),
    ...(polygon.holes === undefined
      ? {}
      : { holes: polygon.holes.map((hole) => hole.map(move)) }),
  };
}

/**
 * Moves what is selected, as one action.
 *
 * Not everything moves on its own: an opening belongs to its wall and slides
 * along it, a room is the space its walls enclose. Those are refused by name
 * rather than moved into an inconsistency, and the rest — walls, slabs, roof
 * planes and network nodes — travel together in a single history entry.
 */
export function moveObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  deltaMm: Point2D,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  if (!Number.isFinite(deltaMm.x) || !Number.isFinite(deltaMm.y))
    return { status: 'ERROR', message: 'Déplacement non mesurable.' };
  const commands: ProjectCommand[] = [];
  for (const objectId of objectIds) {
    const wall = level.walls.find(({ id }) => id === objectId);
    if (wall !== undefined) {
      commands.push(
        new ProjectEditorCommand(
          `wall:move:${objectId}`,
          'Déplacer un mur',
          level.id,
          new MoveWallCommand(`wall:move:${objectId}`, wall.id, deltaMm),
        ),
      );
      continue;
    }
    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined) {
      commands.push(
        new UpdateSlabCommand(level.id, slab.id, {
          polygon: translated(slab.polygon, deltaMm),
        }),
      );
      continue;
    }
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined) {
      commands.push(
        new UpdateRoofCommand(level.id, roof.id, {
          footprint: translated(roof.footprint, deltaMm),
        }),
      );
      continue;
    }
    const network = (file.project.systems ?? []).find((candidate) =>
      candidate.nodes.some(({ id }) => id === objectId),
    );
    const node = network?.nodes.find(({ id }) => id === objectId);
    if (network !== undefined && node !== undefined) {
      commands.push(
        new UpdateNetworkNodeCommand(network.id, node.id, {
          position: {
            x: node.position.x + deltaMm.x,
            y: node.position.y + deltaMm.y,
            z: node.position.z,
          },
        }),
      );
      continue;
    }
    if (level.openings.some(({ id }) => id === objectId))
      return {
        status: 'ERROR',
        message:
          'Une ouverture se déplace le long de son mur : faites glisser sa poignée.',
      };
    if (level.spaces.some(({ id }) => id === objectId))
      return {
        status: 'ERROR',
        message:
          'Une pièce est l’espace que ses murs enferment : déplacez les murs.',
      };
    return {
      status: 'ERROR',
      message: `Cet objet ne se déplace pas depuis le plan : ${objectId}.`,
    };
  }
  const id = `move:${objectIds.join(',')}`;
  return {
    status: 'OK',
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            objectIds.length === 1
              ? 'Déplacer un objet'
              : `Déplacer ${objectIds.length} objets`,
            commands,
          ),
  };
}

/**
 * How a selection is being transformed.
 *
 * Both are one map from a point to a point: turning around a centre, or
 * reflecting across an axis. Expressing them the same way is what lets walls,
 * slabs, roof planes and network nodes all follow the same code.
 */
export type PlanTransform =
  | {
      readonly kind: 'ROTATE';
      readonly centre: Point2D;
      readonly angleDeg: number;
    }
  | {
      readonly kind: 'MIRROR';
      /** Two points of the axis the selection is reflected across. */
      readonly from: Point2D;
      readonly to: Point2D;
    };

/** The point a transform sends this one to. */
export function transformPoint(
  transform: PlanTransform,
  point: Point2D,
): Point2D {
  if (transform.kind === 'ROTATE') {
    const radians = (transform.angleDeg * Math.PI) / 180;
    const dx = point.x - transform.centre.x;
    const dy = point.y - transform.centre.y;
    return {
      x: transform.centre.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: transform.centre.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  }
  const axis = {
    x: transform.to.x - transform.from.x,
    y: transform.to.y - transform.from.y,
  };
  const lengthSquared = axis.x * axis.x + axis.y * axis.y;
  // An axis of no length reflects nothing; the point stays where it is rather
  // than becoming a division by zero.
  if (lengthSquared === 0) return point;
  const dx = point.x - transform.from.x;
  const dy = point.y - transform.from.y;
  const projection = (dx * axis.x + dy * axis.y) / lengthSquared;
  const foot = {
    x: transform.from.x + axis.x * projection,
    y: transform.from.y + axis.y * projection,
  };
  return { x: 2 * foot.x - point.x, y: 2 * foot.y - point.y };
}

function transformedPolygon(
  polygon: Polygon2D,
  transform: PlanTransform,
): Polygon2D {
  const move = (point: Point2D) => transformPoint(transform, point);
  return {
    outer: polygon.outer.map(move),
    ...(polygon.holes === undefined
      ? {}
      : { holes: polygon.holes.map((hole) => hole.map(move)) }),
  };
}

/**
 * Turns or reflects what is selected, as one action.
 *
 * A wall is reshaped in a single step rather than point by point: moving its
 * points one at a time passes through lengths the wall never has, and an
 * opening that fits before and after would be refused in between.
 */
export function transformObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  transform: PlanTransform,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  if (transform.kind === 'ROTATE' && !Number.isFinite(transform.angleDeg))
    return { status: 'ERROR', message: 'Angle non mesurable.' };
  const commands: ProjectCommand[] = [];
  for (const objectId of objectIds) {
    const wall = level.walls.find(({ id }) => id === objectId);
    if (wall !== undefined) {
      commands.push(
        new ProjectEditorCommand(
          `wall:transform:${objectId}`,
          transform.kind === 'ROTATE' ? 'Pivoter un mur' : 'Retourner un mur',
          level.id,
          new SetWallPathCommand(
            `wall:transform:${objectId}`,
            wall.id,
            wall.path.points.map((point) => transformPoint(transform, point)),
          ),
        ),
      );
      continue;
    }
    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined) {
      commands.push(
        new UpdateSlabCommand(level.id, slab.id, {
          polygon: transformedPolygon(slab.polygon, transform),
        }),
      );
      continue;
    }
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined) {
      commands.push(
        new UpdateRoofCommand(level.id, roof.id, {
          footprint: transformedPolygon(roof.footprint, transform),
        }),
      );
      continue;
    }
    const network = (file.project.systems ?? []).find((candidate) =>
      candidate.nodes.some(({ id }) => id === objectId),
    );
    const node = network?.nodes.find(({ id }) => id === objectId);
    if (network !== undefined && node !== undefined) {
      const moved = transformPoint(transform, node.position);
      commands.push(
        new UpdateNetworkNodeCommand(network.id, node.id, {
          position: { x: moved.x, y: moved.y, z: node.position.z },
        }),
      );
      continue;
    }
    if (level.openings.some(({ id }) => id === objectId))
      return {
        status: 'ERROR',
        message:
          'Une ouverture suit son mur : faites pivoter le mur qui la porte.',
      };
    return {
      status: 'ERROR',
      message: `Cet objet ne se transforme pas depuis le plan : ${objectId}.`,
    };
  }
  const id = `${transform.kind.toLowerCase()}:${objectIds.join(',')}`;
  const label =
    transform.kind === 'ROTATE'
      ? `Pivoter ${objectIds.length} objet(s)`
      : `Retourner ${objectIds.length} objet(s)`;
  return {
    status: 'OK',
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(id, label, commands),
  };
}

/** What a duplication produced, so the copies can be selected in its place. */
export type DuplicationResult =
  | {
      readonly status: 'OK';
      readonly command: ProjectCommand;
      readonly createdIds: readonly string[];
    }
  | { readonly status: 'ERROR'; readonly message: string };

/**
 * Copies what is selected, a little to the side.
 *
 * The copies are what the user then works on, so their identifiers are
 * reported: a duplication that leaves the originals selected looks like
 * nothing happened.
 *
 * An opening belongs to a wall. Its copy is hosted by the copy of that wall
 * when the wall was duplicated too, and refused otherwise: put back on the same
 * wall at the same place it would sit exactly under the original.
 */
export function duplicateObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  deltaMm: Point2D,
  newId: (prefix: string) => string,
): DuplicationResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length === 0)
    return { status: 'ERROR', message: 'La sélection est vide.' };
  const commands: ProjectCommand[] = [];
  const createdIds: string[] = [];
  /** The copy each duplicated wall got, so its openings can follow it. */
  const copiedWalls = new Map<string, string>();

  for (const objectId of objectIds) {
    const wall = level.walls.find(({ id }) => id === objectId);
    if (wall === undefined) continue;
    const copyId = newId('wall');
    copiedWalls.set(wall.id, copyId);
    createdIds.push(copyId);
    commands.push(
      new ProjectEditorCommand(
        `wall:duplicate:${copyId}`,
        'Dupliquer un mur',
        level.id,
        new AddWallCommand(`wall:duplicate:${copyId}`, {
          ...wall,
          id: copyId as Wall['id'],
          path: {
            points: wall.path.points.map((point) => ({
              x: point.x + deltaMm.x,
              y: point.y + deltaMm.y,
            })),
          },
        }),
      ),
    );
  }

  for (const objectId of objectIds) {
    if (copiedWalls.has(objectId)) continue;
    const opening = level.openings.find(({ id }) => id === objectId);
    if (opening !== undefined) {
      const host = copiedWalls.get(opening.hostElementId);
      if (host === undefined)
        return {
          status: 'ERROR',
          message:
            'Une ouverture ne se duplique qu’avec son mur : sélectionnez aussi le mur qui la porte.',
        };
      const copyId = newId('opening');
      createdIds.push(copyId);
      commands.push(
        new ProjectEditorCommand(
          `opening:duplicate:${copyId}`,
          'Dupliquer une ouverture',
          level.id,
          new AddOpeningCommand(`opening:duplicate:${copyId}`, {
            ...opening,
            id: copyId as Opening['id'],
            hostElementId: host as Opening['hostElementId'],
          }),
        ),
      );
      continue;
    }
    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined) {
      const copyId = newId('slab');
      createdIds.push(copyId);
      commands.push(
        new AddSlabCommand(level.id, {
          id: copyId,
          polygon: translated(slab.polygon, deltaMm),
          assemblyId: slab.assemblyId,
          role: slab.role,
          elevationOffsetMm: slab.elevationOffsetMm,
        }),
      );
      continue;
    }
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined) {
      const copyId = newId('roof');
      createdIds.push(copyId);
      commands.push(
        new AddRoofCommand(level.id, {
          id: copyId,
          footprint: translated(roof.footprint, deltaMm),
          assemblyId: roof.assemblyId,
          slopeDeg: roof.slopeDeg,
          azimuthDeg: roof.azimuthDeg,
          baseElevationMm: roof.baseElevationMm,
        }),
      );
      continue;
    }
    return {
      status: 'ERROR',
      message: `Cet objet ne se duplique pas depuis le plan : ${objectId}.`,
    };
  }

  if (commands.length === 0)
    return {
      status: 'ERROR',
      message: 'Rien de sélectionné ne se duplique depuis le plan.',
    };
  const id = `duplicate:${createdIds.join(',')}`;
  return {
    status: 'OK',
    createdIds,
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            createdIds.length === 1
              ? 'Dupliquer un objet'
              : `Dupliquer ${createdIds.length} objets`,
            commands,
          ),
  };
}

/**
 * Cuts a wall where the user pointed.
 *
 * Splitting from the toolbar cut at the middle, whatever the user had in mind;
 * the domain command has always taken a point, and this is what hands it the
 * one that was clicked. The point is projected onto the wall, so a click a
 * little beside it still cuts where it was aimed.
 */
export function splitWallCommand(
  file: ProjectFile,
  levelId: string | undefined,
  wallId: string,
  at: Point2D,
  newWallId: string,
): EditingCommandResult {
  return geometryEditCommand(
    file,
    levelId,
    { kind: 'WALL_SPLIT', wallId, at },
    newWallId,
  );
}

/**
 * The command a dragged handle produces.
 *
 * The canvas reports what was dragged and where it landed; turning that into an
 * edit of the project happens here, where the commands are known and where a
 * refusal can be explained.
 */
export function geometryEditCommand(
  file: ProjectFile,
  levelId: string | undefined,
  edit: GeometryEdit,
  newWallId?: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Aucun niveau actif.' };
  switch (edit.kind) {
    case 'WALL_POINT':
      return {
        status: 'OK',
        command: new ProjectEditorCommand(
          `wall:point:${edit.wallId}:${edit.pointIndex}`,
          'Déplacer une extrémité de mur',
          level.id,
          new MoveWallPointCommand(
            `wall:point:${edit.wallId}`,
            edit.wallId as Wall['id'],
            edit.pointIndex,
            edit.to,
          ),
        ),
      };
    case 'WALL_MOVE':
      return {
        status: 'OK',
        command: new ProjectEditorCommand(
          `wall:move:${edit.wallId}`,
          'Déplacer un mur',
          level.id,
          new MoveWallCommand(
            `wall:move:${edit.wallId}`,
            edit.wallId as Wall['id'],
            edit.delta,
          ),
        ),
      };
    case 'WALL_SPLIT': {
      if (newWallId === undefined)
        return {
          status: 'ERROR',
          message: 'Aucun identifiant disponible pour le mur créé.',
        };
      return {
        status: 'OK',
        command: new ProjectEditorCommand(
          `wall:split:${edit.wallId}`,
          'Scinder un mur',
          level.id,
          new SplitWallCommand(
            `wall:split:${edit.wallId}`,
            edit.wallId as Wall['id'],
            edit.at,
            newWallId as Wall['id'],
          ),
        ),
      };
    }
    case 'OPENING_OFFSET':
      return {
        status: 'OK',
        command: new UpdateOpeningCommand(level.id, edit.openingId, {
          offsetAlongHostMm: edit.offsetMm,
        }),
      };
    case 'POLYGON_VERTEX':
    case 'POLYGON_INSERT':
    case 'POLYGON_REMOVE': {
      const slab =
        edit.objectKind === 'SLAB'
          ? level.slabs.find(({ id }) => id === edit.objectId)
          : undefined;
      const roof =
        edit.objectKind === 'ROOF'
          ? level.roofs.find(({ id }) => id === edit.objectId)
          : undefined;
      const polygon = slab?.polygon ?? roof?.footprint;
      if (polygon === undefined)
        return {
          status: 'ERROR',
          message: `${edit.objectId} est introuvable.`,
        };
      const next =
        edit.kind === 'POLYGON_VERTEX'
          ? withMovedVertex(polygon, edit.vertexIndex, edit.to)
          : edit.kind === 'POLYGON_INSERT'
            ? withInsertedVertex(polygon, edit.edgeIndex, edit.at)
            : withoutVertex(polygon, edit.vertexIndex);
      if (next === undefined)
        return {
          status: 'ERROR',
          message:
            'Un contour garde au moins trois sommets : celui-ci ne peut pas en perdre un de plus.',
        };
      return {
        status: 'OK',
        command:
          slab === undefined
            ? new UpdateRoofCommand(level.id, edit.objectId, {
                footprint: next,
              })
            : new UpdateSlabCommand(level.id, edit.objectId, { polygon: next }),
      };
    }
  }
}
