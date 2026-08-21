import type { Point2D } from '@house-technical-designer/geometry';
import type { Wall } from './wall.js';

declare const dimensionIdBrand: unique symbol;
export type DimensionId = string & { readonly [dimensionIdBrand]: true };

export const DIMENSION_TYPES = ['ALIGNED', 'HORIZONTAL', 'VERTICAL'] as const;
export type DimensionType = (typeof DIMENSION_TYPES)[number];

export function isDimensionType(value: string): value is DimensionType {
  return (DIMENSION_TYPES as readonly string[]).includes(value);
}

/**
 * What a dimension measures.
 *
 * A dimension never stores a length. It stores what it measures — two wall
 * endpoints — so moving a wall moves its dimension with it, and a dimension can
 * never disagree with the drawing it annotates.
 */
export interface WallEndpointReference {
  readonly kind: 'WALL_ENDPOINT';
  readonly wallId: Wall['id'];
  readonly endpoint: 'START' | 'END';
}

export interface Dimension {
  readonly id: DimensionId;
  /** Discriminates this annotation from the other kinds a level may carry. */
  readonly kind: 'DIMENSION';
  readonly type: DimensionType;
  readonly first: WallEndpointReference;
  readonly second: WallEndpointReference;
  /** Perpendicular distance from the measured line, in millimetres. */
  readonly offsetMm: number;
  /** Display only: never replaces the resolved numeric value. */
  readonly overrideText?: string;
}

declare const textNoteIdBrand: unique symbol;
export type TextNoteId = string & { readonly [textNoteIdBrand]: true };

/**
 * Something written on the drawing that the model does not say.
 *
 * « Reprise en sous-œuvre », « cote à vérifier sur site », « existant à
 * démolir » : a drawing carries what the building is and what the person
 * drawing it wants read, and only the first had anywhere to live. A note is
 * not a room label — those are derived from the rooms — and it is never read
 * by a calculation: it says something to a human being, which is why it is
 * free text and stays free text.
 */
export interface TextNote {
  readonly id: TextNoteId;
  /** Discriminates this annotation from the other kinds a level may carry. */
  readonly kind: 'TEXT';
  /** Where the text sits on the plan. */
  readonly at: Point2D;
  readonly text: string;
  /** How tall the letters are printed, in millimetres of paper. */
  readonly heightMm?: number;
  readonly rotationDeg?: number;
  /** What the note points at, when it points at something. */
  readonly leaderTo?: Point2D;
}

export function textNoteId(value: string): TextNoteId {
  if (value.trim() === '')
    throw new TypeError('Text note ID must not be empty.');
  return value as TextNoteId;
}

export function isTextNote(value: unknown): value is TextNote {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'TEXT'
  );
}

export type TextNoteIssue = {
  readonly path: string;
  readonly message: string;
};

export function validateTextNote(note: TextNote): readonly TextNoteIssue[] {
  const issues: TextNoteIssue[] = [];
  if (note.text.trim() === '')
    issues.push({ path: 'text', message: 'must not be empty' });
  if (!Number.isFinite(note.at.x) || !Number.isFinite(note.at.y))
    issues.push({ path: 'at', message: 'must be finite' });
  if (
    note.leaderTo !== undefined &&
    (!Number.isFinite(note.leaderTo.x) || !Number.isFinite(note.leaderTo.y))
  )
    issues.push({ path: 'leaderTo', message: 'must be finite' });
  if (
    note.heightMm !== undefined &&
    (!Number.isFinite(note.heightMm) || note.heightMm <= 0)
  )
    issues.push({
      path: 'heightMm',
      message: 'must be finite and greater than zero',
    });
  if (note.rotationDeg !== undefined && !Number.isFinite(note.rotationDeg))
    issues.push({ path: 'rotationDeg', message: 'must be finite' });
  return issues;
}

/** How tall a note is printed when nothing says otherwise, in paper mm. */
export const DEFAULT_NOTE_HEIGHT_MM = 2.5;

/** Everything a level may carry as an annotation. */
export type Annotation = Dimension | TextNote;

export type DimensionResolution =
  | {
      readonly status: 'OK';
      readonly valueMm: number;
      readonly firstPoint: Point2D;
      readonly secondPoint: Point2D;
    }
  | {
      readonly status: 'UNKNOWN';
      readonly missingWallIds: readonly Wall['id'][];
    };

export function dimensionId(value: string): DimensionId {
  if (value.trim() === '')
    throw new TypeError('Dimension ID must not be empty.');
  return value as DimensionId;
}

export function isDimension(value: unknown): value is Dimension {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'DIMENSION'
  );
}

/**
 * Resolves the value a dimension measures against the walls it references.
 *
 * A dimension whose walls no longer exist resolves to UNKNOWN and names them:
 * it never falls back to the last value it happened to show.
 */
export function resolveDimension(
  dimension: Dimension,
  walls: readonly Wall[],
): DimensionResolution {
  const firstPoint = resolveReference(dimension.first, walls);
  const secondPoint = resolveReference(dimension.second, walls);
  const missing = [
    firstPoint === undefined ? dimension.first.wallId : undefined,
    secondPoint === undefined ? dimension.second.wallId : undefined,
  ].filter((value): value is Wall['id'] => value !== undefined);
  if (missing.length > 0)
    return { status: 'UNKNOWN', missingWallIds: [...new Set(missing)] };
  const dx = secondPoint!.x - firstPoint!.x;
  const dy = secondPoint!.y - firstPoint!.y;
  const valueMm =
    dimension.type === 'HORIZONTAL'
      ? Math.abs(dx)
      : dimension.type === 'VERTICAL'
        ? Math.abs(dy)
        : Math.hypot(dx, dy);
  return {
    status: 'OK',
    valueMm,
    firstPoint: firstPoint!,
    secondPoint: secondPoint!,
  };
}

function resolveReference(
  reference: WallEndpointReference,
  walls: readonly Wall[],
): Point2D | undefined {
  const wall = walls.find(({ id }) => id === reference.wallId);
  if (wall === undefined) return undefined;
  return reference.endpoint === 'START'
    ? wall.path.points[0]
    : wall.path.points.at(-1);
}
