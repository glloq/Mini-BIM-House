import type {
  ComponentInstance,
  Dimension,
  EquipmentDefinition,
  Level,
  Project,
  Space,
  TechnicalNetwork,
  RoofPlane,
  TextNote,
  Wall,
  WallOpening,
} from '@house-technical-designer/core-domain';
import {
  deriveRoofPlanes,
  deriveWallFaces,
  DEFAULT_NOTE_HEIGHT_MM,
  isDimension,
  isTextNote,
  isWallOpening,
  resolveDimension,
  portAnchors,
  resolveStraightWallJoin,
  roofEaveOutline,
  roofOpeningGeometry,
  structuralFootprint,
  validateWall,
  resolveSpaceGeometry,
  doorSwingOf,
} from '@house-technical-designer/core-domain';
import type { Assembly } from '@house-technical-designer/assemblies';
import type {
  Discipline,
  DrawingView,
  ObjectState,
  ScenePrimitive,
  SemanticRole,
  SemanticScene,
} from '@house-technical-designer/drawing-engine';
import {
  createSemanticScene,
  drawingViewId,
  graphicProfileId,
  placeSymbol,
  spaceGraphicCategory,
  SYMBOL_LIBRARY_V1,
} from '@house-technical-designer/drawing-engine';
import type {
  BoundingBox2D,
  Point2D,
  Polygon2D,
} from '@house-technical-designer/geometry';
import {
  boundingBox2D,
  interiorLabelPoint,
  offsetPolyline,
} from '@house-technical-designer/geometry';
import { architecturalFixtureSymbol } from './fixture-symbols.js';
import {
  isGlazedRepresentation,
  openingRepresentation,
} from './opening-representation.js';
import {
  defaultVisibility,
  visibleDisciplines,
  type LayerVisibility,
} from './layers.js';

export type PlanViewIssueCode =
  | 'VIEW_UNKNOWN_LEVEL'
  | 'VIEW_MISSING_ASSEMBLY'
  | 'VIEW_INVALID_WALL'
  | 'VIEW_OPENING_OUTSIDE_HOST'
  | 'VIEW_UNRESOLVED_HOST'
  | 'VIEW_UNRESOLVED_DIMENSION';

export interface PlanViewIssue {
  readonly code: PlanViewIssueCode;
  readonly objectId: string;
  readonly message: string;
}

/**
 * How much of a plan's dimensioning is drawn.
 *
 * The dimensions a project holds are objects somebody placed; the overall
 * width and depth of a building are neither placed nor stored, because they
 * are true of whatever the walls happen to be today. Asking for them is a
 * property of the drawing, and what comes back is graphic information derived
 * on the spot — never an object written back into the model.
 */
export type DimensionDisplayMode = 'NONE' | 'PROJECT' | 'PROJECT_AND_OVERALL';

export interface PlanViewOptions {
  readonly levelId?: string;
  /** Drawing scale denominator: 50 means 1:50. */
  readonly scale?: number;
  readonly layers?: LayerVisibility;
  readonly selection?: readonly string[];
  readonly hoveredId?: string;
  readonly graphicProfileId?: string;
  /** What the drawing dimensions. Its own dimensions when unstated. */
  readonly dimensions?: DimensionDisplayMode;
  /** Extra primitives merged into the scene, such as an analysis overlay. */
  readonly extraPrimitives?: readonly ScenePrimitive[];
  /** Model-space padding around the drawn content, in millimetres. */
  readonly paddingMm?: number;
  /**
   * The model window the view shows, when the caller states one.
   *
   * Without it the view frames whatever it drew, which is what a screen wants
   * and what a printed drawing must not do: a sheet says 1:50 and 1:50 is a
   * fixed number of model millimetres per paper millimetre, not whatever makes
   * the content fit.
   */
  readonly viewport?: BoundingBox2D;
}

export interface PlanViewResult {
  readonly view: DrawingView;
  readonly scene: SemanticScene;
  /** Every primitive built, before the view filters by discipline and viewport. */
  readonly primitives: readonly ScenePrimitive[];
  readonly issues: readonly PlanViewIssue[];
  readonly levelId?: string;
}

const DEFAULT_PADDING_MM = 800;
const DEFAULT_SCALE = 50;

function stateOf(
  id: string,
  selection: ReadonlySet<string>,
  hoveredId: string | undefined,
): ObjectState | undefined {
  if (selection.has(id)) return 'SELECTED';
  if (hoveredId === id) return 'HOVER';
  return undefined;
}

interface PrimitiveDraft {
  readonly id: string;
  readonly sourceObjectId?: string;
  readonly semanticRole: SemanticRole;
  readonly geometry: ScenePrimitive['geometry'];
  readonly layer: string;
  readonly zIndex: number;
  readonly discipline: Discipline;
  readonly metadata?: ScenePrimitive['metadata'];
}

function unitDirection(from: Point2D, to: Point2D): Point2D | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? undefined : { x: dx / length, y: dy / length };
}

function negate(direction: Point2D): Point2D {
  return { x: -direction.x, y: -direction.y };
}

function normal(direction: Point2D): Point2D {
  return { x: -direction.y, y: direction.x };
}

function translate(
  point: Point2D,
  direction: Point2D,
  distance: number,
): Point2D {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  };
}

/** Cumulative offsets of each assembly layer, measured from the wall's left face. */
function layerBands(
  assembly: Assembly,
  thicknessMm: number,
  referenceSide: Wall['referenceSide'],
): readonly {
  readonly layerId: string;
  readonly materialId: string;
  readonly role: string;
  readonly fromMm: number;
  readonly toMm: number;
}[] {
  const leftOffset =
    referenceSide === 'CENTER'
      ? thicknessMm / 2
      : referenceSide === 'LEFT'
        ? 0
        : thicknessMm;
  let cursor = leftOffset;
  return assembly.layers.map((layer) => {
    const layerThicknessMm = layer.thicknessM * 1000;
    const fromMm = cursor;
    cursor -= layerThicknessMm;
    return {
      layerId: layer.id,
      materialId: layer.materialId,
      role: layer.role ?? 'OTHER',
      fromMm,
      toMm: cursor,
    };
  });
}

/** Rectangle between two signed offsets of a straight wall segment. */
function bandPolygon(
  start: Point2D,
  end: Point2D,
  fromMm: number,
  toMm: number,
): Polygon2D | undefined {
  const direction = unitDirection(start, end);
  if (direction === undefined) return undefined;
  const side = normal(direction);
  return {
    outer: [
      translate(start, side, fromMm),
      translate(end, side, fromMm),
      translate(end, side, toMm),
      translate(start, side, toMm),
    ],
  };
}

/** Maps a layer's construction role onto the role the drawing profile styles. */
function layerRole(role: string): SemanticRole {
  switch (role) {
    case 'STRUCTURAL':
      return 'WALL_LAYER_STRUCTURE';
    case 'INSULATION':
      return 'WALL_LAYER_INSULATION';
    case 'FINISH':
    case 'CLADDING':
      return 'WALL_LAYER_FINISH';
    default:
      return 'WALL_LAYER_OTHER';
  }
}

function wallSegment(wall: Wall): readonly [Point2D, Point2D] | undefined {
  const points = wall.path.points;
  return points.length === 2 ? [points[0]!, points[1]!] : undefined;
}

function distanceAlong(wall: Wall): number {
  const segment = wallSegment(wall);
  if (segment === undefined) return 0;
  return Math.hypot(segment[1].x - segment[0].x, segment[1].y - segment[0].y);
}

/**
 * Builds the drawn representation of one wall: its cut footprint, the material
 * bands of its assembly, and the joins it makes with its neighbours.
 */
