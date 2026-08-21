import type {
  Project,
  ProjectSheet,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import {
  GENERIC_TECHNICAL_SCREEN,
  GENERIC_TITLE_BLOCK_V1,
  createSheetLayout,
  paperSizeFor,
  renderSemanticSceneToSvg,
  renderSheetToSvg,
  type RenderedViewport,
  type SheetDefinition,
  type SheetLayout,
} from '@house-technical-designer/drawing-engine';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import type { BoundingBox2D } from '@house-technical-designer/geometry';

/** Where the title block sits on a sheet: bottom right, inside the margins. */
const MARGINS_MM = { top: 10, right: 10, bottom: 10, left: 10 };

/**
 * The sheet as the drawing engine understands it.
 *
 * The project holds the choices — format, orientation, which view goes where —
 * and the engine builds the layout from them and from a title block template
 * the application supplies. What the title block says is derived from the
 * project each time: a project renamed is a title block renamed.
 */
export function sheetDefinitionOf(
  project: Project,
  sheet: ProjectSheet,
): SheetDefinition {
  const paper = paperSizeFor(sheet.format, sheet.orientation);
  const template = GENERIC_TITLE_BLOCK_V1;
  const position = {
    x: paper.width - MARGINS_MM.right - template.size.width,
    y: paper.height - MARGINS_MM.bottom - template.size.height,
  };
  return {
    id: sheet.id,
    number: sheet.number,
    format: sheet.format,
    orientation: sheet.orientation,
    marginsMm: MARGINS_MM,
    viewports: sheet.viewports.map((viewport) => ({
      id: viewport.id,
      drawingViewId:
        viewport.viewId as SheetDefinition['viewports'][number]['drawingViewId'],
      scaleDenominator: viewport.scaleDenominator,
      frame: {
        x: viewport.x,
        y: viewport.y,
        width: viewport.width,
        height: viewport.height,
      },
      title:
        (project.drawingViews ?? []).find(({ id }) => id === viewport.viewId)
          ?.name ?? viewport.viewId,
    })),
    titleBlock: {
      template,
      // A cell the project cannot fill is left out and drawn as unknown:
      // writing a plausible value into a printed drawing is how a drawing
      // stops being evidence.
      values: {
        PROJECT_NAME: project.metadata.name,
        DRAWING_TITLE: sheet.title,
        DRAWING_NUMBER: sheet.number,
        ...(sheet.revision === undefined ? {} : { REVISION: sheet.revision }),
        ...(project.metadata.author === undefined
          ? {}
          : { AUTHOR: project.metadata.author }),
        UNIT: 'mm',
      },
      position,
    },
    ...(sheet.notes === undefined ? {} : { notes: sheet.notes }),
  };
}

export function sheetLayoutOf(
  project: Project,
  sheet: ProjectSheet,
): SheetLayout {
  return createSheetLayout(sheetDefinitionOf(project, sheet));
}

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

function contentCentreOf(
  project: Project,
  view: SavedDrawingView,
): { readonly x: number; readonly y: number } {
  const { viewport } = planOf(project, view).view;
  return {
    x: (viewport.min.x + viewport.max.x) / 2,
    y: (viewport.min.y + viewport.max.y) / 2,
  };
}

function planOf(
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

/**
 * Renders one saved view, exactly as the plan renders it.
 *
 * A sheet that drew the model a second way would be a second drawing engine,
 * and the two would eventually disagree.
 *
 * Given a paper frame, the view is drawn at its stated scale and nothing else:
 * the model window is computed from the frame and the scale. Without a frame —
 * a preview on screen — it frames its content, and nothing claims a scale.
 */
export function renderViewToSvg(
  project: Project,
  view: SavedDrawingView,
  frameMm?: PaperFrameMm,
  scaleDenominator?: number,
): string {
  const plan = planOf(
    project,
    view,
    frameMm === undefined
      ? undefined
      : modelWindowOf(project, view, frameMm, scaleDenominator),
  );
  return renderSemanticSceneToSvg(
    plan.scene,
    plan.view,
    GENERIC_TECHNICAL_SCREEN.profile,
    GENERIC_TECHNICAL_SCREEN.styles,
    { includeSemanticGroups: true },
  );
}

/** A sheet drawn whole: its frame, the views on it, and its title block. */
export function renderSheet(project: Project, sheet: ProjectSheet): string {
  const views = new Map(
    (project.drawingViews ?? []).map((view) => [view.id, view]),
  );
  const rendered: RenderedViewport[] = sheet.viewports.flatMap((viewport) => {
    const view = views.get(viewport.viewId);
    if (view === undefined) return [];
    return [
      {
        viewportId: viewport.id,
        // The frame and the scale of this viewport, not the view's own: the
        // same view may sit on two sheets at two scales.
        svg: renderViewToSvg(
          project,
          view,
          { width: viewport.width, height: viewport.height },
          viewport.scaleDenominator,
        ),
        caption: view.name,
      },
    ];
  });
  return renderSheetToSvg(sheetLayoutOf(project, sheet), rendered);
}

/** A frame filling the printable area, less the title block's own row. */
export function defaultViewportFrame(
  sheet: Pick<ProjectSheet, 'format' | 'orientation'>,
): { x: number; y: number; width: number; height: number } {
  const paper = paperSizeFor(sheet.format, sheet.orientation);
  return {
    x: MARGINS_MM.left,
    y: MARGINS_MM.top,
    width: paper.width - MARGINS_MM.left - MARGINS_MM.right,
    height:
      paper.height -
      MARGINS_MM.top -
      MARGINS_MM.bottom -
      GENERIC_TITLE_BLOCK_V1.size.height -
      4,
  };
}
