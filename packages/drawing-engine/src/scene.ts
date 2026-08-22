import type {
  BoundingBox2D,
  Point2D,
  Polygon2D,
  Polyline2D,
} from '@house-technical-designer/geometry';

declare const drawingViewIdBrand: unique symbol;
declare const graphicProfileIdBrand: unique symbol;
export type DrawingViewId = string & { readonly [drawingViewIdBrand]: true };
export type GraphicProfileId = string & {
  readonly [graphicProfileIdBrand]: true;
};

/**
 * The kinds of drawing a project holds.
 *
 * The same list as the project's own `DRAWING_VIEW_TYPES`: a saved view whose
 * type the engine could not name was a view the engine could not build, and a
 * roof plan saved in the file came back as a storey plan without saying so.
 */
export type DrawingViewType =
  'PLAN' | 'SECTION' | 'ELEVATION' | 'ROOF' | 'SITE' | 'DETAIL' | 'SCHEMATIC';
/**
 * What part of the building a primitive belongs to.
 *
 * The structure and the ground used to be « architecture » and « other »: a
 * post and a parcel were drawn under the same heading as a wall and a
 * radiator, so an exported drawing could not separate the frame from the
 * masonry, nor the plot from the furniture. A discipline is what a drawing is
 * read by.
 */
export type Discipline =
  | 'ARCHITECTURE'
  | 'STRUCTURE'
  | 'SITE'
  | 'WATER'
  | 'WASTEWATER'
  | 'VENTILATION'
  | 'ELECTRICAL'
  | 'LIGHTING'
  | 'HEATING'
  | 'PV'
  | 'OTHER';
export type SemanticRole =
  | 'SITE'
  | 'SPACE_FILL'
  | 'WALL_CUT'
  | 'WALL_LAYER_STRUCTURE'
  | 'WALL_LAYER_INSULATION'
  | 'WALL_LAYER_FINISH'
  | 'WALL_LAYER_OTHER'
  | 'WALL_BELOW'
  | 'OPENING'
  | 'OPENING_REVEAL'
  | 'NETWORK'
  | 'WATER_COLD'
  | 'WATER_HOT'
  | 'WATER_RECIRCULATION'
  | 'WATER_NON_POTABLE'
  | 'VENT_SUPPLY'
  | 'VENT_EXHAUST'
  | 'VENT_TRANSFER'
  | 'ELECTRICAL_POWER'
  | 'ELECTRICAL_LIGHTING'
  | 'ELECTRICAL_CONTROL'
  | 'ELECTRICAL_PV'
  | 'SYMBOL'
  | 'ANNOTATION'
  | 'DIMENSION'
  | 'ANALYSIS'
  | 'ANALYSIS_LOW'
  | 'ANALYSIS_MEDIUM'
  | 'ANALYSIS_HIGH'
  | 'ANALYSIS_UNKNOWN';
export type ObjectState =
  'NORMAL' | 'SELECTED' | 'HOVER' | 'WARNING' | 'ERROR' | 'GHOST';
export type SceneGeometry =
  | { readonly kind: 'POINT'; readonly point: Point2D }
  | { readonly kind: 'POLYLINE'; readonly polyline: Polyline2D }
  | { readonly kind: 'POLYGON'; readonly polygon: Polygon2D }
  | {
      readonly kind: 'TEXT';
      readonly anchor: Point2D;
      readonly text: string;
      readonly rotationDeg?: number;
    };

export interface DrawingView {
  readonly id: DrawingViewId;
  readonly type: DrawingViewType;
  readonly levelId?: string;
  /** Denominator: 50 represents a 1:50 drawing. */
  readonly scale: number;
  readonly viewport: BoundingBox2D;
  readonly visibleDisciplines: readonly Discipline[];
  readonly graphicProfileId: GraphicProfileId;
  readonly cutElevationMm?: number;
  readonly viewDepthMm?: number;
  readonly analysisOverlayId?: string;
}

export interface ScenePrimitive {
  readonly id: string;
  readonly sourceObjectId?: string;
  readonly semanticRole: SemanticRole;
  readonly geometry: SceneGeometry;
  readonly layer: string;
  readonly zIndex: number;
  readonly discipline: Discipline;
  readonly state?: ObjectState;
  readonly metadata?: Readonly<
    Record<string, string | number | boolean | null>
  >;
}

export interface GraphicProfile {
  readonly id: GraphicProfileId;
  readonly name: string;
  readonly locale?: string;
  /** Maps semantic roles to versionable tokens, not SVG/CSS declarations. */
  readonly roleTokens: Readonly<Partial<Record<SemanticRole, string>>>;
  /** Maps stable semantic symbol IDs to profile-specific definitions. */
  readonly symbolOverrides?: Readonly<Record<string, string>>;
  readonly minimumScreenStrokePx?: number;
}

export interface SemanticScene {
  readonly viewId: DrawingViewId;
  readonly primitives: readonly ScenePrimitive[];
}

export function drawingViewId(value: string): DrawingViewId {
  if (value.trim() === '')
    throw new TypeError('Drawing view ID must not be empty');
  return value as DrawingViewId;
}

export function graphicProfileId(value: string): GraphicProfileId {
  if (value.trim() === '')
    throw new TypeError('Graphic profile ID must not be empty');
  return value as GraphicProfileId;
}

export function createSemanticScene(
  view: DrawingView,
  primitives: readonly ScenePrimitive[],
): SemanticScene {
  if (!Number.isFinite(view.scale) || view.scale <= 0)
    throw new RangeError('Drawing scale must be finite and greater than zero');
  const viewportValues = [
    view.viewport.min.x,
    view.viewport.min.y,
    view.viewport.max.x,
    view.viewport.max.y,
  ];
  if (
    viewportValues.some((value) => !Number.isFinite(value)) ||
    view.viewport.min.x > view.viewport.max.x ||
    view.viewport.min.y > view.viewport.max.y
  )
    throw new RangeError('Drawing viewport must be finite and normalized.');
  const visible = primitives
    .filter(({ discipline }) => view.visibleDisciplines.includes(discipline))
    .filter(({ geometry }) => intersectsViewport(geometry, view.viewport));
  visible.sort(
    (first, second) =>
      first.zIndex - second.zIndex || first.id.localeCompare(second.id),
  );
  return { viewId: view.id, primitives: visible };
}

function intersectsViewport(
  geometry: SceneGeometry,
  viewport: BoundingBox2D,
): boolean {
  const points =
    geometry.kind === 'POINT'
      ? [geometry.point]
      : geometry.kind === 'POLYLINE'
        ? geometry.polyline.points
        : geometry.kind === 'POLYGON'
          ? geometry.polygon.outer
          : [geometry.anchor];
  if (points.length === 0) return false;
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return (
    maxX >= viewport.min.x &&
    minX <= viewport.max.x &&
    maxY >= viewport.min.y &&
    minY <= viewport.max.y
  );
}
