import { describe, expect, it } from 'vitest';
import type {
  Project,
  ProjectSheet,
} from '@house-technical-designer/core-domain';
import {
  createSheetLayout,
  paperSizeFor,
} from '@house-technical-designer/drawing-engine';
import { loadDemoProject } from '../demo-project.js';
import {
  relaidSheet,
  sheetDefinitionOf,
  viewportFramesFor,
} from './documents-model.js';
import {
  MAXIMUM_PIXELS_PER_MM,
  PIXEL_BUDGET,
  announcedDotsPerInch,
  rasterPlanFor,
} from './raster-plan.js';

function project(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function sheetOf(
  format: ProjectSheet['format'],
  orientation: ProjectSheet['orientation'],
  count: number,
): ProjectSheet {
  return {
    id: 'sheet-1',
    number: 'A-001',
    title: 'Plans',
    format,
    orientation,
    viewports: Array.from({ length: count }, (_unused, index) => ({
      id: `viewport-${index}`,
      viewId: 'view-1',
      scaleDenominator: 100,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    })),
  };
}

/** The drawing engine is the judge: it refuses anything off the paper. */
function drawable(sheet: ProjectSheet): boolean {
  const withViews: Project = {
    ...project(),
    drawingViews: [
      {
        id: 'view-1',
        type: 'PLAN',
        name: 'Plan',
        scaleDenominator: 100,
        layers: {},
        graphicProfileId: 'generic-technical-screen',
      },
    ],
  };
  createSheetLayout(sheetDefinitionOf(withViews, sheet));
  return true;
}

describe('several views on one sheet', () => {
  it.each([1, 2, 3, 4, 6, 9])('lays %i of them out on the paper', (count) => {
    const frames = viewportFramesFor(sheetOf('A3', 'LANDSCAPE', count), count);
    expect(frames).toHaveLength(count);
    for (const frame of frames) {
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
    }
  });

  it('never lets two of them overlap', () => {
    const frames = viewportFramesFor(sheetOf('A3', 'LANDSCAPE', 4), 4);
    for (const [index, first] of frames.entries())
      for (const second of frames.slice(index + 1))
        expect(
          first.x + first.width <= second.x ||
            second.x + second.width <= first.x ||
            first.y + first.height <= second.y ||
            second.y + second.height <= first.y,
        ).toBe(true);
  });

  it.each([
    ['A4', 'PORTRAIT'],
    ['A3', 'LANDSCAPE'],
    ['A1', 'PORTRAIT'],
    ['A0', 'LANDSCAPE'],
  ] as const)('stays drawable on %s %s', (format, orientation) => {
    expect(drawable(relaidSheet(sheetOf(format, orientation, 4)))).toBe(true);
  });

  it('lays the frames out again when the paper is turned', () => {
    // The frames of a landscape A3 hang off a portrait one: they are derived
    // from the paper, so turning the paper derives them again.
    const landscape = relaidSheet(sheetOf('A3', 'LANDSCAPE', 2));
    const turned = relaidSheet({ ...landscape, orientation: 'PORTRAIT' });
    const paper = paperSizeFor('A3', 'PORTRAIT');
    for (const viewport of turned.viewports) {
      expect(viewport.x + viewport.width).toBeLessThanOrEqual(paper.width);
      expect(viewport.y + viewport.height).toBeLessThanOrEqual(paper.height);
    }
    expect(() => drawable(turned)).not.toThrow();
  });

  it('keeps each viewport its own view and its own scale', () => {
    const sheet = relaidSheet({
      ...sheetOf('A3', 'LANDSCAPE', 2),
      viewports: [
        {
          id: 'v1',
          viewId: 'view-1',
          scaleDenominator: 50,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        {
          id: 'v2',
          viewId: 'view-1',
          scaleDenominator: 200,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ],
    });
    expect(
      sheet.viewports.map(({ scaleDenominator }) => scaleDenominator),
    ).toEqual([50, 200]);
  });
});

describe('the resolution a sheet is rasterised at', () => {
  it('gives a small format the full density', () => {
    const plan = rasterPlanFor(paperSizeFor('A4', 'PORTRAIT'));
    expect(plan.pixelsPerMm).toBe(MAXIMUM_PIXELS_PER_MM);
    expect(plan.dotsPerInch).toBe(203);
  });

  it('keeps every format inside the budget one page may occupy', () => {
    for (const format of ['A4', 'A3', 'A2', 'A1', 'A0'] as const) {
      const plan = rasterPlanFor(paperSizeFor(format, 'LANDSCAPE'));
      expect(plan.pixelWidth * plan.pixelHeight).toBeLessThanOrEqual(
        PIXEL_BUDGET * 1.01,
      );
    }
  });

  it('reduces a large format rather than exhausting the tab', () => {
    // An A0 at eight pixels a millimetre is sixty-four megapixels: a quarter
    // of a gigabyte for one page, and there used to be one canvas per sheet
    // all at once.
    const a0 = rasterPlanFor(paperSizeFor('A0', 'LANDSCAPE'));
    expect(a0.pixelsPerMm).toBeLessThan(MAXIMUM_PIXELS_PER_MM);
    expect(a0.dotsPerInch).toBeGreaterThan(100);
  });

  it('announces the density of the sheet that had to give up the most', () => {
    const dpi = announcedDotsPerInch([
      paperSizeFor('A4', 'PORTRAIT'),
      paperSizeFor('A0', 'LANDSCAPE'),
    ]);
    expect(dpi).toBe(
      rasterPlanFor(paperSizeFor('A0', 'LANDSCAPE')).dotsPerInch,
    );
  });

  it('announces nothing about a set with no sheets', () => {
    expect(announcedDotsPerInch([])).toBeUndefined();
  });
});
