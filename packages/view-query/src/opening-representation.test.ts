import { describe, expect, it } from 'vitest';

import {
  isGlazedRepresentation,
  openingRepresentation,
} from './opening-representation.js';

describe('the drawing an opening gets', () => {
  it('reads the family of the catalogue entry, not its identifier', () => {
    // A sliding door and a hinged door are both DOOR, and drawing both with a
    // quarter-circle says the sliding one sweeps a metre of room it does not.
    expect(openingRepresentation('DOOR', 'DOOR_SINGLE')).toBe('HINGED_DOOR');
    expect(openingRepresentation('DOOR', 'DOOR_SLIDING')).toBe('SLIDING_DOOR');
    expect(openingRepresentation('DOOR', 'DOOR_POCKET')).toBe('POCKET_DOOR');
    expect(openingRepresentation('DOOR', 'DOOR_DOUBLE')).toBe('DOUBLE_DOOR');
    expect(openingRepresentation('DOOR', 'DOOR_FOLDING')).toBe('FOLDING_DOOR');
    expect(openingRepresentation('DOOR', 'DOOR_GARAGE')).toBe('GARAGE_DOOR');
    expect(openingRepresentation('DOOR', 'FRENCH_DOOR')).toBe('GLAZED_DOOR');
    expect(openingRepresentation('WINDOW', 'WINDOW_FIXED')).toBe(
      'GLAZED_FIXED',
    );
    expect(openingRepresentation('WINDOW', 'WINDOW_TILT_TURN')).toBe(
      'GLAZED_CASEMENT',
    );
    expect(openingRepresentation('WINDOW', 'WINDOW_SLIDING')).toBe(
      'GLAZED_SLIDING',
    );
    expect(openingRepresentation('WINDOW', 'WINDOW_BAY')).toBe('GLAZED_BAY');
  });

  it('draws an opening whose family it does not know, rather than nothing', () => {
    expect(openingRepresentation('DOOR', 'DOOR_FROM_2031')).toBe('HINGED_DOOR');
    expect(openingRepresentation('WINDOW')).toBe('GLAZED_CASEMENT');
    expect(openingRepresentation('VOID')).toBe('PLAIN_VOID');
    expect(openingRepresentation('OTHER', 'ROLLER_SHUTTER')).toBe('PLAIN_VOID');
  });

  it('knows which representations show a pane of glass', () => {
    expect(isGlazedRepresentation('GLAZED_BAY')).toBe(true);
    expect(isGlazedRepresentation('HINGED_DOOR')).toBe(false);
    expect(isGlazedRepresentation('PLAIN_VOID')).toBe(false);
  });
});
