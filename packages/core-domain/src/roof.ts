import {
  validatePolygon,
  type Point2D,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { AssemblyId } from '@house-technical-designer/assemblies';
import { straightSkeleton } from '@house-technical-designer/roof-geometry';

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

/** Whether an outline turns the same way at every corner. */
function isConvex(outline: readonly Point2D[]): boolean {
  if (outline.length < 3) return false;
  let sign = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const previous = outline[(index + outline.length - 1) % outline.length]!;
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    const cross =
      (current.x - previous.x) * (next.y - current.y) -
      (current.y - previous.y) * (next.x - current.x);
    if (Math.abs(cross) < 1e-6) continue;
    const turn = cross > 0 ? 1 : -1;
    if (sign === 0) sign = turn;
    else if (sign !== turn) return false;
  }
  return sign !== 0;
}

/** A half-plane `a·x + b·y <= c`, used to cut a face out of an outline. */
interface HalfPlane {
  readonly a: number;
  readonly b: number;
  readonly c: number;
}

/**
 * Cuts a convex outline down to the part satisfying a half-plane.
 *
 * Sutherland and Hodgman's clip: each side of the outline is walked, and a
 * side crossing the cut is split exactly at the crossing. Cutting a convex
 * shape by a half-plane leaves a convex shape, so this can be applied once per
 * constraint without ever leaving the family it started in.
 */
function clipped(
  outline: readonly Point2D[],
  { a, b, c }: HalfPlane,
): readonly Point2D[] {
  const inside = (point: Point2D): number => c - (a * point.x + b * point.y);
  const result: Point2D[] = [];
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    const here = inside(current);
    const there = inside(next);
    if (here >= -TOLERANCE_MM) result.push(current);
    if ((here > 0 && there < 0) || (here < 0 && there > 0)) {
      const ratio = here / (here - there);
      result.push({
        x: current.x + (next.x - current.x) * ratio,
        y: current.y + (next.y - current.y) * ratio,
      });
    }
  }
  return dedupedCorners(result);
}

/** How close two corners have to be to count as one, in millimetres. */
const TOLERANCE_MM = 0.001;

function dedupedCorners(outline: readonly Point2D[]): readonly Point2D[] {
  const result: Point2D[] = [];
  for (const point of outline) {
    const last = result[result.length - 1];
    if (
      last !== undefined &&
      Math.abs(last.x - point.x) < TOLERANCE_MM &&
      Math.abs(last.y - point.y) < TOLERANCE_MM
    )
      continue;
    result.push(point);
  }
  const first = result[0];
  const last = result[result.length - 1];
  if (
    result.length > 1 &&
    first !== undefined &&
    last !== undefined &&
    Math.abs(first.x - last.x) < TOLERANCE_MM &&
    Math.abs(first.y - last.y) < TOLERANCE_MM
  )
    result.pop();
  return result;
}

/** The line an eave runs along, as an inward distance from any point. */
interface EaveLine {
  readonly index: number;
  /** Inward unit normal. */
  readonly nx: number;
  readonly ny: number;
  /** Distance from the origin, so that inward distance is n·p − offset. */
  readonly offset: number;
  /** How fast the roof climbs away from this eave. */
  readonly tangent: number;
}

function eaveLinesOf(
  outline: readonly Point2D[],
  edges: readonly RoofEdge[],
  clockwise: boolean,
): readonly EaveLine[] {
  const lines: EaveLine[] = [];
  for (const [index, edge] of edges.entries()) {
    if (edge.kind !== 'SLOPED') continue;
    const from = outline[index];
    const to = outline[(index + 1) % outline.length];
    if (from === undefined || to === undefined) continue;
    const outward = outwardNormal(from, to, clockwise);
    const nx = -outward.x;
    const ny = -outward.y;
    lines.push({
      index,
      nx,
      ny,
      offset: nx * from.x + ny * from.y,
      tangent: Math.tan((edge.slopeDeg * Math.PI) / 180),
    });
  }
  return lines;
}

