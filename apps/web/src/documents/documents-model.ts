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
  graphicProfileBundle,
} from '@house-technical-designer/drawing-engine';
import { drawingOf, modelWindowOf, type PaperFrameMm } from './model-window.js';

export { modelWindowOf, type PaperFrameMm };

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
  const plan = drawingOf(
    project,
    view,
    frameMm === undefined
      ? undefined
      : modelWindowOf(project, view, frameMm, scaleDenominator),
  );
  // The charter the view chose, and the generic one only when the view chose
  // something this version does not ship.
  const charter =
    graphicProfileBundle(view.graphicProfileId) ?? GENERIC_TECHNICAL_SCREEN;
  return renderSemanticSceneToSvg(
    plan.scene,
    plan.view,
    charter.profile,
    charter.styles,
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

/** What separates two viewports, and them from the title block, in mm. */
const GUTTER_MM = 4;

export interface ViewportFrameMm {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where several views sit on one sheet.
 *
 * A sheet carried exactly one view, because that is what the panel could
 * produce — a plan and its section on the same sheet is the ordinary case of a
 * drawing set, and it could not be expressed. The frames are laid out rather
 * than placed by hand: the drawing engine refuses a viewport that leaves the
 * printable area or sits under the title block, and a grid computed from the
 * paper cannot do either.
 *
 * The band the title block occupies is left free across the whole width. Half
 * a sheet of margin is cheaper than a plan printed over its own cartouche.
 */
export function viewportFramesFor(
  sheet: Pick<ProjectSheet, 'format' | 'orientation'>,
  count: number,
): readonly ViewportFrameMm[] {
  const paper = paperSizeFor(sheet.format, sheet.orientation);
  const area = {
    x: MARGINS_MM.left,
    y: MARGINS_MM.top,
    width: paper.width - MARGINS_MM.left - MARGINS_MM.right,
    height:
      paper.height -
      MARGINS_MM.top -
      MARGINS_MM.bottom -
      GENERIC_TITLE_BLOCK_V1.size.height -
      GUTTER_MM,
  };
  const wanted = Math.max(1, Math.floor(count));
  // As square a grid as the count allows: two views side by side, four in a
  // square, six in three columns of two.
  const columns = Math.ceil(Math.sqrt(wanted));
  const rows = Math.ceil(wanted / columns);
  const width = (area.width - (columns - 1) * GUTTER_MM) / columns;
  const height = (area.height - (rows - 1) * GUTTER_MM) / rows;
  return Array.from({ length: wanted }, (_unused, index) => ({
    x: area.x + (index % columns) * (width + GUTTER_MM),
    y: area.y + Math.floor(index / columns) * (height + GUTTER_MM),
    width,
    height,
  }));
}

/** A frame filling the printable area, less the title block's own row. */
export function defaultViewportFrame(
  sheet: Pick<ProjectSheet, 'format' | 'orientation'>,
): ViewportFrameMm {
  return viewportFramesFor(sheet, 1)[0]!;
}

/**
 * The sheet with its viewports laid out again for the paper it is now on.
 *
 * Turning an A3 from landscape to portrait moves every frame: the ones that
 * were inside the old paper hang off the new one, and the sheet stops being
 * drawable. Nothing about a viewport's frame is a decision the user made — it
 * is derived from the format, the orientation and how many views there are —
 * so it is derived again whenever one of the three changes.
 */
export function relaidSheet(sheet: ProjectSheet): ProjectSheet {
  const frames = viewportFramesFor(sheet, sheet.viewports.length);
  return {
    ...sheet,
    viewports: sheet.viewports.map((viewport, index) => ({
      ...viewport,
      ...frames[index]!,
    })),
  };
}
