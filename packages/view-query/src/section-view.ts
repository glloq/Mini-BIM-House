import type {
  BoundingBox2D,
  Point2D,
  Segment2D,
} from '@house-technical-designer/geometry';
import type {
  Discipline,
  DrawingView,
  ScenePrimitive,
  SemanticRole,
  SemanticScene,
} from '@house-technical-designer/drawing-engine';
import {
  createSemanticScene,
  drawingViewId,
  graphicProfileId,
} from '@house-technical-designer/drawing-engine';
import type {
  Level,
  Project,
  RoofPlane,
  Wall,
} from '@house-technical-designer/core-domain';
import { allRoofPlanes } from '@house-technical-designer/core-domain';
import type { Assembly } from '@house-technical-designer/assemblies';
import { totalThicknessMillimetres } from '@house-technical-designer/assemblies';
import { numericValue } from '@house-technical-designer/units';

/**
 * Where a section is cut, how far behind it looks, and what slice of height it
 * shows.
 *
 * A section is a decision, not a rendering setting: this line, looking that
 * way, that deep. Two people cutting the same house in two places produce two
 * drawings, and a file that did not record the line could not reproduce
 * either — which is why the same three numbers live on `SavedDrawingView`.
 */
export interface SectionCut {
  /** The cut, from left to right of the resulting drawing. */
  readonly line: Segment2D;
  /**
   * How far behind the cut is drawn, in millimetres.
   *
   * A section that showed everything behind it would be a house seen through
   * itself. Undefined means « as far as the model goes ».
   */
  readonly depthMm?: number;
  /** The band of height the drawing keeps, when the view states one. */
  readonly verticalRangeMm?: VerticalRange;
}

/** A slice of height, measured from the project's zero like everything else. */
export interface VerticalRange {
  readonly minMm: number;
  readonly maxMm: number;
}

/** Which way a façade is seen from, and how far into the house it looks. */
export interface ElevationDirection {
  /** Counter-clockwise from east, like every other azimuth in this model. */
  readonly azimuthDeg: number;
  readonly depthMm?: number;
  readonly verticalRangeMm?: VerticalRange;
}

export interface SectionViewOptions {
  readonly scale?: number;
  readonly graphicProfileId?: string;
  /** Model-space padding around the drawn content, in millimetres. */
  readonly paddingMm?: number;
  readonly extraPrimitives?: readonly ScenePrimitive[];
  /** Identifier of the saved view, so primitives are stable across rebuilds. */
  readonly viewId?: string;
  /**
   * The model window the view shows, when the caller states one.
   *
   * A sheet says 1:50, and 1:50 is a fixed number of model millimetres per
   * paper millimetre — never whatever makes the content fit. Without it the
   * view frames what it drew, which is what a screen wants.
   */
  readonly viewport?: BoundingBox2D;
}

export interface SectionViewIssue {
  readonly code: string;
  readonly objectId?: string;
  readonly message: string;
}

export interface SectionViewResult {
  readonly view: DrawingView;
  readonly scene: SemanticScene;
  readonly primitives: readonly ScenePrimitive[];
  readonly issues: readonly SectionViewIssue[];
}

const DEFAULT_PADDING_MM = 800;
const DEFAULT_SCALE = 50;
/** Half the thickness a cut of unknown width is drawn with, in millimetres. */
const HALF_CUT_MM = 100;

/** Where a point falls in the drawing: along the cut, and how far behind it. */
function projected(
  point: Point2D,
  origin: Point2D,
  along: Point2D,
): { readonly along: number; readonly behind: number } {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    along: dx * along.x + dy * along.y,
    // Positive is behind the cut, in the direction the drawing looks.
    behind: dx * -along.y + dy * along.x,
  };
}

function unit(segment: Segment2D): Point2D | undefined {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? undefined : { x: dx / length, y: dy / length };
}

/** The height of a wall, which is either stated or measured to a storey. */
function wallHeightMm(
  wall: Wall,
  levels: readonly Level[],
): number | undefined {
  if (wall.heightMode === 'EXPLICIT') return wall.heightMm;
  const level = levels.find(({ id }) => id === wall.levelId);
  const top = levels.find(({ id }) => id === wall.topLevelId);
  if (level === undefined || top === undefined) return undefined;
  return top.elevationMm - level.elevationMm + (wall.topOffsetMm ?? 0);
}