function wallPrimitives(
  wall: Wall,
  assembly: Assembly,
  neighbours: readonly Wall[],
  assemblies: ReadonlyMap<string, Assembly>,
  issues: PlanViewIssue[],
): readonly PrimitiveDraft[] {
  const validation = validateWall(wall, assembly);
  if (validation.length > 0) {
    issues.push({
      code: 'VIEW_INVALID_WALL',
      objectId: wall.id,
      message: validation.map(({ message }) => message).join('; '),
    });
    return [];
  }
  const faces = deriveWallFaces(wall, assembly);
  const drafts: PrimitiveDraft[] = [
    {
      id: `wall:${wall.id}`,
      sourceObjectId: wall.id,
      semanticRole: 'WALL_CUT',
      geometry: { kind: 'POLYGON', polygon: faces.footprint },
      layer: 'architecture.walls',
      zIndex: 20,
      discipline: 'ARCHITECTURE',
      metadata: {
        thicknessMm: faces.thicknessMm,
        assemblyId: assembly.id,
        role: wall.role,
        lengthMm: Math.round(distanceAlong(wall)),
      },
    },
  ];

  const segment = wallSegment(wall);
  if (segment !== undefined) {
    for (const band of layerBands(
      assembly,
      faces.thicknessMm,
      wall.referenceSide,
    )) {
      const polygon = bandPolygon(
        segment[0],
        segment[1],
        band.fromMm,
        band.toMm,
      );
      if (polygon === undefined) continue;
      drafts.push({
        id: `wall-layer:${wall.id}:${band.layerId}`,
        sourceObjectId: wall.id,
        semanticRole: layerRole(band.role),
        geometry: { kind: 'POLYGON', polygon },
        layer: 'architecture.wall-layers',
        zIndex: 21,
        discipline: 'ARCHITECTURE',
        metadata: {
          materialId: band.materialId,
          layerRole: band.role,
          thicknessMm: Math.abs(band.fromMm - band.toMm),
        },
      });
    }
  }

  for (const other of neighbours) {
    if (other.id <= wall.id) continue;
    const join = resolveStraightWallJoin(wall, other);
    if (join.status !== 'JOINED') continue;
    const otherAssembly = assemblies.get(other.assemblyId);
    if (otherAssembly === undefined) continue;
    const patch = joinPatch(
      wall,
      faces.thicknessMm,
      other,
      deriveWallFaces(other, otherAssembly).thicknessMm,
      join.point,
    );
    if (patch === undefined) continue;
    drafts.push({
      id: `wall-join:${wall.id}:${other.id}`,
      sourceObjectId: wall.id,
      semanticRole: 'WALL_CUT',
      geometry: { kind: 'POLYGON', polygon: patch },
      layer: 'architecture.walls',
      zIndex: 22,
      discipline: 'ARCHITECTURE',
      metadata: {
        joinKind: join.kind,
        withWallId: other.id,
        // The corner reads as the heavier of the two walls, because that is
        // what it is: a partition dies into a party wall, not the other way.
        role: heavierRole(wall.role, other.role),
      },
    });
  }
  return drafts;
}

/** Which of two walls the corner between them belongs to. */
const WALL_ROLE_WEIGHT: Readonly<Record<string, number>> = {
  EXTERIOR: 3,
  INTERIOR: 2,
  PARTITION: 1,
  OTHER: 0,
};

function heavierRole(first: string, second: string): string {
  return (WALL_ROLE_WEIGHT[first] ?? 0) >= (WALL_ROLE_WEIGHT[second] ?? 0)
    ? first
    : second;
}

/**
 * Below this, two walls are too nearly parallel for a corner to mean anything.
 *
 * The patch of a one-degree corner is metres long and is not a corner; the
 * walls simply overlap, and drawing them is enough.
 */
const JOIN_MINIMUM_SINE = 0.05;

/**
 * The piece of masonry that closes the corner between two walls.
 *
 * Each wall is drawn as its own rectangle, so two walls meeting at their ends
 * cover three of the four quadrants around the corner and leave the fourth
 * empty: a white notch bitten out of the outside of every corner of the house.
 * The missing piece is exactly where both walls' faces would run if neither
 * stopped — the parallelogram cut by the four face lines — so the patch is
 * built from those lines and can never spill past a face.
 */
function joinPatch(
  first: Wall,
  firstThicknessMm: number,
  second: Wall,
  secondThicknessMm: number,
  point: Point2D,
): Polygon2D | undefined {
  const firstSegment = wallSegment(first);
  const secondSegment = wallSegment(second);
  if (firstSegment === undefined || secondSegment === undefined)
    return undefined;
  const firstDirection = unitDirection(firstSegment[0], firstSegment[1]);
  const secondDirection = unitDirection(secondSegment[0], secondSegment[1]);
  if (firstDirection === undefined || secondDirection === undefined)
    return undefined;
  const cross =
    firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x;
  if (Math.abs(cross) < JOIN_MINIMUM_SINE) return undefined;
  const corner = (firstSide: number, secondSide: number): Point2D => {
    const along = (-secondSide * secondThicknessMm) / (2 * cross);
    const across = (firstSide * firstThicknessMm) / (2 * cross);
    return {
      x: point.x + firstDirection.x * along + secondDirection.x * across,
      y: point.y + firstDirection.y * along + secondDirection.y * across,
    };
  };
  return {
    outer: [corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)],
  };
}

/**
 * Builds an opening: the reveal cut through the wall, plus the door swing or the
 * window glazing line that tells the two apart on a plan.
 */
function openingPrimitives(
  opening: WallOpening,
  host: Wall | undefined,
  assembly: Assembly | undefined,
  familyId: string | undefined,
  issues: PlanViewIssue[],
): readonly PrimitiveDraft[] {
  if (host === undefined || assembly === undefined) {
    issues.push({
      code: 'VIEW_UNRESOLVED_HOST',
      objectId: opening.id,
      message: `L'ouverture ${opening.id} ne référence aucun mur du niveau.`,
    });
    return [];
  }
  const segment = wallSegment(host);
  if (segment === undefined) return [];
  const direction = unitDirection(segment[0], segment[1]);
  if (direction === undefined) return [];
  const wallLengthMm = distanceAlong(host);
  if (opening.offsetAlongHostMm + opening.widthMm > wallLengthMm) {
    issues.push({
      code: 'VIEW_OPENING_OUTSIDE_HOST',
      objectId: opening.id,
      message: `L'ouverture ${opening.id} dépasse de son mur porteur.`,
    });
  }
  const faces = deriveWallFaces(host, assembly);
  const thicknessMm = faces.thicknessMm;
  const leftOffset =
    host.referenceSide === 'CENTER'
      ? thicknessMm / 2
      : host.referenceSide === 'LEFT'
        ? 0
        : thicknessMm;
  const rightOffset = leftOffset - thicknessMm;
  const start = translate(segment[0], direction, opening.offsetAlongHostMm);
  const end = translate(start, direction, opening.widthMm);
  const side = normal(direction);
  const reveal: Polygon2D = {
    outer: [
      translate(start, side, leftOffset),
      translate(end, side, leftOffset),
      translate(end, side, rightOffset),
      translate(start, side, rightOffset),
    ],
  };
  const drafts: PrimitiveDraft[] = [
    {
      id: `opening:${opening.id}`,
      sourceObjectId: opening.id,
      semanticRole: 'OPENING_REVEAL',
      geometry: { kind: 'POLYGON', polygon: reveal },
      layer: 'architecture.openings',
      zIndex: 30,
      discipline: 'ARCHITECTURE',
      metadata: {
        openingType: opening.openingType,
        representation: openingRepresentation(opening.openingType, familyId),
        widthMm: opening.widthMm,
        heightMm: opening.heightMm,
        sillHeightMm: opening.sillHeightMm,
        hostElementId: opening.host.id,
      },
    },
  ];

  const representation = openingRepresentation(opening.openingType, familyId);
  const centreOffset = (leftOffset + rightOffset) / 2;
  const push = (
    suffix: string,
    part: string,
    points: readonly Point2D[],
    extra: ScenePrimitive['metadata'] = {},
  ): void => {
    drafts.push({
      id: `opening-${suffix}:${opening.id}`,
      sourceObjectId: opening.id,
      semanticRole: 'OPENING',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [...points], closed: false },
      },
      layer: 'architecture.openings',
      zIndex: 31,
      discipline: 'ARCHITECTURE',
      metadata: {
        openingType: opening.openingType,
        representation,
        part,
        ...extra,
      },
    });
  };

  const swing = doorSwingOf(opening);
  const hingeAtStart = swing.hinge === 'START';
  const opensLeft = swing.opensTo === 'LEFT_OF_HOST';
  const faceOffset = opensLeft ? leftOffset : rightOffset;
  const along = hingeAtStart ? direction : negate(direction);
  const across = opensLeft ? side : negate(side);
  const jamb = (fromStart: boolean): Point2D =>
    translate(fromStart ? start : end, side, faceOffset);

  /** The leaf and the arc it sweeps, hinged where the model says. */
  const leafAndSwing = (
    suffix: string,
    hinge: Point2D,
    leafAlong: Point2D,
    widthMm: number,
  ): void => {
    const angleDeg = swing.openingAngleDeg;
    const at = (degrees: number): Point2D => {
      const radians = (degrees * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      return {
        x: hinge.x + (leafAlong.x * cos + across.x * sin) * widthMm,
        y: hinge.y + (leafAlong.y * cos + across.y * sin) * widthMm,
      };
    };
    push(`leaf${suffix}`, 'LEAF', [hinge, at(angleDeg)], { angleDeg });
    // Twenty segments rather than eight: at eight the arc of a door is a
    // visible polygon on a printed sheet, and a plan is read at arm's length.
    const arc: Point2D[] = [];
    for (let step = 0; step <= DOOR_SWING_SEGMENTS; step += 1)
      arc.push(at((angleDeg * step) / DOOR_SWING_SEGMENTS));
    push(`swing${suffix}`, 'SWING', arc, { angleDeg });
  };

  switch (representation) {
    case 'HINGED_DOOR':
    case 'GLAZED_DOOR': {
      leafAndSwing('', jamb(hingeAtStart), along, opening.widthMm);
      break;
    }
    case 'DOUBLE_DOOR':
    case 'GLAZED_DOUBLE_DOOR': {
      // Two leaves, each half the bay, hinged one at each jamb.
      const half = opening.widthMm / 2;
      leafAndSwing('-a', jamb(true), direction, half);
      leafAndSwing('-b', jamb(false), negate(direction), half);
      break;
    }
    case 'SLIDING_DOOR': {
      // The panel runs along the wall instead of sweeping the room.
      const face = translate(
        jamb(hingeAtStart),
        across,
        SLIDING_PANEL_OFFSET_MM,
      );
      push('leaf', 'LEAF', [
        face,
        translate(face, negate(along), opening.widthMm),
      ]);
      break;
    }
    case 'POCKET_DOOR': {
      // Into the wall, where it is hidden: drawn between the two faces.
      const centre = translate(hingeAtStart ? start : end, side, centreOffset);
      push('leaf', 'LEAF_HIDDEN', [
        centre,
        translate(centre, negate(along), opening.widthMm),
      ]);
      break;
    }
    case 'FOLDING_DOOR': {
      const half = opening.widthMm / 2;
      const hinge = jamb(hingeAtStart);
      const knuckle = {
        x: hinge.x + (along.x * 0.7071 + across.x * 0.7071) * half,
        y: hinge.y + (along.y * 0.7071 + across.y * 0.7071) * half,
      };
      const far = translate(knuckle, along, half * 0.7071);
      push('leaf', 'LEAF', [
        hinge,
        knuckle,
        translate(far, across, -half * 0.7071),
      ]);
      break;
    }
    case 'GARAGE_DOOR': {
      // No leaf on a plan: the panel is overhead. The line says where it is.
      push('panel', 'PANEL', [
        translate(start, side, centreOffset),
        translate(end, side, centreOffset),
      ]);
      break;
    }
    default:
      break;
  }

  if (
    isGlazedRepresentation(representation) ||
    representation === 'GLAZED_DOOR'
  ) {
    // Reveal, then frame, then glass: a window read as a hole with something
    // fitted in it rather than as a line drawn across the masonry.
    const frameInset = Math.min(thicknessMm / 4, FRAME_INSET_MM);
    const frameLeft = leftOffset - frameInset;
    const frameRight = rightOffset + frameInset;
    push(
      'frame',
      'FRAME',
      [
        translate(start, side, frameLeft),
        translate(end, side, frameLeft),
        translate(end, side, frameRight),
        translate(start, side, frameRight),
        translate(start, side, frameLeft),
      ],
      { sillHeightMm: opening.sillHeightMm },
    );
    if (representation === 'GLAZED_SLIDING') {
      // Two panes that pass one another, so the plan says which slides.
      const gap = Math.min(thicknessMm / 6, SLIDING_PANE_GAP_MM);
      const overlap = opening.widthMm * 0.55;
      push('glazing-a', 'GLAZING', [
        translate(start, side, centreOffset - gap),
        translate(
          translate(start, direction, overlap),
          side,
          centreOffset - gap,
        ),
      ]);
      push('glazing-b', 'GLAZING', [
        translate(
          translate(start, direction, opening.widthMm - overlap),
          side,
          centreOffset + gap,
        ),
        translate(end, side, centreOffset + gap),
      ]);
    } else {
      push(
        'glazing',
        'GLAZING',
        [
          translate(start, side, centreOffset),
          translate(end, side, centreOffset),
        ],
        { sillHeightMm: opening.sillHeightMm },
      );
    }
    if (representation === 'GLAZED_BAY')
      // A bay is not one pane: the mullions say how it is divided.
      for (const fraction of [1 / 3, 2 / 3]) {
        const at = translate(start, direction, opening.widthMm * fraction);
        push(`mullion-${Math.round(fraction * 100)}`, 'MULLION', [
          translate(at, side, frameLeft),
          translate(at, side, frameRight),
        ]);
      }
  }
  return drafts;
}

