/**
 * The film of still air on each face of a wall, and why it is not one number.
 *
 * Rsi 0,13 and Rse 0,04 are the horizontal case. They were applied to every
 * element, so a floor slab, a ceiling and a façade all had the same films —
 * and heat does not leave a house the same way through the floor as through
 * the walls. ISO 6946 gives three directions of flow, and a boundary that is
 * not the outside gives a fourth case:
 *
 * - **horizontal** (walls, windows, doors) — Rsi 0,13, Rse 0,04
 * - **upward** (roofs, ceilings) — Rsi 0,10, Rse 0,04
 * - **downward** (floors) — Rsi 0,17, Rse 0,04
 * - **onto the ground** — no external film at all: the slab meets earth, and
 *   what is on the other side is a ground model, not a breeze
 * - **onto an unheated space** — an *internal* surface on both sides, so the
 *   outer film is the inner one of the same direction
 *
 * These are stated values with a reference, not fitted constants: whoever
 * reads a U-value can find out where its two films came from.
 */

export const SURFACE_RESISTANCE_REFERENCE =
  'ISO 6946:2017, tableau 1 — résistances superficielles';

/** Which way the heat goes through an element, which is what decides Rsi. */
export type HeatFlowDirection = 'HORIZONTAL' | 'UPWARD' | 'DOWNWARD';

/** What is on the far side of the element. */
export type SurfaceBoundary = 'EXTERIOR' | 'GROUND' | 'UNHEATED';

export interface SurfaceResistances {
  readonly insideSurfaceResistanceM2KW: number;
  readonly outsideSurfaceResistanceM2KW: number;
  readonly direction: HeatFlowDirection;
  readonly boundary: SurfaceBoundary;
  readonly reference: string;
}

const INSIDE: Readonly<Record<HeatFlowDirection, number>> = {
  HORIZONTAL: 0.13,
  UPWARD: 0.1,
  DOWNWARD: 0.17,
};

const OUTSIDE_EXTERIOR = 0.04;

/**
 * Which way the heat goes, from what the element is.
 *
 * A roof and a ceiling send it up, a ground floor sends it down, everything
 * vertical sends it sideways.
 */
export function heatFlowDirection(kind: string): HeatFlowDirection {
  switch (kind) {
    case 'ROOF':
    case 'CEILING':
      return 'UPWARD';
    case 'FLOOR_GROUND':
      return 'DOWNWARD';
    default:
      return 'HORIZONTAL';
  }
}

export function surfaceResistances(
  kind: string,
  boundary: SurfaceBoundary,
): SurfaceResistances {
  const direction = heatFlowDirection(kind);
  const inside = INSIDE[direction];
  const outside =
    boundary === 'GROUND'
      ? // Earth is not air: the slab has no external film, and what happens
        // below it is a ground model this application does not yet have. The
        // U-value it produces is therefore of the construction alone, and the
        // result says so rather than adding a breeze under the floor.
        0
      : boundary === 'UNHEATED'
        ? // Both faces are indoors. A ceiling under a roof space is not
          // exposed to wind, and giving it Rse 0,04 makes it lose more than it
          // does.
          inside
        : OUTSIDE_EXTERIOR;
  return {
    insideSurfaceResistanceM2KW: inside,
    outsideSurfaceResistanceM2KW: outside,
    direction,
    boundary,
    reference: SURFACE_RESISTANCE_REFERENCE,
  };
}
