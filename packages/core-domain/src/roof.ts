import {
  validatePolygon,
  type Point2D,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { AssemblyId } from '@house-technical-designer/assemblies';
import type { LevelId, RoofId } from './ids.js';
import type { RoofPlane } from './roof-plane.js';
import { entityId } from './ids.js';

/**
 * What one side of a roof does.
 *
 * A sloped side carries a plane that climbs towards the ridge; a gable side is
 * closed by a wall and carries nothing. Which is which is the decision that
 * turns one footprint into a hipped roof, a two-sided roof or a single pitch,
 * and it belongs to the side rather than to the roof as a whole.
 */
export const ROOF_EDGE_KINDS = ['SLOPED', 'GABLE'] as const;
export type RoofEdgeKind = (typeof ROOF_EDGE_KINDS)[number];

export function isRoofEdgeKind(value: string): value is RoofEdgeKind {
  return (ROOF_EDGE_KINDS as readonly string[]).includes(value);
}

export interface RoofEdge {
  readonly kind: RoofEdgeKind;
  /** Pitch of the side, in degrees; meaningless on a gable. */
  readonly slopeDeg: number;
  /** How far the roof reaches past this side of the footprint. */
  readonly overhangMm: number;
}

/**
 * A roof described by what encloses it, rather than by its planes.
 *
 * The previous contract said as much out loud: « MVP planar roof contract.
 * Connected roof topology is deliberately deferred. » Each plane was drawn by
 * hand, with its own footprint, slope and azimuth, and nothing tied them
 * together: two planes could meet nowhere, overlap, or point the same way, and
 * the model had no opinion.
 *
 * A roof now holds the outline it covers and what each side of that outline
 * does. The planes follow from those, so a footprint that moves moves them and
 * a side that becomes a gable removes one.
 */
export interface Roof {
  readonly id: RoofId;
  readonly type: 'ROOF';
  readonly levelId: LevelId;
  readonly footprint: Polygon2D;
  /** One entry per side of the outline, in the order the outline is drawn. */
  readonly edges: readonly RoofEdge[];
  readonly assemblyId: AssemblyId;
  /** Height of the eaves, absolute in the project. */
  readonly baseElevationMm: number;
}

export function validateRoof(roof: Roof): readonly string[] {
  const issues = validatePolygon(roof.footprint).map(({ message }) => message);
  if (roof.edges.length !== roof.footprint.outer.length)
    issues.push(
      `edges must describe each of the ${roof.footprint.outer.length} sides of the outline`,
    );
  for (const [index, edge] of roof.edges.entries()) {
    if (!isRoofEdgeKind(edge.kind))
      issues.push(
        `edges[${index}].kind must be one of ${ROOF_EDGE_KINDS.join(', ')}`,
      );
    if (
      edge.kind === 'SLOPED' &&
      (!Number.isFinite(edge.slopeDeg) ||
        edge.slopeDeg <= 0 ||
        edge.slopeDeg >= 90)
    )
      issues.push(`edges[${index}].slopeDeg must be finite and in (0, 90)`);
    if (!Number.isFinite(edge.overhangMm) || edge.overhangMm < 0)
      issues.push(`edges[${index}].overhangMm must be finite and not negative`);
  }
  if (!roof.edges.some(({ kind }) => kind === 'SLOPED'))
    issues.push('a roof needs at least one sloped side');
  if (!Number.isFinite(roof.baseElevationMm))
    issues.push('baseElevationMm must be finite');
  return issues;
}

/**
 * Which way a side of the outline looks, away from what it encloses.
 *
 * Turning the side a quarter turn gives a normal; which of the two quarter
 * turns points outwards depends on the way the outline was drawn, so the
 * winding decides rather than a convention nobody stated.
 */
function outwardNormal(
  from: Point2D,
  to: Point2D,
  clockwise: boolean,
): Point2D {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const sign = clockwise ? -1 : 1;
  return { x: (sign * dy) / length, y: (-sign * dx) / length };
}

function signedAreaOf(outline: readonly Point2D[]): number {
  let total = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
}

function crossing(
  a: Point2D,
  ad: Point2D,
  b: Point2D,
  bd: Point2D,
): Point2D | undefined {
  const denominator = ad.x * bd.y - ad.y * bd.x;
  if (Math.abs(denominator) < 1e-9) return undefined;
  const t = ((b.x - a.x) * bd.y - (b.y - a.y) * bd.x) / denominator;
  return { x: a.x + ad.x * t, y: a.y + ad.y * t };
}

/**
 * The line the eaves follow: the outline pushed out by each side's overhang.
 *
 * This is what a roof plan shows, and it is exact for any outline: each side
 * moves outwards by its own overhang and the corners are where the moved sides
 * meet. Two sides that no longer meet — an overhang wide enough to turn the
 * corner inside out — keep the original corner rather than inventing one.
 */
export function roofEaveOutline(roof: Roof): Polygon2D {
  const outline = roof.footprint.outer;
  if (outline.length < 3) return roof.footprint;
  const clockwise = signedAreaOf(outline) < 0;
  const moved = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length]!;
    const normal = outwardNormal(point, next, clockwise);
    const overhang = roof.edges[index]?.overhangMm ?? 0;
    return {
      from: {
        x: point.x + normal.x * overhang,
        y: point.y + normal.y * overhang,
      },
      direction: { x: next.x - point.x, y: next.y - point.y },
    };
  });
  const corners = outline.map((point, index) => {
    const previous = moved[(index - 1 + moved.length) % moved.length]!;
    const current = moved[index]!;
    return (
      crossing(
        previous.from,
        previous.direction,
        current.from,
        current.direction,
      ) ?? point
    );
  });
  return {
    outer: corners,
    ...(roof.footprint.holes === undefined
      ? {}
      : { holes: roof.footprint.holes }),
  };
}

