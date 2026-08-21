import type {
  PdfBackend,
  PdfBackendRequest,
} from '@house-technical-designer/drawing-engine';

import { rasterPlanFor } from './raster-plan.js';

/**
 * Turns the sheets into a PDF, in the browser, with no library.
 *
 * The drawing engine already builds the print job, validates the pages and
 * checks the bytes that come back; what was missing was something to produce
 * those bytes. This is that, and no more: it is the injectable backend the
 * engine asks for.
 *
 * **The pages it produces are images.** PDF has no notion of SVG, and turning
 * a drawing into PDF vector operators means writing a second renderer that
 * would drift from the first. Each sheet is therefore drawn into a canvas at a
 * stated resolution and embedded as a JPEG. The result prints at the right
 * size and cannot be selected, searched or zoomed without loss — which is why
 * the interface says so beside the button rather than letting the file be
 * mistaken for a vector drawing.
 *
 * They are produced **one at a time**, and each page's resolution comes from a
 * pixel budget rather than from a constant. Rasterising ten A0 sheets at once
 * at eight pixels a millimetre asked the tab for two and a half gigabytes of
 * canvas; what came back was a crash with no file and no message.
 */
export class BrowserPdfBackend implements PdfBackend {
  readonly id = 'browser-canvas-jpeg';
  readonly version = '1.0.0';

  async generate(request: PdfBackendRequest): Promise<Uint8Array> {
    const pages: RasterPage[] = [];
    // One after another, on purpose: a page's canvas is released before the
    // next one is asked for, so the memory a drawing set needs is the memory
    // of its largest sheet and not of all of them together.
    for (const page of request.pages)
      pages.push(
        await rasterise(
          page.svg,
          page.paperSizeMm,
          request.colorMode === 'GRAYSCALE',
        ),
      );
    return assemblePdf(request, pages);
  }
}

interface RasterPage {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly jpeg: Uint8Array;
}

async function rasterise(
  svg: string,
  paperSizeMm: { readonly width: number; readonly height: number },
  grayscale: boolean,
): Promise<RasterPage> {
  const { pixelWidth, pixelHeight } = rasterPlanFor(paperSizeMm);
  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const context = canvas.getContext('2d');
  if (context === null)
    throw new TypeError('Ce navigateur ne fournit pas de canevas 2D.');
  // A white ground, because a PDF page is paper and a transparent drawing
  // would print as black in some readers.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, pixelWidth, pixelHeight);
  const url = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
  );
  try {
    const image = await loadImage(url);
    context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
  if (grayscale) {
    const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const grey = Math.round(
        0.299 * pixels.data[index]! +
          0.587 * pixels.data[index + 1]! +
          0.114 * pixels.data[index + 2]!,
      );
      pixels.data[index] = grey;
      pixels.data[index + 1] = grey;
      pixels.data[index + 2] = grey;
    }
    context.putImageData(pixels, 0, 0);
  }
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });
  if (blob === null)
    throw new TypeError('Le navigateur n’a pas produit d’image de la feuille.');
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  // The canvas is what holds the megapixels; giving it up here is what makes
  // rasterising page by page worth anything.
  canvas.width = 0;
  canvas.height = 0;
  return {
    widthMm: paperSizeMm.width,
    heightMm: paperSizeMm.height,
    pixelWidth,
    pixelHeight,
    jpeg,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new TypeError('La feuille n’a pas pu être dessinée.'));
    };
    image.src = url;
  });
}

const POINTS_PER_MM = 72 / 25.4;

function pdfText(value: string): string {
  return value.replace(/([\\()])/gu, '\\$1');
}

/**
 * Writes the smallest PDF that holds these pages.
 *
 * One page object per sheet, one JPEG stream per page embedded with
 * `/DCTDecode` — which is why the images are JPEG: the bytes go in as they
 * are, with nothing to compress or re-encode here.
 */
function assemblePdf(
  request: PdfBackendRequest,
  pages: readonly RasterPage[],
): Uint8Array {
  const objects: Uint8Array[] = [];
  const encoder = new TextEncoder();
  const push = (value: string | Uint8Array): number => {
    objects.push(typeof value === 'string' ? encoder.encode(value) : value);
    return objects.length;
  };
  const bytes = (...parts: (string | Uint8Array)[]): Uint8Array => {
    const encoded = parts.map((part) =>
      typeof part === 'string' ? encoder.encode(part) : part,
    );
    const total = encoded.reduce((sum, part) => sum + part.byteLength, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const part of encoded) {
      result.set(part, offset);
      offset += part.byteLength;
    }
    return result;
  };

  // 1 catalogue, 2 pages tree, then three objects per page.
  const pageObjectNumbers: number[] = [];
  push('placeholder-catalog');
  push('placeholder-pages');
  for (const page of pages) {
    const widthPt = page.widthMm * POINTS_PER_MM;
    const heightPt = page.heightMm * POINTS_PER_MM;
    const imageNumber = push(
      bytes(
        `<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.byteLength} >>\nstream\n`,
        page.jpeg,
        '\nendstream',
      ),
    );
    const content = `q ${widthPt.toFixed(3)} 0 0 ${heightPt.toFixed(3)} 0 0 cm /Im0 Do Q`;
    const contentNumber = push(
      `<< /Length ${encoder.encode(content).byteLength} >>\nstream\n${content}\nendstream`,
    );
    const pageNumber = push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(3)} ${heightPt.toFixed(3)}] /Resources << /XObject << /Im0 ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`,
    );
    pageObjectNumbers.push(pageNumber);
  }
  const infoNumber = push(
    `<< /Title (${pdfText(request.metadata.title)})${
      request.metadata.author === undefined
        ? ''
        : ` /Author (${pdfText(request.metadata.author)})`
    }${
      request.metadata.subject === undefined
        ? ''
        : ` /Subject (${pdfText(request.metadata.subject)})`
    } /Producer (Mini-BIM-House) >>`,
  );
  objects[0] = encoder.encode('<< /Type /Catalog /Pages 2 0 R >>');
  objects[1] = encoder.encode(
    `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers
      .map((number) => `${number} 0 R`)
      .join(' ')}] >>`,
  );

  const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
  const offsets: number[] = [];
  let position = parts[0]!.byteLength;
  for (const [index, object] of objects.entries()) {
    offsets.push(position);
    const chunk = bytes(`${index + 1} 0 obj\n`, object, '\nendobj\n');
    parts.push(chunk);
    position += chunk.byteLength;
  }
  const xrefPosition = position;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.map(
      (offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`,
    ),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNumber} 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`,
  ].join('');
  parts.push(encoder.encode(xref));
  return bytes(...parts);
}
