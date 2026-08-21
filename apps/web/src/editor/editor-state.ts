import type {
  Camera2D,
  ScreenPoint,
  SnapResult,
} from '@house-technical-designer/editor-core';
import {
  panCamera,
  screenToModel,
  zoomCameraAt,
} from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';
import type { LayerVisibility } from '@house-technical-designer/view-query';
import {
  LAYER_PRESETS,
  defaultVisibility,
  presetVisibility,
} from '@house-technical-designer/view-query';

import {
  constrainsDrafting,
  isOpenEnded,
  requiredPoints,
  toolAtLevel,
  toolDefinition,
  type EditorLevel,
  type EditorTool,
} from './tool-registry.js';

// The tools themselves are declared in the registry; the state only needs to
// know which one is active and how many points it is still waiting for.
export type { EditorLevel, EditorTool };
export {
  constrainsDrafting,
  isOpenEnded,
  requiredPoints,
  toolDefinition,
} from './tool-registry.js';

export interface SnapSettings {
  readonly enabled: boolean;
  readonly grid: boolean;
  readonly endpoint: boolean;
  readonly midpoint: boolean;
  readonly intersection: boolean;
  readonly orthogonal: boolean;
  readonly gridSpacingMm: number;
  readonly tolerancePx: number;
  /** Angle increment the orthogonal constraint snaps to, in degrees. */
  readonly angleStepDeg: number;
}

export const DEFAULT_SNAP: SnapSettings = {
  enabled: true,
  grid: true,
  endpoint: true,
  midpoint: true,
  intersection: true,
  orthogonal: true,
  gridSpacingMm: 100,
  tolerancePx: 12,
  angleStepDeg: 15,
};

/** Length and angle the user has locked while drawing. */
export interface DirectInput {
  readonly lengthMm?: number;
  readonly angleDeg?: number;
}

/** A change to the locked values; `null` releases a lock. */
export interface DirectInputPatch {
  readonly lengthMm?: number | null;
  readonly angleDeg?: number | null;
}

function applyDirectInput(
  current: DirectInput,
  patch: DirectInputPatch,
): DirectInput {
  const lengthMm = 'lengthMm' in patch ? patch.lengthMm : current.lengthMm;
  const angleDeg = 'angleDeg' in patch ? patch.angleDeg : current.angleDeg;
  return {
    ...(lengthMm === null || lengthMm === undefined ? {} : { lengthMm }),
    ...(angleDeg === null || angleDeg === undefined ? {} : { angleDeg }),
  };
}

/**
 * Everything the editor needs that is not a project fact.
 *
 * None of it is ever persisted: reloading a project restores the model, not the
 * selection, the camera or the active tool.
 */
export interface EditorState {
  readonly activeTool: EditorTool;
  /**
   * How much of the editor is shown.
   *
   * Editor state, not project state: how many tools a person wants in front of
   * them says nothing about the building, and a project opened by someone else
   * must not rearrange their interface.
   */
  readonly editorLevel: EditorLevel;
  readonly selection: readonly string[];
  readonly hoveredId?: string;
  readonly camera: Camera2D;
  readonly snap: SnapSettings;
  readonly activeSnap?: SnapResult;
  readonly layers: LayerVisibility;
  readonly presetId: string;
  readonly levelId?: string;
  /** Points already committed for the tool in progress. */
  readonly pendingPoints: readonly Point2D[];
  /**
   * What each of those points landed on, when it landed on something.
   *
   * A tool that joins two walls is told which walls by the clicks themselves;
   * the point and what it touched are one fact and are kept together.
   */
  readonly pendingPicks: readonly (string | undefined)[];
  /** The rubber band being dragged, while one is. */
  readonly selectionBox?: { readonly from: Point2D; readonly to: Point2D };
  readonly cursorModel?: Point2D;
  readonly directInput: DirectInput;
}

export interface EditorViewport {
  readonly widthPx: number;
  readonly heightPx: number;
}

export function createCamera(
  viewport: EditorViewport,
  centerModelMm: Point2D = { x: 5000, y: 4000 },
  pixelsPerMm = 0.06,
): Camera2D {
  return {
    centerModelMm,
    pixelsPerMm,
    viewportWidthPx: Math.max(1, viewport.widthPx),
    viewportHeightPx: Math.max(1, viewport.heightPx),
  };
}

