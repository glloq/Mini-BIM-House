import {
  polygonArea,
  polygonContains,
  polygonPerimeter,
  type Point2D,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { Level, Project } from './types.js';
import type { Opening, OpeningHostKind } from './opening.js';
import { isWallOpening, wallOpenings } from './opening.js';
import type { Space } from './space.js';
import { detectSpaceBoundaries } from './space.js';
import type { Wall } from './wall.js';
import type { RoofPlane } from './roof-plane.js';
import { allRoofPlanes } from './roof.js';

/**
 * The geometry a project implies, worked out once.
 *
 * A house must have one answer to « quelle est la surface de cette pièce ? »
 * and « jusqu'où monte ce mur ? ». It had several: the plan resolved a wall's
 * height one way, the calculation context another, the dashboard measured a
 * floor area with its own shoelace formula, and a room drawn by its walls had
 * no area at all once it reached a calculation. Three answers and one
 * silence — and nothing said which was the house's.
 *
 * Nothing here is ever persisted. It is derived from the project each time,
 * exactly like the drawing: a wall that moved changes every answer at once.
 */

/** Where a resolved figure comes from, or why there is none. */
export type GeometrySource = 'STATED' | 'DERIVED' | 'UNRESOLVED';

export interface ResolvedSpaceGeometry {
  readonly spaceId: string;
  readonly levelId: string;
  readonly name: string;
  readonly category: string;
  readonly source: GeometrySource;
  /** The outline, stated or detected. Absent when neither could be had. */
  readonly polygon?: Polygon2D;
  readonly floorAreaM2?: number;
  readonly perimeterM?: number;
  readonly heightM?: number;
  readonly volumeM3?: number;
  /** Why nothing could be resolved, in the words the user reads. */
  readonly unresolved?: string;
}

export interface ResolvedWallGeometry {
  readonly wallId: string;
  readonly levelId: string;
  readonly assemblyId: string;
  readonly role: string;
  readonly lengthM: number;
  readonly source: GeometrySource;
  readonly heightM?: number;
  /** Absolute, so two storeys can be compared without counting from a floor. */
  readonly baseElevationMm: number;
  readonly topElevationMm?: number;
  readonly grossAreaM2?: number;
  readonly openingAreaM2: number;
  readonly netAreaM2?: number;
  readonly openingIds: readonly string[];
  readonly unresolved?: string;
}

export interface ResolvedOpeningGeometry {
  readonly openingId: string;
  readonly levelId: string;
  readonly hostElementId: string;
  readonly openingType: string;
  readonly areaM2: number;
  readonly widthM: number;
  readonly heightM: number;
  /** Ce que l'ouverture perce : un mur, ou un pan de toiture. */
  readonly hostKind: OpeningHostKind;
  /**
   * Height of the sill above the project's zero, not above its storey.
   *
   * Absente pour une fenêtre de toit, et c'est un fait plutôt qu'un manque :
   * son bord bas repose sur un plan incliné, donc son altitude dépend du pan
   * et de l'endroit du pan — que cette résolution n'a pas sous la main. La
   * rendre à zéro poserait toutes les fenêtres de toit au niveau du sol dans
   * tout ce qui lit cette valeur.
   */
  readonly sillElevationMm?: number;
}

export interface ResolvedRoofGeometry {
  readonly roofId: string;
  readonly levelId: string;
  readonly assemblyId: string;
  readonly projectedAreaM2: number;
  readonly surfaceAreaM2: number;
  readonly slopeDeg: number;
  readonly azimuthDeg: number;
  readonly baseElevationMm: number;
}

const SQUARE_MM_PER_SQUARE_M = 1_000_000;

function squareMetres(areaMm2: number): number {
  return areaMm2 / SQUARE_MM_PER_SQUARE_M;
}

/**
 * How high a wall stands, whichever way it says so.
 *
 * A wall states its height or names the storey it climbs to. Reading only the
 * first left every wall built to a storey out of the thermal envelope: the
 * calculation skipped it, and the house it computed had fewer walls than the
 * house on the screen.
 */
export function resolveWallHeightMm(
  project: Project,
  wall: Wall,
): number | undefined {
  if (wall.heightMode === 'EXPLICIT')
    return Number.isFinite(wall.heightMm) && wall.heightMm > 0
      ? wall.heightMm
      : undefined;
  const levels = project.building.levels;
  const base = levels.find(({ id }) => id === wall.levelId);
  const top = levels.find(({ id }) => id === wall.topLevelId);
  if (base === undefined || top === undefined) return undefined;
  const height =
    top.elevationMm -
    base.elevationMm +
    (wall.topOffsetMm ?? 0) -
    wall.baseOffsetMm;
  return Number.isFinite(height) && height > 0 ? height : undefined;
}

/** The length of the path a wall is drawn along, in metres. */
export function wallLengthM(wall: Wall): number {
  let total = 0;
  for (const [index, point] of wall.path.points.entries()) {
    if (index === 0) continue;
    const previous = wall.path.points[index - 1]!;
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
  }
  return total / 1000;
}

export function resolveOpeningGeometry(
  opening: Opening,
  level: Level,
): ResolvedOpeningGeometry {
  return {
    openingId: opening.id,
    levelId: level.id,
    hostElementId: opening.host.id,
    openingType: opening.openingType,
    widthM: opening.widthMm / 1000,
    heightM: opening.heightMm / 1000,
    areaM2: squareMetres(opening.widthMm * opening.heightMm),
    hostKind: opening.host.kind,
    ...(isWallOpening(opening)
      ? { sillElevationMm: level.elevationMm + opening.sillHeightMm }
      : {}),
  };
}

export function resolveWallGeometry(
  project: Project,
  wall: Wall,
  level: Level,
): ResolvedWallGeometry {
  const heightMm = resolveWallHeightMm(project, wall);
  const lengthM = wallLengthM(wall);
  const hosted = wallOpenings(level.openings, wall.id);
  const openingAreaM2 = hosted.reduce(
    (sum, opening) => sum + squareMetres(opening.widthMm * opening.heightMm),
    0,
  );
  const base = level.elevationMm + wall.baseOffsetMm;
  const shared = {
    wallId: wall.id,
    levelId: level.id,
    assemblyId: wall.assemblyId,
    role: wall.role,
    lengthM,
    baseElevationMm: base,
    openingAreaM2,
    openingIds: hosted.map(({ id }) => id as string),
  };
  if (heightMm === undefined)
    return {
      ...shared,
      source: 'UNRESOLVED',
      unresolved:
        wall.heightMode === 'EXPLICIT'
          ? `Le mur ${wall.id} ne dit pas de hauteur utilisable.`
          : `Le mur ${wall.id} monte jusqu’au niveau ${wall.topLevelId}, que le projet ne tient pas — ou qui n’est pas au-dessus du sien.`,
    };
  const grossAreaM2 = squareMetres(lengthM * 1000 * heightMm);
  return {
    ...shared,
    source: wall.heightMode === 'EXPLICIT' ? 'STATED' : 'DERIVED',
    heightM: heightMm / 1000,
    topElevationMm: base + heightMm,
    grossAreaM2,
    netAreaM2: Math.max(0, grossAreaM2 - openingAreaM2),
  };
}

export function resolveRoofGeometry(
  roof: RoofPlane,
  level: Level,
): ResolvedRoofGeometry {
  const projectedAreaM2 = squareMetres(polygonArea(roof.footprint));
  return {
    roofId: roof.id,
    levelId: level.id,
    assemblyId: roof.assemblyId,
    projectedAreaM2,
    surfaceAreaM2: projectedAreaM2 / Math.cos((roof.slopeDeg * Math.PI) / 180),
    slopeDeg: roof.slopeDeg,
    azimuthDeg: roof.azimuthDeg,
    baseElevationMm: roof.baseElevationMm,
  };
}

/**
 * The outline of a room, stated or worked out from the walls around it.
 *
 * An automatic room is paired with the enclosure its anchor falls in. Without
 * an anchor there is nothing to pair it with — a storey of six rooms detects
 * six faces and no rule says which is which — so the room has no geometry, and
 * that is what is reported rather than the first face in the list.
 */
export function resolveSpaceGeometry(
  space: Space,
  level: Level,
): ResolvedSpaceGeometry {
  const shared = {
    spaceId: space.id,
    levelId: level.id,
    name: space.name,
    category: space.category,
  };
  const heightM = level.defaultStoreyHeightMm / 1000;
  const withHeight = (
    polygon: Polygon2D | undefined,
    source: GeometrySource,
    unresolved?: string,
  ): ResolvedSpaceGeometry => {
    if (polygon === undefined)
      return {
        ...shared,
        source: 'UNRESOLVED',
        ...(unresolved === undefined ? {} : { unresolved }),
        ...(Number.isFinite(heightM) && heightM > 0 ? { heightM } : {}),
      };
    const floorAreaM2 = squareMetres(polygonArea(polygon));
    const usable = Number.isFinite(heightM) && heightM > 0;
    return {
      ...shared,
      source,
      polygon,
      floorAreaM2,
      perimeterM: polygonPerimeter(polygon) / 1000,
      ...(usable ? { heightM, volumeM3: floorAreaM2 * heightM } : {}),
    };
  };
  if (space.boundaryMode === 'MANUAL')
    return withHeight(space.manualPolygon, 'STATED');
  const anchor = space.anchor;
  if (anchor === undefined)
    return withHeight(
      undefined,
      'UNRESOLVED',
      `La pièce ${space.name} est décrite par les murs qui l’entourent et ne dit pas lequel de leurs enclos elle est : sa surface reste inconnue.`,
    );
  const detection = detectSpaceBoundaries(level.walls);
  if (detection.status !== 'OK')
    return withHeight(
      undefined,
      'UNRESOLVED',
      `Les murs du niveau ${level.name} n’enferment aucune pièce (${detection.reason}) : la surface de ${space.name} reste inconnue.`,
    );
  const face = detection.boundaries.find(({ polygon }) =>
    polygonContains(polygon, anchor),
  );
  return face === undefined
    ? withHeight(
        undefined,
        'UNRESOLVED',
        `Aucun enclos de murs ne contient le point de la pièce ${space.name} : sa surface reste inconnue.`,
      )
    : withHeight(face.polygon, 'DERIVED');
}

/** Where a resolved room stands, so a caller can label or pick it. */
export function spaceAnchor(
  geometry: ResolvedSpaceGeometry,
): Point2D | undefined {
  const outer = geometry.polygon?.outer;
  if (outer === undefined || outer.length === 0) return undefined;
  return {
    x: outer.reduce((sum, { x }) => sum + x, 0) / outer.length,
    y: outer.reduce((sum, { y }) => sum + y, 0) / outer.length,
  };
}

/** Every room of the project, resolved. */
export function resolvedSpaces(
  project: Project,
): readonly ResolvedSpaceGeometry[] {
  return project.building.levels.flatMap((level) =>
    level.spaces.map((space) => resolveSpaceGeometry(space, level)),
  );
}

/** Every wall of the project, resolved. */
export function resolvedWalls(
  project: Project,
): readonly ResolvedWallGeometry[] {
  return project.building.levels.flatMap((level) =>
    level.walls.map((wall) => resolveWallGeometry(project, wall, level)),
  );
}

/** Every opening of the project, resolved. */
export function resolvedOpenings(
  project: Project,
): readonly ResolvedOpeningGeometry[] {
  return project.building.levels.flatMap((level) =>
    level.openings.map((opening) => resolveOpeningGeometry(opening, level)),
  );
}

/** Every roof plane of the project, resolved — outlined ones included. */
export function resolvedRoofs(
  project: Project,
): readonly ResolvedRoofGeometry[] {
  return project.building.levels.flatMap((level) =>
    allRoofPlanes(level).map((roof) => resolveRoofGeometry(roof, level)),
  );
}
