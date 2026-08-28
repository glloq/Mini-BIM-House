/**
 * Où une fenêtre de toit se trouve, en plan et en altitude.
 *
 * Une baie verticale se donne le long d'un mur et par son allège ; une fenêtre
 * de toit se donne dans le plan du pan, qui est incliné. Ce module fait la
 * conversion — les deux longueurs qu'un couvreur trace sur le rampant vers le
 * rectangle que le plan dessine et l'altitude que l'enveloppe lit.
 *
 * ## L'égout d'un pan se déduit
 *
 * Un `RoofPlane` porte son emprise en plan, sa pente et son azimut ; il ne dit
 * pas lequel de ses côtés est l'égout. Il n'a pas à le dire : l'azimut est la
 * direction dans laquelle le pan descend, donc l'égout est le côté le plus
 * bas — celui dont les deux extrémités vont le plus loin dans cette direction.
 * Le déduire plutôt que le stocker est la règle de tout ce projet, et elle
 * tient ici pour une raison de plus : un pan dérivé d'une toiture n'a personne
 * pour renseigner un champ de plus, et un champ que personne ne renseigne est
 * un champ qui ment.
 *
 * ## Longueur vraie contre projection
 *
 * `upSlopeMm` est une longueur **dans le plan incliné** : c'est ainsi qu'une
 * fenêtre de toit est vendue, implantée et vérifiée. Sa projection au sol vaut
 * `upSlopeMm · cos θ`, et l'altitude qu'elle gagne `upSlopeMm · sin θ`. Garder
 * la longueur vraie est ce qui fait qu'une fenêtre reste posée au même endroit
 * du rampant quand la pente du pan change.
 */
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import type { RoofOpening } from './opening.js';
import type { RoofPlane } from './roof-plane.js';

/** Sous cette distance, deux points sont le même point. */
const EPSILON = 1e-6;

const sub = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
const add = (a: Point2D, b: Point2D): Point2D => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
const scale = (a: Point2D, k: number): Point2D => ({ x: a.x * k, y: a.y * k });
const dot = (a: Point2D, b: Point2D): number => a.x * b.x + a.y * b.y;

/** Le repère du pan : son égout, et par où l'on monte. */
export interface RoofPlaneFrame {
  /** Premier sommet de l'égout, d'où `alongEaveMm` se compte. */
  readonly eaveStart: Point2D;
  /** Vecteur unitaire le long de l'égout. */
  readonly along: Point2D;
  /** Longueur de l'égout, en millimètres. */
  readonly eaveLengthMm: number;
  /** Vecteur unitaire de la montée, **en plan** : l'opposé de la descente. */
  readonly upSlope: Point2D;
}

/**
 * Le repère d'un pan, déduit de son emprise et de son azimut.
 *
 * Rend `undefined` pour un pan plat — pente nulle, donc pas de descente, donc
 * pas d'égout à désigner — ou pour une emprise dégénérée.
 */
