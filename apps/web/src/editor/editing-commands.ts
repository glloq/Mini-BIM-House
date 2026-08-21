import type {
  ComponentCategory,
  Dimension,
  DimensionType,
  SiteObstacleKind,
  StairType,
  StructuralMemberKind,
  Opening,
  Project,
  ProjectFile,
  RoofPlane,
  Slab,
  Wall,
} from '@house-technical-designer/core-domain';
import { dimensionId, entityId } from '@house-technical-designer/core-domain';
import {
  AddComponentCommand,
  AddDimensionCommand,
  AddOpeningCommand,
  AddRoofCommand,
  AddRoofStructureCommand,
  AddSlabCommand,
  AddSiteObstacleCommand,
  AddSpaceCommand,
  AddStairCommand,
  AddStructuralMemberCommand,
  AddWallCommand,
  MoveNetworkEdgeVertexCommand,
  MoveWallCommand,
  MoveWallPointCommand,
  ProjectEditorCommand,
  ProjectTransactionCommand,
  SetParcelBoundaryCommand,
  SetWallPathCommand,
  SplitWallCommand,
  UpdateComponentCommand,
  UpdateNetworkNodeCommand,
  UpdateOpeningCommand,
  UpdateRoofCommand,
  UpdateSlabCommand,
  createOpeningInsertionCommand,
  detectRooms,
  withInsertedVertex,
  withMovedVertex,
  withoutVertex,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import type { GeometryEdit } from './grips.js';
import { removalCommandFor } from './object-editors.js';

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
 * Builds the walls a run of points describes.
 *
 * A house is drawn as a run — corner, corner, corner — and not as a series of
 * unrelated pairs of clicks. Two readings of the same run are both legitimate
 * and neither is guessable: a wall per side, which can then take its own
 * assembly and its own openings; or one polyline wall, which stays one thing
 * when it is moved. The user says which.
 */
export function addWallRunCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: WallToolDraft,
  options: {
    readonly asOneWall: boolean;
    readonly closed: boolean;
    readonly newId: (prefix: string) => string;
  },
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const assembly = (file.project.assemblies ?? []).find(
    ({ id }) => id === draft.assemblyId,
  );
  if (assembly === undefined)
    return {
      status: 'ERROR',
      message: `Assemblage inconnu : ${draft.assemblyId || 'aucun'}.`,
    };
  // Two clicks at the same place are one point, not a wall of no length; the
  // run keeps what the user actually described.
  const corners: Point2D[] = [];
  for (const point of points) {
    const last = corners[corners.length - 1];
    if (last === undefined || last.x !== point.x || last.y !== point.y)
      corners.push(point);
  }
  const path =
    options.closed && corners.length > 2 ? [...corners, corners[0]!] : corners;
  if (path.length < 2)
    return {
      status: 'ERROR',
      message: 'Un mur demande deux points distincts.',
    };

  const wallAt = (walls: readonly Point2D[], id: string): Wall => ({
    id: entityId<'Wall'>(id),
    type: 'WALL',
    levelId: level.id,
    path: { points: walls },
    referenceSide: 'CENTER',
    assemblyId: assembly.id,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: level.defaultStoreyHeightMm,
    role: draft.role,
  });

  if (options.asOneWall) {
    const wall = wallAt(path, options.newId('wall'));
    return {
      status: 'OK',
      command: new ProjectEditorCommand(
        `add-wall:${wall.id}`,
        'Ajouter un mur polyligne',
        level.id,
        new AddWallCommand(`add-wall:${wall.id}`, wall),
      ),
    };
  }

  const commands: ProjectCommand[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const wall = wallAt(
      [path[index - 1]!, path[index]!],
      options.newId('wall'),
    );
    commands.push(
      new ProjectEditorCommand(
        `add-wall:${wall.id}`,
        'Ajouter un mur',
        level.id,
        new AddWallCommand(`add-wall:${wall.id}`, wall),
      ),
    );
  }
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `wall-run:${commands.length}:${options.newId('')}`,
      commands.length === 1
        ? 'Ajouter un mur'
        : `Ajouter ${commands.length} murs`,
      commands,
    ),
  };
}

/**
 * Builds the four walls of a rectangle drawn by its opposite corners.
 *
 * Drawing a house begins by enclosing it, and enclosing it by four clicks that
 * must land on right angles is four chances to miss one.
 */
