import type {
  Dimension,
  Level,
  Opening,
  Project,
  Space,
  TechnicalNetwork,
  Wall,
} from '@house-technical-designer/core-domain';
import {
  deriveRoofPlanes,
  deriveWallFaces,
  isDimension,
  resolveDimension,
  portAnchors,
  resolveStraightWallJoin,
  roofEaveOutline,
  structuralFootprint,
  validateWall,
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
} from '@house-technical-designer/drawing-engine';
import type {
  BoundingBox2D,
  Point2D,
  Polygon2D,
} from '@house-technical-designer/geometry';
import {
  offsetPolyline,
  polygonArea,
} from '@house-technical-designer/geometry';
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

export interface PlanViewOptions {
  readonly levelId?: string;
  /** Drawing scale denominator: 50 means 1:50. */
  readonly scale?: number;
  readonly layers?: LayerVisibility;
  readonly selection?: readonly string[];
  readonly hoveredId?: string;
  readonly graphicProfileId?: string;
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
    drafts.push({
      id: `wall-join:${wall.id}:${other.id}`,
      sourceObjectId: wall.id,
      semanticRole: 'WALL_CUT',
      geometry: { kind: 'POINT', point: join.point },
      layer: 'architecture.walls',
      zIndex: 22,
      discipline: 'ARCHITECTURE',
      metadata: { joinKind: join.kind, withWallId: other.id },
    });
  }
  return drafts;
}

/**
 * Builds an opening: the reveal cut through the wall, plus the door swing or the
 * window glazing line that tells the two apart on a plan.
 */
function openingPrimitives(
  opening: Opening,
  host: Wall | undefined,
  assembly: Assembly | undefined,
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
        widthMm: opening.widthMm,
        heightMm: opening.heightMm,
        sillHeightMm: opening.sillHeightMm,
        hostElementId: opening.hostElementId,
      },
    },
  ];

  if (opening.openingType === 'DOOR') {
    // Leaf shown open at 90°, then the quarter-circle swing it sweeps.
    const hinge = translate(start, side, rightOffset);
    const leafEnd = translate(hinge, side, -opening.widthMm);
    drafts.push({
      id: `opening-leaf:${opening.id}`,
      sourceObjectId: opening.id,
      semanticRole: 'OPENING',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: [hinge, leafEnd], closed: false },
      },
      layer: 'architecture.openings',
      zIndex: 31,
      discipline: 'ARCHITECTURE',
      metadata: { openingType: 'DOOR', part: 'LEAF' },
    });
    const steps = 8;
    const swing: Point2D[] = [];
    for (let step = 0; step <= steps; step += 1) {
      const angle = (Math.PI / 2) * (step / steps);
      const along = Math.sin(angle) * opening.widthMm;
      const across = -Math.cos(angle) * opening.widthMm;
      swing.push({
        x: hinge.x + direction.x * along + side.x * across,
        y: hinge.y + direction.y * along + side.y * across,
      });
    }
    drafts.push({
      id: `opening-swing:${opening.id}`,
      sourceObjectId: opening.id,
      semanticRole: 'OPENING',
      geometry: {
        kind: 'POLYLINE',
        polyline: { points: swing, closed: false },
      },
      layer: 'architecture.openings',
      zIndex: 31,
      discipline: 'ARCHITECTURE',
      metadata: { openingType: 'DOOR', part: 'SWING' },
    });
  }

  if (opening.openingType === 'WINDOW') {
    const glazingOffset = (leftOffset + rightOffset) / 2;
    drafts.push({
      id: `opening-glazing:${opening.id}`,
      sourceObjectId: opening.id,
      semanticRole: 'OPENING',
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: [
            translate(start, side, glazingOffset),
            translate(end, side, glazingOffset),
          ],
          closed: false,
        },
      },
      layer: 'architecture.openings',
      zIndex: 31,
      discipline: 'ARCHITECTURE',
      metadata: {
        openingType: 'WINDOW',
        part: 'GLAZING',
        sillHeightMm: opening.sillHeightMm,
      },
    });
  }
  return drafts;
}

function spacePolygon(space: Space): Polygon2D | undefined {
  return space.boundaryMode === 'MANUAL' ? space.manualPolygon : undefined;
}

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