/**
 * How thick a thing built of this assembly is.
 *
 * The thickness of a wall is not a property of the wall: it is the sum of what
 * it is made of. A section drawing every wall the same width would be a
 * drawing of a house nobody specified.
 */
function thicknessMm(
  assemblyId: string,
  assemblies: ReadonlyMap<string, Assembly>,
  fallback: number,
): number {
  const assembly = assemblies.get(assemblyId);
  if (assembly === undefined) return fallback;
  const total = numericValue(totalThicknessMillimetres(assembly));
  return Number.isFinite(total) && total > 0 ? total : fallback;
}

function assembliesOf(project: Project): ReadonlyMap<string, Assembly> {
  return new Map(
    (project.assemblies ?? []).map((assembly) => [assembly.id, assembly]),
  );
}

interface Draft {
  readonly id: string;
  readonly sourceObjectId: string;
  readonly semanticRole: SemanticRole;
  readonly points: readonly Point2D[];
  readonly layer: string;
  readonly zIndex: number;
  readonly discipline?: Discipline;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

function rectangle(
  left: number,
  right: number,
  bottom: number,
  top: number,
): readonly Point2D[] {
  return [
    { x: left, y: bottom },
    { x: right, y: bottom },
    { x: right, y: top },
    { x: left, y: top },
  ];
}

/**
 * Every crossing of a run by the cut.
 *
 * A wall is a run, not a point: what the section shows is the piece of it the
 * cut passes through, where along the drawing that piece falls, and how far
 * along the wall itself — the last one is what says whether the saw went
 * through a window or through masonry.
 */
interface Crossing {
  readonly along: number;
  readonly alongHost: number;
}

function crossings(
  points: readonly Point2D[],
  origin: Point2D,
  along: Point2D,
): readonly Crossing[] {
  const found: Crossing[] = [];
  let travelled = 0;
  for (const [index, point] of points.entries()) {
    if (index === 0) continue;
    const previous = points[index - 1]!;
    const runLength = Math.hypot(point.x - previous.x, point.y - previous.y);
    const first = projected(previous, origin, along);
    const second = projected(point, origin, along);
    // A run crosses the cut when its two ends are on opposite sides of it.
    if (
      first.behind !== second.behind &&
      first.behind > 0 !== second.behind > 0
    ) {
      const ratio = first.behind / (first.behind - second.behind);
      found.push({
        along: first.along + (second.along - first.along) * ratio,
        alongHost: travelled + runLength * ratio,
      });
    }
    travelled += runLength;
  }
  return found;
}

/** How far behind the cut a whole run sits, when all of it is behind. */
function behindDistance(
  points: readonly Point2D[],
  origin: Point2D,
  along: Point2D,
): number | undefined {
  const marks = points.map((point) => projected(point, origin, along));
  const nearest = Math.min(...marks.map(({ behind }) => behind));
  return nearest <= 0 ? undefined : nearest;
}

function spanAlong(
  points: readonly Point2D[],
  origin: Point2D,
  along: Point2D,
): { readonly left: number; readonly right: number } {
  const marks = points.map((point) => projected(point, origin, along).along);
  return { left: Math.min(...marks), right: Math.max(...marks) };
}

/** Whether a band of height falls inside the slice the view keeps. */
function withinRange(
  range: VerticalRange | undefined,
  bottom: number,
  top: number,
): boolean {
  if (range === undefined) return true;
  return top > range.minMm && bottom < range.maxMm;
}

/**
 * A section of the house, drawn.
 *
 * The section is a real projection and not a picture of the plan: each wall the
 * cut passes through becomes a band at the place it crosses, as high as the
 * wall and standing on its storey; an opening the saw went through becomes the
 * gap it is; each slab crossed becomes a band at its own height; the roof
 * becomes the profile its slopes describe. What stands behind the cut, within
 * the depth asked for, is drawn as background rather than as masonry.
 *
 * Derived every time from the model, like the plan: a section opened after a
 * wall moved shows the wall where it is now.
 */
export function buildSectionView(
  project: Project,
  cut: SectionCut,
  options: SectionViewOptions = {},
): SectionViewResult {
  const issues: SectionViewIssue[] = [];
  const along = unit(cut.line);
  if (along === undefined) {
    issues.push({
      code: 'SECTION_EMPTY_CUT',
      message: 'La ligne de coupe doit avoir deux extrémités distinctes.',
    });
    return assembled('SECTION', [], options, issues, cut);
  }
  const origin = cut.line.start;
  const range = cut.verticalRangeMm;
  const drafts: Draft[] = [];
  const levels = project.building.levels;
  const assemblies = assembliesOf(project);
  const deep = (distance: number): boolean =>
    cut.depthMm === undefined || distance <= cut.depthMm;

  for (const level of levels) {
    for (const wall of level.walls) {
      const height = wallHeightMm(wall, levels);
      if (height === undefined) {
        issues.push({
          code: 'SECTION_UNKNOWN_HEIGHT',
          objectId: wall.id,
          message: `Le mur ${wall.id} ne dit pas jusqu’où il monte : il n’est pas dessiné dans la coupe.`,
        });
        continue;
      }
      const base = level.elevationMm + wall.baseOffsetMm;
      if (!withinRange(range, base, base + height)) continue;
      const marks = crossings(wall.path.points, origin, along);

      if (marks.length === 0) {
        // Not cut. It is either behind the cut — and then it is background,
        // within the depth asked for — or in front of it, and then the viewer
        // stands between it and the house, so it is not drawn at all.
        const distance = behindDistance(wall.path.points, origin, along);
        if (distance === undefined || !deep(distance)) continue;
        const { left, right } = spanAlong(wall.path.points, origin, along);
        if (right - left < 1) continue;
        drafts.push({
          id: `${prefix(options)}wall-behind:${wall.id}`,
          sourceObjectId: wall.id,
          semanticRole: 'WALL_BELOW',
          points: rectangle(left, right, base, base + height),
          layer: 'architecture.walls',
          zIndex: 10,
          metadata: { behindMm: Math.round(distance) },
        });
        continue;
      }
      const half =
        thicknessMm(wall.assemblyId, assemblies, HALF_CUT_MM * 2) / 2;
      for (const [index, crossing] of marks.entries()) {
        // The openings the saw went through: they interrupt the masonry, so
        // the band is drawn in pieces and the gap is drawn as an opening.
        const holes = level.openings
          .filter(({ hostElementId }) => hostElementId === wall.id)
          .filter(
            (opening) =>
              crossing.alongHost >= opening.offsetAlongHostMm &&
              crossing.alongHost <= opening.offsetAlongHostMm + opening.widthMm,
          );
        const left = crossing.along - half;
        const right = crossing.along + half;
        const bands: { readonly bottom: number; readonly top: number }[] = [];
        let bottom = base;
        for (const opening of [...holes].sort(
          (first, second) => first.sillHeightMm - second.sillHeightMm,
        )) {
          const sill = base + opening.sillHeightMm;
          const head = sill + opening.heightMm;
          if (sill > bottom) bands.push({ bottom, top: sill });
          bottom = Math.max(bottom, head);
          drafts.push({
            id: `${prefix(options)}opening-cut:${opening.id}`,
            sourceObjectId: opening.id,
            semanticRole: 'OPENING',
            points: rectangle(left, right, sill, head),
            layer: 'architecture.openings',
            zIndex: 40,
          });
        }
        if (base + height > bottom) bands.push({ bottom, top: base + height });
        for (const [piece, band] of bands.entries())
          drafts.push({
            id: `${prefix(options)}wall-cut:${wall.id}:${index}:${piece}`,
            sourceObjectId: wall.id,
            semanticRole: 'WALL_CUT',
            points: rectangle(left, right, band.bottom, band.top),
            layer: 'architecture.walls',
            zIndex: 30,
          });
      }
    }

    // A slab crossed by the cut is a band at its own height, which is what
    // tells a reader where one storey stops and the next begins.
    for (const slab of level.slabs) {
      const outline = [...slab.polygon.outer, slab.polygon.outer[0]!];
      const marks = crossings(outline, origin, along);
      if (marks.length < 2) continue;
      const left = Math.min(...marks.map(({ along: at }) => at));
      const right = Math.max(...marks.map(({ along: at }) => at));
      const base = level.elevationMm + slab.elevationOffsetMm;
      const depth = thicknessMm(slab.assemblyId, assemblies, 200);
      if (!withinRange(range, base - depth, base)) continue;
      drafts.push({
        id: `${prefix(options)}slab:${slab.id}`,
        sourceObjectId: slab.id,
        semanticRole: 'WALL_LAYER_STRUCTURE',
        points: rectangle(left, right, base - depth, base),
        layer: 'architecture.slabs',
        zIndex: 20,
      });
    }
  }

  // The roof, as the profile its slopes describe where the cut passes.
  for (const plane of levels.flatMap((level) => allRoofPlanes(level))) {
    const outline = [...plane.footprint.outer, plane.footprint.outer[0]!];
    const marks = crossings(outline, origin, along);
    if (marks.length < 2) continue;
    const left = Math.min(...marks.map(({ along: at }) => at));
    const right = Math.max(...marks.map(({ along: at }) => at));
    const climb = roofClimb(plane, along, left, right);
    if (
      !withinRange(
        range,
        plane.baseElevationMm,
        plane.baseElevationMm + Math.abs(climb) + 200,
      )
    )
      continue;
    drafts.push({
      id: `${prefix(options)}roof:${plane.id}`,
      sourceObjectId: plane.id,
      semanticRole: 'WALL_CUT',
      points: [
        { x: left, y: plane.baseElevationMm + Math.max(0, -climb) },
        { x: right, y: plane.baseElevationMm + Math.max(0, climb) },
        { x: right, y: plane.baseElevationMm + Math.max(0, climb) + 200 },
        { x: left, y: plane.baseElevationMm + Math.max(0, -climb) + 200 },
      ],
      layer: 'architecture.roofs',
      zIndex: 40,
      metadata: { slopeDeg: plane.slopeDeg },
    });
  }

  return assembled('SECTION', drafts, options, issues, cut);
}

/**
 * How much a roof plane climbs between the two ends of the piece the cut
 * crosses.
 *
 * A plane rises along its own downhill direction and nowhere else, so a cut
 * running across the slope shows a horizontal roof and one running up it shows
 * the full pitch. Taking the pitch as read would draw a hip roof as though
 * every cut went up the ridge.
 */
function roofClimb(
  plane: RoofPlane,
  along: Point2D,
  left: number,
  right: number,
): number {
  const radians = (plane.azimuthDeg * Math.PI) / 180;
  // The downhill direction, in the drawing's own along-axis.
  const downhill = Math.cos(radians) * along.x + Math.sin(radians) * along.y;
  const projectedRise = Math.tan((plane.slopeDeg * Math.PI) / 180) * -downhill;
  return (right - left) * projectedRise;
}

/**
 * A façade, drawn.
 *
 * An elevation is a section that cuts nothing: it stands outside the house,
 * looks one way, and draws what faces it. The projection is the same, which is
 * why it is the same code — a façade seen from the south and a section cut
 * east-west differ by where the plane is put, not by what is done with it.
 *
 * What is further into the house than the depth asked for is left out; without
 * a depth the whole house is drawn, which is what a façade of a simple house
 * wants and what makes a façade of a courtyard house unreadable.
 */
export function buildElevationView(
  project: Project,
  direction: ElevationDirection,
  options: SectionViewOptions = {},
): SectionViewResult {
  const issues: SectionViewIssue[] = [];
  const radians = (direction.azimuthDeg * Math.PI) / 180;
  // We look along the azimuth; the drawing runs across it.
  const along: Point2D = { x: -Math.sin(radians), y: Math.cos(radians) };
  const drafts: Draft[] = [];
  const levels = project.building.levels;
  const origin: Point2D = { x: 0, y: 0 };
  const range = direction.verticalRangeMm;

  // Depth is measured from whatever stands nearest the viewer, because a façade
  // is looked at from outside and not from a plane the file never recorded.
  const all = levels.flatMap((level) =>
    level.walls.flatMap((wall) => wall.path.points),
  );
  const nearest =
    all.length === 0
      ? 0
      : Math.min(
          ...all.map((point) => -projected(point, origin, along).behind),
        );

  for (const level of levels)
    for (const wall of level.walls) {
      const height = wallHeightMm(wall, levels);
      if (height === undefined) {
        issues.push({
          code: 'ELEVATION_UNKNOWN_HEIGHT',
          objectId: wall.id,
          message: `Le mur ${wall.id} ne dit pas jusqu’où il monte : il n’est pas dessiné sur la façade.`,
        });
        continue;
      }
      const marks = wall.path.points.map((point) =>
        projected(point, origin, along),
      );
      const into = Math.min(...marks.map(({ behind }) => -behind)) - nearest;
      if (direction.depthMm !== undefined && into > direction.depthMm) continue;
      const left = Math.min(...marks.map(({ along: at }) => at));
      const right = Math.max(...marks.map(({ along: at }) => at));
      // A wall seen end-on has no façade; drawing it would be a black line
      // across the windows behind it.
      if (right - left < 1) continue;
      const base = level.elevationMm + wall.baseOffsetMm;
      if (!withinRange(range, base, base + height)) continue;
      drafts.push({
        id: `${prefix(options)}wall:${wall.id}`,
        sourceObjectId: wall.id,
        semanticRole: into > 1 ? 'WALL_BELOW' : 'WALL_CUT',
        points: rectangle(left, right, base, base + height),
        layer: 'architecture.walls',
        zIndex: into > 1 ? 10 : 20,
        metadata: { intoMm: Math.round(into) },
      });
      // The openings of that wall, where they fall on the façade. The offset is
      // measured along the wall, so it only reads across the drawing when the
      // wall does; a wall at an angle is foreshortened, and so are its windows.
      const wallLength = pathLength(wall.path.points);
      if (wallLength < 1) continue;
      const foreshortened = (right - left) / wallLength;
      for (const opening of level.openings) {
        if (opening.hostElementId !== wall.id) continue;
        const start = left + opening.offsetAlongHostMm * foreshortened;
        const sill = base + opening.sillHeightMm;
        if (!withinRange(range, sill, sill + opening.heightMm)) continue;
        drafts.push({
          id: `${prefix(options)}opening:${opening.id}`,
          sourceObjectId: opening.id,
          semanticRole: 'OPENING',
          points: rectangle(
            start,
            start + opening.widthMm * foreshortened,
            sill,
            sill + opening.heightMm,
          ),
          layer: 'architecture.openings',
          zIndex: 30,
        });
      }
    }

  return assembled('ELEVATION', drafts, options, issues, direction);
}

function pathLength(points: readonly Point2D[]): number {
  let total = 0;
  for (const [index, point] of points.entries()) {
    if (index === 0) continue;
    const previous = points[index - 1]!;
    total += Math.hypot(point.x - previous.x, point.y - previous.y);
  }
  return total;
}

/**
 * The roof plan.
 *
 * Seen from above, a roof is its planes, the lines where they meet, and the
 * way each one falls. The plan already drew a roof as an outline on a storey,
 * which said where it is and nothing about how it works: no slope, no ridge,
 * no direction of fall — the three things a roof plan exists to state.
 */
export function buildRoofView(
  project: Project,
  options: SectionViewOptions = {},
): SectionViewResult {
  const issues: SectionViewIssue[] = [];
  const drafts: Draft[] = [];
  const planes = project.building.levels.flatMap((level) =>
    allRoofPlanes(level),
  );
  if (planes.length === 0)
    issues.push({
      code: 'ROOF_VIEW_EMPTY',
      message: 'Ce projet ne porte aucun pan de toiture.',
    });

  // The house under the roof, so the overhang can be read as an overhang.
  for (const level of project.building.levels)
    for (const wall of level.walls)
      drafts.push({
        id: `${prefix(options)}below:${wall.id}`,
        sourceObjectId: wall.id,
        semanticRole: 'WALL_BELOW',
        points: wall.path.points,
        layer: 'architecture.walls',
        zIndex: 5,
      });

  for (const plane of planes) {
    drafts.push({
      id: `${prefix(options)}plane:${plane.id}`,
      sourceObjectId: plane.id,
      semanticRole: 'WALL_LAYER_FINISH',
      points: plane.footprint.outer,
      layer: 'architecture.roofs',
      zIndex: 10,
      metadata: {
        slopeDeg: plane.slopeDeg,
        azimuthDeg: plane.azimuthDeg,
        baseElevationMm: plane.baseElevationMm,
      },
    });
    // The arrow of greatest slope, drawn from the middle of the plane and
    // pointing the way water runs.
    const centre = centroid(plane.footprint.outer);
    const radians = (plane.azimuthDeg * Math.PI) / 180;
    const reach = Math.max(500, extent(plane.footprint.outer) / 4);
    const tip = {
      x: centre.x + Math.cos(radians) * reach,
      y: centre.y + Math.sin(radians) * reach,
    };
    drafts.push({
      id: `${prefix(options)}fall:${plane.id}`,
      sourceObjectId: plane.id,
      semanticRole: 'ANNOTATION',
      points: [
        centre,
        tip,
        {
          x: tip.x - Math.cos(radians - 0.35) * reach * 0.25,
          y: tip.y - Math.sin(radians - 0.35) * reach * 0.25,
        },
        tip,
        {
          x: tip.x - Math.cos(radians + 0.35) * reach * 0.25,
          y: tip.y - Math.sin(radians + 0.35) * reach * 0.25,
        },
      ],
      layer: 'architecture.roofs',
      zIndex: 20,
      metadata: { slopeDeg: plane.slopeDeg },
    });
  }

  // Where two planes share an edge there is a ridge, a hip or a valley. Which
  // of the three it is follows from the elevations the two planes reach along
  // that edge, and this version does not compute them — so the line is drawn
  // and named « arête », which is true of all three.
  for (const [index, edge] of sharedEdges(planes).entries())
    drafts.push({
      id: `${prefix(options)}ridge:${index}`,
      sourceObjectId: edge.planeIds[0]!,
      semanticRole: 'WALL_CUT',
      points: [edge.start, edge.end],
      layer: 'architecture.roofs',
      zIndex: 30,
      metadata: { entre: edge.planeIds.join(' / ') },
    });

  return assembled('ROOF', drafts, options, issues, undefined);
}

/**
 * The site plan.
 *
 * The parcel, what stands on it, and the house's own footprint at ground
 * level. It answers the questions a plan of one storey cannot: how far the
 * house is from the limits, and what casts a shadow on it.
 */
export function buildSiteView(
  project: Project,
  options: SectionViewOptions = {},
): SectionViewResult {
  const issues: SectionViewIssue[] = [];
  const drafts: Draft[] = [];
  const parcel = project.site.parcelBoundary;
  if (parcel === undefined)
    issues.push({
      code: 'SITE_VIEW_NO_PARCEL',
      message:
        'Ce projet ne dit pas où sont les limites du terrain : le plan de masse ne montre que le bâti.',
    });
  else
    drafts.push({
      id: `${prefix(options)}parcel`,
      sourceObjectId: 'site:parcel',
      semanticRole: 'SITE',
      points: parcel.outer,
      layer: 'site.parcel',
      zIndex: 1,
      discipline: 'SITE',
    });

  for (const obstacle of project.site.obstacles ?? [])
    drafts.push({
      id: `${prefix(options)}obstacle:${obstacle.id}`,
      sourceObjectId: obstacle.id,
      semanticRole: 'SITE',
      points: obstacle.boundary.outer,
      layer: 'site.parcel',
      zIndex: 2,
      discipline: 'SITE',
      metadata: {
        ...(obstacle.kind === undefined ? {} : { kind: obstacle.kind }),
        ...(obstacle.heightMm === undefined
          ? {}
          : { heightMm: obstacle.heightMm }),
      },
    });

  // The house, as the storey that meets the ground draws it.
  const ground = [...project.building.levels].sort(
    (first, second) => first.elevationMm - second.elevationMm,
  )[0];
  for (const wall of ground?.walls ?? [])
    drafts.push({
      id: `${prefix(options)}wall:${wall.id}`,
      sourceObjectId: wall.id,
      semanticRole: 'WALL_CUT',
      points: wall.path.points,
      layer: 'architecture.walls',
      zIndex: 10,
    });
  for (const plane of project.building.levels.flatMap((level) =>
    allRoofPlanes(level),
  ))
    drafts.push({
      id: `${prefix(options)}roof:${plane.id}`,
      sourceObjectId: plane.id,
      semanticRole: 'WALL_BELOW',
      points: plane.footprint.outer,
      layer: 'architecture.roofs',
      zIndex: 8,
    });

  return assembled('SITE', drafts, options, issues, undefined);
}

function centroid(points: readonly Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((total, { x }) => total + x, 0) / points.length,
    y: points.reduce((total, { y }) => total + y, 0) / points.length,
  };
}

