import { describe, expect, it } from 'vitest';
import {
  constrainPoint,
  createEditorState,
  DEFAULT_SNAP,
  editorReducer,
  pointerModelPoint,
  requiredPoints,
  type EditorState,
} from './editor-state.js';
import {
  SHORTCUTS,
  resolveShortcut,
  shortcutLabel,
  shouldIgnoreTarget,
} from './shortcuts.js';

const viewport = { widthPx: 800, heightPx: 600 };

function state(): EditorState {
  return createEditorState(viewport);
}

function key(
  init: Partial<Parameters<typeof resolveShortcut>[0]> & { key: string },
) {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  };
}

describe('editor state', () => {
  it('starts on the selection tool with nothing selected', () => {
    const initial = state();
    expect(initial.activeTool).toBe('SELECT');
    expect(initial.selection).toEqual([]);
    expect(initial.pendingPoints).toEqual([]);
    expect(initial.snap).toEqual(DEFAULT_SNAP);
  });

  it('replaces or extends the selection depending on the modifier', () => {
    let current = editorReducer(state(), {
      type: 'SELECT',
      objectId: 'wall-1',
    });
    expect(current.selection).toEqual(['wall-1']);
    current = editorReducer(current, { type: 'SELECT', objectId: 'wall-2' });
    expect(current.selection).toEqual(['wall-2']);
    current = editorReducer(current, {
      type: 'SELECT',
      objectId: 'wall-1',
      additive: true,
    });
    expect(current.selection).toEqual(['wall-2', 'wall-1']);
    current = editorReducer(current, {
      type: 'SELECT',
      objectId: 'wall-1',
      additive: true,
    });
    expect(current.selection).toEqual(['wall-2']);
  });

  it('drops the hover when the pointer leaves everything', () => {
    const hovered = editorReducer(state(), {
      type: 'HOVER',
      objectId: 'space-1',
    });
    expect(hovered.hoveredId).toBe('space-1');
    expect(editorReducer(hovered, { type: 'HOVER' })).not.toHaveProperty(
      'hoveredId',
    );
  });

  it('zooms towards the cursor rather than the viewport centre', () => {
    const zoomed = editorReducer(state(), {
      type: 'ZOOM',
      anchorPx: { x: 0, y: 0 },
      factor: 2,
    });
    expect(zoomed.camera.pixelsPerMm).toBeCloseTo(0.12, 9);
    // The model point under the cursor stays put.
    const before = pointerModelPoint(
      state().camera,
      { x: 0, y: 0 },
      {
        left: 0,
        top: 0,
      },
    );
    const after = pointerModelPoint(
      zoomed.camera,
      { x: 0, y: 0 },
      {
        left: 0,
        top: 0,
      },
    );
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('keeps a fitted drawing framed when the viewport is resized', () => {
    const fitted = editorReducer(state(), {
      type: 'ZOOM_FIT',
      bounds: { min: { x: 0, y: 0 }, max: { x: 10_000, y: 8_000 } },
    });
    const modelWidthBefore =
      fitted.camera.viewportWidthPx / fitted.camera.pixelsPerMm;
    const resized = editorReducer(fitted, {
      type: 'RESIZE',
      viewport: { widthPx: 400, heightPx: 300 },
    });
    expect(
      resized.camera.viewportWidthPx / resized.camera.pixelsPerMm,
    ).toBeCloseTo(modelWidthBefore, 6);
  });

  it('fits a bounding box into the viewport and resets back', () => {
    const fitted = editorReducer(state(), {
      type: 'ZOOM_FIT',
      bounds: { min: { x: 0, y: 0 }, max: { x: 10_000, y: 8_000 } },
    });
    expect(fitted.camera.centerModelMm).toEqual({ x: 5000, y: 4000 });
    expect(fitted.camera.pixelsPerMm).toBeGreaterThan(0);
    expect(
      editorReducer(fitted, { type: 'RESET_VIEW' }).camera.pixelsPerMm,
    ).toBeCloseTo(0.06, 9);
  });

  it('collects the points a tool needs and clears them when it is done', () => {
    let current = editorReducer(state(), { type: 'SET_TOOL', tool: 'WALL' });
    expect(requiredPoints(current.activeTool)).toBe(2);
    current = editorReducer(current, {
      type: 'COMMIT_POINT',
      point: { x: 0, y: 0 },
    });
    expect(current.pendingPoints).toHaveLength(1);
    current = editorReducer(current, {
      type: 'COMMIT_POINT',
      point: { x: 4000, y: 0 },
    });
    expect(current.pendingPoints).toEqual([]);
  });

  it('cancels the action in progress without touching the tool', () => {
    let current = editorReducer(state(), { type: 'SET_TOOL', tool: 'WALL' });
    current = editorReducer(current, {
      type: 'COMMIT_POINT',
      point: { x: 0, y: 0 },
    });
    current = editorReducer(current, { type: 'CANCEL' });
    expect(current.pendingPoints).toEqual([]);
    expect(current.activeTool).toBe('WALL');
  });

  it('switches layer presets and toggles a single layer', () => {
    let current = editorReducer(state(), {
      type: 'APPLY_PRESET',
      presetId: 'plumbing',
    });
    expect(current.layers['water.pipes']).toBe(true);
    expect(current.layers['electrical.circuits']).toBe(false);
    current = editorReducer(current, {
      type: 'TOGGLE_LAYER',
      layerId: 'electrical.circuits',
    });
    expect(current.layers['electrical.circuits']).toBe(true);
    expect(
      editorReducer(current, { type: 'APPLY_PRESET', presetId: 'nope' }),
    ).toBe(current);
  });
});

describe('drawing constraints', () => {
  it('snaps the drafted angle to the configured step', () => {
    const point = constrainPoint(
      { x: 0, y: 0 },
      { x: 1000, y: 60 },
      DEFAULT_SNAP,
      {},
    );
    // 3.4° rounds to the horizontal with a 15° step.
    expect(point.y).toBeCloseTo(0, 6);
    expect(point.x).toBeCloseTo(Math.hypot(1000, 60), 6);
  });

  it('honours a locked length and a locked angle', () => {
    const point = constrainPoint(
      { x: 1000, y: 1000 },
      { x: 2000, y: 1000 },
      DEFAULT_SNAP,
      { lengthMm: 4250, angleDeg: 90 },
    );
    expect(point.x).toBeCloseTo(1000, 6);
    expect(point.y).toBeCloseTo(5250, 6);
  });

  it('leaves the angle free when the orthogonal constraint is off', () => {
    const point = constrainPoint(
      { x: 0, y: 0 },
      { x: 1000, y: 60 },
      { ...DEFAULT_SNAP, orthogonal: false },
      {},
    );
    expect(point.y).toBeCloseTo(60, 6);
  });

  it('returns the target itself for a zero-length draft', () => {
    expect(
      constrainPoint({ x: 5, y: 5 }, { x: 5, y: 5 }, DEFAULT_SNAP, {}),
    ).toEqual({ x: 5, y: 5 });
  });
});

describe('keyboard shortcuts', () => {
  it('resolves the documented bindings', () => {
    expect(resolveShortcut(key({ key: 'w' }))).toBe('tool.wall');
    expect(resolveShortcut(key({ key: 'O' }))).toBe('tool.opening');
    expect(resolveShortcut(key({ key: 'z', ctrlKey: true }))).toBe('edit.undo');
    expect(
      resolveShortcut(key({ key: 'z', ctrlKey: true, shiftKey: true })),
    ).toBe('edit.redo');
    expect(resolveShortcut(key({ key: 's', metaKey: true }))).toBe('file.save');
    expect(resolveShortcut(key({ key: 'Delete' }))).toBe('edit.delete');
    expect(resolveShortcut(key({ key: 'q' }))).toBeUndefined();
  });

  it('never lets a modified chord fall through to its bare binding', () => {
    expect(resolveShortcut(key({ key: 'w', ctrlKey: true }))).toBeUndefined();
    expect(resolveShortcut(key({ key: 'f', shiftKey: true }))).toBe(
      'view.zoomSelection',
    );
    expect(resolveShortcut(key({ key: 'f' }))).toBe('view.zoomFit');
  });

  it('ignores plain keys typed into a form control but keeps the chords', () => {
    expect(shouldIgnoreTarget('INPUT', key({ key: 'w' }))).toBe(true);
    expect(shouldIgnoreTarget('INPUT', key({ key: 's', ctrlKey: true }))).toBe(
      false,
    );
    expect(shouldIgnoreTarget('DIV', key({ key: 'w' }))).toBe(false);
  });

  it('labels every binding without duplicating a command', () => {
    const ids = SHORTCUTS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(shortcutLabel(SHORTCUTS.find(({ id }) => id === 'edit.redo')!)).toBe(
      'Ctrl + Maj + Z',
    );
    expect(shortcutLabel(SHORTCUTS.find(({ id }) => id === 'tool.wall')!)).toBe(
      'W',
    );
  });
});