export function createEditorState(viewport: EditorViewport): EditorState {
  return {
    activeTool: 'SELECT',
    // What an ordinary project asks for. Someone drawing their first plan
    // narrows it; someone drawing a set of documents widens it.
    editorLevel: 'DESIGN',
    selection: [],
    camera: createCamera(viewport),
    snap: DEFAULT_SNAP,
    layers: defaultVisibility(),
    presetId: 'architecture',
    pendingPoints: [],
    pendingPicks: [],
    directInput: {},
  };
}

export type EditorAction =
  | { readonly type: 'SET_TOOL'; readonly tool: EditorTool }
  | {
      readonly type: 'SELECT';
      readonly objectId?: string;
      readonly additive?: boolean;
    }
  | { readonly type: 'CLEAR_SELECTION' }
  | {
      readonly type: 'SELECT_MANY';
      readonly objectIds: readonly string[];
      readonly additive?: boolean;
    }
  | {
      readonly type: 'SET_SELECTION_BOX';
      readonly from: Point2D;
      readonly to: Point2D;
    }
  | { readonly type: 'CLEAR_SELECTION_BOX' }
  | { readonly type: 'HOVER'; readonly objectId?: string }
  | { readonly type: 'RESIZE'; readonly viewport: EditorViewport }
  | { readonly type: 'PAN'; readonly deltaPx: ScreenPoint }
  | {
      readonly type: 'ZOOM';
      readonly anchorPx: ScreenPoint;
      readonly factor: number;
    }
  | { readonly type: 'ZOOM_FIT'; readonly bounds: Bounds }
  | { readonly type: 'ZOOM_SELECTION'; readonly bounds?: Bounds }
  | { readonly type: 'RESET_VIEW' }
  | {
      readonly type: 'MOVE_CURSOR';
      readonly model: Point2D;
      readonly snap?: SnapResult;
    }
  | {
      readonly type: 'COMMIT_POINT';
      readonly point: Point2D;
      readonly objectId?: string;
    }
  | { readonly type: 'FINISH_RUN' }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'SET_SNAP'; readonly snap: Partial<SnapSettings> }
  | { readonly type: 'SET_DIRECT_INPUT'; readonly input: DirectInputPatch }
  | { readonly type: 'TOGGLE_LAYER'; readonly layerId: string }
  | { readonly type: 'SHOW_LAYERS'; readonly layerIds: readonly string[] }
  /**
   * Every layer set to exactly what is stated, hiding included.
   *
   * `SHOW_LAYERS` never hides, which is right when a discipline is being
   * revealed and wrong when a saved view is being restored: a view that had
   * the networks off came back with them on, and the drawing that reappeared
   * was not the drawing that had been saved.
   */
  | {
      readonly type: 'SET_LAYERS';
      readonly layers: Readonly<Record<string, boolean>>;
    }
  /**
   * The camera put exactly where it is told: a centre and a zoom.
   *
   * Restoring a saved view is the reason: framing what happens to be drawn is
   * not the framing the view recorded, and a scale of 1:50 that comes back as
   * « whatever fits » is not a scale.
   */
  | {
      readonly type: 'SET_CAMERA';
      readonly centreModelMm: Point2D;
      readonly pixelsPerMm: number;
    }
  | { readonly type: 'APPLY_PRESET'; readonly presetId: string }
  | { readonly type: 'SET_LEVEL'; readonly levelId: string }
  | { readonly type: 'SET_EDITOR_LEVEL'; readonly level: EditorLevel };

export interface Bounds {
  readonly min: Point2D;
  readonly max: Point2D;
}

function fitCamera(camera: Camera2D, bounds: Bounds): Camera2D {
  const width = Math.max(1, bounds.max.x - bounds.min.x);
  const height = Math.max(1, bounds.max.y - bounds.min.y);
  const pixelsPerMm = Math.min(
    camera.viewportWidthPx / width,
    camera.viewportHeightPx / height,
  );
  return {
    ...camera,
    centerModelMm: {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
    },
    pixelsPerMm: pixelsPerMm > 0 ? pixelsPerMm * 0.92 : camera.pixelsPerMm,
  };
}