export function addWallRectangleCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: WallToolDraft,
  newId: (prefix: string) => string,
): EditingCommandResult {
  const [from, to] = points;
  if (from === undefined || to === undefined)
    return { status: 'ERROR', message: 'Deux coins opposés sont attendus.' };
  if (from.x === to.x || from.y === to.y)
    return {
      status: 'ERROR',
      message: 'Les deux coins doivent délimiter une surface.',
    };
  return addWallRunCommand(
    file,
    levelId,
    [from, { x: to.x, y: from.y }, to, { x: from.x, y: to.y }],
    draft,
    { asOneWall: false, closed: true, newId },
  );
}

/**
 * Places one thing in the building, where the user pointed.
 *
 * The room it stands in is read from the plan rather than asked for: the user
 * has just pointed at a place, and that place is in a room or it is not. What
 * the model does not know it leaves unsaid — a component outside every room is
 * a component with no room, not a component in the first one.
 */
export function placeComponentCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: {
    readonly category: ComponentCategory;
    readonly definitionId?: string;
    readonly name?: string;
    readonly elevationMm: number;
  },
  componentId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const room = level.spaces.find(
    (space) =>
      space.boundaryMode === 'MANUAL' &&
      pointInPolygon(point, space.manualPolygon.outer),
  );
  return {
    status: 'OK',
    command: new AddComponentCommand(level.id, {
      id: componentId,
      category: draft.category,
      ...(draft.definitionId === undefined || draft.definitionId === ''
        ? {}
        : { definitionId: draft.definitionId }),
      ...(draft.name === undefined || draft.name.trim() === ''
        ? {}
        : { name: draft.name }),
      position: { x: point.x, y: point.y },
      elevationMm: draft.elevationMm,
      rotationDeg: 0,
      ...(room === undefined ? {} : { spaceId: room.id }),
    }),
  };
}

/**
 * Builds a stair along the line the user walked with the pointer.
 *
 * The storey it arrives at is the one just above, because that is what a stair
 * between two floors does; the inspector lets it be sent elsewhere. Its riser
 * height is never asked for: the storeys already answer it.
 */
export function addStairCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly stairType: StairType;
    readonly widthMm: number;
    readonly riserCount: number;
    readonly treadDepthMm: number;
  },
  stairId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 2)
    return {
      status: 'ERROR',
      message: 'Une ligne de foulée demande deux points.',
    };
  const above = file.project.building.levels
    .filter(({ elevationMm }) => elevationMm > level.elevationMm)
    .sort((first, second) => first.elevationMm - second.elevationMm)[0];
  if (above === undefined)
    return {
      status: 'ERROR',
      message: `Aucun niveau ne se trouve au-dessus de ${level.name} : un escalier n’aurait nulle part où monter.`,
    };
  return {
    status: 'OK',
    command: new AddStairCommand(level.id, {
      id: stairId,
      topLevelId: above.id,
      stairType: draft.stairType,
      widthMm: draft.widthMm,
      riserCount: draft.riserCount,
      treadDepthMm: draft.treadDepthMm,
      path: points.map((point) => ({ ...point })),
    }),
  };
}

/**
 * Builds a roof from the outline that was drawn, or from the walls below it.
 *
 * Every side starts as a slope of the same pitch, which is a hipped roof; the
 * inspector turns the sides that should be gables into gables. Nothing about
 * the shape is guessed at creation, because the two-sided roof and the hipped
 * roof have the same outline and only the user knows which was meant.
 */
export function addRoofStructureCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly assemblyId: string;
    readonly slopeDeg: number;
    readonly overhangMm: number;
    readonly fromWalls: boolean;
  },
  roofId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  let outline: readonly Point2D[];
  if (draft.fromWalls) {
    const point = points[0];
    if (point === undefined)
      return { status: 'ERROR', message: 'Un point est attendu.' };
    const room = detectRooms(file.project, level.id).find((candidate) =>
      pointInPolygon(point, candidate.polygon.outer),
    );
    if (room === undefined)
      return {
        status: 'ERROR',
        message: 'Ce point n’est dans aucun contour fermé par les murs.',
      };
    outline = room.polygon.outer;
  } else {
    if (points.length < 3)
      return { status: 'ERROR', message: 'Une toiture demande trois points.' };
    outline = points;
  }
  return {
    status: 'OK',
    command: new AddRoofStructureCommand(level.id, {
      id: roofId,
      footprint: { outer: outline.map((point) => ({ ...point })) },
      edges: outline.map(() => ({
        kind: 'SLOPED' as const,
        slopeDeg: draft.slopeDeg,
        overhangMm: draft.overhangMm,
      })),
      assemblyId: draft.assemblyId,
      baseElevationMm: level.elevationMm + level.defaultStoreyHeightMm,
    }),
  };
}