function spacePrimitives(
  space: Space,
  level: Level,
): readonly PrimitiveDraft[] {
  const polygon = spacePolygon(space);
  if (polygon === undefined) return [];
  const areaM2 = Math.abs(polygonArea(polygon)) / 1_000_000;
  const heightM = level.defaultStoreyHeightMm / 1000;
  const anchor = centroid(polygon);
  return [
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
        areaM2: Number(areaM2.toFixed(2)),
        volumeM3: Number((areaM2 * heightM).toFixed(2)),
        heightM,
      },
    },
    {
      id: `space-label:${space.id}`,
      sourceObjectId: space.id,
      semanticRole: 'ANNOTATION',
      geometry: {
        kind: 'TEXT',
        anchor,
        text: `${space.name}\n${areaM2.toFixed(2)} m²`,
      },
      layer: 'architecture.space-labels',
      zIndex: 60,
      discipline: 'ARCHITECTURE',
      metadata: { name: space.name, areaM2: Number(areaM2.toFixed(2)) },
    },
  ];
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

function networkPrimitives(
  network: TechnicalNetwork,
): readonly PrimitiveDraft[] {
  const mapping = NETWORK_LAYERS[network.discipline] ?? NETWORK_LAYERS.OTHER!;
  const role = networkRole(network);
  const drafts: PrimitiveDraft[] = [];
  for (const edge of network.edges) {
    const points = edge.path.map(({ x, y }) => ({ x, y }));
    if (points.length < 2) continue;
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

function componentPrimitives(level: Level): readonly PrimitiveDraft[] {
  return (level.components ?? []).map((component) => {
    const half = COMPONENT_MARK_MM / 2;
    const radians = (component.rotationDeg * Math.PI) / 180;
    const corner = (dx: number, dy: number) => ({
      x: component.position.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: component.position.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    });
    return {
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
      discipline: 'OTHER' as const,
      metadata: {
        category: component.category,
        ...(component.definitionId === undefined
          ? {}
          : { definitionId: component.definitionId }),
        ...(component.spaceId === undefined
          ? {}
          : { spaceId: component.spaceId }),
      },
    };
  });
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
    for (let index = 1; index <= treads; index += 1) {
      const along = (totalMm * index) / (treads + 1);
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
function roofStructurePrimitives(level: Level): readonly PrimitiveDraft[] {
  const drafts: PrimitiveDraft[] = [];
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
    for (const plane of topology.planes)
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
        discipline: 'ARCHITECTURE' as const,
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
  if (parcel !== undefined)
    drafts.push({
      id: 'site:parcel',
      sourceObjectId: 'site:parcel',
      semanticRole: 'SITE',
      geometry: { kind: 'POLYGON', polygon: parcel },
      layer: 'site.parcel',
      zIndex: 1,
      discipline: 'OTHER',
    });
  for (const obstacle of project.site.obstacles ?? [])
    drafts.push({
      id: `site-obstacle:${obstacle.id}`,
      sourceObjectId: obstacle.id,
      semanticRole: 'SITE',
      geometry: { kind: 'POLYGON', polygon: obstacle.boundary },
      layer: 'site.parcel',
      zIndex: 2,
      discipline: 'OTHER',
      metadata: {
        ...(obstacle.kind === undefined ? {} : { kind: obstacle.kind }),
        ...(obstacle.heightMm === undefined
          ? {}
          : { heightMm: obstacle.heightMm }),
      },
    });
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
  primitives: readonly PrimitiveDraft[],
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
      drafts.push(...wallPrimitives(wall, assembly, level.walls, issues));
    }
    for (const opening of level.openings) {
      const host = level.walls.find(({ id }) => id === opening.hostElementId);
      drafts.push(
        ...openingPrimitives(
          opening,
          host,
          host === undefined ? undefined : assemblies.get(host.assemblyId),
          issues,
        ),
      );
    }
    for (const space of level.spaces)
      drafts.push(...spacePrimitives(space, level));
    for (const annotation of level.annotations)
      if (isDimension(annotation))
        drafts.push(...dimensionPrimitives(annotation, level, issues));
    drafts.push(...slabAndRoofPrimitives(level));
    drafts.push(...componentPrimitives(level));
    drafts.push(...stairPrimitives(level));
    drafts.push(...roofStructurePrimitives(level));
    drafts.push(...structurePrimitives(level));
  }
  drafts.push(...sitePrimitives(project));
  for (const network of project.systems ?? [])
    drafts.push(...networkPrimitives(network));

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
      boundsOf(drafts, options.paddingMm ?? DEFAULT_PADDING_MM),
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
