import { polylineLength } from '@house-technical-designer/geometry';
import type { OpeningId, WallId } from './ids.js';
import type { Wall } from './wall.js';

export const OPENING_TYPES = ['DOOR', 'WINDOW', 'VOID', 'OTHER'] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

export function isOpeningType(value: string): value is OpeningType {
  return (OPENING_TYPES as readonly string[]).includes(value);
}

export const DOOR_HINGES = ['START', 'END'] as const;
export type DoorHinge = (typeof DOOR_HINGES)[number];

export const DOOR_OPENING_SIDES = ['LEFT_OF_HOST', 'RIGHT_OF_HOST'] as const;
export type DoorOpeningSide = (typeof DOOR_OPENING_SIDES)[number];

/**
 * Which way a door opens.
 *
 * Stated against the host wall's own path — the end of the path it is hinged
 * on, and the side of the path it swings towards — never against the screen.
 * « À gauche » of a drawing is a different door once the plan is mirrored or
 * the wall redrawn the other way round, and the model may not hold a fact that
 * depends on how it is being looked at.
 */
export interface DoorSwing {
  readonly hinge: DoorHinge;
  readonly opensTo: DoorOpeningSide;
  /** How far open the leaf is drawn. Ninety degrees when unstated. */
  readonly openingAngleDeg?: number;
}

/**
 * What a door does when nobody has said.
 *
 * Exactly what every door drew before a door could be asked: hinged at the
 * start of its host's path, opening to the right of it, at a right angle. A
 * file written before this existed opens unchanged.
 */
export const DEFAULT_SWING_ANGLE_DEG = 90;

export const DEFAULT_DOOR_SWING: DoorSwing = {
  hinge: 'START',
  opensTo: 'RIGHT_OF_HOST',
  openingAngleDeg: DEFAULT_SWING_ANGLE_DEG,
};

export function isDoorHinge(value: string): value is DoorHinge {
  return (DOOR_HINGES as readonly string[]).includes(value);
}

export function isDoorOpeningSide(value: string): value is DoorOpeningSide {
  return (DOOR_OPENING_SIDES as readonly string[]).includes(value);
}

/** The swing a door is drawn with: its own, or the one every door had. */
export function doorSwingOf(opening: Opening): Required<DoorSwing> {
  const stated = opening.swing ?? DEFAULT_DOOR_SWING;
  return {
    hinge: stated.hinge,
    opensTo: stated.opensTo,
    openingAngleDeg: stated.openingAngleDeg ?? DEFAULT_SWING_ANGLE_DEG,
  };
}

/**
 * Ce qu'une ouverture perce, et non plus « quel mur ».
 *
 * `hostElementId: WallId` disait « une ouverture est dans un mur », et toute
 * la chaîne le supposait : validation, plan, coupe, enveloppe, métrés,
 * transformations. Les familles `WINDOW_ROOF` et `SKYLIGHT` existent pourtant
 * dans la nomenclature, avec leurs propriétés, et déclarent `ROOF` parmi leurs
 * supports — le modèle ne permettait simplement pas de les poser.
 *
 * Une référence discriminée plutôt qu'un identifiant nu : le compilateur
 * demande alors, à chaque endroit qui suppose un mur, de le dire. C'était le
 * but — il y en avait soixante-dix-huit, et aucun ne se voyait.
 *
 * **Et deux façons de se repérer, parce qu'il y en a deux.** Une baie
 * verticale se donne par une distance le long du mur et une allège ; une
 * fenêtre de toit se donne dans le plan du pan, qui est incliné — le long de
 * l'égout et en remontant le rampant, comme un couvreur l'implante. Réunir les
 * deux dans les mêmes champs serait mentir sur ce qu'ils mesurent, donc chaque
 * variante porte le sien, et le compilateur demande à chaque lecture de dire
 * laquelle elle traite.
 */
export type OpeningHostKind = 'WALL' | 'ROOF';

/** Le mur percé. */
export interface WallOpeningHost {
  readonly kind: 'WALL';
  readonly id: string;
}

/** Le pan de toiture percé. */
export interface RoofOpeningHost {
  readonly kind: 'ROOF';
  readonly id: string;
}

export type OpeningHost = WallOpeningHost | RoofOpeningHost;

