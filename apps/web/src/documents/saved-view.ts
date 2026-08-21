import type {
  Project,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import { GENERIC_TECHNICAL_SCREEN } from '@house-technical-designer/drawing-engine';
import { defaultVisibility } from '@house-technical-designer/view-query';
import {
  overlayOption,
  type OverlayId,
} from '../calculations/overlay-source.js';
import { modelWindowOf } from './model-window.js';

/**
 * How many CSS pixels make a millimetre of paper.
 *
 * A CSS pixel is one ninety-sixth of an inch by definition, so this is the
 * bridge between a scale — a denominator — and a zoom.
 */
export const CSS_PIXELS_PER_MM = 96 / 25.4;

/** The zoom a stated scale asks for, and the scale a zoom amounts to. */
export function pixelsPerMmForScale(scaleDenominator: number): number {
  return CSS_PIXELS_PER_MM / scaleDenominator;
}

export function scaleDenominatorForZoom(pixelsPerMm: number): number {
  // A zoom that is not a number says nothing about a scale; 1:50 is what a
  // house plan is drawn at, and it is stated rather than derived from nothing.
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) return 50;
  // Never below 1:1 — a drawing cannot be larger than the building.
  return Math.max(1, Math.round(CSS_PIXELS_PER_MM / pixelsPerMm));
}

/**
 * Everything the plan has to be put back to for a saved view to be that view.
 *
 * A view used to come back as its storey and whichever of its layers were on —
 * `SHOW_LAYERS` never hides — so a view saved with the networks off reappeared
 * with them on, at whatever zoom the user happened to be at, with whichever
 * analysis was showing. It was a different drawing wearing the same name.
 *
 * Everything it cannot restore is named rather than passed over: a storey that
 * was deleted, an analysis this version no longer offers, a kind of view the
 * plan cannot draw. A view that comes back wrong in silence is worse than one
 * that says what it lost.
 */
export interface RestoredView {
  readonly levelId?: string;
  /** Every layer, on or off, exactly as the view had them. */
  readonly layers: Readonly<Record<string, boolean>>;
  readonly centreMm: Point2D;
  readonly pixelsPerMm: number;
  readonly overlayId: OverlayId;
  /** What the view asked for and the project can no longer give. */
  readonly unresolved: readonly string[];
}

export function restoredView(
  project: Project,
  view: SavedDrawingView,
): RestoredView {
  const unresolved: string[] = [];

  const level =
    view.levelId === undefined
      ? undefined
      : project.building.levels.find(({ id }) => id === view.levelId);
  if (view.levelId !== undefined && level === undefined)
    unresolved.push(
      `le niveau ${view.levelId}, qui n’est plus dans le projet — le plan reste sur le niveau courant`,
    );

  // A view is drawn by the plan, and the plan draws plans. The other kinds are
  // kept in the file — a section is a decision worth keeping — and saying so is
  // what keeps « ouvrir la vue » from silently opening a plan instead.
  if (view.type !== 'PLAN')
    unresolved.push(
      `le type ${view.type}, que le plan ne dessine pas encore — seuls le niveau, les calques et le cadrage sont rétablis`,
    );

  if (view.graphicProfileId !== GENERIC_TECHNICAL_SCREEN.profile.id)
    unresolved.push(
      `la charte graphique ${view.graphicProfileId}, que cette version ne connaît pas`,
    );

  const overlay =
    view.analysisOverlayId === undefined
      ? undefined
      : overlayOption(view.analysisOverlayId);
  if (view.analysisOverlayId !== undefined && overlay === undefined)
    unresolved.push(
      `l’analyse ${view.analysisOverlayId}, que cette version n’affiche plus`,
    );

  return {
    ...(level === undefined ? {} : { levelId: level.id }),
    // Every layer the application knows, then what the view said about it: a
    // layer the view never mentioned takes its ordinary state rather than
    // disappearing.
    layers: { ...defaultVisibility(), ...view.layers },
    centreMm: centreOf(project, view),
    pixelsPerMm: pixelsPerMmForScale(view.scaleDenominator),
    overlayId: (overlay?.id ?? 'none') as OverlayId,
    unresolved,
  };
}

/**
 * Where the view is centred: what it says, or the middle of what it draws.
 *
 * A view saved before centres were recorded has no centre, and framing its
 * content is the only honest answer — it is a framing decision, not a
 * measurement, which is why the scale is never derived from it.
 */
function centreOf(project: Project, view: SavedDrawingView): Point2D {
  if (view.centreMm !== undefined) return view.centreMm;
  const window = modelWindowOf(project, view, { width: 1, height: 1 });
  return {
    x: (window.min.x + window.max.x) / 2,
    y: (window.min.y + window.max.y) / 2,
  };
}
