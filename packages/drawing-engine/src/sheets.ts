import type { DrawingViewId } from './scene.js';

export type StandardSheetFormat = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type SheetFormat = StandardSheetFormat | 'CUSTOM';
export type SheetOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface PaperSizeMm {
  readonly width: number;
  readonly height: number;
}

export interface PaperMarginsMm {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PaperRectangleMm {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SheetViewport {
  readonly id: string;
  readonly drawingViewId: DrawingViewId;
  /** The scale is displayed on the sheet; model rendering remains owned by DrawingView. */
  readonly scaleDenominator: number;
  readonly frame: PaperRectangleMm;
  readonly title?: string;
}

export type TitleBlockField =
  | 'PROJECT_NAME'
  | 'DRAWING_TITLE'
  | 'DRAWING_NUMBER'
  | 'REVISION'
  | 'DATE'
  | 'AUTHOR'
  | 'SCALE'
  | 'UNIT'
  | 'STATUS'
  | 'REFERENCES';

export interface TitleBlockCell {
  readonly id: string;
  readonly field: TitleBlockField;
  readonly label: string;
  readonly frame: PaperRectangleMm;
}

export interface TitleBlockTemplate {
  readonly id: string;
  readonly version: string;
  readonly size: PaperSizeMm;
  readonly cells: readonly TitleBlockCell[];
}

export type TitleBlockValues = Readonly<
  Partial<Record<TitleBlockField, string>>
>;

export interface SheetDefinition {
  readonly id: string;
  readonly number: string;
  readonly format: SheetFormat;
  readonly orientation: SheetOrientation;
  readonly customSizeMm?: PaperSizeMm;
  readonly marginsMm: PaperMarginsMm;
  readonly viewports: readonly SheetViewport[];
  readonly titleBlock: {
    readonly template: TitleBlockTemplate;
    readonly values: TitleBlockValues;
    /** Top-left origin of the title block in paper millimetres. */
    readonly position: { readonly x: number; readonly y: number };
  };
  readonly notes?: readonly string[];
}

export interface ResolvedTitleBlockCell extends TitleBlockCell {
  readonly value?: string;
  readonly state: 'KNOWN' | 'UNKNOWN';
}

export interface SheetLayout {
  readonly sheet: SheetDefinition;
  readonly paperSizeMm: PaperSizeMm;
  readonly printableArea: PaperRectangleMm;
  readonly titleBlockCells: readonly ResolvedTitleBlockCell[];
}

const portraitSizes: Readonly<Record<StandardSheetFormat, PaperSizeMm>> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1_189 },
};

export function paperSizeFor(
  format: SheetFormat,
  orientation: SheetOrientation,
  customSizeMm?: PaperSizeMm,
): PaperSizeMm {
  const portrait = format === 'CUSTOM' ? customSizeMm : portraitSizes[format];
  if (portrait === undefined)
    throw new TypeError('A custom sheet requires explicit paper dimensions.');
  validateSize(portrait, 'Paper');
  const normalized =
    portrait.width <= portrait.height
      ? portrait
      : { width: portrait.height, height: portrait.width };
  return orientation === 'PORTRAIT'
    ? normalized
    : { width: normalized.height, height: normalized.width };
}

export function createSheetLayout(sheet: SheetDefinition): SheetLayout {
  if (sheet.id.trim() === '' || sheet.number.trim() === '')
    throw new TypeError('Sheet ID and number must not be empty.');
  const paperSizeMm = paperSizeFor(
    sheet.format,
    sheet.orientation,
    sheet.customSizeMm,
  );
  validateMargins(sheet.marginsMm, paperSizeMm);
  const printableArea: PaperRectangleMm = {
    x: sheet.marginsMm.left,
    y: sheet.marginsMm.top,
    width: paperSizeMm.width - sheet.marginsMm.left - sheet.marginsMm.right,
    height: paperSizeMm.height - sheet.marginsMm.top - sheet.marginsMm.bottom,
  };
  validateTemplate(sheet.titleBlock.template);
  const titleBlockFrame: PaperRectangleMm = {
    ...sheet.titleBlock.position,
    ...sheet.titleBlock.template.size,
  };
  validateRectangle(titleBlockFrame, 'Title block');
  assertContained(titleBlockFrame, printableArea, 'Title block');
  const viewportIds = new Set<string>();
  for (const viewport of sheet.viewports) {
    if (viewport.id.trim() === '' || viewportIds.has(viewport.id))
      throw new TypeError('Sheet viewport IDs must be non-empty and unique.');
    viewportIds.add(viewport.id);
    if (
      !Number.isFinite(viewport.scaleDenominator) ||
      viewport.scaleDenominator <= 0
    )
      throw new RangeError('Viewport scale must be finite and positive.');
    validateRectangle(viewport.frame, `Viewport ${viewport.id}`);
    assertContained(viewport.frame, printableArea, `Viewport ${viewport.id}`);
    if (rectanglesOverlap(viewport.frame, titleBlockFrame))
      throw new RangeError(`Viewport ${viewport.id} overlaps the title block.`);
  }
  const titleBlockCells = resolveTitleBlock(
    sheet.titleBlock.template,
    sheet.titleBlock.values,
  );
  return { sheet, paperSizeMm, printableArea, titleBlockCells };
}

