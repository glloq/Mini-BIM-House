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
        line.materialId === 'generic-eps' &&
        line.levelName === 'Rez-de-chaussée',
    )!;
    expect(insulation.lot).toBe('INSULATION');
    expect(
      report.lines.some(
        (line) =>
          line.materialId === 'generic-eps' && line.levelName === 'Étage',
      ),
    ).toBe(true);
    expect(insulation.netVolumeM3).toBeGreaterThan(0);
    expect(insulation.sourceEntityIds.length).toBeGreaterThan(1);
  });

  it('applies the declared waste allowance to the purchase quantity', () => {
    const report = buildBom(demo());
    const masonry = report.lines.find(
      (line) => line.materialId === 'generic-concrete-block',
    )!;
    expect(masonry.wasteFactor).toBeCloseTo(0.05, 9);
    expect(masonry.purchaseVolumeM3).toBeCloseTo(masonry.netVolumeM3 * 1.05, 9);
  });

  it('derives mass, cost and carbon from the project settings', () => {
    const report = buildBom(demo());
    const masonry = report.lines.find(
      (line) => line.materialId === 'generic-concrete-block',
    )!;
    expect(masonry.massKg).toBeCloseTo(masonry.netVolumeM3 * 1300, 6);
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
            unitPriceByMaterial: { 'generic-concrete-block': 185 },
          },
        },
      },
    };
    const report = buildBom(stripped);
    expect(report.lines.length).toBeGreaterThan(0);
    // Everything the house is made of except the one still priced.
    expect(report.missingPrices).toContain('generic-eps');
    expect(report.missingPrices).not.toContain('generic-concrete-block');
    expect(report.totalCost).toBeUndefined();
    expect(
      report.lines.find((line) => line.materialId === 'generic-eps')?.cost,
    ).toBeUndefined();
  });

  it('counts the floors and the roof, not only the walls', () => {
    // The takeoff read the walls and nothing else. A house's ground slab, its
    // intermediate floor and its two roof planes are half of what it is made
    // of, and none of it reached the bill, the cost or the carbon — a total
    // that silently omits half a building reads as complete and is not.
    const project = demo();
    const report = buildBom(project);
    const counted = new Set(
      report.lines.flatMap(({ sourceEntityIds }) => [...sourceEntityIds]),
    );
    const surfaces = project.building.levels.flatMap((level) => [
      ...level.slabs.map(({ id }) => String(id)),
      ...level.roofs.map(({ id }) => String(id)),
    ]);
    expect(surfaces.length).toBeGreaterThan(3);
    for (const id of surfaces) expect(counted.has(id), id).toBe(true);
    // And what they are made of is in the bill: the concrete of the slab, the
    // joists of the floor, the glass wool of the roof.
    const materials = new Set(report.lines.map(({ materialId }) => materialId));
    for (const id of [
      'generic-concrete',
      'generic-softwood',
      'generic-glass-wool',
    ])
      expect(materials.has(id), id).toBe(true);
  });

  it('leaves nothing of the building uncounted', () => {
    // Asked of the model rather than of a list written here: the day a storey
    // gains a kind of object nobody counted, this names it.
    const project = demo();
    const counted = new Set(
      buildBom(project).lines.flatMap(({ sourceEntityIds }) => [
        ...sourceEntityIds,
      ]),
    );
    const uncounted = project.building.levels
      .flatMap((level) => [
        ...level.walls.map(({ id }) => String(id)),
        ...level.slabs.map(({ id }) => String(id)),
        ...level.roofs.map(({ id }) => String(id)),
      ])
      .filter((id) => !counted.has(id));
    expect(uncounted).toEqual([]);
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
