import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import {
  createRoofSolarSurface,
  type RoofSolarSurface,
} from './solar-surface.js';

export interface PvModuleDefinition {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly widthM: number;
  readonly heightM: number;
  readonly nominalPowerWp: number;
  readonly efficiency?: number;
  readonly vocV?: number;
  readonly vmpV?: number;
  readonly iscA?: number;
  readonly impA?: number;
  readonly source: {
    readonly sourceType: 'MANUFACTURER' | 'CATALOG' | 'USER' | 'OTHER';
    readonly reference?: string;
  };
}

export type PvModuleOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface PvLayoutInput {
  readonly surface: RoofSolarSurface;
  readonly module: PvModuleDefinition;
  readonly orientation: PvModuleOrientation | 'BEST_COUNT';
  readonly edgeMarginMm: number;
  readonly gapMm: number;
}

export interface PvModulePlacement {
  readonly id: string;
  readonly moduleId: string;
  readonly surfaceId: string;
  readonly orientation: PvModuleOrientation;
  /** Horizontal projection in persisted millimetre coordinates. */
  readonly polygon: Polygon2D;
}

export interface PvLayoutResult {
  readonly methodId: 'rectangular-grid-roof-plane-v1';
  readonly surfaceId: string;
  readonly orientation: PvModuleOrientation;
  readonly placements: readonly PvModulePlacement[];
  readonly moduleCount: number;
  readonly installedPowerWp: number;
}

interface PlaneTransform {
  readonly cross: Point2D;
  readonly slope: Point2D;
  readonly cosineTilt: number;
}

export function solvePvLayout(input: PvLayoutInput): PvLayoutResult {
  createRoofSolarSurface(input.surface);
  validateModule(input.module);
  nonNegative(input.edgeMarginMm, 'edge margin');
  nonNegative(input.gapMm, 'module gap');
  if (input.orientation === 'BEST_COUNT') {
    const portrait = solveOrientation(input, 'PORTRAIT');
    const landscape = solveOrientation(input, 'LANDSCAPE');
    return landscape.moduleCount > portrait.moduleCount ? landscape : portrait;
  }
  return solveOrientation(input, input.orientation);
}

function solveOrientation(
  input: PvLayoutInput,
  orientation: PvModuleOrientation,
): PvLayoutResult {
  const transform = planeTransform(input.surface);
  const surfaceLocal = transformPolygon(input.surface.polygon, (point) =>
    toPlane(point, transform),
  );
  const exclusions = [
    ...input.surface.exclusionZones
      .filter(({ enabled }) => enabled)
      .map(({ polygon }) =>
        transformPolygon(polygon, (point) => toPlane(point, transform)),
      ),
    ...input.surface.obstacles
      .filter(({ enabled }) => enabled)
      .map(({ footprint }) =>
        transformPolygon(footprint, (point) => toPlane(point, transform)),
      ),
  ];
  const widthMm =
    (orientation === 'PORTRAIT' ? input.module.widthM : input.module.heightM) *
    1_000;
  const heightMm =
    (orientation === 'PORTRAIT' ? input.module.heightM : input.module.widthM) *
    1_000;
  const bounds = polygonBounds(surfaceLocal);
  const placements: PvModulePlacement[] = [];
  let row = 0;
  for (
    let y = bounds.min.y + input.edgeMarginMm;
    y + heightMm <= bounds.max.y - input.edgeMarginMm + 1e-9;
    y += heightMm + input.gapMm
  ) {
    let column = 0;
    for (
      let x = bounds.min.x + input.edgeMarginMm;
      x + widthMm <= bounds.max.x - input.edgeMarginMm + 1e-9;
      x += widthMm + input.gapMm
    ) {
      const rectangle = rectanglePolygon(x, y, widthMm, heightMm);
      if (
        polygonContainsPolygon(surfaceLocal, rectangle, input.edgeMarginMm) &&
        exclusions.every((excluded) => !polygonsOverlap(rectangle, excluded))
      ) {
        placements.push({
          id: `${input.surface.id}:${orientation.toLowerCase()}:${row}:${column}`,
          moduleId: input.module.id,
          surfaceId: input.surface.id,
          orientation,
          polygon: transformPolygon(rectangle, (point) =>
            fromPlane(point, transform),
          ),
        });
      }
      column += 1;
    }
    row += 1;
  }
  return {
    methodId: 'rectangular-grid-roof-plane-v1',
    surfaceId: input.surface.id,
    orientation,
    placements,
    moduleCount: placements.length,
    installedPowerWp: placements.length * input.module.nominalPowerWp,
  };
}