/** Builds a column, a beam or a footing from the points that were clicked. */
export function addStructuralMemberCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly kind: StructuralMemberKind;
    readonly widthMm: number;
    readonly depthMm: number;
    readonly heightMm?: number;
  },
  memberId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const wanted = draft.kind === 'BEAM' ? 2 : 1;
  if (points.length < wanted)
    return {
      status: 'ERROR',
      message:
        wanted === 1
          ? 'Un point est attendu.'
          : 'Une poutre demande deux points.',
    };
  return {
    status: 'OK',
    command: new AddStructuralMemberCommand(level.id, {
      id: memberId,
      kind: draft.kind,
      path: points.slice(0, wanted).map((point) => ({ ...point })),
      widthMm: draft.widthMm,
      depthMm: draft.depthMm,
      ...(draft.heightMm === undefined ? {} : { heightMm: draft.heightMm }),
    }),
  };
}

/** Draws the parcel, or something standing on the site around the house. */
export function addSiteOutlineCommand(
  points: readonly Point2D[],
  draft: {
    readonly target: 'PARCEL' | 'OBSTACLE';
    readonly kind: SiteObstacleKind;
    readonly heightMm?: number;
    readonly name?: string;
  },
  obstacleId: string,
): EditingCommandResult {
  if (points.length < 3)
    return { status: 'ERROR', message: 'Un contour demande trois points.' };
  const outline = points.map((point) => ({ ...point }));
  return {
    status: 'OK',
    command:
      draft.target === 'PARCEL'
        ? new SetParcelBoundaryCommand(outline)
        : new AddSiteObstacleCommand({
            id: obstacleId,
            outline,
            kind: draft.kind,
            ...(draft.heightMm === undefined
              ? {}
              : { heightMm: draft.heightMm }),
            ...(draft.name === undefined ? {} : { name: draft.name }),
          }),
  };
}

/** Whether a point falls inside a contour, by the crossing-number rule. */
export function pointInPolygon(
  point: Point2D,
  outline: readonly Point2D[],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = outline.length - 1;
    index < outline.length;
    previous = index, index += 1
  ) {
    const current = outline[index]!;
    const last = outline[previous]!;
    if (current.y > point.y === last.y > point.y) continue;
    const crossingX =
      ((last.x - current.x) * (point.y - current.y)) / (last.y - current.y) +
      current.x;
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

/**
 * Turns the contour the walls enclose around a point into a room.
 *
 * A room is described by walls that already exist, and redrawing its outline
 * by hand is redrawing what the model can already derive — with the near
 * certainty of a corner a few millimetres off, which then reads as a gap.
 */
export function addSpaceAtPointCommand(
  file: ProjectFile,
  levelId: string | undefined,
  point: Point2D,
  draft: { readonly name: string; readonly category: string },
  spaceId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const rooms = detectRooms(file.project, level.id);
  if (rooms.length === 0)
    return {
      status: 'ERROR',
      message: 'Les murs de ce niveau n’enferment aucun contour.',
    };
  const found = rooms.find((room) => pointInPolygon(point, room.polygon.outer));
  if (found === undefined)
    return {
      status: 'ERROR',
      message: 'Ce point n’est dans aucun contour fermé par les murs.',
    };
  if (found.existingSpaceId !== undefined)
    return {
      status: 'ERROR',
      message: `Ce contour porte déjà la pièce ${found.existingSpaceId}.`,
    };
  return {
    status: 'OK',
    command: new AddSpaceCommand(level.id, {
      id: spaceId,
      name: draft.name,
      category: draft.category,
      polygon: found.polygon,
    }),
  };
}

/**
 * Turns every contour the walls enclose into a room, in one action.
 *
 * A house has as many rooms as it has enclosed contours, and naming them one
 * by one through a panel is the navigation this replaces. Contours already
 * covered are left alone rather than duplicated.
 */
export function addEveryDetectedRoomCommand(
  file: ProjectFile,
  levelId: string | undefined,
  draft: { readonly category: string },
  newId: (prefix: string) => string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const rooms = detectRooms(file.project, level.id).filter(
    (room) => room.existingSpaceId === undefined,
  );
  if (rooms.length === 0)
    return {
      status: 'ERROR',
      message: 'Aucun contour fermé n’est encore sans pièce.',
    };
  const commands = rooms.map((room, index) => {
    const id = newId('space');
    return new AddSpaceCommand(level.id, {
      id,
      name: `Pièce ${level.spaces.length + index + 1}`,
      category: draft.category,
      polygon: room.polygon,
    });
  });
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `spaces:detected:${newId('')}`,
      `Ajouter ${commands.length} pièce(s) détectée(s)`,
      commands,
    ),
  };
}