export type RoofTopology =
  | { readonly status: 'DERIVED'; readonly planes: readonly RoofPlane[] }
  | {
      readonly status: 'NOT_DERIVABLE';
      readonly reason: string;
      readonly planes: readonly RoofPlane[];
    };

/** Whether four corners describe a rectangle, within a tenth of a millimetre. */
function isRectangle(outline: readonly Point2D[]): boolean {
  if (outline.length !== 4) return false;
  for (let index = 0; index < 4; index += 1) {
    const previous = outline[(index + 3) % 4]!;
    const current = outline[index]!;
    const next = outline[(index + 1) % 4]!;
    const ax = current.x - previous.x;
    const ay = current.y - previous.y;
    const bx = next.x - current.x;
    const by = next.y - current.y;
    if (Math.abs(ax * bx + ay * by) > 0.1) return false;
  }
  return true;
}

/**
 * The planes a roof is made of, derived and never stored.
 *
 * A rectangular outline is solved exactly, whatever the mix of sloped and
 * gable sides and whatever the pitches: opposite sides meet where their two
 * climbs reach the same height, which is a division and not a guess.
 *
 * Any other outline needs a straight skeleton, which this version does not
 * compute. It says so and returns the planes it is sure of — one per sloped
 * side, standing on that side — rather than inventing a ridge nobody drew.
 */
