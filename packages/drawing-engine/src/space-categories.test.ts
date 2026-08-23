import { describe, expect, it } from 'vitest';

import {
  SPACE_GRAPHIC_CATEGORIES,
  spaceGraphicCategory,
} from './space-categories.js';

describe('the graphic category of a room', () => {
  it('reads the values the interface offers', () => {
    expect(spaceGraphicCategory('BEDROOM')).toBe('BEDROOM');
    expect(spaceGraphicCategory('LIVING')).toBe('LIVING');
    expect(spaceGraphicCategory('KITCHEN')).toBe('KITCHEN');
    expect(spaceGraphicCategory('BATHROOM')).toBe('BATHROOM');
    expect(spaceGraphicCategory('WC')).toBe('WC');
    expect(spaceGraphicCategory('HALL')).toBe('CIRCULATION');
    expect(spaceGraphicCategory('CORRIDOR')).toBe('CIRCULATION');
    expect(spaceGraphicCategory('STORAGE')).toBe('STORAGE');
    expect(spaceGraphicCategory('GARAGE')).toBe('GARAGE');
    expect(spaceGraphicCategory('TECHNICAL')).toBe('TECHNICAL');
    expect(spaceGraphicCategory('OTHER')).toBe('OTHER');
  });

  it('levels accents, case and punctuation', () => {
    // « Salle-de-bains » and « SALLE DE BAINS » are one colour on a plan and
    // would be two keys in a style table written by hand.
    for (const written of [
      'Salle de bains',
      'SALLE-DE-BAINS',
      'salle_de_bains',
      '  Salle  De  Bains  ',
    ])
      expect(spaceGraphicCategory(written)).toBe('BATHROOM');
    expect(spaceGraphicCategory('Dégagement')).toBe('CIRCULATION');
    expect(spaceGraphicCategory('Séjour')).toBe('LIVING');
  });

  it('keeps a room whose use it does not know as a room', () => {
    // An unknown use stays unknown: it is drawn as a room, not as whatever the
    // table happened to list last.
    expect(spaceGraphicCategory('SALLE DE JEUX')).toBe('OTHER');
    expect(spaceGraphicCategory('')).toBe('OTHER');
    expect(spaceGraphicCategory(undefined)).toBe('OTHER');
    expect(spaceGraphicCategory(null)).toBe('OTHER');
  });

  it('tells a kitchen open on the living room from either of them', () => {
    expect(spaceGraphicCategory('Séjour cuisine')).toBe('LIVING_KITCHEN');
    expect(spaceGraphicCategory('Cuisine')).toBe('KITCHEN');
    expect(spaceGraphicCategory('Séjour')).toBe('LIVING');
  });

  it('answers with one of the categories it declares', () => {
    for (const written of [
      'BEDROOM',
      'Buanderie',
      'Bureau',
      'Cellier',
      'Local technique',
      'Carport',
      'n’importe quoi',
    ])
      expect(SPACE_GRAPHIC_CATEGORIES).toContain(spaceGraphicCategory(written));
  });
});
