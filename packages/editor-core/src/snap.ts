import {
  intersectSegments,
  type Point2D,
  type Segment2D,
} from '@house-technical-designer/geometry';
import type { Camera2D, ScreenPoint } from './camera.js';
import { modelToScreen, screenToModel } from './camera.js';

export type SnapKind = 'ENDPOINT' | 'MIDPOINT' | 'INTERSECTION' | 'GRID';
export interface SnapResult {
  readonly kind: SnapKind;
  readonly point: Point2D;
  readonly distancePx: number;
}
export interface SnapOptions {
  readonly tolerancePx: number;
  readonly gridSpacingMm?: number;
}

export function findSnap(
  camera: Camera2D,
  cursor: ScreenPoint,
  segments: readonly Segment2D[],
  options: SnapOptions,
): SnapResult | undefined {
  if (!Number.isFinite(options.tolerancePx) || options.tolerancePx < 0)
    throw new RangeError('Snap tolerance must be finite and non-negative.');
  const candidates: { kind: SnapKind; point: Point2D }[] = [];
  for (const segment of segments) {
    candidates.push(
      { kind: 'ENDPOINT', point: segment.start },
      { kind: 'ENDPOINT', point: segment.end },
    );
    candidates.push({
      kind: 'MIDPOINT',
      point: {
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
      },
    });
  }
  for (let first = 0; first < segments.length; first += 1)
    for (let second = first + 1; second < segments.length; second += 1) {
      const intersection = intersectSegments(
        segments[first]!,
        segments[second]!,
      );
      if (intersection.kind === 'POINT')
        candidates.push({ kind: 'INTERSECTION', point: intersection.point });
    }
  if (options.gridSpacingMm !== undefined) {
    if (!Number.isFinite(options.gridSpacingMm) || options.gridSpacingMm <= 0)
      throw new RangeError('Grid spacing must be finite and positive.');
    const model = screenToModel(camera, cursor);
    candidates.push({
      kind: 'GRID',
      point: {
        x: Math.round(model.x / options.gridSpacingMm) * options.gridSpacingMm,
        y: Math.round(model.y / options.gridSpacingMm) * options.gridSpacingMm,
      },
    });
  }
  const priority: Record<SnapKind, number> = {
    ENDPOINT: 0,
    INTERSECTION: 1,
    MIDPOINT: 2,
    GRID: 3,
  };
  return candidates
    .map(({ kind, point }) => {
      const screen = modelToScreen(camera, point);
      return {
        kind,
        point,
        distancePx: Math.hypot(screen.x - cursor.x, screen.y - cursor.y),
      };
    })
    .filter(({ distancePx }) => distancePx <= options.tolerancePx)
    .sort(
      (a, b) =>
        a.distancePx - b.distancePx || priority[a.kind] - priority[b.kind],
    )[0];
}
