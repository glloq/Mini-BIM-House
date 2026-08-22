import type { Point2D } from '@house-technical-designer/geometry';
import type { LevelId } from './ids.js';

export const DRAWING_VIEW_TYPES = [
  'PLAN',
  'SECTION',
  'ELEVATION',
  'ROOF',
  'SITE',
] as const;
export type DrawingViewType = (typeof DRAWING_VIEW_TYPES)[number];

export function isDrawingViewType(value: string): value is DrawingViewType {
  return (DRAWING_VIEW_TYPES as readonly string[]).includes(value);
}

/**
 * A view of the project the user can come back to.
 *
 * The project carried `drawingViews?: readonly JsonValue[]` — a list the file
 * transported and nothing could read. A project therefore exported whatever
 * the screen happened to show, and a drawing produced twice was two different
 * drawings.
 *
 * A view holds the decisions that make one: which storey, at what scale, with
 * which layers on, under which graphic profile. It holds no geometry: the
 * drawing is derived from the model each time, so a view opened after a wall
 * moved shows the wall where it is now.
 */
export interface SavedDrawingView {
  readonly id: string;
  readonly type: DrawingViewType;
  readonly name: string;
  readonly levelId?: LevelId;
  /** Denominator: 50 stands for a 1:50 drawing. */
  readonly scaleDenominator: number;
  /** Which layers are on, by layer identifier. */
  readonly layers: Readonly<Record<string, boolean>>;
  readonly graphicProfileId: string;
  /** Where the view is centred, when it states a framing of its own. */
  readonly centreMm?: Point2D;
  readonly analysisOverlayId?: string;
  /**
   * Where the section is cut, for a view that cuts.
   *
   * A section without its line is a section nobody can reopen. The type said
   * « coupe » and the file said nothing else, so the only honest thing the
   * application could do was draw a plan and admit it.
   */
  readonly cut?: SectionLine;
  /**
   * Which way a façade is looked at: counter-clockwise from east, like every
   * other azimuth in this model.
   */
  readonly viewDirectionDeg?: number;
  /** How far behind the cut, or into the house, the drawing looks. */
  readonly viewDepthMm?: number;
  /** The slice of height the drawing keeps, when it keeps one. */
  readonly verticalRangeMm?: VerticalRangeMm;
}

/** The two ends of a cut, in model millimetres. */
export interface SectionLine {
  readonly start: Point2D;
  readonly end: Point2D;
}

/** A band of height, measured from the project's zero. */
export interface VerticalRangeMm {
  readonly minMm: number;
  readonly maxMm: number;
}

export type SheetFormat = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type SheetOrientation = 'PORTRAIT' | 'LANDSCAPE';

export const SHEET_FORMATS = ['A4', 'A3', 'A2', 'A1', 'A0'] as const;
export const SHEET_ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'] as const;

export function isSheetFormat(value: string): value is SheetFormat {
  return (SHEET_FORMATS as readonly string[]).includes(value);
}

export function isSheetOrientation(value: string): value is SheetOrientation {
  return (SHEET_ORIENTATIONS as readonly string[]).includes(value);
}

/** Where a view sits on a sheet, in paper millimetres. */
export interface SheetViewportPlacement {
  readonly id: string;
  readonly viewId: string;
  readonly scaleDenominator: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * One sheet of the drawing set.
 *
 * The sheet holds the choices; the drawing engine builds the layout from them
 * and from a title block template the application supplies. What is written in
 * the title block is derived from the project — its name, the sheet number,
 * the revision — and never copied here, so a project renamed is a title block
 * renamed.
 */
export interface ProjectSheet {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly format: SheetFormat;
  readonly orientation: SheetOrientation;
  readonly viewports: readonly SheetViewportPlacement[];
  readonly revision?: string;
  readonly colorMode?: 'COLOR' | 'GRAYSCALE';
  readonly notes?: readonly string[];
}

export function validateDrawingView(view: SavedDrawingView): readonly string[] {
  const issues: string[] = [];
  if (view.id.trim() === '') issues.push('id must not be empty');
  if (view.name.trim() === '') issues.push('name must not be empty');
  if (!isDrawingViewType(view.type))
    issues.push(`type must be one of ${DRAWING_VIEW_TYPES.join(', ')}`);
  if (
    !Number.isFinite(view.scaleDenominator) ||
    view.scaleDenominator <= 0 ||
    !Number.isInteger(view.scaleDenominator)
  )
    issues.push('scaleDenominator must be a whole number greater than zero');
  if (view.graphicProfileId.trim() === '')
    issues.push('graphicProfileId must not be empty');
  // A section says where it cuts and a façade says which way it looks, because
  // neither can be redrawn from the type alone. Everything else about the view
  // is derived from the model; these two are decisions, and a decision the file
  // does not carry is a decision lost.
  if (view.type === 'SECTION' && view.cut === undefined)
    issues.push('a SECTION view must carry the line it is cut along');
  if (view.cut !== undefined) {
    for (const [name, point] of [
      ['start', view.cut.start],
      ['end', view.cut.end],
    ] as const)
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        issues.push(`cut.${name} must be a finite point`);
    if (
      view.cut.start.x === view.cut.end.x &&
      view.cut.start.y === view.cut.end.y
    )
      issues.push('cut must have two distinct ends');
  }
  if (view.type === 'ELEVATION' && view.viewDirectionDeg === undefined)
    issues.push('an ELEVATION view must carry the direction it is seen from');
  if (
    view.viewDirectionDeg !== undefined &&
    !Number.isFinite(view.viewDirectionDeg)
  )
    issues.push('viewDirectionDeg must be finite');
  if (
    view.viewDepthMm !== undefined &&
    (!Number.isFinite(view.viewDepthMm) || view.viewDepthMm <= 0)
  )
    issues.push('viewDepthMm must be a finite length greater than zero');
  if (view.verticalRangeMm !== undefined) {
    const { minMm, maxMm } = view.verticalRangeMm;
    if (!Number.isFinite(minMm) || !Number.isFinite(maxMm))
      issues.push('verticalRangeMm must be finite');
    else if (maxMm <= minMm)
      issues.push(
        'verticalRangeMm must go from a lower height to a higher one',
      );
  }
  return issues;
}

export function validateSheet(sheet: ProjectSheet): readonly string[] {
  const issues: string[] = [];
  if (sheet.id.trim() === '') issues.push('id must not be empty');
  if (sheet.number.trim() === '') issues.push('number must not be empty');
  if (sheet.title.trim() === '') issues.push('title must not be empty');
  if (!isSheetFormat(sheet.format))
    issues.push(`format must be one of ${SHEET_FORMATS.join(', ')}`);
  if (!isSheetOrientation(sheet.orientation))
    issues.push(`orientation must be one of ${SHEET_ORIENTATIONS.join(', ')}`);
  const seen = new Set<string>();
  for (const [index, viewport] of sheet.viewports.entries()) {
    if (viewport.id.trim() === '' || seen.has(viewport.id))
      issues.push(`viewports[${index}].id must be unique and not empty`);
    seen.add(viewport.id);
    if (
      !Number.isFinite(viewport.scaleDenominator) ||
      viewport.scaleDenominator <= 0
    )
      issues.push(
        `viewports[${index}].scaleDenominator must be finite and positive`,
      );
    if (
      ![viewport.x, viewport.y, viewport.width, viewport.height].every(
        Number.isFinite,
      ) ||
      viewport.width <= 0 ||
      viewport.height <= 0
    )
      issues.push(`viewports[${index}] must have a finite positive frame`);
  }
  return issues;
}
