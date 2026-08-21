/** A rectangle of paper, in millimetres. */
export interface PaperSizeMm {
  readonly width: number;
  readonly height: number;
}

/**
 * How many pixels one paper millimetre becomes, at best.
 *
 * Eight, which is 203 dots per inch: readable when printed at size, and the
 * resolution a small format is rasterised at.
 */
export const MAXIMUM_PIXELS_PER_MM = 8;

/**
 * How many pixels one page may occupy while it is being drawn.
 *
 * A canvas is held as four bytes a pixel, and the encoder needs the image
 * again while it works: twenty-five megapixels is about a hundred megabytes of
 * canvas plus what the JPEG encoder takes, which a browser tab survives.
 *
 * An A0 at eight pixels a millimetre would be 6 728 × 9 512 — sixty-four
 * megapixels, a quarter of a gigabyte for one page, and the pages were
 * rasterised all at once. A drawing set of ten A0 sheets asked the tab for two
 * and a half gigabytes and got a crash: no file, no error, no explanation.
 */
export const PIXEL_BUDGET = 25_000_000;

export interface RasterPlan {
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  /** What the page is actually rasterised at, once the budget is applied. */
  readonly pixelsPerMm: number;
  readonly dotsPerInch: number;
}

/**
 * The resolution one page of paper is drawn at.
 *
 * Small formats get the full density; large ones get whatever the budget
 * allows, which is a decision and is therefore stated rather than discovered
 * afterwards by a reader wondering why the A0 looks softer than the A3. What
 * this returns is what the interface announces before the export starts.
 */
export function rasterPlanFor(paperSizeMm: PaperSizeMm): RasterPlan {
  const areaMm2 = Math.max(1, paperSizeMm.width * paperSizeMm.height);
  const affordable = Math.sqrt(PIXEL_BUDGET / areaMm2);
  const pixelsPerMm = Math.min(MAXIMUM_PIXELS_PER_MM, affordable);
  return {
    pixelWidth: Math.max(1, Math.round(paperSizeMm.width * pixelsPerMm)),
    pixelHeight: Math.max(1, Math.round(paperSizeMm.height * pixelsPerMm)),
    pixelsPerMm,
    dotsPerInch: Math.round(pixelsPerMm * 25.4),
  };
}

/**
 * What the export announces about a set of sheets before producing it.
 *
 * The coarsest page decides what is said: a set is only as sharp as the sheet
 * that had to be reduced most, and saying « 203 dpi » because the A4 reached it
 * would be saying something about a page nobody is worried about.
 */
export function announcedDotsPerInch(
  pages: readonly PaperSizeMm[],
): number | undefined {
  const resolutions = pages.map((page) => rasterPlanFor(page).dotsPerInch);
  return resolutions.length === 0 ? undefined : Math.min(...resolutions);
}
