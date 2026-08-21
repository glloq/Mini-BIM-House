import type {
  Project,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

/**
 * What kind of drawing is being kept, and the one decision that kind needs.
 *
 * A plan needs a storey, and the plan already knows which one. A section needs
 * a line and a façade needs a direction, and neither can be read off the
 * screen — so they are asked for, once, when the view is made.
 */
export type ViewCaptureKind =
  | { readonly type: 'PLAN' }
  | { readonly type: 'ROOF' }
  | { readonly type: 'SITE' }
  | { readonly type: 'SECTION'; readonly axis: SectionAxis }
  | { readonly type: 'ELEVATION'; readonly facade: Facade };

/** Which way the saw runs across the house. */
export type SectionAxis = 'EAST_WEST' | 'NORTH_SOUTH';

export type Facade = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

/** Every kind of view the panel offers, in the order it offers them. */
export const VIEW_CAPTURE_KINDS = [
  { id: 'PLAN', label: 'Plan de niveau' },
  { id: 'SECTION', label: 'Coupe' },
  { id: 'ELEVATION', label: 'Façade' },
  { id: 'ROOF', label: 'Plan de toiture' },
  { id: 'SITE', label: 'Plan de masse' },
] as const;

export const SECTION_AXES = [
  { id: 'EAST_WEST', label: 'Est-ouest' },
  { id: 'NORTH_SOUTH', label: 'Nord-sud' },
] as const;

/**
 * Which way each façade is looked at.
 *
 * The azimuth is counter-clockwise from east, as everywhere else in this
 * model, and it is the direction of the *gaze*: standing north of the house
 * and looking south is what shows the north façade.
 */
export const FACADES = [
  { id: 'NORTH', label: 'Façade nord', azimuthDeg: 270 },
  { id: 'SOUTH', label: 'Façade sud', azimuthDeg: 90 },
  { id: 'EAST', label: 'Façade est', azimuthDeg: 180 },
  { id: 'WEST', label: 'Façade ouest', azimuthDeg: 0 },
] as const;

export interface ViewCaptureRequest {
  readonly id: string;
  readonly name: string;
  readonly kind: ViewCaptureKind;
  readonly levelId?: SavedDrawingView['levelId'];
  readonly scaleDenominator: number;
  readonly layers: Readonly<Record<string, boolean>>;
  readonly graphicProfileId: string;
  readonly centreMm: Point2D;
  readonly analysisOverlayId?: string;
}

/**
 * The view a request makes, complete enough to be drawn again.
 *
 * A section is cut through the middle of what the project holds, along the
 * axis asked for: a default the user can see and move, rather than a line the
 * file does not carry. The building's own extent settles how long the cut is,
 * so a house drawn far from the origin is still cut through itself.
 */
export function capturedView(
  project: Project,
  request: ViewCaptureRequest,
): SavedDrawingView {
  const shared = {
    id: request.id,
    name: request.name,
    scaleDenominator: request.scaleDenominator,
    layers: request.layers,
    graphicProfileId: request.graphicProfileId,
    centreMm: request.centreMm,
    ...(request.analysisOverlayId === undefined
      ? {}
      : { analysisOverlayId: request.analysisOverlayId }),
  };
  const kind = request.kind;
  switch (kind.type) {
    case 'PLAN':
      return {
        ...shared,
        type: 'PLAN',
        // Only a plan is of a storey; a section crosses them all.
        ...(request.levelId === undefined ? {} : { levelId: request.levelId }),
      };
    case 'ROOF':
      return { ...shared, type: 'ROOF' };
    case 'SITE':
      return { ...shared, type: 'SITE' };
    case 'SECTION':
      return {
        ...shared,
        type: 'SECTION',
        cut: cutThrough(project, kind.axis),
      };
    case 'ELEVATION':
      return {
        ...shared,
        type: 'ELEVATION',
        viewDirectionDeg:
          FACADES.find(({ id }) => id === kind.facade)?.azimuthDeg ?? 0,
      };
  }
}

/** How far past the building a cut runs, so it crosses the outside walls. */
const OVERSHOOT_MM = 1000;

function cutThrough(
  project: Project,
  axis: SectionAxis,
): NonNullable<SavedDrawingView['cut']> {
  const points = footprintPoints(project);
  if (points.length === 0)
    return axis === 'EAST_WEST'
      ? { start: { x: -OVERSHOOT_MM, y: 0 }, end: { x: OVERSHOOT_MM, y: 0 } }
      : { start: { x: 0, y: -OVERSHOOT_MM }, end: { x: 0, y: OVERSHOOT_MM } };
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const middle = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
  return axis === 'EAST_WEST'
    ? {
        start: { x: Math.min(...xs) - OVERSHOOT_MM, y: middle.y },
        end: { x: Math.max(...xs) + OVERSHOOT_MM, y: middle.y },
      }
    : {
        start: { x: middle.x, y: Math.min(...ys) - OVERSHOOT_MM },
        end: { x: middle.x, y: Math.max(...ys) + OVERSHOOT_MM },
      };
}

function footprintPoints(project: Project): readonly Point2D[] {
  return project.building.levels.flatMap((level) => [
    ...level.walls.flatMap((wall) => wall.path.points),
    ...level.slabs.flatMap((slab) => slab.polygon.outer),
  ]);
}
