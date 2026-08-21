import { describe, expect, it } from 'vitest';
import {
  ProjectCommandDispatcher,
  RemoveDrawingViewCommand,
  RemoveSheetCommand,
  SaveDrawingViewCommand,
  SaveSheetCommand,
} from '@house-technical-designer/editor-core';
import { GENERIC_TECHNICAL_SCREEN } from '@house-technical-designer/drawing-engine';
import type {
  ProjectSheet,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import { defaultVisibility } from '@house-technical-designer/view-query';
import { loadDemoProject } from '../demo-project.js';
import {
  defaultViewportFrame,
  renderSheet,
  renderViewToSvg,
  sheetLayoutOf,
} from './documents-model.js';

function project() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

const VIEW: SavedDrawingView = {
  id: 'view-ground',
  type: 'PLAN',
  name: 'Plan du rez-de-chaussée',
  levelId: entityId<'Level'>('ground'),
  scaleDenominator: 50,
  layers: defaultVisibility(),
  graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
};

function sheetWith(viewId: string): ProjectSheet {
  return {
    // The reference house ships its own A-001; this suite adds a second sheet
    // rather than overwriting it, so what it asserts is what it created.
    id: 'sheet-a900',
    number: 'A-900',
    title: 'Plan du rez-de-chaussée',
    format: 'A3',
    orientation: 'LANDSCAPE',
    viewports: [
      {
        id: 'viewport-1',
        viewId,
        scaleDenominator: 50,
        ...defaultViewportFrame({ format: 'A3', orientation: 'LANDSCAPE' }),
      },
    ],
  };
}

function withDocuments() {
  const dispatcher = new ProjectCommandDispatcher(project());
  const saved = dispatcher.dispatch(new SaveDrawingViewCommand(VIEW));
  if (saved.status !== 'APPLIED') throw new Error('view refused');
  const sheet = dispatcher.dispatch(new SaveSheetCommand(sheetWith(VIEW.id)));
  if (sheet.status !== 'APPLIED') throw new Error('sheet refused');
  return dispatcher;
}

describe('keeping a view rather than a picture', () => {
  it('stores the decisions and no geometry', () => {
    const saved = (withDocuments().project.drawingViews ?? [])[0]!;
    expect(saved.levelId).toBe('ground');
    expect(saved.scaleDenominator).toBe(50);
    expect(Object.keys(saved)).not.toContain('primitives');
  });

  it('refuses a view of a storey the project does not hold', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new SaveDrawingViewCommand({
          ...VIEW,
          levelId: entityId<'Level'>('nowhere'),
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('refuses a scale that is not a whole denominator', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new SaveDrawingViewCommand({ ...VIEW, scaleDenominator: 0 }),
      ).status,
    ).toBe('REJECTED');
  });

  it('replaces a view saved again under the same identifier', () => {
    const dispatcher = withDocuments();
    dispatcher.dispatch(
      new SaveDrawingViewCommand({ ...VIEW, name: 'Autre nom' }),
    );
    const saved = dispatcher.project.drawingViews?.filter(
      ({ id }) => id === VIEW.id,
    );
    expect(saved).toHaveLength(1);
    expect(saved?.[0]?.name).toBe('Autre nom');
  });

  it('refuses to delete a view a sheet still lays out', () => {
    // A sheet naming a view that is gone is a sheet nothing can print.
    const dispatcher = withDocuments();
    const refused = dispatcher.dispatch(new RemoveDrawingViewCommand(VIEW.id));
    expect(refused.status).toBe('REJECTED');
    if (refused.status !== 'REJECTED') return;
    expect(refused.errors.join(' ')).toContain('A-900');
  });

  it('lets the view go once no sheet holds it', () => {
    const dispatcher = withDocuments();
    dispatcher.dispatch(new RemoveSheetCommand('sheet-a900'));
    expect(
      dispatcher.dispatch(new RemoveDrawingViewCommand(VIEW.id)).status,
    ).toBe('APPLIED');
    expect(
      dispatcher.project.drawingViews?.some(({ id }) => id === VIEW.id),
    ).toBe(false);
  });

  it('undoes a saved view as one action', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    dispatcher.dispatch(new SaveDrawingViewCommand(VIEW));
    expect(dispatcher.undo().status).toBe('APPLIED');
    expect(
      (dispatcher.project.drawingViews ?? []).some(({ id }) => id === VIEW.id),
    ).toBe(false);
  });
});

