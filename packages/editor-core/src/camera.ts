import type { Point2D } from '@house-technical-designer/geometry';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}
export interface Camera2D {
  readonly centerModelMm: Point2D;
  readonly pixelsPerMm: number;
  readonly viewportWidthPx: number;
  readonly viewportHeightPx: number;
}

export function validateCamera(camera: Camera2D): void {
  const values = [
    camera.centerModelMm.x,
    camera.centerModelMm.y,
    camera.pixelsPerMm,
    camera.viewportWidthPx,
    camera.viewportHeightPx,
  ];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    camera.pixelsPerMm <= 0 ||
    camera.viewportWidthPx <= 0 ||
    camera.viewportHeightPx <= 0
  ) {
    throw new RangeError(
      'Camera values must be finite and dimensions and zoom must be positive.',
    );
  }
}

export function modelToScreen(camera: Camera2D, point: Point2D): ScreenPoint {
  validateCamera(camera);
  return {
    x:
      camera.viewportWidthPx / 2 +
      (point.x - camera.centerModelMm.x) * camera.pixelsPerMm,
    y:
      camera.viewportHeightPx / 2 +
      (point.y - camera.centerModelMm.y) * camera.pixelsPerMm,
  };
}

export function screenToModel(camera: Camera2D, point: ScreenPoint): Point2D {
  validateCamera(camera);
  return {
    x:
      camera.centerModelMm.x +
      (point.x - camera.viewportWidthPx / 2) / camera.pixelsPerMm,
    y:
      camera.centerModelMm.y +
      (point.y - camera.viewportHeightPx / 2) / camera.pixelsPerMm,
  };
}

export function panCamera(camera: Camera2D, deltaPx: ScreenPoint): Camera2D {
  validateCamera(camera);
  return {
    ...camera,
    centerModelMm: {
      x: camera.centerModelMm.x - deltaPx.x / camera.pixelsPerMm,
      y: camera.centerModelMm.y - deltaPx.y / camera.pixelsPerMm,
    },
  };
}

export function zoomCameraAt(
  camera: Camera2D,
  anchorPx: ScreenPoint,
  factor: number,
): Camera2D {
  validateCamera(camera);
  if (!Number.isFinite(factor) || factor <= 0)
    throw new RangeError('Zoom factor must be finite and positive.');
  const anchoredModelPoint = screenToModel(camera, anchorPx);
  const zoomed = { ...camera, pixelsPerMm: camera.pixelsPerMm * factor };
  const pointAfterZoom = screenToModel(zoomed, anchorPx);
  return {
    ...zoomed,
    centerModelMm: {
      x: zoomed.centerModelMm.x + anchoredModelPoint.x - pointAfterZoom.x,
      y: zoomed.centerModelMm.y + anchoredModelPoint.y - pointAfterZoom.y,
    },
  };
}