/** Segments in the arc of a door: enough that a printed sheet reads a curve. */
const DOOR_SWING_SEGMENTS = 20;
/** How far outside the wall face a sliding panel is drawn. */
const SLIDING_PANEL_OFFSET_MM = 40;
/** How far apart two sliding panes are drawn, so both are visible. */
const SLIDING_PANE_GAP_MM = 25;
/** How far inside the reveal the frame of a window sits. */
const FRAME_INSET_MM = 50;

function centroid(polygon: Polygon2D): Point2D {
  const points = polygon.outer;
  const sum = points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Draws a dimension: its two extension lines, the measured line and the value.
 *
 * The value shown is resolved from the walls the dimension references. A
 * dimension whose walls have gone is drawn as unknown rather than silently
 * dropped, so the drawing never hides that it lost what it measured.
 */
function dimensionPrimitives(
  dimension: Dimension,
  level: Level,
  issues: PlanViewIssue[],
): readonly PrimitiveDraft[] {
  const resolution = resolveDimension(dimension, level.walls);
  if (resolution.status !== 'OK') {
    issues.push({
      code: 'VIEW_UNRESOLVED_DIMENSION',
      objectId: dimension.id,
      message: `La cote ${dimension.id} référence des murs absents : ${resolution.missingWallIds.join(', ')}.`,
    });
    return [];
  }
  const { firstPoint, secondPoint, valueMm } = resolution;
  const first = measuredEnd(dimension, firstPoint, secondPoint, 'FIRST');
  const second = measuredEnd(dimension, firstPoint, secondPoint, 'SECOND');
  const length = Math.hypot(second.x - first.x, second.y - first.y);
  if (length === 0) return [];
  const normal = {
    x: -(second.y - first.y) / length,
    y: (second.x - first.x) / length,
  };
  const offset = (point: Point2D): Point2D => ({
    x: point.x + normal.x * dimension.offsetMm,
    y: point.y + normal.y * dimension.offsetMm,
  });
  const firstOffset = offset(first);
  const secondOffset = offset(second);
  const label = dimension.overrideText ?? `${(valueMm / 1000).toFixed(2)} m`;
  const shared = {
    sourceObjectId: dimension.id,
    layer: 'annotation.dimensions',
    discipline: 'ARCHITECTURE' as const,
    metadata: {
      valueMm: Number(valueMm.toFixed(1)),
      dimensionType: dimension.type,
      ...(dimension.overrideText === undefined
        ? {}
        : { overrideText: dimension.overrideText }),
    },
  };
  return [
    {
      ...shared,
      id: `dimension:${dimension.id}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [firstOffset, secondOffset], closed: false },
      },
      zIndex: 70,
    },
    {
      ...shared,
      id: `dimension-witness-first:${dimension.id}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [first, firstOffset], closed: false },
      },
      zIndex: 70,
    },
    {
      ...shared,
      id: `dimension-witness-second:${dimension.id}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [second, secondOffset], closed: false },
      },
      zIndex: 70,
    },
    {
      ...shared,
      id: `dimension-label:${dimension.id}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'TEXT',
        anchor: {
          x: (firstOffset.x + secondOffset.x) / 2,
          y: (firstOffset.y + secondOffset.y) / 2,
        },
        text: label,
      },
      zIndex: 71,
    },
  ];
}

/** How far outside the building the overall dimensions are drawn. */
const OVERALL_DIMENSION_OFFSET_MM = 900;

/**
 * The width and the depth of what is built, measured off the walls.
 *
 * Not objects: nothing is written back into the project. They are true of
 * whatever the walls are today, and a stored copy of them would be a second
 * answer to a question the walls already answer.
 */
function overallDimensionPrimitives(
  level: Level,
  assemblies: ReadonlyMap<string, Assembly>,
): readonly PrimitiveDraft[] {
  const corners: Point2D[] = [];
  for (const wall of level.walls) {
    const assembly = assemblies.get(wall.assemblyId);
    if (assembly === undefined) continue;
    corners.push(...deriveWallFaces(wall, assembly).footprint.outer);
  }
  const box = boundingBox2D(corners);
  if (box === undefined) return [];
  const widthMm = box.max.x - box.min.x;
  const depthMm = box.max.y - box.min.y;
  if (widthMm <= 0 || depthMm <= 0) return [];
  const gap = OVERALL_DIMENSION_OFFSET_MM;
  return [
    ...overallRun(
      'width',
      { x: box.min.x, y: box.max.y },
      { x: box.max.x, y: box.max.y },
      { x: 0, y: gap },
      widthMm,
    ),
    ...overallRun(
      'depth',
      { x: box.min.x, y: box.min.y },
      { x: box.min.x, y: box.max.y },
      { x: -gap, y: 0 },
      depthMm,
    ),
  ];
}

