import type { SceneGeometry } from '@house-technical-designer/drawing-engine';
import type { Point2D } from '@house-technical-designer/geometry';
import { translatedPolygon } from './editing-commands.js';

/**
 * The shape a dragged object would have once dropped.
 *
 * The ghost and the command must never describe two different things: a
 * stairwell left behind by the preview and carried by the edit would be a
 * drawing the user cannot trust. The outlines go through the very function the
 * command uses, so they cannot drift apart.
 */
export function carriedGeometry(
  geometry: SceneGeometry,
  delta: Point2D,
): SceneGeometry {
  const carried = (point: Point2D): Point2D => ({
    x: point.x + delta.x,
    y: point.y + delta.y,
  });
  if (geometry.kind === 'POLYGON')
    return { ...geometry, polygon: translatedPolygon(geometry.polygon, delta) };
  if (geometry.kind === 'POLYLINE')
    return {
      ...geometry,
      polyline: {
        ...geometry.polyline,
        points: geometry.polyline.points.map(carried),
      },
    };
  if (geometry.kind === 'POINT')
    return { ...geometry, point: carried(geometry.point) };
  return { ...geometry, anchor: carried(geometry.anchor) };
}
