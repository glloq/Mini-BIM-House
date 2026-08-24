import { describe, expect, it } from 'vitest';
import type { Camera2D } from '@house-technical-designer/editor-core';

import {
  gridStepLabel,
  gridStepMm,
  isMajor,
  majorStepMm,
  modelGrid,
} from './model-grid.js';

const camera = (overrides: Partial<Camera2D> = {}): Camera2D => ({
  centerModelMm: { x: 0, y: 0 },
  pixelsPerMm: 0.05,
  viewportWidthPx: 800,
  viewportHeightPx: 600,
  ...overrides,
});

describe('le pas de la grille', () => {
  it('reste un nombre qu’une règle porte', () => {
    // Un pas de 37 mm serait exact et illisible : l'échelle est celle d'un
    // mètre-ruban, un-deux-cinq et les mêmes dix fois plus grand.
    for (const zoom of [0.005, 0.02, 0.05, 0.2, 0.5, 1, 3]) {
      const step = gridStepMm(zoom);
      const decade = 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5], `${zoom}`).toContain(Math.round(step / decade));
    }
  });

  it('s’élargit quand on dézoome, et jamais l’inverse', () => {
    const zooms = [0.005, 0.01, 0.05, 0.2, 1];
    const steps = zooms.map((zoom) => gridStepMm(zoom));
    for (let index = 1; index < steps.length; index += 1)
      expect(steps[index]!).toBeLessThanOrEqual(steps[index - 1]!);
  });

  it('garde deux lignes assez écartées pour qu’on les distingue', () => {
    // En dessous, la grille cesse d'être un repère : c'est un aplat.
    for (const zoom of [0.01, 0.05, 0.1, 0.4, 2])
      expect(gridStepMm(zoom) * zoom, `${zoom}`).toBeGreaterThanOrEqual(9);
  });

  it('donne un pas fort qui est lui aussi un nombre rond', () => {
    expect(majorStepMm(100)).toBe(1000);
    expect(majorStepMm(200)).toBe(1000);
    expect(majorStepMm(500)).toBe(5000);
    expect(majorStepMm(1000)).toBe(10_000);
  });
});

describe('la grille dans le cadre', () => {
  it('fait passer une ligne exactement par l’origine', () => {
    // C'est le point du modèle, pas un coin du cadre : une grille alignée sur
    // le cadre se décale dès qu'on déplace le plan.
    const grid = modelGrid(camera());
    expect(grid.verticals.some(({ atMm }) => atMm === 0)).toBe(true);
    expect(grid.horizontals.some(({ atMm }) => atMm === 0)).toBe(true);
    expect(grid.originPx).toEqual({ x: 400, y: 300 });
  });

  it('suit le plan quand on le déplace, du même nombre de pixels', () => {
    const still = modelGrid(camera());
    const moved = modelGrid(camera({ centerModelMm: { x: 2000, y: 0 } }));
    const zero = (lines: readonly { atMm: number; atPx: number }[]) =>
      lines.find(({ atMm }) => atMm === 0)!.atPx;
    // 2 000 mm à 0,05 px/mm : cent pixels vers la gauche, exactement.
    expect(zero(still.verticals) - zero(moved.verticals)).toBeCloseTo(100, 6);
  });

  it('suit le zoom : un carreau vaut toujours la même longueur réelle', () => {
    const grid = modelGrid(camera({ pixelsPerMm: 0.2 }));
    const [first, second] = grid.verticals;
    expect(second!.atPx - first!.atPx).toBeCloseTo(grid.minorMm * 0.2, 6);
    expect(second!.atMm - first!.atMm).toBe(grid.minorMm);
  });

  it('couvre le cadre de bord à bord, sans le déborder d’un carreau', () => {
    const grid = modelGrid(camera());
    for (const line of grid.verticals) {
      expect(line.atPx).toBeGreaterThanOrEqual(-1e-6);
      expect(line.atPx).toBeLessThanOrEqual(800 + 1e-6);
    }
    const spacingPx = grid.minorMm * 0.05;
    expect(grid.verticals[0]!.atPx).toBeLessThan(spacingPx + 1e-6);
    expect(grid.verticals.at(-1)!.atPx).toBeGreaterThan(800 - spacingPx - 1e-6);
  });

  it('ne dit plus où est l’origine quand elle est hors du cadre', () => {
    const away = modelGrid(camera({ centerModelMm: { x: 900_000, y: 0 } }));
    expect(away.originPx).toBeUndefined();
    // Et elle reste alignée sur elle : les millimètres restent des multiples.
    for (const line of away.verticals)
      expect(Math.abs(line.atMm % away.minorMm)).toBeLessThan(1e-6);
  });

  it('marque une ligne sur cinq ou sur dix, jamais entre deux', () => {
    const grid = modelGrid(camera());
    const majors = grid.verticals.filter((line) => isMajor(line, grid.majorMm));
    expect(majors.length).toBeGreaterThan(0);
    for (const line of majors)
      expect(Math.abs(line.atMm % grid.majorMm)).toBeLessThan(1e-6);
  });

  it('ne dessine pas plus de lignes qu’un écran n’en porte', () => {
    const grid = modelGrid(camera({ viewportWidthPx: 100_000 }));
    expect(grid.verticals.length).toBeLessThanOrEqual(400);
  });
});

describe('ce que le carreau mesure, écrit', () => {
  it('se lit en centimètres puis en mètres', () => {
    expect(gridStepLabel(100)).toBe('10 cm');
    expect(gridStepLabel(500)).toBe('50 cm');
    expect(gridStepLabel(1000)).toBe('1 m');
    expect(gridStepLabel(2000)).toBe('2 m');
    expect(gridStepLabel(500_000)).toBe('500 m');
  });
});
