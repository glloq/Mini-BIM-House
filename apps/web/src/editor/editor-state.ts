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

export type EditorTool =
  'SELECT' | 'WALL' | 'OPENING' | 'DIMENSION' | 'NETWORK';

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
    selection: [],
    camera: createCamera(viewport),
    snap: DEFAULT_SNAP,
    layers: defaultVisibility(),
    presetId: 'architecture',
    pendingPoints: [],
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
  | { readonly type: 'COMMIT_POINT'; readonly point: Point2D }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'SET_SNAP'; readonly snap: Partial<SnapSettings> }
  | { readonly type: 'SET_DIRECT_INPUT'; readonly input: DirectInputPatch }
  | { readonly type: 'TOGGLE_LAYER'; readonly layerId: string }
  | { readonly type: 'SHOW_LAYERS'; readonly layerIds: readonly string[] }
  | { readonly type: 'APPLY_PRESET'; readonly presetId: string }
  | { readonly type: 'SET_LEVEL'; readonly levelId: string };

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
  if (rawLength === 0) return target;
  const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const angleDeg =
    direct.angleDeg ??
    (snap.enabled && snap.orthogonal && snap.angleStepDeg > 0
      ? Math.round(rawAngle / snap.angleStepDeg) * snap.angleStepDeg
      : rawAngle);
  const lengthMm = direct.lengthMm ?? rawLength;
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(radians) * lengthMm,
    y: origin.y + Math.sin(radians) * lengthMm,
  };
}

/** Number of points a tool needs before it can produce a command. */
export function requiredPoints(tool: EditorTool): number {
  switch (tool) {
    // Two endpoints to measure, then a point setting how far the dimension
    // line sits from them.
    case 'DIMENSION':
      return 3;
    case 'WALL':
      return 2;
    case 'OPENING':
    case 'NETWORK':
      return 1;
    case 'SELECT':
      return 0;
  }
}

/**
 * Whether a tool drafts along constrained angles and lengths.
 *
 * A wall is drawn along the building axes. A dimension is not drawn at all: it
 * points at endpoints that already exist, and constraining the click would pull
 * it off the corner the user aimed at.
 */
export function constrainsDrafting(tool: EditorTool): boolean {
  return tool === 'WALL';
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
      return points.length >= requiredPoints(state.activeTool)
        ? { ...state, pendingPoints: [], directInput: {} }
        : { ...state, pendingPoints: points };
    }
    case 'CANCEL':
      return { ...state, pendingPoints: [], directInput: {}, selection: [] };
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