/** Applies the orthogonal and length constraints to a drafted point. */
export function constrainPoint(
  origin: Point2D,
  target: Point2D,
  snap: SnapSettings,
  direct: DirectInput,
): Point2D {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const rawLength = Math.hypot(dx, dy);
  const lengthMm = direct.lengthMm ?? rawLength;
  // Nothing to place: neither the pointer nor the keyboard has said how far.
  if (lengthMm === 0) return target;
  // A length typed without moving the pointer has no direction of its own; it
  // goes along the axis until the user says otherwise, rather than refusing to
  // draw at all.
  const rawAngle = rawLength === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  const angleDeg =
    direct.angleDeg ??
    (snap.enabled && snap.orthogonal && snap.angleStepDeg > 0
      ? Math.round(rawAngle / snap.angleStepDeg) * snap.angleStepDeg
      : rawAngle);
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(radians) * lengthMm,
    y: origin.y + Math.sin(radians) * lengthMm,
  };
}

/**
 * The point a click, a typed length or a preview all mean.
 *
 * There used to be three readings of the same gesture: the click applied the
 * constraints only for the tools that ask for them, the preview applied them to
 * every tool, and the dynamic input applied them again on its own. A drawing
 * where the ghost is not what lands is a drawing nobody can trust, so the three
 * now ask this one question.
 */