function extent(points: readonly Point2D[]): number {
  if (points.length === 0) return 0;
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
}

interface SharedEdge {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly planeIds: readonly string[];
}

/** Two millimetres: two roof planes meant to meet, drawn by hand, nearly do. */
const EDGE_TOLERANCE_MM = 2;

function edgeKey(first: Point2D, second: Point2D): string {
  const round = (value: number): number =>
    Math.round(value / EDGE_TOLERANCE_MM) * EDGE_TOLERANCE_MM;
  const ends = [
    `${round(first.x)},${round(first.y)}`,
    `${round(second.x)},${round(second.y)}`,
  ].sort();
  return ends.join('|');
}

function sharedEdges(planes: readonly RoofPlane[]): readonly SharedEdge[] {
  const seen = new Map<
    string,
    { start: Point2D; end: Point2D; planeIds: string[] }
  >();
  for (const plane of planes) {
    const outer = plane.footprint.outer;
    for (const [index, point] of outer.entries()) {
      const next = outer[(index + 1) % outer.length]!;
      const key = edgeKey(point, next);
      const held = seen.get(key);
      if (held === undefined)
        seen.set(key, { start: point, end: next, planeIds: [plane.id] });
      else if (!held.planeIds.includes(plane.id)) held.planeIds.push(plane.id);
    }
  }
  return [...seen.values()].filter(({ planeIds }) => planeIds.length > 1);
}

