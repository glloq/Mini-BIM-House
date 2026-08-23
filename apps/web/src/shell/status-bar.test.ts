import { describe, expect, it } from 'vitest';

import { gridLabel, scaleLabel } from './status-bar-labels.js';

describe('what the bottom edge writes', () => {
  it('says a grid step the way a hand says it', () => {
    // « 100 mm » est juste et ne se lit pas ; « 10 cm » se lit.
    expect(gridLabel(100)).toBe('10 cm');
    expect(gridLabel(500)).toBe('50 cm');
    expect(gridLabel(1000)).toBe('1 m');
    expect(gridLabel(2500)).toBe('2.50 m');
    // En dessous du centimètre, le millimètre reste le mot juste.
    expect(gridLabel(5)).toBe('5 mm');
    expect(gridLabel(25)).toBe('25 mm');
  });

  it('says a scale the way a plan carries it', () => {
    // Un écran ordinaire à 96 points par pouce : un pixel vaut 0,2646 mm.
    expect(scaleLabel(1 / 13.229)).toBe('1:50');
    expect(scaleLabel(1 / 26.458)).toBe('1:100');
    // Une échelle qu'aucun rapport entier ne décrit ne se raconte pas.
    expect(scaleLabel(1e9)).toBe('—');
  });
});
