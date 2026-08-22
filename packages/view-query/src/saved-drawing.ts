import type {
  Project,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import type {
  DrawingView,
  ScenePrimitive,
  SemanticScene,
} from '@house-technical-designer/drawing-engine';
import type { BoundingBox2D } from '@house-technical-designer/geometry';
import { buildPlanView } from './plan-view.js';
import {
  buildElevationView,
  buildEmptyView,
  buildRoofView,
  buildSectionView,
  buildSiteView,
  type SectionViewIssue,
} from './section-view.js';
import { defaultVisibility } from './layers.js';

/** A drawing built from a saved view, whatever kind of view it is. */
export interface BuiltDrawing {
  readonly view: DrawingView;
  readonly scene: SemanticScene;
  readonly primitives: readonly ScenePrimitive[];
  readonly issues: readonly SectionViewIssue[];
}

export interface BuiltDrawingOptions {
  readonly viewport?: BoundingBox2D;
  readonly extraPrimitives?: readonly ScenePrimitive[];
}

/**
 * The drawing a saved view names, built from the model.
 *
 * One place decides what a saved view draws. Before it, everything that
 * rendered a view called `buildPlanView` — the canvas, the sheet, the PDF —
 * so a view saved as a section came back as a plan of a storey, on paper, in
 * a drawing set, without one word saying so.
 *
 * Nothing here is persisted: a view reopened after a wall moved shows the wall
 * where it is now, and a section reopened after the same move is cut through
 * the wall's new place.
 */
export function buildSavedDrawing(
  project: Project,
  view: SavedDrawingView,
  options: BuiltDrawingOptions = {},
): BuiltDrawing {
  const shared = {
    scale: view.scaleDenominator,
    graphicProfileId: view.graphicProfileId,
    viewId: view.id,
    ...(options.viewport === undefined ? {} : { viewport: options.viewport }),
    ...(options.extraPrimitives === undefined
      ? {}
      : { extraPrimitives: options.extraPrimitives }),
  };
  const depth =
    view.viewDepthMm === undefined ? {} : { depthMm: view.viewDepthMm };
  const range =
    view.verticalRangeMm === undefined
      ? {}
      : { verticalRangeMm: view.verticalRangeMm };

  switch (view.type) {
    case 'SECTION':
      // A section without its line is a section nobody can reopen; the file
      // now refuses to hold one, and a file written before it did says so
      // rather than being drawn as something else.
      if (view.cut === undefined)
        return buildEmptyView('SECTION', shared, [
          {
            code: 'VIEW_SECTION_WITHOUT_CUT',
            objectId: view.id,
            message:
              'Cette coupe ne dit pas où elle coupe : elle ne peut pas être redessinée.',
          },
        ]);
      return buildSectionView(
        project,
        {
          line: { start: view.cut.start, end: view.cut.end },
          ...depth,
          ...range,
        },
        shared,
      );
    case 'ELEVATION':
      if (view.viewDirectionDeg === undefined)
        return buildEmptyView('ELEVATION', shared, [
          {
            code: 'VIEW_ELEVATION_WITHOUT_DIRECTION',
            objectId: view.id,
            message:
              'Cette façade ne dit pas d’où elle est vue : elle ne peut pas être redessinée.',
          },
        ]);
      return buildElevationView(
        project,
        { azimuthDeg: view.viewDirectionDeg, ...depth, ...range },
        shared,
      );
    case 'ROOF':
      return buildRoofView(project, shared);
    case 'SITE':
      return buildSiteView(project, shared);
    case 'PLAN':
      return planDrawing(project, view, options);
  }
}

function planDrawing(
  project: Project,
  view: SavedDrawingView,
  options: BuiltDrawingOptions,
): BuiltDrawing {
  const result = buildPlanView(project, {
    ...(view.levelId === undefined ? {} : { levelId: view.levelId }),
    layers: { ...defaultVisibility(), ...view.layers },
    graphicProfileId: view.graphicProfileId,
    scale: view.scaleDenominator,
    ...(options.viewport === undefined ? {} : { viewport: options.viewport }),
    ...(options.extraPrimitives === undefined
      ? {}
      : { extraPrimitives: options.extraPrimitives }),
  });
  return {
    view: result.view,
    scene: result.scene,
    primitives: result.primitives,
    issues: result.issues,
  };
}
