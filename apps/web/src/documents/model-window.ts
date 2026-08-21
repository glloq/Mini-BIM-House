import type {
  Project,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import { GENERIC_TECHNICAL_SCREEN } from '@house-technical-designer/drawing-engine';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import type { BoundingBox2D } from '@house-technical-designer/geometry';

/** A rectangle of paper, in millimetres. */
export interface PaperFrameMm {
  readonly width: number;
  readonly height: number;
}

/**
 * The model window a frame of paper shows at a stated scale.
 *
 * This is what makes a scale a scale: 1:50 in a 300 mm frame is exactly
 * 15 000 mm of building, never “whatever makes the drawing fit”. Fitting the
 * content to the frame produces a drawing that looks right and measures wrong,
 * and a plan that measures wrong is worse than no plan.
 *
 * Where the window sits comes from the view when the view says; otherwise from
 * the middle of what there is to draw, which is a framing decision and not a
 * measurement.
 */
export function modelWindowOf(
  project: Project,
  view: SavedDrawingView,
  frameMm: PaperFrameMm,
  scaleDenominator = view.scaleDenominator,
): BoundingBox2D {
  const width = frameMm.width * scaleDenominator;
  const height = frameMm.height * scaleDenominator;
  const centre = view.centreMm ?? contentCentreOf(project, view);
  return {
    min: { x: centre.x - width / 2, y: centre.y - height / 2 },
    max: { x: centre.x + width / 2, y: centre.y + height / 2 },
  };
}

export function contentCentreOf(
  project: Project,
  view: SavedDrawingView,
): { readonly x: number; readonly y: number } {
  const { viewport } = planOf(project, view).view;
  return {
    x: (viewport.min.x + viewport.max.x) / 2,
    y: (viewport.min.y + viewport.max.y) / 2,
  };
}

export function planOf(
  project: Project,
  view: SavedDrawingView,
  viewport?: BoundingBox2D,
) {
  return buildPlanView(project, {
    ...(view.levelId === undefined ? {} : { levelId: view.levelId }),
    layers: { ...defaultVisibility(), ...view.layers },
    graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
    scale: view.scaleDenominator,
    ...(viewport === undefined ? {} : { viewport }),
  });
}
