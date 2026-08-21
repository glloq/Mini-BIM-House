import type { SheetLayout } from './sheets.js';

/** One view already rendered, and where it goes on the sheet. */
export interface RenderedViewport {
  readonly viewportId: string;
  /** A complete SVG document of the view, as the renderer produced it. */
  readonly svg: string;
  /** What the frame is labelled with, under it. */
  readonly caption?: string;
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escaped(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ESCAPES[character]!);
}

/** The body of a rendered view, without its own document wrapper. */
function inner(svg: string): {
  readonly viewBox: string;
  readonly body: string;
} {
  const start = svg.indexOf('<svg ');
  const open = svg.indexOf('>', start);
  const end = svg.lastIndexOf('</svg>');
  if (start < 0 || open < 0 || end < 0)
    throw new TypeError('A rendered view must be a complete SVG document.');
  const attributes = svg.slice(start, open);
  const viewBox = /viewBox="([^"]*)"/u.exec(attributes)?.[1];
  if (viewBox === undefined)
    throw new TypeError('A rendered view must state its viewBox.');
  return { viewBox, body: svg.slice(open + 1, end) };
}

/**
 * Draws a sheet: its frame, the views placed on it, and its title block.
 *
 * The views are not re-rendered here. Each arrives as the document the drawing
 * renderer produced and is nested inside its frame, so what a sheet shows is
 * exactly what the plan shows — a sheet that drew the model a second way would
 * be a second drawing engine, and the two would disagree.
 *
 * A title block cell the project cannot fill is drawn empty and marked as
 * unknown; writing a plausible value into a printed drawing is how a drawing
 * stops being evidence.
 */
export function renderSheetToSvg(
  layout: SheetLayout,
  views: readonly RenderedViewport[],
): string {
  const { paperSizeMm, printableArea, sheet } = layout;
  const rendered = new Map(views.map((view) => [view.viewportId, view]));
  const frames = sheet.viewports
    .map((viewport) => {
      const view = rendered.get(viewport.id);
      const caption = escaped(
        view?.caption ?? `${viewport.title ?? viewport.drawingViewId}`,
      );
      const label = `<text x="${viewport.frame.x}" y="${
        viewport.frame.y + viewport.frame.height + 4
      }" font-size="3.5" fill="#1f2d27">${caption} · 1:${viewport.scaleDenominator}</text>`;
      const border = `<rect x="${viewport.frame.x}" y="${viewport.frame.y}" width="${viewport.frame.width}" height="${viewport.frame.height}" fill="none" stroke="#8b9a92" stroke-width="0.2"/>`;
      if (view === undefined)
        return `${border}<text x="${viewport.frame.x + 2}" y="${
          viewport.frame.y + 6
        }" font-size="3" fill="#8b9a92">Vue non rendue</text>${label}`;
      const { viewBox, body } = inner(view.svg);
      return `<svg x="${viewport.frame.x}" y="${viewport.frame.y}" width="${viewport.frame.width}" height="${viewport.frame.height}" viewBox="${escaped(viewBox)}" preserveAspectRatio="xMidYMid meet" data-view-id="${escaped(viewport.drawingViewId)}">${body}</svg>${border}${label}`;
    })
    .join('');
  const origin = sheet.titleBlock.position;
  const cells = layout.titleBlockCells
    .map((cell) => {
      const x = origin.x + cell.frame.x;
      const y = origin.y + cell.frame.y;
      const value =
        cell.state === 'KNOWN'
          ? `<text x="${x + 1.5}" y="${y + cell.frame.height - 2}" font-size="3.2" fill="#1f2d27">${escaped(cell.value ?? '')}</text>`
          : `<text x="${x + 1.5}" y="${y + cell.frame.height - 2}" font-size="3" fill="#8b9a92" font-style="italic">inconnu</text>`;
      return `<rect x="${x}" y="${y}" width="${cell.frame.width}" height="${cell.frame.height}" fill="none" stroke="#4a5d54" stroke-width="0.2"/><text x="${x + 1.5}" y="${y + 3.4}" font-size="2.2" fill="#5b6b63">${escaped(cell.label)}</text>${value}`;
    })
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${paperSizeMm.width} ${paperSizeMm.height}" width="${paperSizeMm.width}mm" height="${paperSizeMm.height}mm" data-sheet-id="${escaped(sheet.id)}">`,
    `<rect x="0" y="0" width="${paperSizeMm.width}" height="${paperSizeMm.height}" fill="#ffffff"/>`,
    `<rect x="${printableArea.x}" y="${printableArea.y}" width="${printableArea.width}" height="${printableArea.height}" fill="none" stroke="#1f2d27" stroke-width="0.3"/>`,
    frames,
    cells,
    '</svg>',
  ].join('');
}
