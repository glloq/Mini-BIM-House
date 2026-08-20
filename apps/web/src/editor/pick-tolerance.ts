import type { Camera2D } from '@house-technical-designer/editor-core';

/**
 * How far a click may miss what it was aiming at, in pixels.
 *
 * The user aims at what is drawn on the screen, so the tolerance belongs to the
 * screen. Held in millimetres it was a different target at every zoom: eight
 * centimetres of slack, generous when the plan filled the window, covered half
 * a room once zoomed out — and picked the wrong object.
 */
const FINE_PICK_PX = 8;

/** A fingertip covers more than a pointer, and knows less precisely where. */
const COARSE_PICK_PX = 18;

/** Model-space tolerance for a pick at the current zoom. */
export function pickToleranceMm(
  camera: Camera2D,
  pointerType?: string,
): number {
  const pixels =
    pointerType === 'touch' || pointerType === 'pen'
      ? COARSE_PICK_PX
      : FINE_PICK_PX;
  const scale = camera.pixelsPerMm;
  // A camera with no scale cannot happen from the reducer, and a division by
  // zero would silently select everything.
  return scale > 0 ? pixels / scale : pixels;
}