function overallRun(
  axis: string,
  first: Point2D,
  second: Point2D,
  offset: Point2D,
  valueMm: number,
): readonly PrimitiveDraft[] {
  const moved = (point: Point2D): Point2D => ({
    x: point.x + offset.x,
    y: point.y + offset.y,
  });
  const firstOffset = moved(first);
  const secondOffset = moved(second);
  const shared = {
    layer: 'annotation.dimensions',
    discipline: 'ARCHITECTURE' as const,
    metadata: {
      dimensionType: axis === 'width' ? 'HORIZONTAL' : 'VERTICAL',
      valueMm: Number(valueMm.toFixed(1)),
      // Graphic information derived from the walls, not an object the project
      // holds: a reader of the scene can tell the two apart.
      derived: true,
      overallAxis: axis.toUpperCase(),
    },
  };
  return [
    {
      ...shared,
      id: `dimension-overall:${axis}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [firstOffset, secondOffset], closed: false },
      },
      zIndex: 70,
    },
    {
      ...shared,
      id: `dimension-overall-witness-first:${axis}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [first, firstOffset], closed: false },
      },
      zIndex: 70,
    },
    {
      ...shared,
      id: `dimension-overall-witness-second:${axis}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [second, secondOffset], closed: false },
      },
      zIndex: 70,
    },
    {
      ...shared,
      id: `dimension-overall-label:${axis}`,
      semanticRole: 'DIMENSION',
      geometry: {
        kind: 'TEXT',
        anchor: {
          x: (firstOffset.x + secondOffset.x) / 2,
          y: (firstOffset.y + secondOffset.y) / 2,
        },
        text: `${(valueMm / 1000).toFixed(2)} m`,
        ...(axis === 'depth' ? { rotationDeg: -90 } : {}),
      },
      zIndex: 71,
    },
  ];
}

/**
 * Where a dimension's line starts and ends.
 *
 * A horizontal or vertical dimension measures one axis only, so its line runs
 * along that axis rather than between the two points.
 */
function measuredEnd(
  dimension: Dimension,
  firstPoint: Point2D,
  secondPoint: Point2D,
  which: 'FIRST' | 'SECOND',
): Point2D {
  const point = which === 'FIRST' ? firstPoint : secondPoint;
  if (dimension.type === 'HORIZONTAL')
    return { x: point.x, y: Math.min(firstPoint.y, secondPoint.y) };
  if (dimension.type === 'VERTICAL')
    return { x: Math.min(firstPoint.x, secondPoint.x), y: point.y };
  return point;
}

/**
 * The paper the room's name and its area take, at any scale.
 *
 * The engine draws in paper millimetres, so a room that is too small for two
 * lines at 1:100 is too small for two lines, full stop — the decision is made
 * once, here, and holds for every scale the same drawing goes out at.
 */
const LABEL_NAME_PAPER_MM = 2.8;
const LABEL_AREA_PAPER_MM = 2.1;
/** Baseline to baseline, name to area. */
const LABEL_LINE_PAPER_MM = 3.4;
/** Average advance of a sans-serif glyph, as a fraction of its size. */
const LABEL_GLYPH_RATIO = 0.58;

function labelWidthPaperMm(text: string, sizePaperMm: number): number {
  return text.length * sizePaperMm * LABEL_GLYPH_RATIO;
}

function spacePrimitives(
  space: Space,
  level: Level,
  scale: number,
): readonly PrimitiveDraft[] {
  // The project's one answer about a room's outline: stated, or worked out
  // from the walls that enclose it. The plan used to read `manualPolygon` and
  // draw nothing for a room described by its walls.
  const resolved = resolveSpaceGeometry(space, level);
  const polygon = resolved.polygon;
  if (polygon === undefined || resolved.floorAreaM2 === undefined) return [];
  const areaM2 = resolved.floorAreaM2;
  const heightM = level.defaultStoreyHeightMm / 1000;
  const graphicCategory = spaceGraphicCategory(space.category);
  const drafts: PrimitiveDraft[] = [
    {
      id: `space:${space.id}`,
      sourceObjectId: space.id,
      semanticRole: 'SPACE_FILL',
      geometry: { kind: 'POLYGON', polygon },
      layer: 'architecture.spaces',
      zIndex: 10,
      discipline: 'ARCHITECTURE',
      metadata: {
        name: space.name,
        category: space.category,
        // The model's own word for the use, and the canonical one a charter
        // can style: « CHAMBRE », « Bedroom » and « SLEEPING » are one colour
        // on a plan, and the plan must not be the place that learns it.
        graphicCategory,
        areaM2: Number(areaM2.toFixed(2)),
        volumeM3: Number((areaM2 * heightM).toFixed(2)),
        heightM,
      },
    },
  ];

  // Where the name goes: the point furthest from the walls, not the average of
  // the outline's corners — which is inside a rectangle and outside an L.
  const placement = interiorLabelPoint(polygon);
  const box = boundingBox2D(polygon.outer);
  if (box === undefined) return drafts;
  const anchor = placement?.point ?? centroid(polygon);
  const reach =
    placement?.clearance ??
    Math.min(box.max.x - box.min.x, box.max.y - box.min.y) / 2;
  // Width across the room at the anchor, height from the inscribed circle: a
  // corridor holds its name on one line and has no room to stack a second.
  const availableWidthPaperMm =
    (placement?.horizontalSpan ?? box.max.x - box.min.x) / scale;
  const availableHeightPaperMm = (reach * 2) / scale;

  const areaText = `${areaM2.toFixed(2)} m²`;
  const nameWidthPaperMm = labelWidthPaperMm(space.name, LABEL_NAME_PAPER_MM);
  const areaWidthPaperMm = labelWidthPaperMm(areaText, LABEL_AREA_PAPER_MM);
  const fitsName =
    availableHeightPaperMm >= LABEL_NAME_PAPER_MM &&
    availableWidthPaperMm >= nameWidthPaperMm;
  // A cupboard gets its name or nothing; a name that spills into the room next
  // door is worse than a room left unnamed.
  if (!fitsName) return drafts;
  const fitsArea =
    availableHeightPaperMm >= LABEL_LINE_PAPER_MM + LABEL_AREA_PAPER_MM &&
    availableWidthPaperMm >= areaWidthPaperMm;

  const baseline = (offsetPaperMm: number): Point2D => ({
    x: anchor.x,
    y: anchor.y + offsetPaperMm * scale,
  });
  drafts.push({
    id: `space-label-name:${space.id}`,
    sourceObjectId: space.id,
    semanticRole: 'ANNOTATION',
    geometry: {
      kind: 'TEXT',
      anchor: baseline(fitsArea ? -1 : 1),
      text: space.name,
    },
    layer: 'architecture.space-labels',
    zIndex: 60,
    discipline: 'ARCHITECTURE',
    metadata: { labelPart: 'NAME', name: space.name, graphicCategory },
  });
  if (!fitsArea) return drafts;
  // Two primitives rather than one text holding a newline: SVG draws no line
  // break, and « CH 1 » and « 9.72 m² » are two levels of one annotation, not
  // one string in one size.
  drafts.push({
    id: `space-label-area:${space.id}`,
    sourceObjectId: space.id,
    semanticRole: 'ANNOTATION',
    geometry: {
      kind: 'TEXT',
      anchor: baseline(LABEL_LINE_PAPER_MM - 1),
      text: areaText,
    },
    layer: 'architecture.space-labels',
    zIndex: 60,
    discipline: 'ARCHITECTURE',
    metadata: {
      labelPart: 'AREA',
      areaM2: Number(areaM2.toFixed(2)),
      graphicCategory,
    },
  });
  return drafts;
}

const NETWORK_LAYERS: Readonly<
  Record<string, { readonly layer: string; readonly discipline: Discipline }>
> = {
  WATER: { layer: 'water.pipes', discipline: 'WATER' },
  WASTEWATER: { layer: 'wastewater.pipes', discipline: 'WASTEWATER' },
  VENTILATION: { layer: 'ventilation.ducts', discipline: 'VENTILATION' },
  ELECTRICAL: { layer: 'electrical.circuits', discipline: 'ELECTRICAL' },
  RAINWATER: { layer: 'water.pipes', discipline: 'WATER' },
  HEATING: { layer: 'water.pipes', discipline: 'HEATING' },
  OTHER: { layer: 'water.pipes', discipline: 'OTHER' },
};

/** Layer a discipline draws on, so a caller can reveal what it just edited. */
export function networkLayerId(discipline: string): string {
  return (NETWORK_LAYERS[discipline] ?? NETWORK_LAYERS.OTHER!).layer;
}

function networkRole(network: TechnicalNetwork): SemanticRole {
  switch (network.discipline) {
    case 'WATER':
      return network.systemType === 'DOMESTIC_HOT_WATER'
        ? 'WATER_HOT'
        : network.systemType === 'RECIRCULATION'
          ? 'WATER_RECIRCULATION'
          : 'WATER_COLD';
    case 'RAINWATER':
      return 'WATER_NON_POTABLE';
    case 'VENTILATION':
      return network.systemType === 'SUPPLY' ? 'VENT_SUPPLY' : 'VENT_EXHAUST';
    case 'ELECTRICAL':
      return 'ELECTRICAL_POWER';
    default:
      return 'NETWORK';
  }
}

/**
 * Which storey a network object belongs to, when the model says.
 *
 * A node states its level. A segment belongs to the level of the nodes it
 * joins; joining two levels, it is a riser and belongs to both. Nothing is
 * guessed from a height: a plan that placed a duct on a storey because its
 * z looked right would be a plan that moves objects between floors on its own.
 */
function networkLevelsOf(network: TechnicalNetwork): {
  readonly nodes: ReadonlyMap<string, string | undefined>;
  readonly edges: ReadonlyMap<string, readonly (string | undefined)[]>;
} {
  const nodes = new Map<string, string | undefined>(
    network.nodes.map((node) => [node.id, node.levelId]),
  );
  const nodeOfPort = new Map(
    network.ports.map((port) => [port.id, port.nodeId] as const),
  );
  const edges = new Map<string, readonly (string | undefined)[]>();
  for (const edge of network.edges) {
    const ends = [edge.fromPortId, edge.toPortId].map((portId) => {
      const nodeId = nodeOfPort.get(portId);
      return nodeId === undefined ? undefined : nodes.get(nodeId);
    });
    edges.set(edge.id, [...new Set(ends)]);
  }
  return { nodes, edges };
}

/**
 * Whether an object of the network belongs on the storey being drawn.
 *
 * An object that names no level is not placed on a floor: it is unassigned,
 * and it is shown wherever one looks rather than hidden on every storey — the
 * plan cannot invent a level the model does not state, and hiding it would
 * make it invisible everywhere.
 */
function onLevel(
  levels: readonly (string | undefined)[],
  levelId: string | undefined,
): boolean {
  if (levelId === undefined) return true;
  if (levels.every((level) => level === undefined)) return true;
  return levels.includes(levelId);
}

function networkPrimitives(
  network: TechnicalNetwork,
  levelId: string | undefined,
): readonly PrimitiveDraft[] {
  const mapping = NETWORK_LAYERS[network.discipline] ?? NETWORK_LAYERS.OTHER!;
  const role = networkRole(network);
  const placement = networkLevelsOf(network);
  const drafts: PrimitiveDraft[] = [];
  for (const edge of network.edges) {
    const ends = placement.edges.get(edge.id) ?? [];
    if (!onLevel(ends, levelId)) continue;
    const points = edge.path.map(({ x, y }) => ({ x, y }));
    if (points.length < 2) continue;
    // A segment joining two storeys is drawn on both, because that is what a
    // riser is: it passes through this floor on its way to the other.
    const rises = ends.filter((level) => level !== undefined).length > 1;
    drafts.push({
      id: `network-edge:${network.id}:${edge.id}`,
      sourceObjectId: edge.id,
      semanticRole: role,
      geometry: { kind: 'POLYLINE', polyline: { points, closed: false } },
      layer: mapping.layer,
      zIndex: 40,
      discipline: mapping.discipline,
      metadata: {
        networkId: network.id,
        discipline: network.discipline,
        systemType: network.systemType,
        edgeKind: edge.kind,
        riser: rises,
      },
    });
  }
  // A port is a place on an appliance, not a place in the house, so the model
  // gives it none. The drawing has to put it somewhere for the user to point
  // at it: near its node, and clickable on its own.
  const anchors = portAnchors(network);
  for (const port of network.ports) {
    const at = anchors.get(port.id);
    if (at === undefined) continue;
    if (!onLevel([placement.nodes.get(port.nodeId)], levelId)) continue;
    drafts.push({
      id: `network-port:${network.id}:${port.id}`,
      sourceObjectId: port.id,
      semanticRole: role,
      geometry: { kind: 'POINT', point: { x: at.x, y: at.y } },
      layer: mapping.layer,
      zIndex: 42,
      discipline: mapping.discipline,
      metadata: {
        networkId: network.id,
        nodeId: port.nodeId,
        portRole: port.role,
        direction: port.direction,
      },
    });
  }
  for (const node of network.nodes) {
    if (!onLevel([node.levelId], levelId)) continue;
    drafts.push({
      id: `network-node:${network.id}:${node.id}`,
      sourceObjectId: node.id,
      semanticRole: role,
      geometry: {
        kind: 'POINT',
        point: { x: node.position.x, y: node.position.y },
      },
      layer: mapping.layer,
      zIndex: 41,
      discipline: mapping.discipline,
      metadata: {
        networkId: network.id,
        nodeKind: node.kind,
        ...(node.spaceId === undefined ? {} : { spaceId: node.spaceId }),
      },
    });
  }
  return drafts;
}

/**
 * How wide a placed component is drawn, in millimetres.
 *
 * The model does not state a footprint — a catalogue entry describes a model
 * and not the space it takes on a plan — so the drawing marks where the thing
 * is, at a size that reads at a house's scale, and claims nothing about how
 * big it is. A real footprint will come from the definition, not from here.
 */
const COMPONENT_MARK_MM = 300;

const COMPONENT_ROLES: Readonly<Record<string, SemanticRole>> = {
  HEATING: 'ANALYSIS_MEDIUM',
  SANITARY: 'WATER_COLD',
  VENTILATION: 'VENT_SUPPLY',
  ELECTRICAL: 'ELECTRICAL_POWER',
  LIGHTING: 'ELECTRICAL_LIGHTING',
  PHOTOVOLTAIC: 'ELECTRICAL_PV',
};

function componentPrimitives(
  level: Level,
  equipment: ReadonlyMap<string, EquipmentDefinition>,
  scale: number,
): readonly PrimitiveDraft[] {
  return (level.components ?? []).flatMap((component) => {
    const discipline = disciplineOfComponent(component.category);
    const metadata: ScenePrimitive['metadata'] = {
      category: component.category,
      ...(component.definitionId === undefined
        ? {}
        : { definitionId: component.definitionId }),
      ...(component.spaceId === undefined
        ? {}
        : { spaceId: component.spaceId }),
    };
    const definition =
      component.definitionId === undefined
        ? undefined
        : equipment.get(component.definitionId);
    const drawn = fixturePrimitives(
      component,
      definition,
      discipline,
      metadata,
      scale,
    );
    if (drawn !== undefined) return drawn;
    // Nothing in the catalogue draws this one: the mark says something is
    // here, which is all it ever said.
    const half = COMPONENT_MARK_MM / 2;
    const radians = (component.rotationDeg * Math.PI) / 180;
    const corner = (dx: number, dy: number): Point2D => ({
      x: component.position.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: component.position.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    });
    return [
      {
        id: `component:${component.id}`,
        sourceObjectId: component.id,
        semanticRole: COMPONENT_ROLES[component.category] ?? 'SYMBOL',
        geometry: {
          kind: 'POLYGON' as const,
          polygon: {
            outer: [
              corner(-half, -half),
              corner(half, -half),
              corner(half, half),
              corner(-half, half),
            ],
          },
        },
        layer: 'components.placed',
        zIndex: 45,
        discipline,
        metadata,
      },
    ];
  });
}

/**
 * The thing itself, drawn at the size it is.
 *
 * A bath drawn six millimetres on the sheet is a dot at 1:50 and a dot at
 * 1:100: it says a bath is here and nothing about whether anybody can get past
 * it. The glyph is chosen by the family and stretched to the entry's own
 * width, so what the plan shows is the footprint the catalogue declares.
 */
function fixturePrimitives(
  component: ComponentInstance,
  definition: EquipmentDefinition | undefined,
  discipline: Discipline,
  metadata: ScenePrimitive['metadata'],
  scale: number,
): readonly PrimitiveDraft[] | undefined {
  // The family decides first — that is where the emprises are — and what the
  // fiche itself names comes next: a schematic glyph says something is here,
  // which is more than the mark said. Only a model-space glyph is stretched to
  // the declared width; a schematic one keeps its size on the sheet.
  const symbolId =
    architecturalFixtureSymbol(definition?.familyId) ??
    definition?.rendering?.symbols?.find(
      ({ viewType }) => viewType === undefined || viewType === 'PLAN',
    )?.symbolId;
  if (symbolId === undefined) return undefined;
  const symbol = SYMBOL_LIBRARY_V1.definitions[symbolId];
  if (symbol === undefined) return undefined;
  const glyphWidthMm = symbol.viewBox.max.x - symbol.viewBox.min.x;
  const widthMm = definition?.dimensions?.widthMm;
  const modelScale =
    symbol.scaleRules.space === 'MODEL_SPACE' &&
    widthMm !== undefined &&
    Number.isFinite(widthMm) &&
    widthMm > 0 &&
    glyphWidthMm > 0
      ? widthMm / glyphWidthMm
      : 1;
  return placeSymbol(symbol, {
    id: `component:${component.id}`,
    symbolId,
    position: component.position,
    // A model-space glyph is already in millimetres. A schematic one is drawn
    // in paper millimetres, so it takes the drawing's scale and comes out the
    // same size on the sheet whatever the sheet says.
    drawingScale: scale,
    rotationDeg: component.rotationDeg,
    modelScale,
    sourceObjectId: component.id,
    layer: 'components.placed',
    zIndex: 45,
  }).map((primitive) => ({
    id: primitive.id,
    sourceObjectId: component.id,
    // The trade a placed thing belongs to still decides its role, as it did
    // when every one of them was a square: what changed is its shape, not
    // which drawing it is read on.
    semanticRole: COMPONENT_ROLES[component.category] ?? primitive.semanticRole,
    geometry: primitive.geometry,
    layer: 'components.placed',
    zIndex: 45,
    // The discipline of a placed thing is what the thing is, which its own
    // category says; a glyph shared by two trades does not decide it.
    discipline,
    metadata: { ...metadata, ...primitive.metadata },
  }));
}

/**
 * What discipline a placed thing belongs to.
 *
 * A radiator is heating, a basin is water, a socket is electricity. Drawing
 * them all as « other » made an exported plan unable to say which trade each
 * symbol belonged to, which is the first thing a drawing is read for. The
 * furniture and the appliances stay « other », because they belong to no trade.
 */
function disciplineOfComponent(category: string): Discipline {
  switch (category) {
    case 'HEATING':
      return 'HEATING';
    case 'SANITARY':
      return 'WATER';
    case 'VENTILATION':
      return 'VENTILATION';
    case 'ELECTRICAL':
      return 'ELECTRICAL';
    case 'LIGHTING':
      return 'LIGHTING';
    case 'PHOTOVOLTAIC':
      return 'PV';
    default:
      return 'OTHER';
  }
}

/**
 * Draws a stair as a plan reads it: an outline, its treads, and its direction.
 *
 * The treads are placed along the walking line at the depth the stair states,
 * so a flight whose treads do not reach its landing is visibly short rather
 * than quietly wrong.
 */
function stairPrimitives(level: Level): readonly PrimitiveDraft[] {
  const drafts: PrimitiveDraft[] = [];
  for (const stair of level.stairs) {
    const points = stair.path.points;
    const start = points[0];
    const end = points[points.length - 1];
    if (start === undefined || end === undefined || points.length < 2) continue;
    const half = stair.widthMm / 2;
    const left: Point2D[] = [];
    const right: Point2D[] = [];
    for (const [index, point] of points.entries()) {
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[Math.min(points.length - 1, index + 1)]!;
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      left.push({ x: point.x + nx * half, y: point.y + ny * half });
      right.push({ x: point.x - nx * half, y: point.y - ny * half });
    }
    drafts.push({
      id: `stair:${stair.id}`,
      sourceObjectId: stair.id,
      semanticRole: 'WALL_BELOW',
      geometry: {
        kind: 'POLYGON',
        polygon: { outer: [...left, ...[...right].reverse()] },
      },
      layer: 'architecture.stairs',
      zIndex: 12,
      discipline: 'ARCHITECTURE',
      metadata: { stairType: stair.stairType, topLevelId: stair.topLevelId },
    });
    // One fewer tread than risers: the last riser arrives on the storey above.
    const treads = Math.max(0, stair.riserCount - 1);
    const totalMm = polylineLengthOf(points);
    // Each nosing sits one tread further up the line than the one below it,
    // and a landing pushes the ones above it by its own depth. Spreading the
    // treads evenly over the line instead would draw any riser count at any
    // tread depth as a full flight, so a stair whose steps do not fit the
    // space it was given would look exactly like one that does.
    let along = 0;
    for (let index = 1; index <= treads; index += 1) {
      const landing = (stair.landings ?? []).find(
        ({ afterRiser }) => afterRiser === index,
      );
      along += landing?.depthMm ?? stair.treadDepthMm;
      // Past the end of the drawn line there is no floor to put a tread on.
      // Stopping leaves the flight visibly short of its own walking line.
      if (along > totalMm) break;
      const at = pointAlong(points, along);
      const direction = directionAlong(points, along);
      if (at === undefined || direction === undefined) continue;
      drafts.push({
        id: `stair-tread:${stair.id}:${index}`,
        sourceObjectId: stair.id,
        semanticRole: 'ANNOTATION',
        geometry: {
          kind: 'POLYLINE',
          polyline: {
            points: [
              {
                x: at.x - direction.y * half,
                y: at.y + direction.x * half,
              },
              {
                x: at.x + direction.y * half,
                y: at.y - direction.x * half,
              },
            ],
            closed: false,
          },
        },
        layer: 'architecture.stairs',
        zIndex: 13,
        discipline: 'ARCHITECTURE',
      });
    }
    drafts.push({
      id: `stair-walk:${stair.id}`,
      sourceObjectId: stair.id,
      semanticRole: 'ANNOTATION',
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: points.map(({ x, y }) => ({ x, y })),
          closed: false,
        },
      },
      layer: 'architecture.stairs',
      zIndex: 14,
      discipline: 'ARCHITECTURE',
    });
  }
  return drafts;
}

function polylineLengthOf(points: readonly Point2D[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1)
    total += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y,
    );
  return total;
}

function pointAlong(
  points: readonly Point2D[],
  distanceMm: number,
): Point2D | undefined {
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (travelled + length >= distanceMm) {
      const ratio = length === 0 ? 0 : (distanceMm - travelled) / length;
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      };
    }
    travelled += length;
  }
  return points[points.length - 1];
}

function directionAlong(
  points: readonly Point2D[],
  distanceMm: number,
): Point2D | undefined {
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (travelled + length >= distanceMm || index === points.length - 1)
      return length === 0
        ? undefined
        : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    travelled += length;
  }
  return undefined;
}

/**
 * Draws a roof as a roof plan reads it: the eaves, then the lines where the
 * planes meet.
 *
 * A ridge this version cannot solve is simply absent — the eaves are still
 * exact, and a line drawn where no plane meets would be worse than no line.
 */
function roofStructurePrimitives(
  level: Level,
  issues: PlanViewIssue[],
): readonly PrimitiveDraft[] {
  const drafts: PrimitiveDraft[] = [];
  /*
   * Les pans que ce niveau porte, dessinés une fois et retenus : une fenêtre
   * de toit se dessine dans le sien, et le retrouver demande la toiture dont
   * il est dérivé. Les chercher pour chaque fenêtre relancerait un squelette
   * droit par ouverture.
   */
  const planes = new Map<string, RoofPlane>();
  for (const roof of level.roofStructures ?? []) {
    drafts.push({
      id: `roof-structure:${roof.id}`,
      sourceObjectId: roof.id,
      semanticRole: 'WALL_BELOW',
      geometry: { kind: 'POLYGON', polygon: roofEaveOutline(roof) },
      layer: 'architecture.roofs',
      zIndex: 6,
      discipline: 'ARCHITECTURE',
      metadata: { sides: roof.edges.length },
    });
    const topology = deriveRoofPlanes(roof);
    for (const plane of topology.planes) {
      planes.set(plane.id, plane);
      drafts.push({
        id: `roof-structure-plane:${plane.id}`,
        sourceObjectId: roof.id,
        semanticRole: 'ANNOTATION',
        geometry: { kind: 'POLYGON', polygon: plane.footprint },
        layer: 'architecture.roofs',
        zIndex: 7,
        discipline: 'ARCHITECTURE',
        metadata: {
          slopeDeg: plane.slopeDeg,
          azimuthDeg: plane.azimuthDeg,
          derived: topology.status === 'DERIVED',
        },
      });
    }
  }
  for (const plane of level.roofs) planes.set(plane.id, plane);
  drafts.push(...roofOpeningPrimitives(level, planes, issues));
  return drafts;
}

/**
 * Les fenêtres de toit, dessinées dans le pan qui les porte.
 *
 * Un plan de toiture les montre en projection : un rectangle raccourci par la
 * pente, à l'endroit du rampant où elles sont implantées. C'est ce qu'un
 * couvreur lit pour les positionner, et c'est aussi ce que le plan doit
 * montrer pour qu'on voie qu'elles sont là.
 */
function roofOpeningPrimitives(
  level: Level,
  planes: ReadonlyMap<string, RoofPlane>,
  issues: PlanViewIssue[],
): readonly PrimitiveDraft[] {
  const drafts: PrimitiveDraft[] = [];
  for (const opening of level.openings) {
    if (isWallOpening(opening)) continue;
    const plane = planes.get(opening.host.id);
    if (plane === undefined) {
      issues.push({
        code: 'VIEW_UNRESOLVED_HOST',
        objectId: opening.id,
        message: `La fenêtre de toit ${opening.id} ne désigne aucun pan du niveau.`,
      });
      continue;
    }
    const geometry = roofOpeningGeometry(opening, plane);
    if (geometry === undefined) {
      // Un pan sans rampant ne porte pas de fenêtre de toit ; le dire vaut
      // mieux que de poser un rectangle quelque part.
      issues.push({
        code: 'VIEW_UNRESOLVED_HOST',
        objectId: opening.id,
        message: `Le pan ${plane.id} n'a pas de rampant : la fenêtre ${opening.id} n'est pas dessinable.`,
      });
      continue;
    }
    drafts.push({
      id: `roof-opening:${opening.id}`,
      sourceObjectId: opening.id,
      semanticRole: 'OPENING',
      geometry: { kind: 'POLYGON', polygon: geometry.footprint },
      layer: 'architecture.openings',
      zIndex: 31,
      discipline: 'ARCHITECTURE',
      metadata: {
        openingType: opening.openingType,
        widthMm: opening.widthMm,
        heightMm: opening.heightMm,
        hostElementId: opening.host.id,
        lowerEdgeElevationMm: Math.round(geometry.lowerEdgeElevationMm),
      },
    });
  }
  return drafts;
}

/**
 * A note written on the drawing, and the line to what it points at.
 *
 * Nothing here derives anything: the text is what someone wrote, and the plan
 * shows it where they put it. A note that points at something is drawn with a
 * leader, because a note beside a wall and a note about that wall are two
 * different statements.
 */
function textNotePrimitives(note: TextNote): readonly PrimitiveDraft[] {
  const shared = {
    sourceObjectId: note.id,
    layer: 'annotation.notes',
    discipline: 'ARCHITECTURE' as const,
  };
  const drafts: PrimitiveDraft[] = [
    {
      ...shared,
      id: `note:${note.id}`,
      semanticRole: 'ANNOTATION',
      geometry: {
        kind: 'TEXT',
        anchor: note.at,
        text: note.text,
        ...(note.rotationDeg === undefined
          ? {}
          : { rotationDeg: note.rotationDeg }),
      },
      zIndex: 72,
      metadata: {
        heightMm: note.heightMm ?? DEFAULT_NOTE_HEIGHT_MM,
      },
    },
  ];
  if (note.leaderTo !== undefined)
    drafts.push({
      ...shared,
      id: `note-leader:${note.id}`,
      semanticRole: 'ANNOTATION',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [note.at, note.leaderTo], closed: false },
      },
      zIndex: 71,
    });
  return drafts;
}

function structurePrimitives(level: Level): readonly PrimitiveDraft[] {
  return (level.structure ?? []).flatMap((member) => {
    const outline = structuralFootprint(member);
    if (outline.length < 3) return [];
    return [
      {
        id: `structure:${member.id}`,
        sourceObjectId: member.id,
        semanticRole: 'WALL_CUT' as const,
        geometry: { kind: 'POLYGON' as const, polygon: { outer: outline } },
        layer: 'structure.members',
        zIndex: 20,
        discipline: 'STRUCTURE' as const,
        metadata: { kind: member.kind },
      },
    ];
  });
}

/**
 * The ground the house sits on: its parcel and what stands around it.
 *
 * The site has held a boundary and a list of obstacles since the beginning and
 * nothing drew them, so the distances to the limits and the shade of a
 * neighbour were facts nobody could see.
 */
function sitePrimitives(project: Project): readonly PrimitiveDraft[] {
  const drafts: PrimitiveDraft[] = [];
  const parcel = project.site.parcelBoundary;
  if (parcel !== undefined) {
    /*
     * Le sol, puis la limite.
     *
     * Une parcelle fermée n'était qu'un trait tireté pâle sur du blanc : rien
     * ne disait qu'une surface venait d'exister. Le lavis est un dessin à
     * part, sans identifiant — on ne sélectionne pas le sol, on sélectionne la
     * limite — et il passe sous tout le reste, ce qui est sa place.
     */
    drafts.push({
      id: 'site:ground',
      semanticRole: 'SITE',
      geometry: { kind: 'POLYGON', polygon: parcel },
      layer: 'site.parcel',
      zIndex: 0,
      discipline: 'SITE',
      metadata: { ground: true },
    });
    drafts.push({
      id: 'site:parcel',
      sourceObjectId: 'site:parcel',
      semanticRole: 'SITE',
      geometry: { kind: 'POLYGON', polygon: parcel },
      layer: 'site.parcel',
      zIndex: 1,
      discipline: 'SITE',
    });
  }
  for (const obstacle of project.site.obstacles ?? [])
    drafts.push({
      id: `site-obstacle:${obstacle.id}`,
      sourceObjectId: obstacle.id,
      semanticRole: 'SITE',
      geometry: { kind: 'POLYGON', polygon: obstacle.boundary },
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
  return drafts;
}

/**
 * Where the sections are cut and the façades are looked from, on the plan.
 *
 * A drawing set can hold a section and the plan would not say where it passes.
 * A reader holding both sheets had to guess, and a reader holding only the plan
 * did not know the section existed. The mark is derived from the view — it is
 * not a second place where the cut is decided — so moving the cut moves the
 * mark.
 */
function viewMarkPrimitives(project: Project): readonly PrimitiveDraft[] {
  // A mark carries no `sourceObjectId`: it is the plan saying that a drawing
  // exists, not an object of the plan. Making it selectable would put a piece
  // of the drawing set under the pointer, between the wall and the room it
  // separates.
  const drafts: PrimitiveDraft[] = [];
  const footprint = project.building.levels.flatMap(({ walls }) =>
    walls.flatMap(({ path }) => path.points),
  );
  for (const view of project.drawingViews ?? []) {
    if (view.type === 'SECTION' && view.cut !== undefined) {
      const { start, end } = view.cut;
      drafts.push({
        id: `view-mark:${view.id}`,
        semanticRole: 'ANNOTATION',
        geometry: {
          kind: 'POLYLINE',
          polyline: { points: [start, end], closed: false },
        },
        layer: 'annotation.view-marks',
        zIndex: 60,
        discipline: 'ARCHITECTURE',
        metadata: { name: view.name, type: view.type },
      });
      // Which way the section looks, drawn at both ends the way a section mark
      // is: the arrows point behind the cut, where the drawing looks.
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const look = { x: -dy / length, y: dx / length };
        const reach = Math.max(600, length / 12);
        for (const [index, at] of [start, end].entries())
          drafts.push({
            id: `view-mark-arrow:${view.id}:${index}`,
            semanticRole: 'ANNOTATION',
            geometry: {
              kind: 'POLYLINE',
              polyline: {
                points: [
                  at,
                  { x: at.x + look.x * reach, y: at.y + look.y * reach },
                ],
                closed: false,
              },
            },
            layer: 'annotation.view-marks',
            zIndex: 60,
            discipline: 'ARCHITECTURE',
          });
        drafts.push({
          id: `view-mark-label:${view.id}`,
          semanticRole: 'ANNOTATION',
          geometry: {
            kind: 'TEXT',
            anchor: { x: start.x, y: start.y },
            text: view.name,
          },
          layer: 'annotation.view-marks',
          zIndex: 61,
          discipline: 'ARCHITECTURE',
        });
      }
      continue;
    }
    if (view.type !== 'ELEVATION' || view.viewDirectionDeg === undefined)
      continue;
    // A façade is looked at from outside; the mark stands clear of the house
    // and points the way the drawing looks.
    if (footprint.length === 0) continue;
    const centre = {
      x:
        (Math.min(...footprint.map(({ x }) => x)) +
          Math.max(...footprint.map(({ x }) => x))) /
        2,
      y:
        (Math.min(...footprint.map(({ y }) => y)) +
          Math.max(...footprint.map(({ y }) => y))) /
        2,
    };
    const span = Math.max(
      Math.max(...footprint.map(({ x }) => x)) -
        Math.min(...footprint.map(({ x }) => x)),
      Math.max(...footprint.map(({ y }) => y)) -
        Math.min(...footprint.map(({ y }) => y)),
    );
    const radians = (view.viewDirectionDeg * Math.PI) / 180;
    const stand = {
      x: centre.x - Math.cos(radians) * (span * 0.75),
      y: centre.y - Math.sin(radians) * (span * 0.75),
    };
    drafts.push(
      {
        id: `view-mark:${view.id}`,
        semanticRole: 'ANNOTATION',
        geometry: {
          kind: 'POLYLINE',
          polyline: {
            points: [
              stand,
              {
                x: stand.x + Math.cos(radians) * (span / 8),
                y: stand.y + Math.sin(radians) * (span / 8),
              },
            ],
            closed: false,
          },
        },
        layer: 'annotation.view-marks',
        zIndex: 60,
        discipline: 'ARCHITECTURE',
        metadata: {
          name: view.name,
          type: view.type,
          azimuthDeg: view.viewDirectionDeg,
        },
      },
      {
        id: `view-mark-label:${view.id}`,
        semanticRole: 'ANNOTATION',
        geometry: {
          kind: 'TEXT',
          anchor: stand,
          text: view.name,
        },
        layer: 'annotation.view-marks',
        zIndex: 61,
        discipline: 'ARCHITECTURE',
      },
    );
  }
  return drafts;
}

function slabAndRoofPrimitives(level: Level): readonly PrimitiveDraft[] {
  return [
    ...level.slabs.map((slab) => ({
      id: `slab:${slab.id}`,
      sourceObjectId: slab.id,
      semanticRole: 'WALL_BELOW' as const,
      geometry: { kind: 'POLYGON' as const, polygon: slab.polygon },
      layer: 'architecture.slabs',
      zIndex: 5,
      discipline: 'ARCHITECTURE' as const,
      metadata: { assemblyId: slab.assemblyId, role: slab.role },
    })),
    /*
     * Le bord de chaque trémie, pour qu'on puisse la désigner.
     *
     * Un trou était un anneau creusé dans le contour de la dalle : il se
     * voyait et ne se cliquait pas, donc il ne se corrigeait pas. Son bord est
     * un objet à lui, au-dessus de la dalle qu'il perce.
     */
    ...level.slabs.flatMap((slab) =>
      (slab.polygon.holes ?? []).map((ring, index) => ({
        id: `slab:${slab.id}#hole:${index}`,
        sourceObjectId: `${slab.id}#hole:${index}`,
        semanticRole: 'ANNOTATION' as const,
        geometry: {
          kind: 'POLYLINE' as const,
          polyline: { points: ring, closed: true },
        },
        layer: 'architecture.slabs',
        // Au-dessus du remplissage des pièces : un trait qu'on voit et qu'on
        // ne peut pas cliquer parce qu'un aplat le couvre est un trait mort.
        zIndex: 11,
        discipline: 'ARCHITECTURE' as const,
      })),
    ),
    // Only the planes drawn one at a time: a roof described by its outline
    // draws its own, so that clicking one selects the roof and not a plane
    // nobody made.
    ...level.roofs.map((roof) => ({
      id: `roof:${roof.id}`,
      sourceObjectId: roof.id,
      semanticRole: 'WALL_BELOW' as const,
      geometry: { kind: 'POLYGON' as const, polygon: roof.footprint },
      layer: 'architecture.roofs',
      zIndex: 6,
      discipline: 'ARCHITECTURE' as const,
      metadata: {
        assemblyId: roof.assemblyId,
        slopeDeg: roof.slopeDeg,
        azimuthDeg: roof.azimuthDeg,
      },
    })),
  ];
}