/**
 * Builds a slab, either from the points clicked or from the contour aimed at.
 *
 * A floor almost always covers a room that already exists; asking the user to
 * click its corners again is asking for the same shape a second time, and the
 * second one is never quite the first.
 */
export function addSlabFromPointsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
  draft: {
    readonly assemblyId: string;
    readonly role: Slab['role'];
    readonly fromRoom: boolean;
  },
  slabId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  let polygon: Polygon2D;
  if (draft.fromRoom) {
    const point = points[0];
    if (point === undefined)
      return { status: 'ERROR', message: 'Un point est attendu.' };
    const room = detectRooms(file.project, level.id).find((candidate) =>
      pointInPolygon(point, candidate.polygon.outer),
    );
    if (room === undefined)
      return {
        status: 'ERROR',
        message: 'Ce point n’est dans aucun contour fermé par les murs.',
      };
    polygon = room.polygon;
  } else {
    if (points.length < 3)
      return { status: 'ERROR', message: 'Une dalle demande trois points.' };
    polygon = { outer: points.map((point) => ({ ...point })) };
  }
  return {
    status: 'OK',
    command: new AddSlabCommand(level.id, {
      id: slabId,
      polygon,
      assemblyId: draft.assemblyId,
      role: draft.role,
      elevationOffsetMm: 0,
    }),
  };
}

/**
 * Cuts an opening through the slab a contour falls in.
 *
 * A stairwell is a hole in the floor above it, and the floor is one object
 * with a hole rather than four slabs around a gap: a hole moves with its slab
 * and cannot be left behind.
 */
export function punchSlabHoleCommand(
  file: ProjectFile,
  levelId: string | undefined,
  points: readonly Point2D[],
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (points.length < 3)
    return { status: 'ERROR', message: 'Une trémie demande trois points.' };
  const centre = {
    x: points.reduce((total, { x }) => total + x, 0) / points.length,
    y: points.reduce((total, { y }) => total + y, 0) / points.length,
  };
  const host = level.slabs.find((slab) =>
    pointInPolygon(centre, slab.polygon.outer),
  );
  if (host === undefined)
    return {
      status: 'ERROR',
      message: 'Aucune dalle ne passe sous ce contour : rien à percer.',
    };
  // Every corner has to be over the slab: a hole crossing an edge would be a
  // shape the slab does not enclose, and the drawing would show a slab that
  // is not the one the model holds.
  if (!points.every((point) => pointInPolygon(point, host.polygon.outer)))
    return {
      status: 'ERROR',
      message: `La trémie sort de la dalle ${host.id}.`,
    };
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `slab:hole:${host.id}`,
      'Percer une trémie',
      [
        new UpdateSlabCommand(level.id, host.id, {
          polygon: {
            outer: host.polygon.outer,
            holes: [
              ...(host.polygon.holes ?? []),
              points.map((point) => ({ ...point })),
            ],
          },
        }),
      ],
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
  const commands: ProjectCommand[] = [];
  for (const objectId of objectIds) {
    // Each family says how it is deleted, beside where it says how it is drawn
    // and edited: nothing here knows what a slab or a network node is.
    const command = removalCommandFor(file.project, level.id, objectId);
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
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            `Supprimer ${objectIds.length} objets`,
            commands,
          ),
  };
}

