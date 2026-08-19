import type { PaperSizeMm, SheetLayout } from './sheets.js';

export type PdfColorMode = 'COLOR' | 'GRAYSCALE';

export interface PdfPrintMetadata {
  readonly title: string;
  readonly author?: string;
  readonly subject?: string;
  readonly revision?: string;
  /** Caller-supplied ISO timestamp; never generated implicitly. */
  readonly createdAt?: string;
}

export interface PdfPrintPage {
  readonly sheetId: string;
  readonly sheetNumber: string;
  readonly paperSizeMm: PaperSizeMm;
  readonly svg: string;
}

export interface PdfPrintJob {
  readonly id: string;
  readonly metadata: PdfPrintMetadata;
  readonly colorMode: PdfColorMode;
  readonly pages: readonly PdfPrintPage[];
}

export interface PdfBackendRequest {
  readonly metadata: PdfPrintMetadata;
  readonly colorMode: PdfColorMode;
  readonly pages: readonly PdfPrintPage[];
}

/** Injected boundary: browser, worker, or native adapters may implement it. */
export interface PdfBackend {
  readonly id: string;
  readonly version: string;
  generate(request: PdfBackendRequest): Promise<Uint8Array>;
}

export interface PdfArtifact {
  readonly fileName: string;
  readonly mediaType: 'application/pdf';
  readonly bytes: Uint8Array;
  readonly byteLength: number;
  readonly backend: { readonly id: string; readonly version: string };
}

export function createPdfPrintPage(
  layout: SheetLayout,
  svg: string,
): PdfPrintPage {
  validateSvgDocument(svg, 'PDF print page');
  return {
    sheetId: layout.sheet.id,
    sheetNumber: layout.sheet.number,
    paperSizeMm: layout.paperSizeMm,
    svg,
  };
}

export function createPdfPrintJob(input: PdfPrintJob): PdfPrintJob {
  if (input.id.trim() === '')
    throw new TypeError('PDF print job ID must not be empty.');
  validateMetadata(input.metadata);
  if (input.pages.length === 0)
    throw new TypeError('A PDF print job requires at least one page.');
  const sheetIds = new Set<string>();
  for (const page of input.pages) {
    if (page.sheetId.trim() === '' || page.sheetNumber.trim() === '')
      throw new TypeError('PDF page sheet identity must not be empty.');
    if (sheetIds.has(page.sheetId))
      throw new TypeError(`Duplicate PDF sheet ID: ${page.sheetId}`);
    sheetIds.add(page.sheetId);
    validatePaperSize(page.paperSizeMm);
    validateSvgDocument(page.svg, `PDF sheet ${page.sheetId}`);
  }
  return {
    ...input,
    pages: input.pages.map((page) => ({ ...page })),
  };
}

export async function generatePdfArtifact(
  job: PdfPrintJob,
  fileName: string,
  backend: PdfBackend,
): Promise<PdfArtifact> {
  const validated = createPdfPrintJob(job);
  if (backend.id.trim() === '' || backend.version.trim() === '')
    throw new TypeError('PDF backend identity and version must not be empty.');
  const generated = await backend.generate({
    metadata: validated.metadata,
    colorMode: validated.colorMode,
    pages: validated.pages,
  });
  const bytes = new Uint8Array(generated);
  validatePdfBytes(bytes);
  return {
    fileName: normalizePdfFileName(fileName),
    mediaType: 'application/pdf',
    bytes,
    byteLength: bytes.byteLength,
    backend: { id: backend.id, version: backend.version },
  };
}

function validateMetadata(metadata: PdfPrintMetadata): void {
  if (metadata.title.trim() === '')
    throw new TypeError('PDF title must not be empty.');
  if (
    metadata.createdAt !== undefined &&
    (!Number.isFinite(Date.parse(metadata.createdAt)) ||
      !/^\d{4}-\d{2}-\d{2}T/u.test(metadata.createdAt))
  )
    throw new TypeError('PDF creation date must be an ISO date-time.');
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' && value.includes('\0'))
      throw new TypeError(`PDF metadata ${key} contains a null character.`);
  }
}

function validatePaperSize(size: PaperSizeMm): void {
  if (
    ![size.width, size.height].every(Number.isFinite) ||
    size.width <= 0 ||
    size.height <= 0
  )
    throw new RangeError('PDF paper dimensions must be finite and positive.');
}

function validateSvgDocument(value: string, label: string): void {
  const trimmed = value.trimStart();
  const declarationEnd = trimmed.indexOf('?>');
  if (trimmed.startsWith('<?xml') && declarationEnd < 0)
    throw new TypeError(`${label} has an incomplete XML declaration.`);
  const document = trimmed.startsWith('<?xml')
    ? trimmed.slice(declarationEnd + 2).trimStart()
    : trimmed;
  if (
    !document.startsWith('<svg ') ||
    !document.includes('xmlns="http://www.w3.org/2000/svg"') ||
    !document.endsWith('</svg>')
  )
    throw new TypeError(`${label} requires a complete SVG document.`);
  if (
    /<\s*(?:script|foreignObject|iframe|object|embed)\b/iu.test(document) ||
    /\son[a-z]+\s*=/iu.test(document) ||
    /(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:)/iu.test(
      document,
    ) ||
    /<!DOCTYPE/iu.test(document)
  )
    throw new TypeError(`${label} contains unsafe active or external content.`);
}

function validatePdfBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 8)
    throw new TypeError('PDF backend returned an incomplete document.');
  const header = new TextDecoder('ascii').decode(bytes.slice(0, 5));
  if (header !== '%PDF-')
    throw new TypeError('PDF backend returned bytes without a PDF header.');
  const tail = new TextDecoder('ascii').decode(bytes.slice(-16));
  if (!tail.includes('%%EOF'))
    throw new TypeError('PDF backend returned bytes without an end marker.');
}

function normalizePdfFileName(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new TypeError('PDF file name must not be empty.');
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0'))
    throw new TypeError('PDF file name must not contain a path.');
  const withExtension = trimmed.toLowerCase().endsWith('.pdf')
    ? trimmed
    : `${trimmed}.pdf`;
  if (!/^[\p{L}\p{N}._() -]+\.pdf$/u.test(withExtension))
    throw new TypeError('PDF file name contains unsupported characters.');
  return withExtension;
}
