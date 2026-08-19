import type {
  Level,
  Opening,
  Project,
  Space,
  TechnicalNetwork,
  Wall,
} from '@house-technical-designer/core-domain';
import {
  deriveWallFaces,
  resolveStraightWallJoin,
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
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
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
  | 'VIEW_UNRESOLVED_HOST';

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
    drafts.push(...slabAndRoofPrimitives(level));
  }
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
    viewport: boundsOf(drafts, options.paddingMm ?? DEFAULT_PADDING_MM),
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
