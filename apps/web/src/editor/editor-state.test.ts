import { describe, expect, it } from 'vitest';
import {
  constrainPoint,
  resolveDraftPoint,
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

  it('undoes one thing at a time, the most recent first', () => {
    // Abandoning a wall being drawn used to clear the selection too, so a
    // mis-started line cost the objects that were about to be edited.
    let current = editorReducer(state(), {
      type: 'SELECT_MANY',
      objectIds: ['wall-a', 'wall-b'],
    });
    current = editorReducer(current, { type: 'SET_TOOL', tool: 'WALL' });
    current = editorReducer(current, {
      type: 'COMMIT_POINT',
      point: { x: 0, y: 0 },
    });

    current = editorReducer(current, { type: 'CANCEL' });
    expect(current.pendingPoints).toEqual([]);
    expect(current.activeTool).toBe('WALL');
    expect(current.selection).toEqual(['wall-a', 'wall-b']);

    current = editorReducer(current, { type: 'CANCEL' });
    expect(current.activeTool).toBe('SELECT');
    expect(current.selection).toEqual(['wall-a', 'wall-b']);

    current = editorReducer(current, { type: 'CANCEL' });
    expect(current.selection).toEqual([]);
  });

  it('abandons the rubber band before anything else', () => {
    let current = editorReducer(state(), {
      type: 'SET_SELECTION_BOX',
      from: { x: 0, y: 0 },
      to: { x: 1000, y: 1000 },
    });
    current = editorReducer(current, { type: 'CANCEL' });
    expect(current.selectionBox).toBeUndefined();
    expect(current.activeTool).toBe('SELECT');
  });

  it('replaces the selection with what a band caught, or adds to it', () => {
    let current = editorReducer(state(), {
      type: 'SELECT',
      objectId: 'wall-a',
    });
    current = editorReducer(current, {
      type: 'SELECT_MANY',
      objectIds: ['wall-b', 'wall-c'],
    });
    expect(current.selection).toEqual(['wall-b', 'wall-c']);
    current = editorReducer(current, {
      type: 'SELECT_MANY',
      objectIds: ['wall-c', 'wall-d'],
      additive: true,
    });
    // What was already selected stays, and nothing is counted twice.
    expect(current.selection).toEqual(['wall-b', 'wall-c', 'wall-d']);
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

describe('what the constraints do to a drafted point', () => {
  it('places a typed length even when the pointer has not moved', () => {
    // Typing 4500 and pressing Enter is a way of drawing; refusing because the
    // pointer sits on the first point would make the keyboard useless.
    const placed = constrainPoint(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      DEFAULT_SNAP,
      { lengthMm: 4500 },
    );
    expect(placed).toEqual({ x: 4500, y: 0 });
  });

  it('follows the angle that was typed', () => {
    const placed = constrainPoint(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      DEFAULT_SNAP,
      { lengthMm: 1000, angleDeg: 90 },
    );
    expect(Math.round(placed.x)).toBe(0);
    expect(Math.round(placed.y)).toBe(1000);
  });

  it('leaves the point alone when nothing says how far', () => {
    const origin = { x: 120, y: 340 };
    expect(constrainPoint(origin, origin, DEFAULT_SNAP, {})).toEqual(origin);
  });
});

describe('the one reading of a drafted point', () => {
  it('gives the click, the preview and the typed value the same answer', () => {
    // Three readings of one gesture used to exist; a ghost that is not what
    // lands is a drawing nobody can trust.
    const asked = {
      tool: 'WALL' as const,
      pendingPoints: [{ x: 0, y: 0 }],
      raw: { x: 2990, y: 40 },
      snap: { ...DEFAULT_SNAP, grid: false, orthogonal: true },
      directInput: {},
    };
    const point = resolveDraftPoint(asked);
    // Along the axes, as the wall tool asks for.
    expect(Math.round(point.y)).toBe(0);
    expect(resolveDraftPoint(asked)).toEqual(point);
  });

  it('leaves a tool that points at what exists unconstrained', () => {
    // A dimension is not drawn: constraining the click would pull it off the
    // corner the user aimed at.
    const raw = { x: 2990, y: 40 };
    expect(
      resolveDraftPoint({
        tool: 'DIMENSION',
        pendingPoints: [{ x: 0, y: 0 }],
        raw,
        snap: DEFAULT_SNAP,
        directInput: {},
      }),
    ).toEqual(raw);
  });

  it('prefers what the pointer snapped to', () => {
    const snapped = { x: 3000, y: 0 };
    expect(
      resolveDraftPoint({
        tool: 'DIMENSION',
        pendingPoints: [],
        raw: { x: 2990, y: 40 },
        snapped,
        snap: DEFAULT_SNAP,
        directInput: {},
      }),
    ).toEqual(snapped);
  });
});
