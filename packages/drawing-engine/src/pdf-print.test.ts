import { describe, expect, it, vi } from 'vitest';

import {
  createPdfPrintJob,
  createPdfPrintPage,
  generatePdfArtifact,
  type PdfBackend,
  type PdfBackendRequest,
} from './pdf-print.js';
import { drawingViewId } from './scene.js';
import {
  createSheetLayout,
  GENERIC_TITLE_BLOCK_V1,
  type SheetDefinition,
} from './sheets.js';

const definition = (id: string, number: string): SheetDefinition => ({
  id,
  number,
  format: 'A4',
  orientation: 'LANDSCAPE',
  marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
  viewports: [
    {
      id: `viewport-${id}`,
      drawingViewId: drawingViewId(`view-${id}`),
      scaleDenominator: 50,
      frame: { x: 15, y: 15, width: 250, height: 140 },
    },
  ],
  titleBlock: {
    template: GENERIC_TITLE_BLOCK_V1,
    position: { x: 97, y: 164 },
    values: { DRAWING_NUMBER: number },
  },
});

const svg = (id: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-id="${id}"><path d="M 0 0 L 100 100"/></svg>`;

const pdfBytes = (): Uint8Array =>
  new TextEncoder().encode('%PDF-1.7\n1 0 obj\n%%EOF');

describe('PDF print pipeline', () => {
  it('creates ordered vector pages from validated sheet layouts', () => {
    const first = createPdfPrintPage(
      createSheetLayout(definition('a-01', 'A-01')),
      svg('a-01'),
    );
    const second = createPdfPrintPage(
      createSheetLayout(definition('a-02', 'A-02')),
      svg('a-02'),
    );
    const job = createPdfPrintJob({
      id: 'print-1',
      metadata: { title: 'Dossier architectural' },
      colorMode: 'GRAYSCALE',
      pages: [first, second],
    });
    expect(job.pages.map(({ sheetNumber }) => sheetNumber)).toEqual([
      'A-01',
      'A-02',
    ]);
    expect(job.pages[0]?.paperSizeMm).toEqual({ width: 297, height: 210 });
  });

  it('delegates conversion through an injected, traceable backend', async () => {
    const generate = vi.fn(async (_request: PdfBackendRequest) => pdfBytes());
    const backend: PdfBackend = {
      id: 'test-vector-backend',
      version: '2.1.0',
      generate,
    };
    const page = createPdfPrintPage(
      createSheetLayout(definition('a-01', 'A-01')),
      svg('a-01'),
    );
    const artifact = await generatePdfArtifact(
      createPdfPrintJob({
        id: 'print-1',
        metadata: { title: 'Plans', revision: 'B' },
        colorMode: 'COLOR',
        pages: [page],
      }),
      'Dossier plans',
      backend,
    );
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0]?.[0].pages[0]?.svg).toContain('<svg ');
    expect(artifact).toMatchObject({
      fileName: 'Dossier plans.pdf',
      mediaType: 'application/pdf',
      backend: { id: 'test-vector-backend', version: '2.1.0' },
    });
    expect(artifact.byteLength).toBe(artifact.bytes.byteLength);
  });

  it('copies backend bytes so later backend mutation cannot alter the artifact', async () => {
    const generated = pdfBytes();
    const artifact = await generatePdfArtifact(
      {
        id: 'print',
        metadata: { title: 'Plan' },
        colorMode: 'COLOR',
        pages: [
          {
            sheetId: 'a',
            sheetNumber: 'A',
            paperSizeMm: { width: 210, height: 297 },
            svg: svg('a'),
          },
        ],
      },
      'plan.pdf',
      { id: 'backend', version: '1', generate: async () => generated },
    );
    generated.fill(0);
    expect(new TextDecoder('ascii').decode(artifact.bytes.slice(0, 5))).toBe(
      '%PDF-',
    );
  });

  it('rejects malformed jobs and non-PDF backend responses', async () => {
    expect(() =>
      createPdfPrintJob({
        id: 'empty',
        metadata: { title: 'Plan' },
        colorMode: 'COLOR',
        pages: [],
      }),
    ).toThrow('at least one');
    expect(() =>
      createPdfPrintJob({
        id: 'bad',
        metadata: { title: 'Plan' },
        colorMode: 'COLOR',
        pages: [
          {
            sheetId: 'a',
            sheetNumber: 'A',
            paperSizeMm: { width: 210, height: 297 },
            svg: '<svg></svg>',
          },
          {
            sheetId: 'a',
            sheetNumber: 'B',
            paperSizeMm: { width: 210, height: 297 },
            svg: svg('b'),
          },
        ],
      }),
    ).toThrow();
    await expect(
      generatePdfArtifact(
        {
          id: 'print',
          metadata: { title: 'Plan' },
          colorMode: 'COLOR',
          pages: [
            {
              sheetId: 'a',
              sheetNumber: 'A',
              paperSizeMm: { width: 210, height: 297 },
              svg: svg('a'),
            },
          ],
        },
        'plan',
        {
          id: 'broken',
          version: '1',
          generate: async () => new TextEncoder().encode('not a PDF'),
        },
      ),
    ).rejects.toThrow('PDF header');
  });

  it('rejects active or externally loaded SVG content before backend conversion', () => {
    const active =
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>';
    expect(() =>
      createPdfPrintPage(createSheetLayout(definition('a', 'A')), active),
    ).toThrow('unsafe');
    const external =
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test/a.png"/></svg>';
    expect(() =>
      createPdfPrintPage(createSheetLayout(definition('a', 'A')), external),
    ).toThrow('unsafe');
  });
});