export function deriveRoofPlanes(roof: Roof): RoofTopology {
  const outline = roof.footprint.outer;
  const clockwise = signedAreaOf(outline) < 0;
  const planeOf = (index: number, footprint: Polygon2D): RoofPlane => {
    const from = outline[index]!;
    const to = outline[(index + 1) % outline.length]!;
    const normal = outwardNormal(from, to, clockwise);
    return {
      id: entityId<'RoofPlane'>(`${roof.id}:plane:${index}`),
      type: 'ROOF_PLANE',
      levelId: roof.levelId,
      footprint,
      assemblyId: roof.assemblyId,
      slopeDeg: roof.edges[index]?.slopeDeg ?? 0,
      // The plane climbs away from its eave, so it faces the way the eave
      // looks: outwards.
      azimuthDeg: (Math.atan2(normal.y, normal.x) * 180) / Math.PI,
      baseElevationMm: roof.baseElevationMm,
    };
  };
  const eave = roofEaveOutline(roof).outer;
  const sloped = roof.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.kind === 'SLOPED');

  if (!isRectangle(outline))
    return {
      status: 'NOT_DERIVABLE',
      reason:
        'Cette version ne déduit la rencontre des pans que sur un contour rectangulaire.',
      planes: sloped.map(({ index }) =>
        planeOf(index, {
          outer: [
            eave[index]!,
            eave[(index + 1) % eave.length]!,
            outline[(index + 1) % outline.length]!,
            outline[index]!,
          ],
        }),
      ),
    };

  // On a rectangle, sides 0 and 2 face each other, and so do 1 and 3. Two
  // facing climbs meet where they reach the same height: the distance from the
  // first is the span times the tangent of the second over the sum of both.
  const meeting = (first: number, second: number): number | undefined => {
    const one = roof.edges[first];
    const other = roof.edges[second];
    if (one === undefined || other === undefined) return undefined;
    const a = outline[first]!;
    const b = outline[second]!;
    const next = outline[(first + 1) % 4]!;
    const normal = outwardNormal(a, next, clockwise);
    const span = Math.abs((b.x - a.x) * normal.x + (b.y - a.y) * normal.y);
    if (one.kind === 'SLOPED' && other.kind === 'SLOPED') {
      const tangents =
        Math.tan((one.slopeDeg * Math.PI) / 180) +
        Math.tan((other.slopeDeg * Math.PI) / 180);
      return tangents === 0
        ? undefined
        : (span * Math.tan((other.slopeDeg * Math.PI) / 180)) / tangents;
    }
    // A slope facing a gable climbs the whole span on its own.
    return one.kind === 'SLOPED' ? span : undefined;
  };

  const planes: RoofPlane[] = [];
  for (const { index } of sloped) {
    const facing = (index + 2) % 4;
    const depth = meeting(index, facing);
    if (depth === undefined) continue;
    const from = outline[index]!;
    const to = outline[(index + 1) % 4]!;
    const normal = outwardNormal(from, to, clockwise);
    const inward = { x: -normal.x * depth, y: -normal.y * depth };
    planes.push(
      planeOf(index, {
        outer: [
          eave[index]!,
          eave[(index + 1) % 4]!,
          { x: to.x + inward.x, y: to.y + inward.y },
          { x: from.x + inward.x, y: from.y + inward.y },
        ],
      }),
    );
  }
  return { status: 'DERIVED', planes };
}

/** How high the highest point of a roof stands, when that can be derived. */
export function roofRidgeElevationMm(roof: Roof): number | undefined {
  const outline = roof.footprint.outer;
  if (!isRectangle(outline)) return undefined;
  const clockwise = signedAreaOf(outline) < 0;
  let highest: number | undefined;
  for (const [index, edge] of roof.edges.entries()) {
    if (edge.kind !== 'SLOPED') continue;
    const facing = roof.edges[(index + 2) % 4];
    if (facing === undefined) continue;
    const a = outline[index]!;
    const b = outline[(index + 2) % 4]!;
    const next = outline[(index + 1) % 4]!;
    const normal = outwardNormal(a, next, clockwise);
    const span = Math.abs((b.x - a.x) * normal.x + (b.y - a.y) * normal.y);
    const tangent = Math.tan((edge.slopeDeg * Math.PI) / 180);
    const depth =
      facing.kind === 'SLOPED'
        ? (span * Math.tan((facing.slopeDeg * Math.PI) / 180)) /
          (tangent + Math.tan((facing.slopeDeg * Math.PI) / 180))
        : span;
    const height = roof.baseElevationMm + depth * tangent;
    highest = highest === undefined ? height : Math.max(highest, height);
  }
  return highest;
}

/**
 * Every plane of a storey: those drawn one at a time, and those a roof yields.
 *
 * Derived planes are built on read and never stored, so a footprint that moves
 * moves them. Everything downstream — the drawing, the quantities, the thermal
 * envelope, the solar gains — reads this rather than the two collections, so a
 * roof described by its outline counts exactly like a plane drawn by hand.
 */
export function allRoofPlanes(level: {
  readonly roofs: readonly RoofPlane[];
  readonly roofStructures?: readonly Roof[];
}): readonly RoofPlane[] {
  return [
    ...level.roofs,
    ...(level.roofStructures ?? []).flatMap(
      (roof) => deriveRoofPlanes(roof).planes,
    ),
  ];
}
