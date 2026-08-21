import { describe, expect, it } from 'vitest';
import { validateDrawingView } from '@house-technical-designer/core-domain';
import { buildSavedDrawing } from '@house-technical-designer/view-query';
import { loadDemoProject } from '../demo-project.js';
import { capturedView, FACADES } from './view-capture.js';

function project() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

const REQUEST = {
  id: 'view-1',
  name: 'Vue',
  scaleDenominator: 50,
  layers: {},
  graphicProfileId: 'generic-technical-screen',
  centreMm: { x: 5000, y: 2000 },
} as const;

describe('making a view of a kind the plan cannot show', () => {
  it('gives a section the line it is cut along', () => {
    // Asking for « une coupe » used to produce a view of type SECTION with
    // nothing saying where, which is a drawing nobody can reopen.
    const view = capturedView(project(), {
      ...REQUEST,
      kind: { type: 'SECTION', axis: 'EAST_WEST' },
    });
    expect(view.type).toBe('SECTION');
    expect(view.cut?.start.y).toBe(view.cut?.end.y);
    expect(view.cut!.end.x - view.cut!.start.x).toBeGreaterThan(0);
    expect(validateDrawingView(view)).toEqual([]);
  });

  it('cuts across the house, not beside it', () => {
    const view = capturedView(project(), {
      ...REQUEST,
      kind: { type: 'SECTION', axis: 'NORTH_SOUTH' },
    });
    // A cut that meets no wall is a blank sheet with a name on it.
    const walls = buildSavedDrawing(project(), view).primitives.filter(
      ({ semanticRole }) => semanticRole === 'WALL_CUT',
    );
    expect(walls.length).toBeGreaterThan(0);
  });

  it('gives a façade the direction it is seen from', () => {
    for (const { id, azimuthDeg } of FACADES) {
      const view = capturedView(project(), {
        ...REQUEST,
        kind: { type: 'ELEVATION', facade: id },
      });
      expect(view.viewDirectionDeg).toBe(azimuthDeg);
      expect(validateDrawingView(view)).toEqual([]);
    }
  });

  it('does not tie a section, a roof plan or a site plan to one storey', () => {
    // A plan is of a storey; the others cross them all, and naming one would
    // be a level identifier nothing reads.
    for (const kind of [
      { type: 'SECTION', axis: 'EAST_WEST' },
      { type: 'ELEVATION', facade: 'SOUTH' },
      { type: 'ROOF' },
      { type: 'SITE' },
    ] as const) {
      const view = capturedView(project(), {
        ...REQUEST,
        kind,
        levelId: 'ground' as never,
      });
      expect(view.levelId, kind.type).toBeUndefined();
    }
    expect(
      capturedView(project(), {
        ...REQUEST,
        kind: { type: 'PLAN' },
        levelId: 'ground' as never,
      }).levelId,
    ).toBe('ground');
  });

  it('makes something drawable even from a project with no building', () => {
    const bare = project();
    const view = capturedView(
      { ...bare, building: { ...bare.building, levels: [] } },
      { ...REQUEST, kind: { type: 'SECTION', axis: 'EAST_WEST' } },
    );
    expect(validateDrawingView(view)).toEqual([]);
  });
});