function planeTransform(surface: RoofSolarSurface): PlaneTransform {
  const azimuthRad = (surface.azimuthDeg * Math.PI) / 180;
  const normalizeTrigonometric = (value: number): number =>
    Math.abs(value) < 1e-12 ? 0 : value;
  const sine = normalizeTrigonometric(Math.sin(azimuthRad));
  const cosine = normalizeTrigonometric(Math.cos(azimuthRad));
  return {
    slope: { x: sine, y: cosine },
    cross: { x: cosine, y: -sine },
    cosineTilt: Math.cos((surface.tiltDeg * Math.PI) / 180),
  };
}

function toPlane(point: Point2D, transform: PlaneTransform): Point2D {
  return {
    x: point.x * transform.cross.x + point.y * transform.cross.y,
    y:
      (point.x * transform.slope.x + point.y * transform.slope.y) /
      transform.cosineTilt,
  };
}

function fromPlane(point: Point2D, transform: PlaneTransform): Point2D {
  return {
    x:
      point.x * transform.cross.x +
      point.y * transform.cosineTilt * transform.slope.x,
    y:
      point.x * transform.cross.y +
      point.y * transform.cosineTilt * transform.slope.y,
  };
}

function transformPolygon(
  polygon: Polygon2D,
  transform: (point: Point2D) => Point2D,
): Polygon2D {
  return {
    outer: polygon.outer.map(transform),
    ...(polygon.holes === undefined
      ? {}
      : { holes: polygon.holes.map((ring) => ring.map(transform)) }),
  };
}

function rectanglePolygon(
  x: number,
  y: number,
  width: number,
  height: number,
): Polygon2D {
  return {
    outer: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  };
}

function polygonBounds(polygon: Polygon2D): {
  readonly min: Point2D;
  readonly max: Point2D;
} {
  return {
    min: {
      x: Math.min(...polygon.outer.map(({ x }) => x)),
      y: Math.min(...polygon.outer.map(({ y }) => y)),
    },
    max: {
      x: Math.max(...polygon.outer.map(({ x }) => x)),
      y: Math.max(...polygon.outer.map(({ y }) => y)),
    },
  };
}

function polygonContainsPolygon(
  container: Polygon2D,
  candidate: Polygon2D,
  margin: number,
): boolean {
  if (!candidate.outer.every((point) => pointInPolygon(point, container)))
    return false;
  const containerRings = [container.outer, ...(container.holes ?? [])];
  if (ringsIntersect(candidate.outer, containerRings)) return false;
  if (margin <= 0) return true;
  return ringEdges(candidate.outer).every(([candidateStart, candidateEnd]) =>
    containerRings.every((ring) =>
      ringEdges(ring).every(([boundaryStart, boundaryEnd]) =>
        segmentsMeetMargin(
          candidateStart,
          candidateEnd,
          boundaryStart,
          boundaryEnd,
          margin,
        ),
      ),
    ),
  );
}

function segmentsMeetMargin(
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
  margin: number,
): boolean {
  return (
    Math.min(
      pointSegmentDistance(firstStart, secondStart, secondEnd),
      pointSegmentDistance(firstEnd, secondStart, secondEnd),
      pointSegmentDistance(secondStart, firstStart, firstEnd),
      pointSegmentDistance(secondEnd, firstStart, firstEnd),
    ) >= margin
  );
}

function polygonsOverlap(first: Polygon2D, second: Polygon2D): boolean {
  const firstRings = [first.outer, ...(first.holes ?? [])];
  const secondRings = [second.outer, ...(second.holes ?? [])];
  if (firstRings.some((ring) => ringsIntersect(ring, secondRings))) return true;
  return (
    first.outer.some((point) => pointStrictlyInPolygon(point, second)) ||
    second.outer.some((point) => pointStrictlyInPolygon(point, first)) ||
    pointStrictlyInPolygon(ringCentroid(first.outer), second) ||
    pointStrictlyInPolygon(ringCentroid(second.outer), first)
  );
}