function boundsOf(
  primitives: readonly Pick<PrimitiveDraft, 'geometry'>[],
  paddingMm: number,
): DrawingView['viewport'] {
  const points: Point2D[] = [];
  for (const { geometry } of primitives) {
    if (geometry.kind === 'POINT') points.push(geometry.point);
    else if (geometry.kind === 'POLYLINE')
      points.push(...geometry.polyline.points);
    else if (geometry.kind === 'POLYGON')
      points.push(...geometry.polygon.outer);
    else points.push(geometry.anchor);
  }
  if (points.length === 0)
    return { min: { x: 0, y: 0 }, max: { x: 10_000, y: 8_000 } };
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return {
    min: { x: Math.min(...xs) - paddingMm, y: Math.min(...ys) - paddingMm },
    max: { x: Math.max(...xs) + paddingMm, y: Math.max(...ys) + paddingMm },
  };
}

/**
 * Derives the plan drawing of a level from the project.
 *
 * This is the single place where persisted facts become drawable primitives:
 * walls carry their real thickness, faces and material layers, openings are cut
 * through their host, spaces are filled and labelled, and technical networks are
 * routed onto their own discipline layers. Nothing produced here is persisted.
 */
export function buildPlanView(
  project: Project,
  options: PlanViewOptions = {},
): PlanViewResult {
  const issues: PlanViewIssue[] = [];
  const level =
    options.levelId === undefined
      ? project.building.levels[0]
      : project.building.levels.find(({ id }) => id === options.levelId);
  if (level === undefined && options.levelId !== undefined)
    issues.push({
      code: 'VIEW_UNKNOWN_LEVEL',
      objectId: options.levelId,
      message: `Le niveau ${options.levelId} n'existe pas dans ce projet.`,
    });

  const assemblies = new Map(
    (project.assemblies ?? []).map((assembly) => [assembly.id, assembly]),
  );
  // The family the project's own copy of a catalogue entry declares: what says
  // whether a door swings, slides or folds, and a plan that ignores it draws a
  // quarter-circle across a metre of room a sliding door never sweeps.
  const equipment = new Map(
    (project.equipment ?? []).map((entry) => [entry.id, entry]),
  );
  const openingFamilies = new Map(
    (project.openingTypes ?? [])
      .filter(({ familyId }) => familyId !== undefined)
      .map(({ id, familyId }) => [id, familyId!]),
  );
  const drafts: PrimitiveDraft[] = [];
  if (level !== undefined) {
    for (const wall of level.walls) {
      const assembly = assemblies.get(wall.assemblyId);
      if (assembly === undefined) {
        issues.push({
          code: 'VIEW_MISSING_ASSEMBLY',
          objectId: wall.id,
          message: `Le mur ${wall.id} référence l'assemblage inconnu ${wall.assemblyId}.`,
        });
        continue;
      }
      drafts.push(
        ...wallPrimitives(wall, assembly, level.walls, assemblies, issues),
      );
    }
    for (const opening of level.openings) {
      if (!isWallOpening(opening)) continue;
      const host = level.walls.find(({ id }) => id === opening.host.id);
      drafts.push(
        ...openingPrimitives(
          opening,
          host,
          host === undefined ? undefined : assemblies.get(host.assemblyId),
          opening.definitionId === undefined
            ? undefined
            : openingFamilies.get(opening.definitionId),
          issues,
        ),
      );
    }
    for (const space of level.spaces)
      drafts.push(
        ...spacePrimitives(space, level, options.scale ?? DEFAULT_SCALE),
      );
    const dimensionMode = options.dimensions ?? 'PROJECT';
    for (const annotation of level.annotations)
      if (isDimension(annotation)) {
        if (dimensionMode !== 'NONE')
          drafts.push(...dimensionPrimitives(annotation, level, issues));
      } else if (isTextNote(annotation))
        drafts.push(...textNotePrimitives(annotation));
    if (dimensionMode === 'PROJECT_AND_OVERALL')
      drafts.push(...overallDimensionPrimitives(level, assemblies));
    drafts.push(...slabAndRoofPrimitives(level));
    drafts.push(
      ...componentPrimitives(level, equipment, options.scale ?? DEFAULT_SCALE),
    );
    drafts.push(...stairPrimitives(level));
    drafts.push(...roofStructurePrimitives(level, issues));
    drafts.push(...structurePrimitives(level));
  }
  drafts.push(...sitePrimitives(project));
  drafts.push(...viewMarkPrimitives(project));
  for (const network of project.systems ?? [])
    drafts.push(...networkPrimitives(network, level?.id));

  const layers = options.layers ?? defaultVisibility();
  const selection = new Set(options.selection ?? []);
  const primitives: ScenePrimitive[] = [
    ...drafts
      .filter(({ layer }) => layers[layer] !== false)
      .map((draft): ScenePrimitive => {
        const state = stateOf(
          draft.sourceObjectId ?? draft.id,
          selection,
          options.hoveredId,
        );
        const { sourceObjectId, metadata, ...rest } = draft;
        return {
          ...rest,
          ...(sourceObjectId === undefined ? {} : { sourceObjectId }),
          ...(metadata === undefined ? {} : { metadata }),
          ...(state === undefined ? {} : { state }),
        };
      }),
    ...(options.extraPrimitives ?? []),
  ];

  const view: DrawingView = {
    id: drawingViewId(`plan:${level?.id ?? 'empty'}`),
    type: 'PLAN',
    ...(level === undefined ? {} : { levelId: level.id }),
    scale: options.scale ?? DEFAULT_SCALE,
    viewport:
      options.viewport ??
      // What is drawn, not what was built: the bounds used to come from every
      // draft, so switching the plot off left the drawing framed on a plot
      // nobody could see and the house at a quarter of the sheet.
      boundsOf(
        primitives.length === 0 ? drafts : primitives,
        options.paddingMm ?? DEFAULT_PADDING_MM,
      ),
    visibleDisciplines: visibleDisciplines(layers),
    graphicProfileId: graphicProfileId(
      options.graphicProfileId ?? 'generic-technical-screen',
    ),
  };

  return {
    view,
    scene: createSemanticScene(view, primitives),
    primitives,
    issues,
    ...(level === undefined ? {} : { levelId: level.id }),
  };
}

/** Offsets a polyline, exposed so tools can preview a wall before it exists. */
export function previewWallFaces(
  points: readonly Point2D[],
  thicknessMm: number,
): Polygon2D | undefined {
  const reference = { points: [...points], closed: false as const };
  const left = offsetPolyline(reference, thicknessMm / 2);
  const right = offsetPolyline(reference, -thicknessMm / 2);
  if (left.kind !== 'OK' || right.kind !== 'OK') return undefined;
  return {
    outer: [...left.polyline.points, ...[...right.polyline.points].reverse()],
  };
}
