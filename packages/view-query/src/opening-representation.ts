/**
 * How an opening is drawn on a plan.
 *
 * Not what it is — the model says that — but which of the handful of drawings
 * a plan has for a hole in a wall it gets. A sliding door and a hinged door
 * are both `DOOR`, and drawing both with a quarter-circle says the sliding one
 * sweeps a metre of the room it does not.
 *
 * The family of the catalogue entry decides, so the decision is one table
 * rather than a dozen `if (definitionId === …)` scattered through the view.
 */
export type OpeningRepresentation =
  | 'HINGED_DOOR'
  | 'GLAZED_DOOR'
  | 'GLAZED_DOUBLE_DOOR'
  | 'DOUBLE_DOOR'
  | 'SLIDING_DOOR'
  | 'POCKET_DOOR'
  | 'FOLDING_DOOR'
  | 'GARAGE_DOOR'
  | 'GLAZED_CASEMENT'
  | 'GLAZED_FIXED'
  | 'GLAZED_SLIDING'
  | 'GLAZED_BAY'
  | 'PLAIN_VOID';

const BY_FAMILY: Readonly<Record<string, OpeningRepresentation>> = {
  DOOR_SINGLE: 'HINGED_DOOR',
  DOOR_INTERNAL: 'HINGED_DOOR',
  DOOR_EXTERNAL: 'HINGED_DOOR',
  DOOR_FIRE: 'HINGED_DOOR',
  DOOR_SECURITY: 'HINGED_DOOR',
  // Une porte-fenêtre du catalogue est à deux vantaux : un seul vantail de
  // 1,60 m balayerait un mètre six de jardin qu'il ne balaie pas.
  FRENCH_DOOR: 'GLAZED_DOUBLE_DOOR',
  DOOR_DOUBLE: 'DOUBLE_DOOR',
  DOOR_SLIDING: 'SLIDING_DOOR',
  SLIDING_PATIO_DOOR: 'SLIDING_DOOR',
  LIFT_SLIDE_DOOR: 'SLIDING_DOOR',
  DOOR_POCKET: 'POCKET_DOOR',
  POCKET_SLIDING_DOOR: 'POCKET_DOOR',
  DOOR_FOLDING: 'FOLDING_DOOR',
  DOOR_GARAGE: 'GARAGE_DOOR',
  WINDOW_CASEMENT: 'GLAZED_CASEMENT',
  WINDOW_TILT_TURN: 'GLAZED_CASEMENT',
  WINDOW_AWNING: 'GLAZED_CASEMENT',
  WINDOW_HOPPER: 'GLAZED_CASEMENT',
  WINDOW_FIXED: 'GLAZED_FIXED',
  WINDOW_CORNER: 'GLAZED_FIXED',
  WINDOW_ROOF: 'GLAZED_FIXED',
  SKYLIGHT: 'GLAZED_FIXED',
  WINDOW_SLIDING: 'GLAZED_SLIDING',
  WINDOW_DOUBLE_SLIDING: 'GLAZED_SLIDING',
  WINDOW_BAY: 'GLAZED_BAY',
  WINDOW_MULTI_PANEL: 'GLAZED_BAY',
};

/**
 * The drawing an opening gets: from its family, or from the kind it is.
 *
 * An opening whose family this version does not know is still drawn — as the
 * plainest door or window there is, never as nothing.
 */
export function openingRepresentation(
  openingType: string,
  familyId?: string,
): OpeningRepresentation {
  const stated = familyId === undefined ? undefined : BY_FAMILY[familyId];
  if (stated !== undefined) return stated;
  if (openingType === 'DOOR') return 'HINGED_DOOR';
  if (openingType === 'WINDOW') return 'GLAZED_CASEMENT';
  return 'PLAIN_VOID';
}

/** Whether the representation shows a pane of glass. */
export function isGlazedRepresentation(
  representation: OpeningRepresentation,
): boolean {
  return representation.startsWith('GLAZED_');
}
