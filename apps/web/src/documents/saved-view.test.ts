import { describe, expect, it } from 'vitest';
import { entityId } from '@house-technical-designer/core-domain';
import type {
  Project,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import { GENERIC_TECHNICAL_SCREEN } from '@house-technical-designer/drawing-engine';
import { defaultVisibility } from '@house-technical-designer/view-query';
import { loadDemoProject } from '../demo-project.js';
import {
  CSS_PIXELS_PER_MM,
  pixelsPerMmForScale,
  restoredView,
  scaleDenominatorForZoom,
} from './saved-view.js';

function project(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function view(patch: Partial<SavedDrawingView> = {}): SavedDrawingView {
  return {
    id: 'view-1',
    type: 'PLAN',
    name: 'Plan du niveau',
    levelId: entityId<'Level'>('ground'),
    scaleDenominator: 50,
    layers: { ...defaultVisibility(), 'water.pipes': false },
    graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
    centreMm: { x: 4000, y: 3000 },
    ...patch,
  };
}

describe('a saved view reopened', () => {
  it('brings back the layers it hid, and not only the ones it showed', () => {
    // A view saved with the water off came back with it on: revealing never
    // hides, which is right for a discipline being switched on and wrong for
    // a view being restored.
    const restored = restoredView(project(), view());
    expect(restored.layers['water.pipes']).toBe(false);
    expect(restored.layers['architecture.walls']).toBe(true);
  });

  it('gives a layer the view never mentioned its ordinary state', () => {
    const restored = restoredView(
      project(),
      view({ layers: { 'water.pipes': false } }),
    );
    expect(restored.layers['architecture.walls']).toBe(
      defaultVisibility()['architecture.walls'],
    );
  });

  it('brings back the centre and the scale it was saved at', () => {
    const restored = restoredView(project(), view());
    expect(restored.centreMm).toEqual({ x: 4000, y: 3000 });
    expect(restored.pixelsPerMm).toBeCloseTo(CSS_PIXELS_PER_MM / 50, 12);
  });

  it('frames its own content when it never recorded a centre', () => {
    const { centreMm: _none, ...without } = view();
    const restored = restoredView(project(), without);
    // Somewhere in the house rather than at the origin of the model.
    expect(Number.isFinite(restored.centreMm.x)).toBe(true);
    expect(restored.centreMm).not.toEqual({ x: 0, y: 0 });
  });

  it('brings back the analysis that was showing', () => {
    expect(
      restoredView(project(), view({ analysisOverlayId: 'thermal-u' }))
        .overlayId,
    ).toBe('thermal-u');
    expect(restoredView(project(), view()).overlayId).toBe('none');
  });

  it('names the storey it can no longer open instead of opening another', () => {
    const restored = restoredView(
      project(),
      view({ levelId: entityId<'Level'>('demolished') }),
    );
    expect(restored.levelId).toBeUndefined();
    expect(restored.unresolved.join(' ')).toContain('demolished');
  });

  it('names an analysis this version no longer offers', () => {
    const restored = restoredView(
      project(),
      view({ analysisOverlayId: 'thermal-clairvoyance' }),
    );
    expect(restored.overlayId).toBe('none');
    expect(restored.unresolved.join(' ')).toContain('thermal-clairvoyance');
  });

  it('reopens a section as a section, not as a plan wearing its name', () => {
    const restored = restoredView(
      project(),
      view({
        type: 'SECTION',
        cut: { start: { x: 0, y: 2000 }, end: { x: 12_000, y: 2000 } },
      }),
    );
    expect(restored.type).toBe('SECTION');
    expect(restored.unresolved).toEqual([]);
  });

  it('says a section that lost its line cannot be cut anywhere', () => {
    const restored = restoredView(project(), view({ type: 'SECTION' }));
    expect(restored.unresolved.join(' ')).toContain('ligne de coupe');
  });

  it('says a façade that does not say where it looks from', () => {
    const restored = restoredView(project(), view({ type: 'ELEVATION' }));
    expect(restored.unresolved.join(' ')).toContain('direction du regard');
  });

  it('names a graphic profile it does not hold', () => {
    const restored = restoredView(
      project(),
      view({ graphicProfileId: 'charte-agence' }),
    );
    expect(restored.unresolved.join(' ')).toContain('charte-agence');
  });

  it('says nothing when everything came back', () => {
    expect(restoredView(project(), view()).unresolved).toEqual([]);
  });
});

describe('the bridge between a zoom and a scale', () => {
  it('is the same journey in both directions', () => {
    for (const denominator of [20, 50, 100, 200, 500])
      expect(scaleDenominatorForZoom(pixelsPerMmForScale(denominator))).toBe(
        denominator,
      );
  });

  it('never answers a scale of zero', () => {
    expect(scaleDenominatorForZoom(Number.POSITIVE_INFINITY)).toBe(50);
    expect(scaleDenominatorForZoom(CSS_PIXELS_PER_MM * 1000)).toBe(1);
  });
});