/** A polygon carried elsewhere, holes included. */
export function translatedPolygon(
  polygon: Polygon2D,
  delta: Point2D,
): Polygon2D {
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
          polygon: translatedPolygon(slab.polygon, deltaMm),
        }),
      );
      continue;
    }
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined) {
      commands.push(
        new UpdateRoofCommand(level.id, roof.id, {
          footprint: translatedPolygon(roof.footprint, deltaMm),
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
    const component = (level.components ?? []).find(
      ({ id }) => id === objectId,
    );
    if (component !== undefined) {
      commands.push(
        new UpdateComponentCommand(level.id, component.id, {
          position: {
            x: component.position.x + deltaMm.x,
            y: component.position.y + deltaMm.y,
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

/**
 * Where a slope faces once the roof it belongs to has been turned or reflected.
 *
 * A roof plane is not only an outline: it points somewhere, and that bearing is
 * what the sun calculations read. Turning the building without turning the
 * bearing leaves a roof drawn to the east and calculated to the south, which is
 * exactly the kind of silent inconsistency this project refuses.
 *
 * The bearing is carried as a direction rather than as a number so that a
 * reflection can be applied to it: reflecting a direction is reflecting the two
 * points it joins.
 */
export function transformedAzimuthDeg(
  transform: PlanTransform,
  azimuthDeg: number,
): number {
  const radians = (azimuthDeg * Math.PI) / 180;
  const facing = { x: Math.cos(radians), y: Math.sin(radians) };
  const origin = { x: 0, y: 0 };
  const moved =
    transform.kind === 'ROTATE'
      ? transformPoint(
          { kind: 'ROTATE', centre: origin, angleDeg: transform.angleDeg },
          facing,
        )
      : // Only the direction of the axis matters to a direction, not where it
        // sits: the reflection is taken about a parallel axis through zero.
        transformPoint(
          {
            kind: 'MIRROR',
            from: origin,
            to: {
              x: transform.to.x - transform.from.x,
              y: transform.to.y - transform.from.y,
            },
          },
          facing,
        );
  const turned = (Math.atan2(moved.y, moved.x) * 180) / Math.PI;
  return ((turned % 360) + 360) % 360;
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
          // The plane faces somewhere, and that is what the sun is calculated
          // against: an outline turned without its bearing would be drawn one
          // way and computed another.
          azimuthDeg: transformedAzimuthDeg(transform, roof.azimuthDeg),
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

/**
 * What was copied, held apart from the project it came from.
 *
 * The objects themselves are kept rather than their identifiers: what is
 * pasted must not change because the originals were deleted, moved or edited
 * in between, and a copy taken on one storey has to survive being pasted on
 * another.
 */
export interface PlanClipboard {
  readonly walls: readonly Wall[];
  readonly openings: readonly Opening[];
  readonly slabs: readonly Slab[];
  readonly roofs: readonly RoofPlane[];
  /**
   * The storey the copy was taken from, and how high it sits.
   *
   * A copy is not only a shape: a roof plane knows its own altitude and a wall
   * may be built up to a named storey. Pasted a floor higher, both have to be
   * read against the storey they land on, or the copy keeps the altitude of the
   * one it came from — right shape, wrong height, and nothing says so.
   */
  readonly sourceLevelId?: string;
  readonly sourceElevationMm?: number;
}

/** Whether anything at all was copied. */
export function clipboardIsEmpty(clipboard: PlanClipboard): boolean {
  return (
    clipboard.walls.length === 0 &&
    clipboard.openings.length === 0 &&
    clipboard.slabs.length === 0 &&
    clipboard.roofs.length === 0
  );
}

/**
 * Takes a copy of what is selected.
 *
 * An opening is kept only when the wall carrying it is copied too: pasted
 * elsewhere it would have no wall to sit in.
 */
export function copyObjects(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
): PlanClipboard {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { walls: [], openings: [], slabs: [], roofs: [] };
  const chosen = new Set(objectIds);
  const walls = level.walls.filter(({ id }) => chosen.has(id as string));
  const hosts = new Set(walls.map(({ id }) => id as string));
  return {
    walls,
    openings: level.openings.filter(
      (opening) =>
        chosen.has(opening.id as string) &&
        hosts.has(opening.hostElementId as string),
    ),
    slabs: level.slabs.filter(({ id }) => chosen.has(id as string)),
    roofs: level.roofs.filter(({ id }) => chosen.has(id as string)),
    sourceLevelId: level.id,
    sourceElevationMm: level.elevationMm,
  };
}

/**
 * The storey a copied wall should now be built up to.
 *
 * A wall built up to the first floor, pasted on the first floor, must be built
 * up to the second — not back down to where it came from. The storey at the
 * same distance in the list is the one that means the same thing; when there is
 * none above, the wall keeps an explicit height rather than pointing at a level
 * that does not exist.
 */
function retargetedHeight(
  project: Project,
  wall: Wall,
  sourceLevelId: string | undefined,
  targetLevel: { readonly id: string; readonly defaultStoreyHeightMm: number },
): Wall {
  if (wall.heightMode !== 'TO_LEVEL') return wall;
  const levels = project.building.levels;
  const source = levels.findIndex(({ id }) => id === sourceLevelId);
  const target = levels.findIndex(({ id }) => id === targetLevel.id);
  const top = levels.findIndex(({ id }) => id === wall.topLevelId);
  if (source === -1 || target === -1 || top === -1) return wall;
  const shifted = levels[top + (target - source)];
  if (shifted !== undefined) return { ...wall, topLevelId: shifted.id };
  // Nothing that high in this project: the copy keeps a height it can state
  // rather than a reference nobody can resolve.
  const { topLevelId: _top, topOffsetMm: _offset, ...rest } = wall;
  return {
    ...rest,
    heightMode: 'EXPLICIT',
    heightMm: targetLevel.defaultStoreyHeightMm,
  };
}

/**
 * Puts a copy down on a storey, which is not necessarily the one it came from.
 *
 * Copying a storey's partitions onto the one above is the reason this exists,
 * and it is why the paste never reuses an identifier: two objects sharing one
 * would make a click ambiguous and a scenario point at either of them.
 */
export function pasteClipboardCommand(
  file: ProjectFile,
  levelId: string | undefined,
  clipboard: PlanClipboard,
  deltaMm: Point2D,
  newId: (prefix: string) => string,
): DuplicationResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (clipboardIsEmpty(clipboard))
    return { status: 'ERROR', message: 'Rien n’a été copié.' };
  const commands: ProjectCommand[] = [];
  const createdIds: string[] = [];
  const copiedWalls = new Map<string, string>();
  const carried = (point: Point2D): Point2D => ({
    x: point.x + deltaMm.x,
    y: point.y + deltaMm.y,
  });
  // How far up the copy is going. Everything a copy knows about its own
  // altitude is read against the storey it lands on rather than the one it was
  // taken from.
  const risenMm =
    clipboard.sourceElevationMm === undefined
      ? 0
      : level.elevationMm - clipboard.sourceElevationMm;

  for (const wall of clipboard.walls) {
    const copyId = newId('wall');
    copiedWalls.set(wall.id, copyId);
    createdIds.push(copyId);
    commands.push(
      new ProjectEditorCommand(
        `wall:paste:${copyId}`,
        'Coller un mur',
        level.id,
        new AddWallCommand(`wall:paste:${copyId}`, {
          ...retargetedHeight(
            file.project,
            wall,
            clipboard.sourceLevelId,
            level,
          ),
          id: copyId as Wall['id'],
          levelId: level.id,
          path: { points: wall.path.points.map(carried) },
        }),
      ),
    );
  }
  for (const opening of clipboard.openings) {
    const host = copiedWalls.get(opening.hostElementId);
    if (host === undefined) continue;
    const copyId = newId('opening');
    createdIds.push(copyId);
    commands.push(
      new ProjectEditorCommand(
        `opening:paste:${copyId}`,
        'Coller une ouverture',
        level.id,
        new AddOpeningCommand(`opening:paste:${copyId}`, {
          ...opening,
          id: copyId as Opening['id'],
          // An opening belongs to its wall; the wall is what belongs to a level.
          hostElementId: host as Opening['hostElementId'],
        }),
      ),
    );
  }
  for (const slab of clipboard.slabs) {
    const copyId = newId('slab');
    createdIds.push(copyId);
    commands.push(
      new AddSlabCommand(level.id, {
        id: copyId,
        polygon: translatedPolygon(slab.polygon, deltaMm),
        assemblyId: slab.assemblyId,
        role: slab.role,
        elevationOffsetMm: slab.elevationOffsetMm,
      }),
    );
  }
  for (const roof of clipboard.roofs) {
    const copyId = newId('roof');
    createdIds.push(copyId);
    commands.push(
      new AddRoofCommand(level.id, {
        id: copyId,
        footprint: translatedPolygon(roof.footprint, deltaMm),
        assemblyId: roof.assemblyId,
        slopeDeg: roof.slopeDeg,
        azimuthDeg: roof.azimuthDeg,
        // The plane rises with the storey: pasted one floor up it sits one
        // floor higher, not at the altitude of the floor it came from.
        baseElevationMm: roof.baseElevationMm + risenMm,
      }),
    );
  }
  const id = `paste:${createdIds.join(',')}`;
  return {
    status: 'OK',
    createdIds,
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            id,
            createdIds.length === 1
              ? 'Coller un objet'
              : `Coller ${createdIds.length} objets`,
            commands,
          ),
  };
}

/** Which edge of their own outlines the objects are lined up on. */
export type AlignEdge = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export const ALIGN_LABELS: Readonly<Record<AlignEdge, string>> = {
  LEFT: 'Aligner à gauche',
  RIGHT: 'Aligner à droite',
  TOP: 'Aligner en haut',
  BOTTOM: 'Aligner en bas',
};

/** The extent of one object on the plan, or nothing when it has none. */
function objectExtent(
  file: ProjectFile,
  level: {
    readonly walls: readonly Wall[];
    readonly slabs: readonly Slab[];
    readonly roofs: readonly RoofPlane[];
  },
  objectId: string,
): { readonly min: Point2D; readonly max: Point2D } | undefined {
  const points: Point2D[] = [];
  const wall = level.walls.find(({ id }) => id === objectId);
  if (wall !== undefined) points.push(...wall.path.points);
  const slab = level.slabs.find(({ id }) => id === objectId);
  if (slab !== undefined) points.push(...slab.polygon.outer);
  const roof = level.roofs.find(({ id }) => id === objectId);
  if (roof !== undefined) points.push(...roof.footprint.outer);
  const node = (file.project.systems ?? [])
    .flatMap((network) => network.nodes)
    .find(({ id }) => id === objectId);
  if (node !== undefined) points.push(node.position);
  if (points.length === 0) return undefined;
  return {
    min: {
      x: Math.min(...points.map(({ x }) => x)),
      y: Math.min(...points.map(({ y }) => y)),
    },
    max: {
      x: Math.max(...points.map(({ x }) => x)),
      y: Math.max(...points.map(({ y }) => y)),
    },
  };
}

/**
 * Lines several objects up on one edge of the selection.
 *
 * Each object travels the distance that brings its own edge onto the outermost
 * one, so nothing is reshaped: aligning is moving, and a wall that ends up
 * shorter would not be an alignment.
 */
export function alignObjectsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  objectIds: readonly string[],
  edge: AlignEdge,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (objectIds.length < 2)
    return {
      status: 'ERROR',
      message: 'Sélectionnez au moins deux objets à aligner.',
    };
  const extents = objectIds.map((objectId) => ({
    objectId,
    extent: objectExtent(file, level, objectId),
  }));
  const measurable = extents.filter(
    (
      entry,
    ): entry is {
      objectId: string;
      extent: { readonly min: Point2D; readonly max: Point2D };
    } => entry.extent !== undefined,
  );
  if (measurable.length < 2)
    return {
      status: 'ERROR',
      message: 'Ces objets ne se mesurent pas sur le plan.',
    };
  const target =
    edge === 'LEFT'
      ? Math.min(...measurable.map(({ extent }) => extent.min.x))
      : edge === 'RIGHT'
        ? Math.max(...measurable.map(({ extent }) => extent.max.x))
        : edge === 'TOP'
          ? Math.min(...measurable.map(({ extent }) => extent.min.y))
          : Math.max(...measurable.map(({ extent }) => extent.max.y));
  const commands: ProjectCommand[] = [];
  for (const { objectId, extent } of measurable) {
    const current =
      edge === 'LEFT'
        ? extent.min.x
        : edge === 'RIGHT'
          ? extent.max.x
          : edge === 'TOP'
            ? extent.min.y
            : extent.max.y;
    const distance = target - current;
    // An object already on the edge is left alone rather than moved by zero.
    if (Math.abs(distance) < 1e-6) continue;
    const delta =
      edge === 'LEFT' || edge === 'RIGHT'
        ? { x: distance, y: 0 }
        : { x: 0, y: distance };
    const moved = moveObjectsCommand(file, levelId, [objectId], delta);
    if (moved.status === 'ERROR') return moved;
    commands.push(moved.command);
  }
  if (commands.length === 0)
    return {
      status: 'ERROR',
      message: 'Ces objets sont déjà alignés.',
    };
  // Even a single move is recorded as an alignment: the history has to say what
  // the user asked for, not how it happened to be carried out.
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `align:${edge}:${objectIds.join(',')}`,
      ALIGN_LABELS[edge],
      commands,
    ),
  };
}

/** Where two infinite lines cross, when they do. */
export function linesIntersection(
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
): Point2D | undefined {
  const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
  const second = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y,
  };
  const denominator = first.x * second.y - first.y * second.x;
  // Parallel walls never meet, and pretending otherwise would send an endpoint
  // to infinity.
  if (Math.abs(denominator) < 1e-9) return undefined;
  const along =
    ((secondStart.x - firstStart.x) * second.y -
      (secondStart.y - firstStart.y) * second.x) /
    denominator;
  return {
    x: firstStart.x + first.x * along,
    y: firstStart.y + first.y * along,
  };
}

/** A straight wall of this level, or nothing when the identifier is not one. */
function straightWall(
  level: { readonly walls: readonly Wall[] },
  objectId: string | undefined,
): Wall | undefined {
  const wall = level.walls.find(({ id }) => id === objectId);
  return wall !== undefined && wall.path.points.length === 2 ? wall : undefined;
}

/**
 * Draws a wall parallel to another one, on the side that was pointed at.
 *
 * The distance is the one the user showed by clicking: an offset asked for in
 * millimetres would be a number to invent, and the point is already there.
 */
export function offsetWallCommand(
  file: ProjectFile,
  levelId: string | undefined,
  wallId: string,
  towards: Point2D,
  newWallId: string,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  const wall = straightWall(level, wallId);
  if (wall === undefined)
    return {
      status: 'ERROR',
      message: 'Le décalage parallèle demande un mur droit.',
    };
  const start = wall.path.points[0]!;
  const end = wall.path.points[1]!;
  const axis = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.hypot(axis.x, axis.y);
  if (length === 0)
    return { status: 'ERROR', message: 'Ce mur n’a pas de longueur.' };
  const normal = { x: -axis.y / length, y: axis.x / length };
  const signed =
    (towards.x - start.x) * normal.x + (towards.y - start.y) * normal.y;
  if (Math.abs(signed) < 1)
    return {
      status: 'ERROR',
      message: 'Indiquez de quel côté et à quelle distance décaler le mur.',
    };
  const delta = { x: normal.x * signed, y: normal.y * signed };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `wall:offset:${newWallId}`,
      `Décaler un mur de ${Math.round(Math.abs(signed))} mm`,
      level.id,
      new AddWallCommand(`wall:offset:${newWallId}`, {
        ...wall,
        id: newWallId as Wall['id'],
        // The copy carries no openings: a hole in one wall is not a hole in
        // the wall beside it.
        path: {
          points: [
            { x: start.x + delta.x, y: start.y + delta.y },
            { x: end.x + delta.x, y: end.y + delta.y },
          ],
        },
      }),
    ),
  };
}

/** Which end of a wall is nearest a point. */
function nearestEndIndex(wall: Wall, point: Point2D): 0 | 1 {
  const start = wall.path.points[0]!;
  const end = wall.path.points[1]!;
  return Math.hypot(point.x - start.x, point.y - start.y) <=
    Math.hypot(point.x - end.x, point.y - end.y)
    ? 0
    : 1;
}

/**
 * Brings a wall to meet another one.
 *
 * One wall or both: joining two walls sends the near end of each to where their
 * axes cross, and adjusting sends only the near end of the first. Extending and
 * trimming are the same gesture — the endpoint goes to the crossing whether
 * that makes the wall longer or shorter, which is what the user pointed at.
 */
export function joinWallsCommand(
  file: ProjectFile,
  levelId: string | undefined,
  first: { readonly wallId: string; readonly at: Point2D },
  second: { readonly wallId: string; readonly at: Point2D },
  both: boolean,
): EditingCommandResult {
  const level = levelOf(file.project, levelId);
  if (level === undefined)
    return { status: 'ERROR', message: 'Le projet ne contient aucun niveau.' };
  if (first.wallId === second.wallId)
    return {
      status: 'ERROR',
      message: 'Désignez deux murs différents.',
    };
  const firstWall = straightWall(level, first.wallId);
  const secondWall = straightWall(level, second.wallId);
  if (firstWall === undefined || secondWall === undefined)
    return {
      status: 'ERROR',
      message: 'Ces opérations demandent deux murs droits.',
    };
  const crossing = linesIntersection(
    firstWall.path.points[0]!,
    firstWall.path.points[1]!,
    secondWall.path.points[0]!,
    secondWall.path.points[1]!,
  );
  if (crossing === undefined)
    return {
      status: 'ERROR',
      message: 'Ces deux murs sont parallèles : ils ne se rejoignent pas.',
    };
  const moved = (wall: Wall, at: Point2D): ProjectCommand => {
    const index = nearestEndIndex(wall, at);
    const points = wall.path.points.map((point, position) =>
      position === index ? crossing : point,
    );
    return new ProjectEditorCommand(
      `wall:join:${wall.id}`,
      both ? 'Joindre deux murs' : 'Ajuster un mur',
      level.id,
      new SetWallPathCommand(`wall:join:${wall.id}`, wall.id, points),
    );
  };
  const commands = both
    ? [moved(firstWall, first.at), moved(secondWall, second.at)]
    : [moved(firstWall, first.at)];
  return {
    status: 'OK',
    command:
      commands.length === 1
        ? commands[0]!
        : new ProjectTransactionCommand(
            `join:${firstWall.id}:${secondWall.id}`,
            'Joindre deux murs',
            commands,
          ),
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
          polygon: translatedPolygon(slab.polygon, deltaMm),
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
          footprint: translatedPolygon(roof.footprint, deltaMm),
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
    case 'ROUTE_VERTEX':
      return {
        status: 'OK',
        command: new MoveNetworkEdgeVertexCommand(
          edit.networkId,
          edit.edgeId,
          edit.vertexIndex,
          edit.to,
        ),
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