/**
 * Où une fenêtre de toit est posée dans le pan qui la porte.
 *
 * Les deux longueurs qu'un couvreur trace sur le rampant : le long de l'égout
 * depuis son début, et en remontant la pente. La seconde est une **longueur
 * vraie**, mesurée dans le plan incliné et non sa projection au sol — c'est
 * ainsi qu'une fenêtre de toit est vendue, posée et vérifiée, et c'est la
 * seule qui reste juste quand la pente change.
 */
export interface RoofOpeningPlacement {
  /** Le long de l'égout, depuis son premier sommet. */
  readonly alongEaveMm: number;
  /** En remontant le rampant depuis l'égout, en longueur vraie. */
  readonly upSlopeMm: number;
}

interface OpeningBase {
  readonly id: OpeningId;
  readonly type: 'OPENING';
  readonly openingType: OpeningType;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly definitionId?: string;
  /** Doors only, and optional: an unstated swing is the default one. */
  readonly swing?: DoorSwing;
}

export interface WallOpening extends OpeningBase {
  readonly host: WallOpeningHost;
  /** Distance from the start of the host reference path to the opening start. */
  readonly offsetAlongHostMm: number;
  readonly sillHeightMm: number;
}

export interface RoofOpening extends OpeningBase {
  readonly host: RoofOpeningHost;
  readonly placement: RoofOpeningPlacement;
}

export type Opening = WallOpening | RoofOpening;

/** Si cette ouverture perce un mur, et le dit au compilateur. */
export function isWallOpening(opening: Opening): opening is WallOpening {
  return opening.host.kind === 'WALL';
}

/** Si cette ouverture perce un pan de toiture. */
export function isRoofOpening(opening: Opening): opening is RoofOpening {
  return opening.host.kind === 'ROOF';
}

/**
 * Le mur qu'elle perce, quand elle en perce un.
 *
 * Rend `undefined` pour une ouverture de toiture, ce qui oblige l'appelant à
 * dire ce qu'il en fait plutôt qu'à la traiter comme un mur qui n'existe pas.
 */
export function wallHostId(opening: Opening): WallId | undefined {
  return opening.host.kind === 'WALL' ? (opening.host.id as WallId) : undefined;
}

/**
 * Les baies d'un mur, et rien d'autre.
 *
 * Écrit une fois ici parce qu'il l'était douze fois ailleurs, chaque fois sous
 * la forme `openings.filter(({ host }) => host.id === wall.id)` — qui ne
 * regarde pas le genre de l'hôte. Deux identifiants d'espaces différents n'ont
 * aucune raison de coïncider, mais rien ne l'interdisait, et un `filter` qui
 * repose sur le fait que ça n'arrive pas est un `filter` qui ment.
 */
export function wallOpenings(
  openings: readonly Opening[],
  wallId: string,
): readonly WallOpening[] {
  return openings.filter(
    (opening): opening is WallOpening =>
      opening.host.kind === 'WALL' && opening.host.id === wallId,
  );
}

export type OpeningIssueCode =
  | 'INVALID_SWING'
  | 'WRONG_HOST'
  | 'INVALID_OFFSET'
  | 'INVALID_DIMENSION'
  | 'OUTSIDE_HOST'
  | 'OVERLAPPING_OPENINGS';

export interface OpeningIssue {
  readonly code: OpeningIssueCode;
  readonly path: string;
  readonly message: string;
}

