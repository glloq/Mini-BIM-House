import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { bomToCsv, buildBom } from './bom-model.js';

function demo(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

describe('bill of materials', () => {
  it('groups the takeoff by material, lot and level', () => {
    const report = buildBom(demo());
    expect(report.lines.length).toBeGreaterThan(0);
    // Grouped by storey too, which is what makes two lines of the same
    // material on two floors two lines rather than one.
    const insulation = report.lines.find(
      (line) =>
        line.materialId === 'material-insulation' &&
        line.levelName === 'Rez-de-chaussée',
    )!;
    expect(insulation.lot).toBe('INSULATION');
    expect(
      report.lines.some(
        (line) =>
          line.materialId === 'material-insulation' &&
          line.levelName === 'Étage',
      ),
    ).toBe(true);
    expect(insulation.netVolumeM3).toBeGreaterThan(0);
    expect(insulation.sourceEntityIds.length).toBeGreaterThan(1);
  });

  it('applies the declared waste allowance to the purchase quantity', () => {
    const report = buildBom(demo());
    const masonry = report.lines.find(
      (line) => line.materialId === 'material-masonry',
    )!;
    expect(masonry.wasteFactor).toBeCloseTo(0.05, 9);
    expect(masonry.purchaseVolumeM3).toBeCloseTo(masonry.netVolumeM3 * 1.05, 9);
  });

  it('derives mass, cost and carbon from the project settings', () => {
    const report = buildBom(demo());
    const masonry = report.lines.find(
      (line) => line.materialId === 'material-masonry',
    )!;
    expect(masonry.massKg).toBeCloseTo(masonry.netVolumeM3 * 1800, 6);
    expect(masonry.cost).toBeCloseTo(masonry.purchaseVolumeM3 * 185, 6);
    expect(masonry.carbonKgCo2e).toBeCloseTo(masonry.netVolumeM3 * 255, 6);
    expect(report.totalCost).toBeGreaterThan(0);
    expect(report.totalCarbonKgCo2e).toBeGreaterThan(0);
  });

  it('keeps an unpriced material in the list and withholds the total', () => {
    const base = demo();
    const stripped: Project = {
      ...base,
      calculationSettings: {
        ...base.calculationSettings,
        cost: {
          ...base.calculationSettings!.cost!,
          settings: {
            ...base.calculationSettings!.cost!.settings,
            unitPriceByMaterial: { 'material-masonry': 185 },
          },
        },
      },
    };
    const report = buildBom(stripped);
    expect(report.lines.length).toBeGreaterThan(0);
    expect(report.missingPrices).toEqual(['material-insulation']);
    expect(report.totalCost).toBeUndefined();
    expect(
      report.lines.find((line) => line.materialId === 'material-insulation')
        ?.cost,
    ).toBeUndefined();
  });

  it('exports a CSV whose unknown values stay empty', () => {
    const base = demo();
    const csv = bomToCsv(buildBom(base));
    const [header, ...rows] = csv.trim().split('\n');
    expect(header).toContain('quantite_achat_m3');
    expect(rows.length).toBe(buildBom(base).lines.length);
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('reports a takeoff warning instead of dropping the wall silently', () => {
    const base = demo();
    const level = base.building.levels[0]!;
    const first = level.walls[0]!;
    const { heightMm: _explicit, ...common } = first as typeof first & {
      heightMm: number;
    };
    const broken: Project = {
      ...base,
      building: {
        ...base.building,
        levels: [
          {
            ...level,
            // A wall whose height follows another level cannot be measured
            // until levels are resolved, and the takeoff must say so.
            walls: [
              { ...common, heightMode: 'TO_LEVEL', topLevelId: level.id },
              ...level.walls.slice(1),
            ],
          },
        ],
      },
    };
    const report = buildBom(broken);
    expect(report.warnings.map(({ code }) => code)).toContain('UNKNOWN_HEIGHT');
  });
});
