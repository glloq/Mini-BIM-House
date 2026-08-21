import { describe, expect, it } from 'vitest';
import {
  GENERIC_TECHNICAL_SCREEN,
  createPdfPrintPage,
} from '@house-technical-designer/drawing-engine';
import { entityId } from '@house-technical-designer/core-domain';
import type {
  ProjectSheet,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import { defaultVisibility } from '@house-technical-designer/view-query';
import { loadDemoProject } from '../demo-project.js';
import {
  defaultViewportFrame,
  modelWindowOf,
  renderSheet,
  sheetLayoutOf,
} from './documents-model.js';

function project() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

const VIEW: SavedDrawingView = {
  id: 'view-ground',
  type: 'PLAN',
  name: 'Plan du rez-de-chaussée',
  levelId: entityId<'Level'>('ground'),
  scaleDenominator: 50,
  layers: defaultVisibility(),
  graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
  // The south wall of the reference house runs from the origin to ten metres
  // east; centring on it keeps the measured wall inside every frame below.
  centreMm: { x: 5000, y: 4000 },
};

const FRAME = { width: 300, height: 200 };

function sheetAt(scaleDenominator: number): ProjectSheet {
  return {
    id: 'sheet-a001',
    number: 'A-001',
    title: 'Plan',
    format: 'A3',
    orientation: 'LANDSCAPE',
    viewports: [
      {
        id: 'viewport-1',
        viewId: VIEW.id,
        scaleDenominator,
        x: 10,
        y: 10,
        width: FRAME.width,
        height: FRAME.height,
      },
    ],
  };
}

function withView() {
  const base = project();
  return { ...base, drawingViews: [VIEW] };
}

/**
 * The nested view a sheet draws, and the numbers that decide its scale.
 *
 * A sheet places the view in a paper rectangle and gives it a model window as
 * its `viewBox`. How many model millimetres one paper millimetre carries is
 * the ratio of the two, and that ratio is the scale — whatever the caption
 * says.
 */
function nestedView(svg: string): {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly windowMinX: number;
  readonly windowMinY: number;
} {
  const opening =
    /<svg x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)" viewBox="([^"]+)"/u.exec(
      svg,
    );
  if (opening === null) throw new Error('the sheet nests no view');
  const [minX, minY, width, height] = opening[5]!
    .split(/\s+/u)
    .map((value) => Number(value));
  return {
    frameWidth: Number(opening[3]),
    frameHeight: Number(opening[4]),
    windowWidth: width!,
    windowHeight: height!,
    windowMinX: minX!,
    windowMinY: minY!,
  };
}

describe('the scale a sheet actually prints at', () => {
  it.each([
    [50, 200],
    [100, 100],
    [200, 50],
  ])('draws ten metres as %i → %i mm of paper', (scale, expectedMm) => {
    const nested = nestedView(renderSheet(withView(), sheetAt(scale)));
    // One paper millimetre carries `scale` model millimetres, so ten metres of
    // wall measure ten thousand divided by the scale.
    const paperPerModel = nested.frameWidth / nested.windowWidth;
    expect(10_000 * paperPerModel).toBeCloseTo(expectedMm, 6);
  });

  it('carries the same scale across the frame in both directions', () => {
    // A window whose shape differs from the frame's would be squeezed by the
    // renderer, and a plan squeezed in one direction measures wrong in it.
    const nested = nestedView(renderSheet(withView(), sheetAt(50)));
    expect(nested.frameWidth / nested.windowWidth).toBeCloseTo(
      nested.frameHeight / nested.windowHeight,
      9,
    );
  });

  it('shows exactly the model window the frame and the scale describe', () => {
    const nested = nestedView(renderSheet(withView(), sheetAt(50)));
    expect(nested.windowWidth).toBeCloseTo(FRAME.width * 50, 6);
    expect(nested.windowHeight).toBeCloseTo(FRAME.height * 50, 6);
  });

  it('centres the window where the view says', () => {
    const nested = nestedView(renderSheet(withView(), sheetAt(50)));
    expect(nested.windowMinX + nested.windowWidth / 2).toBeCloseTo(5000, 6);
    expect(nested.windowMinY + nested.windowHeight / 2).toBeCloseTo(4000, 6);
  });

  it('never lets the frame decide the scale', () => {
    // The same view in a frame half as wide shows half as much building at the
    // same scale — it does not zoom to fit.
    const narrow = nestedView(
      renderSheet(withView(), {
        ...sheetAt(50),
        viewports: [{ ...sheetAt(50).viewports[0]!, width: FRAME.width / 2 }],
      }),
    );
    expect(narrow.windowWidth).toBeCloseTo((FRAME.width / 2) * 50, 6);
    expect(narrow.frameWidth / narrow.windowWidth).toBeCloseTo(1 / 50, 9);
  });

  it('states the same model window the sheet renders', () => {
    const window = modelWindowOf(withView(), VIEW, FRAME);
    expect(window.max.x - window.min.x).toBeCloseTo(FRAME.width * 50, 6);
    expect(window.max.y - window.min.y).toBeCloseTo(FRAME.height * 50, 6);
  });

  it('frames the content when the view names no centre', () => {
    // A view that says nothing about where it looks is framed on what it draws
    // — a framing decision, and still at the stated scale.
    const { centreMm: _dropped, ...anywhere } = VIEW;
    const window = modelWindowOf(withView(), anywhere, FRAME);
    expect(window.max.x - window.min.x).toBeCloseTo(FRAME.width * 50, 6);
    expect((window.min.x + window.max.x) / 2).toBeGreaterThan(0);
  });

  it('uses the scale of the viewport, not of the view', () => {
    // The same view may sit on two sheets at two scales.
    const nested = nestedView(renderSheet(withView(), sheetAt(200)));
    expect(nested.windowWidth).toBeCloseTo(FRAME.width * 200, 6);
  });

  it('fits a default viewport frame to its sheet', () => {
    const frame = defaultViewportFrame({
      format: 'A3',
      orientation: 'LANDSCAPE',
    });
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(0);
  });
});

describe('the paper the sheet claims to be', () => {
  it('declares its size in millimetres, one to one with its own frame', () => {
    // What carries the scale into the PDF: the page is rasterised from this
    // document onto a canvas sized from the same paper dimensions, so a
    // millimetre of the drawing is a millimetre of the page.
    const svg = renderSheet(withView(), sheetAt(50));
    expect(svg).toContain('width="420mm"');
    expect(svg).toContain('height="297mm"');
    expect(svg).toContain('viewBox="0 0 420 297"');
  });

  it('hands the print job the paper size it was laid out on', () => {
    const page = createPdfPrintPage(
      sheetLayoutOf(withView(), sheetAt(50)),
      renderSheet(withView(), sheetAt(50)),
    );
    expect(page.paperSizeMm).toEqual({ width: 420, height: 297 });
    expect(page.sheetNumber).toBe('A-001');
  });
});
