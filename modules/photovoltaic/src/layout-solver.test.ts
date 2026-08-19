import { describe, expect, it } from 'vitest';
import { solvePvLayout, type PvModuleDefinition } from './layout-solver.js';
import type { RoofSolarSurface } from './solar-surface.js';

const module: PvModuleDefinition = {
  id: 'module-450',
  name: '450 Wp module',
  widthM: 1,
  heightM: 2,
  nominalPowerWp: 450,
  efficiency: 0.22,
  source: { sourceType: 'MANUFACTURER', reference: 'datasheet-v1' },
};

const surface: RoofSolarSurface = {
  id: 'roof',
  sourceRoofFaceId: 'roof-face',
  polygon: {
    outer: [
      { x: 0, y: 0 },
      { x: 10_000, y: 0 },
      { x: 10_000, y: 4_000 },
      { x: 0, y: 4_000 },
    ],
  },
  azimuthDeg: 180,
  tiltDeg: 0,
  obstacles: [],
  exclusionZones: [],
};

describe('photovoltaic layout solver', () => {
  it('implements PV-001: 20 × 450 Wp = 9.0 kWp', () => {
    const result = solvePvLayout({
      surface,
      module,
      orientation: 'LANDSCAPE',
      edgeMarginMm: 0,
      gapMm: 0,
    });
    expect(result.moduleCount).toBe(20);
    expect(result.installedPowerWp).toBe(9_000);
  });

  it('implements PV-002: no module intersects an enabled exclusion', () => {
    const excluded: RoofSolarSurface = {
      ...surface,
      exclusionZones: [
        {
          id: 'reserved',
          enabled: true,
          polygon: {
            outer: [
              { x: 0, y: 0 },
              { x: 2_000, y: 0 },
              { x: 2_000, y: 1_000 },
              { x: 0, y: 1_000 },
            ],
          },
        },
      ],
    };
    const result = solvePvLayout({
      surface: excluded,
      module,
      orientation: 'LANDSCAPE',
      edgeMarginMm: 0,
      gapMm: 0,
    });
    expect(result.moduleCount).toBe(19);
    expect(
      result.placements.some(({ polygon }) =>
        polygon.outer.some(
          ({ x, y }) => x > 0 && x < 2_000 && y > 0 && y < 1_000,
        ),
      ),
    ).toBe(false);
  });

  it('implements PV-003 with deterministic placement and tie-breaking', () => {
    const input = {
      surface,
      module,
      orientation: 'BEST_COUNT' as const,
      edgeMarginMm: 100,
      gapMm: 50,
    };
    expect(solvePvLayout(input)).toEqual(solvePvLayout(input));
    const square: RoofSolarSurface = {
      ...surface,
      polygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 4_000, y: 0 },
          { x: 4_000, y: 4_000 },
          { x: 0, y: 4_000 },
        ],
      },
    };
    expect(
      solvePvLayout({ ...input, surface: square, edgeMarginMm: 0, gapMm: 0 })
        .orientation,
    ).toBe('PORTRAIT');
  });

  it('evaluates portrait and landscape and selects the highest count', () => {
    const narrow: RoofSolarSurface = {
      ...surface,
      polygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 4_000, y: 0 },
          { x: 4_000, y: 3_000 },
          { x: 0, y: 3_000 },
        ],
      },
    };
    const result = solvePvLayout({
      surface: narrow,
      module,
      orientation: 'BEST_COUNT',
      edgeMarginMm: 0,
      gapMm: 0,
    });
    expect(result.orientation).toBe('LANDSCAPE');
    expect(result.moduleCount).toBe(6);
  });

  it('uses roof-plane dimensions for inclined projected geometry', () => {
    const inclined: RoofSolarSurface = {
      ...surface,
      polygon: {
        outer: [
          { x: 0, y: 0 },
          { x: 4_000, y: 0 },
          { x: 4_000, y: 1_500 },
          { x: 0, y: 1_500 },
        ],
      },
      azimuthDeg: 180,
      tiltDeg: 60,
    };
    const result = solvePvLayout({
      surface: inclined,
      module,
      orientation: 'PORTRAIT',
      edgeMarginMm: 0,
      gapMm: 0,
    });
    expect(result.moduleCount).toBe(4);
  });

  it('rejects invalid modules and layout controls', () => {
    expect(() =>
      solvePvLayout({
        surface,
        module: { ...module, nominalPowerWp: 0 },
        orientation: 'PORTRAIT',
        edgeMarginMm: 0,
        gapMm: 0,
      }),
    ).toThrow(/nominal power/);
    expect(() =>
      solvePvLayout({
        surface,
        module,
        orientation: 'PORTRAIT',
        edgeMarginMm: -1,
        gapMm: 0,
      }),
    ).toThrow(/edge margin/);
  });
});