export function resolveDraftPoint(options: {
  readonly tool: EditorTool;
  readonly pendingPoints: readonly Point2D[];
  /** Where the pointer is, in model millimetres. */
  readonly raw: Point2D;
  /** What the pointer snapped to, when it snapped to something. */
  readonly snapped?: Point2D;
  readonly snap: SnapSettings;
  readonly directInput: DirectInput;
}): Point2D {
  const base = options.snapped ?? options.raw;
  const origin = options.pendingPoints[options.pendingPoints.length - 1];
  // Nothing to constrain against, or a tool that points at what exists rather
  // than drawing along the building axes.
  if (origin === undefined || !constrainsDrafting(options.tool)) return base;
  return constrainPoint(origin, base, options.snap, options.directInput);
}

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case 'SET_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        pendingPoints: [],
        pendingPicks: [],
        directInput: {},
      };
    case 'SELECT': {
      if (action.objectId === undefined) return { ...state, selection: [] };
      if (action.additive !== true)
        return { ...state, selection: [action.objectId] };
      return state.selection.includes(action.objectId)
        ? {
            ...state,
            selection: state.selection.filter((id) => id !== action.objectId),
          }
        : { ...state, selection: [...state.selection, action.objectId] };
    }
    case 'SELECT_MANY': {
      const { selectionBox: _band, ...rest } = state;
      if (action.additive !== true)
        return { ...rest, selection: [...action.objectIds] };
      // Adding a band to a selection adds what it caught and removes nothing:
      // taking objects away is what clicking them again is for.
      return {
        ...rest,
        selection: [...new Set([...state.selection, ...action.objectIds])],
      };
    }
    case 'SET_SELECTION_BOX':
      return {
        ...state,
        selectionBox: { from: action.from, to: action.to },
      };
    case 'CLEAR_SELECTION_BOX': {
      const { selectionBox: _band, ...rest } = state;
      return rest;
    }
    case 'CLEAR_SELECTION':
      return { ...state, selection: [] };
    case 'HOVER': {
      const { hoveredId: _previous, ...rest } = state;
      return action.objectId === undefined
        ? rest
        : { ...rest, hoveredId: action.objectId };
    }
    case 'RESIZE': {
      const widthPx = Math.max(1, action.viewport.widthPx);
      const heightPx = Math.max(1, action.viewport.heightPx);
      // Keep whatever is framed still framed: the zoom follows the smaller of
      // the two dimension changes so a fitted drawing stays fitted.
      const factor = Math.min(
        widthPx / state.camera.viewportWidthPx,
        heightPx / state.camera.viewportHeightPx,
      );
      return {
        ...state,
        camera: {
          ...state.camera,
          viewportWidthPx: widthPx,
          viewportHeightPx: heightPx,
          pixelsPerMm:
            Number.isFinite(factor) && factor > 0
              ? state.camera.pixelsPerMm * factor
              : state.camera.pixelsPerMm,
        },
      };
    }
    case 'PAN':
      return { ...state, camera: panCamera(state.camera, action.deltaPx) };
    case 'ZOOM':
      return {
        ...state,
        camera: zoomCameraAt(state.camera, action.anchorPx, action.factor),
      };
    case 'ZOOM_FIT':
      return { ...state, camera: fitCamera(state.camera, action.bounds) };
    case 'ZOOM_SELECTION':
      return action.bounds === undefined
        ? state
        : { ...state, camera: fitCamera(state.camera, action.bounds) };
    case 'RESET_VIEW':
      return {
        ...state,
        camera: createCamera({
          widthPx: state.camera.viewportWidthPx,
          heightPx: state.camera.viewportHeightPx,
        }),
      };
    case 'MOVE_CURSOR': {
      const { activeSnap: _previous, ...rest } = state;
      return {
        ...rest,
        cursorModel: action.model,
        ...(action.snap === undefined ? {} : { activeSnap: action.snap }),
      };
    }
    case 'COMMIT_POINT': {
      const points = [...state.pendingPoints, action.point];
      const picks = [...state.pendingPicks, action.objectId];
      // A tool that draws until the user says stop never reaches a count: it
      // keeps its points until Entrée ends the run.
      const done =
        !isOpenEnded(state.activeTool) &&
        points.length >= requiredPoints(state.activeTool);
      return done
        ? { ...state, pendingPoints: [], pendingPicks: [], directInput: {} }
        : { ...state, pendingPoints: points, pendingPicks: picks };
    }
    case 'FINISH_RUN':
      // What the run produced is the application's business; the state only
      // forgets the points, exactly as a finished count would have.
      return { ...state, pendingPoints: [], pendingPicks: [], directInput: {} };
    case 'CANCEL': {
      // One step at a time, and the most recent first. Abandoning a wall being
      // drawn used to clear the selection as well, so a mis-started line cost
      // the twelve walls that were about to be edited.
      const { selectionBox: _band, ...rest } = state;
      if (state.pendingPoints.length > 0 || state.selectionBox !== undefined)
        return {
          ...rest,
          pendingPoints: [],
          pendingPicks: [],
          directInput: {},
        };
      if (state.activeTool !== 'SELECT')
        return { ...rest, activeTool: 'SELECT', directInput: {} };
      return { ...rest, selection: [] };
    }
    case 'SET_SNAP':
      return { ...state, snap: { ...state.snap, ...action.snap } };
    case 'SET_DIRECT_INPUT':
      return {
        ...state,
        directInput: applyDirectInput(state.directInput, action.input),
      };
    case 'TOGGLE_LAYER':
      return {
        ...state,
        layers: {
          ...state.layers,
          [action.layerId]: state.layers[action.layerId] !== true,
        },
      };
    case 'SHOW_LAYERS': {
      // Revealing never hides: turning a discipline on to see what was just
      // edited must not take the architecture out from under it.
      const hidden = action.layerIds.filter((id) => state.layers[id] !== true);
      return hidden.length === 0
        ? state
        : {
            ...state,
            layers: {
              ...state.layers,
              ...Object.fromEntries(hidden.map((id) => [id, true])),
            },
          };
    }
    case 'SET_EDITOR_LEVEL': {
      if (action.level === state.editorLevel) return state;
      // A tool that the new level does not offer would stay active with no
      // button to say so; selection is offered at every level.
      const keeps = toolAtLevel(toolDefinition(state.activeTool), action.level);
      return {
        ...state,
        editorLevel: action.level,
        ...(keeps ? {} : { activeTool: 'SELECT' }),
      };
    }
    case 'SET_LAYERS':
      return { ...state, layers: { ...state.layers, ...action.layers } };
    case 'SET_CAMERA': {
      const { centreModelMm, pixelsPerMm } = action;
      // A zoom of zero or of infinity is not a framing; the camera keeps the
      // one it has rather than dividing the model by nothing.
      if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) return state;
      if (
        !Number.isFinite(centreModelMm.x) ||
        !Number.isFinite(centreModelMm.y)
      )
        return state;
      return {
        ...state,
        camera: {
          ...state.camera,
          centerModelMm: { x: centreModelMm.x, y: centreModelMm.y },
          pixelsPerMm,
        },
      };
    }
    case 'APPLY_PRESET': {
      const preset = LAYER_PRESETS.find(({ id }) => id === action.presetId);
      return preset === undefined
        ? state
        : {
            ...state,
            presetId: preset.id,
            layers: presetVisibility(preset),
          };
    }
    case 'SET_LEVEL':
      return {
        ...state,
        levelId: action.levelId,
        selection: [],
        pendingPoints: [],
        pendingPicks: [],
      };
  }
}

/** Model point under a client pixel, given the element's bounding box. */
export function pointerModelPoint(
  camera: Camera2D,
  clientPoint: ScreenPoint,
  bounds: { readonly left: number; readonly top: number },
): Point2D {
  return screenToModel(camera, {
    x: clientPoint.x - bounds.left,
    y: clientPoint.y - bounds.top,
  });
}
