import { describe, expect, it } from 'vitest';

import {
  draftMeasureLabel,
  draftMeasures,
  lengthLabel,
} from './draft-measures.js';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 30_000, y: 0 },
  { x: 30_000, y: 25_000 },
  { x: 0, y: 25_000 },
];

describe('draftMeasures', () => {
  it('ne mesure rien tant qu’il n’y a qu’un point', () => {
    expect(draftMeasures([], 'CLOSE_POLYGON')).toBeUndefined();
    expect(draftMeasures([SQUARE[0]!], 'CLOSE_POLYGON')).toBeUndefined();
  });

  it('donne la longueur parcourue pour un chemin, sans aire', () => {
    const measures = draftMeasures(SQUARE.slice(0, 3), 'FINISH_PATH');
    expect(measures).toEqual({ perimeterMm: 55_000 });
  });

  it('ferme le contour d’une surface : 30 × 25 fait 750 m²', () => {
    const measures = draftMeasures(SQUARE, 'CLOSE_POLYGON');
    expect(measures?.areaM2).toBeCloseTo(750, 6);
    expect(measures?.perimeterMm).toBeCloseTo(110_000, 6);
  });

  it('compte le retour au premier sommet, qu’il soit cliqué ou non', () => {
    const two = draftMeasures(SQUARE.slice(0, 2), 'CLOSE_POLYGON');
    // Aller et retour : le contour d'une surface se referme toujours.
    expect(two).toEqual({ perimeterMm: 60_000 });
    expect(two?.areaM2).toBeUndefined();
  });

  it('n’écrit rien pour un tracé qui ne mesure rien', () => {
    const nowhere = [
      { x: 4000, y: 4000 },
      { x: 4000, y: 4000 },
    ];
    expect(draftMeasures(nowhere, 'CLOSE_POLYGON')).toBeUndefined();
    expect(draftMeasures(nowhere, 'FINISH_PATH')).toBeUndefined();
  });

  it('n’écrit pas une aire nulle pour trois points alignés', () => {
    const flat = draftMeasures(
      [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 2000, y: 0 },
      ],
      'CLOSE_POLYGON',
    );
    expect(flat?.areaM2).toBeUndefined();
    expect(flat?.perimeterMm).toBeCloseTo(4000, 6);
  });
});

describe('les libellés', () => {
  it('écrit les mètres avec une virgule', () => {
    expect(lengthLabel(110_000)).toBe('110,00 m');
  });

  it('met l’aire devant, parce que c’est ce qu’on trace', () => {
    expect(draftMeasureLabel(draftMeasures(SQUARE, 'CLOSE_POLYGON')!)).toBe(
      '750,00 m² · 110,00 m',
    );
    expect(
      draftMeasureLabel(draftMeasures(SQUARE.slice(0, 3), 'FINISH_PATH')!),
    ).toBe('55,00 m');
  });
});