describe('laying views out on sheets', () => {
  it('refuses a sheet naming a view the project has not', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(new SaveSheetCommand(sheetWith('nowhere'))).status,
    ).toBe('REJECTED');
  });

  it('refuses two sheets under the same number', () => {
    const dispatcher = withDocuments();
    expect(
      dispatcher.dispatch(
        new SaveSheetCommand({ ...sheetWith(VIEW.id), id: 'sheet-other' }),
      ).status,
    ).toBe('REJECTED');
  });

  it('builds a layout whose title block says what the project says', () => {
    const layout = sheetLayoutOf(withDocuments().project, sheetWith(VIEW.id));
    const cells = new Map(
      layout.titleBlockCells.map((cell) => [cell.field, cell]),
    );
    expect(cells.get('PROJECT_NAME')?.value).toBe(
      withDocuments().project.metadata.name,
    );
    expect(cells.get('DRAWING_NUMBER')?.value).toBe('A-900');
    // A cell the project cannot fill is marked unknown rather than invented.
    expect(cells.get('STATUS')?.state).toBe('UNKNOWN');
  });
});

describe('drawing a sheet', () => {
  it('renders the view inside the sheet, and the title block around it', () => {
    const svg = renderSheet(withDocuments().project, sheetWith(VIEW.id));
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    // The view is nested, not redrawn: what the sheet shows is what the plan
    // shows.
    expect(svg).toContain('data-view-id=');
    expect(svg).toContain('Plan du rez-de-chaussée');
    expect(svg).toContain('1:50');
  });

  it('marks an unfilled title block cell as unknown on the paper', () => {
    expect(renderSheet(withDocuments().project, sheetWith(VIEW.id))).toContain(
      'inconnu',
    );
  });

  it('renders a view on its own, as the plan renders it', () => {
    const svg = renderViewToSvg(withDocuments().project, VIEW);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
  });

  it('draws a frame saying so rather than failing on a missing view', () => {
    // The sheet is validated against the project before it is stored, so this
    // can only happen to a sheet handed straight to the renderer.
    const svg = renderSheet(project(), sheetWith('nowhere'));
    expect(svg).toContain('Vue non rendue');
  });
});

describe('a drawing set that holds more than plans', () => {
  const CUT = {
    start: { x: 0, y: 2000 },
    end: { x: 12_000, y: 2000 },
  } as const;

  it('refuses a section that does not say where it cuts', () => {
    // The type said « coupe » and the file said nothing else: reopening it,
    // the only honest thing left was to draw a plan and admit it.
    const dispatcher = new ProjectCommandDispatcher(project());
    const result = dispatcher.dispatch(
      new SaveDrawingViewCommand({ ...VIEW, id: 'view-cut', type: 'SECTION' }),
    );
    expect(result.status).toBe('REJECTED');
  });

  it('refuses a façade that does not say where it is seen from', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    expect(
      dispatcher.dispatch(
        new SaveDrawingViewCommand({
          ...VIEW,
          id: 'view-face',
          type: 'ELEVATION',
        }),
      ).status,
    ).toBe('REJECTED');
  });

  it('keeps a section and prints it as a section', () => {
    const dispatcher = new ProjectCommandDispatcher(project());
    const view: SavedDrawingView = {
      ...VIEW,
      id: 'view-cut',
      name: 'Coupe AA',
      type: 'SECTION',
      cut: CUT,
      viewDepthMm: 6000,
    };
    expect(dispatcher.dispatch(new SaveDrawingViewCommand(view)).status).toBe(
      'APPLIED',
    );
    const svg = renderViewToSvg(dispatcher.project, view);
    // A section is drawn in elevation: the walls stand on their storey, so the
    // drawing carries heights the plan never had.
    expect(svg).toContain('data-role="WALL_CUT"');
    // The saw shows the storey it went through, not the outline of a plan.
    expect(svg).toContain('data-role="WALL_BELOW"');
    expect(svg).not.toBe(renderViewToSvg(dispatcher.project, VIEW));
  });

  it('draws a roof plan and a site plan without a storey to stand on', () => {
    for (const type of ['ROOF', 'SITE'] as const) {
      const view: SavedDrawingView = {
        ...VIEW,
        id: `view-${type.toLowerCase()}`,
        type,
      };
      expect(renderViewToSvg(project(), view)).toContain('<svg');
    }
  });
});