/**
 * Les pans d'un contour rentrant, lus du squelette droit.
 *
 * `roof-geometry` travaille en vitesses — de combien un côté recule par unité
 * de hauteur — parce que c'est ce qui fait avancer un front d'onde. Une pente
 * de θ recule de `1 / tan θ` ; un pignon ne recule pas, sa vitesse est nulle,
 * et il borne la toiture sans lui donner de surface.
 */
function fromSkeleton(
  roof: Roof,
  eave: readonly Point2D[],
  planeOf: (index: number, face: readonly Point2D[]) => RoofPlane,
  unresolved: (reason: string) => RoofTopology,
): RoofTopology {
  const speeds = roof.edges.map((edge) => {
    if (edge.kind !== 'SLOPED') return { speed: 0 };
    const tangent = Math.tan((edge.slopeDeg * Math.PI) / 180);
    return {
      speed: Number.isFinite(tangent) && tangent > 0 ? 1 / tangent : 0,
    };
  });
  const skeleton = straightSkeleton(eave, speeds);
  if (skeleton.status === 'UNRESOLVED') return unresolved(skeleton.reason);
  const planes = skeleton.faces
    .filter(({ edgeIndex }) => roof.edges[edgeIndex]?.kind === 'SLOPED')
    .map(({ edgeIndex, outline }) => planeOf(edgeIndex, outline));
  if (skeleton.status === 'PARTIAL')
    return { status: 'NOT_DERIVABLE', reason: skeleton.reason, planes };
  return { status: 'DERIVED', planes };
}

/**
 * The planes a roof is made of, derived and never stored.
 *
 * A roof is the lowest of the surfaces climbing from its eaves: at any point
 * under it, the covering plane is the one that reaches that point lowest, and
 * a plane's face is exactly where it is that lowest one. Building the faces
 * that way is what makes them a partition — they cover the roof once and only
 * once — instead of four independent quadrilaterals that overlap in the middle
 * and count the same square metre twice.
 *
 * The construction is exact for any convex outline, whatever the mix of sloped
 * and gable sides and whatever the pitches: a gable raises no surface, so the
 * sides that do slope share the whole roof between them. A non-convex outline
 * needs a straight skeleton, which this version does not compute; it says so,
 * and what it says is then kept out of every area the project counts.
 */