/**
 * A view of the right kind with nothing in it, and the reason why.
 *
 * A drawing that cannot be built is not a plan of the ground floor: it is this
 * view, empty, saying what is missing. The frame is still the one the sheet
 * asked for, so an empty viewport on a sheet stays the size it was given.
 */
export function buildEmptyView(
  type: DrawingView['type'],
  options: SectionViewOptions,
  issues: readonly SectionViewIssue[],
): SectionViewResult {
  return assembled(type, [], options, issues, undefined);
}

function prefix(options: SectionViewOptions): string {
  return options.viewId === undefined ? '' : `${options.viewId}:`;
}

function assembled(
  type: DrawingView['type'],
  drafts: readonly Draft[],
  options: SectionViewOptions,
  issues: readonly SectionViewIssue[],
  depth: { readonly depthMm?: number } | undefined,
): SectionViewResult {
  const primitives: readonly ScenePrimitive[] = [
    ...drafts.map((draft): ScenePrimitive => ({
      id: draft.id,
      sourceObjectId: draft.sourceObjectId,
      semanticRole: draft.semanticRole,
      geometry:
        draft.semanticRole === 'ANNOTATION'
          ? {
              kind: 'POLYLINE' as const,
              polyline: { points: [...draft.points], closed: false },
            }
          : { kind: 'POLYGON', polygon: { outer: [...draft.points] } },
      layer: draft.layer,
      zIndex: draft.zIndex,
      discipline: draft.discipline ?? 'ARCHITECTURE',
      ...(draft.metadata === undefined ? {} : { metadata: draft.metadata }),
    })),
    ...(options.extraPrimitives ?? []),
  ];
  const padding = options.paddingMm ?? DEFAULT_PADDING_MM;
  const points = drafts.flatMap(({ points: own }) => own);
  const depthMm = depth?.depthMm;
  const view: DrawingView = {
    id: drawingViewId(options.viewId ?? `${type.toLowerCase()}:derived`),
    type,
    scale: options.scale ?? DEFAULT_SCALE,
    viewport:
      options.viewport !== undefined
        ? options.viewport
        : points.length === 0
          ? {
              min: { x: -padding, y: -padding },
              max: { x: padding, y: padding },
            }
          : {
              min: {
                x: Math.min(...points.map(({ x }) => x)) - padding,
                y: Math.min(...points.map(({ y }) => y)) - padding,
              },
              max: {
                x: Math.max(...points.map(({ x }) => x)) + padding,
                y: Math.max(...points.map(({ y }) => y)) + padding,
              },
            },
    visibleDisciplines: [
      ...new Set(primitives.map(({ discipline }) => discipline)),
    ],
    graphicProfileId: graphicProfileId(
      options.graphicProfileId ?? 'generic-technical-screen',
    ),
    ...(depthMm === undefined ? {} : { viewDepthMm: depthMm }),
  };
  return {
    view,
    scene: createSemanticScene(view, primitives),
    primitives,
    issues,
  };
}
