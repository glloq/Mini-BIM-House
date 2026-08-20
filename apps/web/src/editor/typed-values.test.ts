import { describe, expect, it } from 'vitest';
import {
  draftedMeasures,
  parseAngleDeg,
  parseLengthMm,
} from './typed-values.js';

describe('a length typed while drawing', () => {
  it('reads the unit the person was thinking in', () => {
    expect(parseLengthMm('4200')).toBe(4200);
    expect(parseLengthMm('4.2m')).toBe(4200);
    expect(parseLengthMm('4,2 m')).toBe(4200);
    expect(parseLengthMm('420cm')).toBe(4200);
    expect(parseLengthMm('42 dm')).toBe(4200);
    expect(parseLengthMm('4200 mm')).toBe(4200);
  });

  it('refuses what it cannot read rather than guessing', () => {
    // A length nobody meant is worse than no length at all.
    expect(parseLengthMm('')).toBeUndefined();
    expect(parseLengthMm('quatre mètres')).toBeUndefined();
    expect(parseLengthMm('4200 pouces')).toBeUndefined();
    expect(parseLengthMm('0')).toBeUndefined();
    expect(parseLengthMm('-1200')).toBeUndefined();
  });

  it('reads an angle with or without its degree sign', () => {
    expect(parseAngleDeg('90')).toBe(90);
    expect(parseAngleDeg('-45,5°')).toBe(-45.5);
    expect(parseAngleDeg('')).toBeUndefined();
    expect(parseAngleDeg('nord')).toBeUndefined();
  });

  it('measures what is being drafted as the user reads it', () => {
    const measures = draftedMeasures({ x: 0, y: 0 }, { x: 3000, y: 0 });
    expect(measures.lengthMm).toBe(3000);
    expect(measures.angleDeg).toBe(0);
    expect(draftedMeasures({ x: 0, y: 0 }, { x: 0, y: 1000 }).angleDeg).toBe(
      90,
    );
  });
});