export function deriveRoofPlanes(roof: Roof): RoofTopology {
  const outline = roof.footprint.outer;
  const eave = roofEaveOutline(roof).outer;
  const clockwise = signedAreaOf(eave) < 0;
  const planeOf = (index: number, face: readonly Point2D[]): RoofPlane => {
    const from = outline[index]!;
    const to = outline[(index + 1) % outline.length]!;
    const normal = outwardNormal(from, to, signedAreaOf(outline) < 0);
    return {
      id: entityId<'RoofPlane'>(`${roof.id}:plane:${index}`),
      type: 'ROOF_PLANE',
      levelId: roof.levelId,
      footprint: { outer: [...face] },
      assemblyId: roof.assemblyId,
      slopeDeg: roof.edges[index]?.slopeDeg ?? 0,
      // The plane climbs away from its eave, so it faces the way the eave
      // looks: outwards.
      azimuthDeg: (Math.atan2(normal.y, normal.x) * 180) / Math.PI,
      baseElevationMm: roof.baseElevationMm,
    };
  };

  const lines = eaveLinesOf(eave, roof.edges, clockwise);
  const unresolved = (reason: string): RoofTopology => ({
    status: 'NOT_DERIVABLE',
    reason,
    // One strip per sloped side, standing on that side and reaching the
    // outline. It is what the drawing can honestly show and nothing counts it.
    planes: lines.map(({ index }) =>
      planeOf(index, [
        eave[index]!,
        eave[(index + 1) % eave.length]!,
        outline[(index + 1) % outline.length]!,
        outline[index]!,
      ]),
    ),
  });

  /*
   * Un contour rentrant ne se découpe pas en demi-plans.
   *
   * La construction ci-dessous est exacte tant que l'aire est convexe : la
   * face d'un pan y est l'intersection des demi-plans « je monte plus bas que
   * l'autre », et une intersection de demi-plans est convexe. Sur un L, la
   * droite qui porte un côté laisse une partie de l'aire de son mauvais côté,
   * et la distance signée y devient négative : le pan gagnerait un morceau
   * qu'il ne couvre pas.
   *
   * C'est le squelette droit pondéré qui répond là — un paquet à part, éprouvé
   * sur le rectangle, le carré, le L, le U et les pièges connus — et ce qu'il
   * ne sait pas conclure, il le dit.
   */
  if (!isConvex(eave)) return fromSkeleton(roof, eave, planeOf, unresolved);
  if (lines.some(({ tangent }) => !Number.isFinite(tangent) || tangent <= 0))
    return unresolved(
      'Une pente nulle ou plate ne fait pas se rencontrer les pans.',
    );

  const planes: RoofPlane[] = [];
  for (const line of lines) {
    let face = eave;
    for (const other of lines) {
      if (other.index === line.index) continue;
      // This plane covers the point when it reaches it lowest:
      //   d_line · t_line <= d_other · t_other
      // Both distances are affine inside a convex outline, so the condition
      // is a half-plane and the face stays convex.
      face = clipped(face, {
        a: line.tangent * line.nx - other.tangent * other.nx,
        b: line.tangent * line.ny - other.tangent * other.ny,
        c: line.tangent * line.offset - other.tangent * other.offset,
      });
      if (face.length < 3) break;
    }
    if (face.length >= 3) planes.push(planeOf(line.index, face));
  }
  return { status: 'DERIVED', planes };
}

/**
 * How high the highest point of a roof stands, when that can be derived.
 *
 * The ridge is where the lowest of the climbing surfaces is highest, which is
 * always at a corner of one of the faces: a plane is flat, so its maximum over
 * a convex face is at a vertex.
 */
export function roofRidgeElevationMm(roof: Roof): number | undefined {
  const topology = deriveRoofPlanes(roof);
  if (topology.status !== 'DERIVED') return undefined;
  const eave = roofEaveOutline(roof).outer;
  const lines = eaveLinesOf(eave, roof.edges, signedAreaOf(eave) < 0);
  let highest: number | undefined;
  for (const plane of topology.planes) {
    const line = lines.find(
      ({ index }) => plane.id === `${roof.id}:plane:${index}`,
    );
    if (line === undefined) continue;
    for (const corner of plane.footprint.outer) {
      const climb =
        (line.nx * corner.x + line.ny * corner.y - line.offset) * line.tangent;
      const height = roof.baseElevationMm + climb;
      highest = highest === undefined ? height : Math.max(highest, height);
    }
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
    ...(level.roofStructures ?? []).flatMap((roof) => {
      const topology = deriveRoofPlanes(roof);
      // A roof this version cannot partition contributes nothing to what the
      // project counts. Its strips are drawn so the shape can be seen, and a
      // drawing that overstates itself is a nuisance; an area that overstates
      // itself reaches the quantities, the thermal envelope and the solar
      // gains, and nothing downstream would say where the extra square metres
      // came from.
      return topology.status === 'DERIVED' ? topology.planes : [];
    }),
  ];
}

/** The roofs of a storey whose planes could not be worked out. */
export function unresolvedRoofs(level: {
  readonly roofStructures?: readonly Roof[];
}): readonly { readonly roof: Roof; readonly reason: string }[] {
  return (level.roofStructures ?? []).flatMap((roof) => {
    const topology = deriveRoofPlanes(roof);
    return topology.status === 'DERIVED'
      ? []
      : [{ roof, reason: topology.reason }];
  });
}