export function roofPlaneFrame(plane: RoofPlane): RoofPlaneFrame | undefined {
  const outline = plane.footprint.outer;
  if (outline.length < 3) return undefined;
  if (!Number.isFinite(plane.azimuthDeg)) return undefined;
  if (!Number.isFinite(plane.slopeDeg) || plane.slopeDeg <= 0) return undefined;
  // L'azimut est la direction vers laquelle le pan regarde, donc descend.
  const radians = (plane.azimuthDeg * Math.PI) / 180;
  const down: Point2D = { x: Math.cos(radians), y: Math.sin(radians) };
  let bestIndex = -1;
  let bestDepth = -Infinity;
  for (let index = 0; index < outline.length; index += 1) {
    const from = outline[index]!;
    const to = outline[(index + 1) % outline.length]!;
    const span = sub(to, from);
    const spanLength = Math.hypot(span.x, span.y);
    if (spanLength < EPSILON) continue;
    // Un côté est d'autant plus bas que ses deux extrémités descendent loin ;
    // le retenir par le minimum de ses deux profondeurs écarte les rampants,
    // dont une seule extrémité touche le bas.
    const depth = Math.min(dot(from, down), dot(to, down));
    if (depth > bestDepth + EPSILON) {
      bestDepth = depth;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return undefined;
  const from = outline[bestIndex]!;
  const to = outline[(bestIndex + 1) % outline.length]!;
  const span = sub(to, from);
  const eaveLengthMm = Math.hypot(span.x, span.y);
  return {
    eaveStart: from,
    along: scale(span, 1 / eaveLengthMm),
    eaveLengthMm,
    upSlope: scale(down, -1),
  };
}

/** Ce qu'une fenêtre de toit occupe, une fois posée. */
export interface RoofOpeningGeometry {
  /** Son rectangle projeté au sol, dans le repère du projet. */
  readonly footprint: Polygon2D;
  /** L'altitude de son bord bas, au-dessus du zéro du projet. */
  readonly lowerEdgeElevationMm: number;
  /** L'altitude de son bord haut. */
  readonly upperEdgeElevationMm: number;
  /** Sa surface vraie, dans le plan du pan, en millimètres carrés. */
  readonly areaMm2: number;
}

/**
 * Le rectangle qu'une fenêtre de toit occupe, en plan et en altitude.
 *
 * Rend `undefined` quand le pan n'a pas de repère — pente nulle, emprise
 * dégénérée — plutôt qu'un rectangle posé au hasard.
 */
export function roofOpeningGeometry(
  opening: RoofOpening,
  plane: RoofPlane,
): RoofOpeningGeometry | undefined {
  const frame = roofPlaneFrame(plane);
  if (frame === undefined) return undefined;
  const slope = (plane.slopeDeg * Math.PI) / 180;
  const cosine = Math.cos(slope);
  const sine = Math.sin(slope);
  const { alongEaveMm, upSlopeMm } = opening.placement;
  if (
    !Number.isFinite(alongEaveMm) ||
    !Number.isFinite(upSlopeMm) ||
    !Number.isFinite(opening.widthMm) ||
    !Number.isFinite(opening.heightMm)
  )
    return undefined;
  const base = add(
    add(frame.eaveStart, scale(frame.along, alongEaveMm)),
    // La montée se raccourcit en plan : c'est le seul endroit où la pente
    // entre dans le dessin, et l'oublier poserait toutes les fenêtres trop
    // haut sur le rampant.
    scale(frame.upSlope, upSlopeMm * cosine),
  );
  const width = scale(frame.along, opening.widthMm);
  const up = scale(frame.upSlope, opening.heightMm * cosine);
  return {
    footprint: {
      outer: [base, add(base, width), add(add(base, width), up), add(base, up)],
    },
    lowerEdgeElevationMm: plane.baseElevationMm + upSlopeMm * sine,
    upperEdgeElevationMm:
      plane.baseElevationMm + (upSlopeMm + opening.heightMm) * sine,
    areaMm2: opening.widthMm * opening.heightMm,
  };
}

export interface RoofOpeningIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Ce qu'une fenêtre de toit doit respecter pour être posable.
 *
 * Les dimensions et les distances d'abord, puis le fait qu'elle tienne dans
 * son pan — ses quatre coins projetés doivent être dans l'emprise. Un contrôle
 * sur les seuls nombres laisserait poser une fenêtre au-delà du faîtage, ce
 * qui se dessine très bien et n'existe pas.
 */
export function validateRoofOpening(
  opening: RoofOpening,
  plane: RoofPlane,
): readonly RoofOpeningIssue[] {
  const issues: RoofOpeningIssue[] = [];
  if (opening.host.id !== plane.id)
    issues.push({
      path: 'host',
      message: 'ne désigne pas le pan de toiture fourni',
    });
  for (const [path, value] of [
    ['widthMm', opening.widthMm],
    ['heightMm', opening.heightMm],
  ] as const)
    if (!Number.isFinite(value) || value <= 0)
      issues.push({ path, message: 'doit être fini et strictement positif' });
  for (const [path, value] of [
    ['placement.alongEaveMm', opening.placement.alongEaveMm],
    ['placement.upSlopeMm', opening.placement.upSlopeMm],
  ] as const)
    if (!Number.isFinite(value) || value < 0)
      issues.push({ path, message: 'doit être fini et positif ou nul' });
  if (issues.length > 0) return issues;
  const geometry = roofOpeningGeometry(opening, plane);
  if (geometry === undefined) {
    issues.push({
      path: 'host',
      message: 'ce pan n’a pas de rampant : une fenêtre de toit n’y tient pas',
    });
    return issues;
  }
  const outside = geometry.footprint.outer.filter(
    (corner) => !containedBy(corner, plane.footprint.outer),
  );
  if (outside.length > 0)
    issues.push({
      path: 'placement',
      message: `la fenêtre déborde du pan par ${outside.length} de ses coins`,
    });
  return issues;
}

/**
 * Si un point est dans un contour, bord compris.
 *
 * La règle du nombre de croisements, avec une tolérance sur le bord : une
 * fenêtre posée exactement à l'aplomb de l'égout est posée dans le pan, et un
 * test strict la refuserait pour une erreur d'arrondi au micron.
 */
function containedBy(point: Point2D, outline: readonly Point2D[]): boolean {
  for (let index = 0; index < outline.length; index += 1) {
    const from = outline[index]!;
    const to = outline[(index + 1) % outline.length]!;
    const span = sub(to, from);
    const spanLength = Math.hypot(span.x, span.y);
    if (spanLength < EPSILON) continue;
    const offset = sub(point, from);
    const across = (span.x * offset.y - span.y * offset.x) / spanLength;
    const along = dot(offset, span) / spanLength;
    if (Math.abs(across) < 1e-3 && along > -1e-3 && along < spanLength + 1e-3)
      return true;
  }
  let within = false;
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
    if (point.x < crossingX) within = !within;
  }
  return within;
}