function pointStrictlyInPolygon(point: Point2D, polygon: Polygon2D): boolean {
  if (!pointStrictlyInRing(point, polygon.outer)) return false;
  return !(polygon.holes ?? []).some((hole) => pointInRing(point, hole));
}

function pointStrictlyInRing(
  point: Point2D,
  ring: readonly Point2D[],
): boolean {
  if (
    ringEdges(ring).some(
      ([first, second]) => pointSegmentDistance(point, first, second) <= 1e-7,
    )
  )
    return false;
  return rayInsideRing(point, ring);
}

function pointInPolygon(point: Point2D, polygon: Polygon2D): boolean {
  if (!pointInRing(point, polygon.outer)) return false;
  return !(polygon.holes ?? []).some((hole) => pointInRing(point, hole));
}

function pointInRing(point: Point2D, ring: readonly Point2D[]): boolean {
  if (
    ringEdges(ring).some(
      ([first, second]) => pointSegmentDistance(point, first, second) <= 1e-7,
    )
  )
    return true;
  return rayInsideRing(point, ring);
}

function rayInsideRing(point: Point2D, ring: readonly Point2D[]): boolean {
  let inside = false;
  for (const [first, second] of ringEdges(ring)) {
    if (
      first.y > point.y !== second.y > point.y &&
      point.x <
        ((second.x - first.x) * (point.y - first.y)) / (second.y - first.y) +
          first.x
    )
      inside = !inside;
  }
  return inside;
}

function ringCentroid(ring: readonly Point2D[]): Point2D {
  return {
    x: ring.reduce((total, point) => total + point.x, 0) / ring.length,
    y: ring.reduce((total, point) => total + point.y, 0) / ring.length,
  };
}

function ringsIntersect(
  ring: readonly Point2D[],
  otherRings: readonly (readonly Point2D[])[],
): boolean {
  return ringEdges(ring).some(([a, b]) =>
    otherRings.some((other) =>
      ringEdges(other).some(([c, d]) => segmentsProperlyIntersect(a, b, c, d)),
    ),
  );
}

function segmentsProperlyIntersect(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
): boolean {
  const cross = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return (
    cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
  );
}

function ringEdges(
  ring: readonly Point2D[],
): readonly (readonly [Point2D, Point2D])[] {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length]!]);
}

function pointSegmentDistance(
  point: Point2D,
  first: Point2D,
  second: Point2D,
): number {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0)
    return Math.hypot(point.x - first.x, point.y - first.y);
  const parameter = Math.max(
    0,
    Math.min(
      1,
      ((point.x - first.x) * dx + (point.y - first.y) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (first.x + parameter * dx),
    point.y - (first.y + parameter * dy),
  );
}

function validateModule(module: PvModuleDefinition): void {
  if (
    module.id.trim() === '' ||
    module.name.trim() === '' ||
    module.source.sourceType.trim() === ''
  )
    throw new TypeError('PV module identity and source must not be empty');
  positive(module.widthM, 'module width');
  positive(module.heightM, 'module height');
  positive(module.nominalPowerWp, 'module nominal power');
  if (
    (module.manufacturer !== undefined && module.manufacturer.trim() === '') ||
    (module.model !== undefined && module.model.trim() === '')
  )
    throw new TypeError('PV module manufacturer and model must not be empty');
  if (
    module.efficiency !== undefined &&
    (!Number.isFinite(module.efficiency) ||
      module.efficiency <= 0 ||
      module.efficiency > 1)
  )
    throw new RangeError('module efficiency must be in (0, 1]');
  for (const [name, value] of [
    ['open-circuit voltage', module.vocV],
    ['MPP voltage', module.vmpV],
    ['short-circuit current', module.iscA],
    ['MPP current', module.impA],
  ] as const)
    if (value !== undefined) positive(value, name);
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}