export function resolveTitleBlock(
  template: TitleBlockTemplate,
  values: TitleBlockValues,
): readonly ResolvedTitleBlockCell[] {
  validateTemplate(template);
  return template.cells.map((cell) => {
    const value = values[cell.field];
    const known = value !== undefined && value.trim() !== '';
    return {
      ...cell,
      ...(known ? { value } : {}),
      state: known ? 'KNOWN' : 'UNKNOWN',
    };
  });
}

function validateTemplate(template: TitleBlockTemplate): void {
  if (template.id.trim() === '' || template.version.trim() === '')
    throw new TypeError('Title block template identity must not be empty.');
  validateSize(template.size, 'Title block');
  const boundary: PaperRectangleMm = { x: 0, y: 0, ...template.size };
  const ids = new Set<string>();
  const previousCells: TitleBlockCell[] = [];
  for (const cell of template.cells) {
    if (cell.id.trim() === '' || cell.label.trim() === '' || ids.has(cell.id))
      throw new TypeError(
        'Title block cell IDs must be unique and labels non-empty.',
      );
    ids.add(cell.id);
    validateRectangle(cell.frame, `Title block cell ${cell.id}`);
    assertContained(cell.frame, boundary, `Title block cell ${cell.id}`);
    const overlap = previousCells.find((other) =>
      rectanglesOverlap(cell.frame, other.frame),
    );
    if (overlap !== undefined)
      throw new RangeError(
        `Title block cells ${overlap.id} and ${cell.id} overlap.`,
      );
    previousCells.push(cell);
  }
}

function validateMargins(margins: PaperMarginsMm, paper: PaperSizeMm): void {
  const values = [margins.top, margins.right, margins.bottom, margins.left];
  if (values.some((value) => !Number.isFinite(value) || value < 0))
    throw new RangeError('Paper margins must be finite and non-negative.');
  if (
    margins.left + margins.right >= paper.width ||
    margins.top + margins.bottom >= paper.height
  )
    throw new RangeError('Paper margins leave no printable area.');
}

function validateSize(size: PaperSizeMm, label: string): void {
  if (
    ![size.width, size.height].every(Number.isFinite) ||
    size.width <= 0 ||
    size.height <= 0
  )
    throw new RangeError(`${label} dimensions must be finite and positive.`);
}

function validateRectangle(rectangle: PaperRectangleMm, label: string): void {
  if (
    ![rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(
      Number.isFinite,
    ) ||
    rectangle.width <= 0 ||
    rectangle.height <= 0
  )
    throw new RangeError(
      `${label} must have finite coordinates and positive dimensions.`,
    );
}

function assertContained(
  inner: PaperRectangleMm,
  outer: PaperRectangleMm,
  label: string,
): void {
  if (
    inner.x < outer.x ||
    inner.y < outer.y ||
    inner.x + inner.width > outer.x + outer.width ||
    inner.y + inner.height > outer.y + outer.height
  )
    throw new RangeError(`${label} must fit within the printable area.`);
}

function rectanglesOverlap(
  first: PaperRectangleMm,
  second: PaperRectangleMm,
): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export const GENERIC_TITLE_BLOCK_V1: TitleBlockTemplate = {
  id: 'generic-title-block',
  version: '1.0.0',
  size: { width: 180, height: 36 },
  cells: [
    {
      id: 'project',
      field: 'PROJECT_NAME',
      label: 'Projet',
      frame: { x: 0, y: 0, width: 90, height: 12 },
    },
    {
      id: 'title',
      field: 'DRAWING_TITLE',
      label: 'Titre',
      frame: { x: 0, y: 12, width: 90, height: 24 },
    },
    {
      id: 'number',
      field: 'DRAWING_NUMBER',
      label: 'N°',
      frame: { x: 90, y: 0, width: 30, height: 12 },
    },
    {
      id: 'revision',
      field: 'REVISION',
      label: 'Révision',
      frame: { x: 120, y: 0, width: 30, height: 12 },
    },
    {
      id: 'date',
      field: 'DATE',
      label: 'Date',
      frame: { x: 150, y: 0, width: 30, height: 12 },
    },
    {
      id: 'author',
      field: 'AUTHOR',
      label: 'Auteur',
      frame: { x: 90, y: 12, width: 45, height: 12 },
    },
    {
      id: 'scale',
      field: 'SCALE',
      label: 'Échelle',
      frame: { x: 135, y: 12, width: 45, height: 12 },
    },
    {
      id: 'status',
      field: 'STATUS',
      label: 'Statut',
      frame: { x: 90, y: 24, width: 45, height: 12 },
    },
    {
      id: 'unit',
      field: 'UNIT',
      label: 'Unité',
      frame: { x: 135, y: 24, width: 45, height: 12 },
    },
  ],
};
