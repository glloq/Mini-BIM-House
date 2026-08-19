import { describe, expect, it } from 'vitest';

import { drawingViewId } from './scene.js';
import {
  createSheetLayout,
  GENERIC_TITLE_BLOCK_V1,
  paperSizeFor,
  resolveTitleBlock,
  type SheetDefinition,
} from './sheets.js';

const sheet = (overrides: Partial<SheetDefinition> = {}): SheetDefinition => ({
  id: 'sheet-a-01',
  number: 'A-01',
  format: 'A4',
  orientation: 'PORTRAIT',
  marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
  viewports: [
    {
      id: 'ground-floor',
      drawingViewId: drawingViewId('ground-floor-plan'),
      scaleDenominator: 50,
      frame: { x: 15, y: 15, width: 180, height: 220 },
      title: 'Plan du rez-de-chaussée',
    },
  ],
  titleBlock: {
    template: GENERIC_TITLE_BLOCK_V1,
    position: { x: 15, y: 246 },
    values: {
      PROJECT_NAME: 'Maison exemple',
      DRAWING_TITLE: 'Plan architectural',
      DRAWING_NUMBER: 'A-01',
      SCALE: '1:50',
      UNIT: 'mm',
    },
  },
  ...overrides,
});

describe('sheet layouts and title blocks', () => {
  it('derives standard portrait and landscape dimensions in paper millimetres', () => {
    expect(paperSizeFor('A4', 'PORTRAIT')).toEqual({ width: 210, height: 297 });
    expect(paperSizeFor('A3', 'LANDSCAPE')).toEqual({
      width: 420,
      height: 297,
    });
    expect(paperSizeFor('A0', 'PORTRAIT')).toEqual({
      width: 841,
      height: 1_189,
    });
  });

  it('requires explicit finite dimensions for custom formats', () => {
    expect(() => paperSizeFor('CUSTOM', 'PORTRAIT')).toThrow(
      'requires explicit',
    );
    expect(
      paperSizeFor('CUSTOM', 'LANDSCAPE', { width: 500, height: 300 }),
    ).toEqual({ width: 500, height: 300 });
    expect(() =>
      paperSizeFor('CUSTOM', 'PORTRAIT', { width: Number.NaN, height: 300 }),
    ).toThrow('finite and positive');
  });

  it('creates a deterministic printable layout with explicit unknown title values', () => {
    const layout = createSheetLayout(sheet());
    expect(layout.printableArea).toEqual({
      x: 10,
      y: 10,
      width: 190,
      height: 277,
    });
    expect(
      layout.titleBlockCells.find(({ field }) => field === 'PROJECT_NAME'),
    ).toMatchObject({ state: 'KNOWN', value: 'Maison exemple' });
    expect(
      layout.titleBlockCells.find(({ field }) => field === 'REVISION'),
    ).toMatchObject({ state: 'UNKNOWN' });
    expect(
      layout.titleBlockCells.find(({ field }) => field === 'REVISION'),
    ).not.toHaveProperty('value');
  });

  it('does not invent values when resolving a reusable title block template', () => {
    const resolved = resolveTitleBlock(GENERIC_TITLE_BLOCK_V1, {
      AUTHOR: '  ',
    });
    expect(resolved.every(({ state }) => state === 'UNKNOWN')).toBe(true);
  });

  it('rejects duplicate viewport IDs, invalid scales, overflow, and title block overlaps', () => {
    const viewport = sheet().viewports[0]!;
    expect(() =>
      createSheetLayout(sheet({ viewports: [viewport, viewport] })),
    ).toThrow('unique');
    expect(() =>
      createSheetLayout(
        sheet({ viewports: [{ ...viewport, scaleDenominator: 0 }] }),
      ),
    ).toThrow('scale');
    expect(() =>
      createSheetLayout(
        sheet({
          viewports: [
            { ...viewport, frame: { x: 15, y: 15, width: 500, height: 20 } },
          ],
        }),
      ),
    ).toThrow('printable area');
    expect(() =>
      createSheetLayout(
        sheet({
          viewports: [
            { ...viewport, frame: { x: 15, y: 240, width: 100, height: 20 } },
          ],
        }),
      ),
    ).toThrow('overlaps');
  });

  it('rejects margins that erase the printable area', () => {
    expect(() =>
      createSheetLayout(
        sheet({ marginsMm: { top: 10, right: 105, bottom: 10, left: 105 } }),
      ),
    ).toThrow('no printable area');
  });

  it('rejects non-finite title-block positions and overlapping template cells', () => {
    expect(() =>
      createSheetLayout(
        sheet({
          titleBlock: {
            ...sheet().titleBlock,
            position: { x: Number.NaN, y: 246 },
          },
        }),
      ),
    ).toThrow('finite coordinates');
    expect(() =>
      resolveTitleBlock(
        {
          ...GENERIC_TITLE_BLOCK_V1,
          id: 'overlapping',
          cells: [
            GENERIC_TITLE_BLOCK_V1.cells[0]!,
            {
              ...GENERIC_TITLE_BLOCK_V1.cells[1]!,
              frame: { x: 10, y: 5, width: 20, height: 10 },
            },
          ],
        },
        {},
      ),
    ).toThrow('overlap');
  });
});