export function validateOpening(
  opening: WallOpening,
  host: Wall,
): readonly OpeningIssue[] {
  const issues: OpeningIssue[] = [];
  if (opening.host.kind !== 'WALL' || opening.host.id !== host.id)
    issues.push({
      code: 'WRONG_HOST',
      path: 'host',
      message: 'does not reference the supplied wall',
    });
  if (
    !Number.isFinite(opening.offsetAlongHostMm) ||
    opening.offsetAlongHostMm < 0
  ) {
    issues.push({
      code: 'INVALID_OFFSET',
      path: 'offsetAlongHostMm',
      message: 'must be finite and non-negative',
    });
  }
  for (const [path, value] of [
    ['widthMm', opening.widthMm],
    ['heightMm', opening.heightMm],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0)
      issues.push({
        code: 'INVALID_DIMENSION',
        path,
        message: 'must be finite and greater than zero',
      });
  }
  if (!Number.isFinite(opening.sillHeightMm))
    issues.push({
      code: 'INVALID_DIMENSION',
      path: 'sillHeightMm',
      message: 'must be finite',
    });
  const hostLength = polylineLength({
    points: host.path.points,
    closed: false,
  });
  if (
    Number.isFinite(opening.offsetAlongHostMm) &&
    Number.isFinite(opening.widthMm) &&
    opening.offsetAlongHostMm + opening.widthMm > hostLength
  ) {
    issues.push({
      code: 'OUTSIDE_HOST',
      path: 'offsetAlongHostMm',
      message: 'opening extends beyond its host path',
    });
  }
  if (
    host.heightMode === 'EXPLICIT' &&
    Number.isFinite(opening.sillHeightMm) &&
    Number.isFinite(opening.heightMm) &&
    opening.sillHeightMm + opening.heightMm > host.heightMm
  ) {
    issues.push({
      code: 'OUTSIDE_HOST',
      path: 'sillHeightMm',
      message: 'opening extends above its host wall',
    });
  }
  const swing = opening.swing;
  if (swing !== undefined) {
    if (!isDoorHinge(swing.hinge))
      issues.push({
        code: 'INVALID_SWING',
        path: 'swing.hinge',
        message: `must be one of ${DOOR_HINGES.join(', ')}`,
      });
    if (!isDoorOpeningSide(swing.opensTo))
      issues.push({
        code: 'INVALID_SWING',
        path: 'swing.opensTo',
        message: `must be one of ${DOOR_OPENING_SIDES.join(', ')}`,
      });
    if (
      swing.openingAngleDeg !== undefined &&
      (!Number.isFinite(swing.openingAngleDeg) ||
        swing.openingAngleDeg <= 0 ||
        swing.openingAngleDeg > 180)
    )
      issues.push({
        code: 'INVALID_SWING',
        path: 'swing.openingAngleDeg',
        message: 'must be greater than zero and at most 180',
      });
    if (opening.openingType !== 'DOOR')
      issues.push({
        code: 'INVALID_SWING',
        path: 'swing',
        message: 'only a door has a swing',
      });
  }
  return issues;
}

export type WallAreaResult =
  | {
      readonly status: 'OK';
      readonly grossAreaMm2: number;
      readonly openingAreaMm2: number;
      readonly netAreaMm2: number;
    }
  | {
      readonly status: 'UNKNOWN';
      readonly reason: 'WALL_HEIGHT_REQUIRES_LEVELS';
    }
  | { readonly status: 'INVALID'; readonly issues: readonly OpeningIssue[] };

export function calculateWallNetArea(
  wall: Wall,
  openings: readonly WallOpening[],
): WallAreaResult {
  if (wall.heightMode !== 'EXPLICIT')
    return { status: 'UNKNOWN', reason: 'WALL_HEIGHT_REQUIRES_LEVELS' };
  const issues = openings.flatMap((opening) => validateOpening(opening, wall));
  for (let first = 0; first < openings.length; first += 1) {
    for (let second = first + 1; second < openings.length; second += 1) {
      if (overlaps(openings[first]!, openings[second]!)) {
        issues.push({
          code: 'OVERLAPPING_OPENINGS',
          path: `openings[${first},${second}]`,
          message: 'opening rectangles overlap on the host wall',
        });
      }
    }
  }
  if (issues.length > 0) return { status: 'INVALID', issues };
  const grossAreaMm2 =
    polylineLength({ points: wall.path.points, closed: false }) * wall.heightMm;
  const openingAreaMm2 = openings.reduce(
    (total, opening) => total + opening.widthMm * opening.heightMm,
    0,
  );
  return {
    status: 'OK',
    grossAreaMm2,
    openingAreaMm2,
    netAreaMm2: grossAreaMm2 - openingAreaMm2,
  };
}

function overlaps(first: WallOpening, second: WallOpening): boolean {
  const horizontal =
    first.offsetAlongHostMm < second.offsetAlongHostMm + second.widthMm &&
    second.offsetAlongHostMm < first.offsetAlongHostMm + first.widthMm;
  const vertical =
    first.sillHeightMm < second.sillHeightMm + second.heightMm &&
    second.sillHeightMm < first.sillHeightMm + first.heightMm;
  return horizontal && vertical;
}
