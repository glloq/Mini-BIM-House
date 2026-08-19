import { describe, expect, it } from 'vitest';
import {
  modelToScreen,
  panCamera,
  screenToModel,
  zoomCameraAt,
  type Camera2D,
} from './camera.js';
import { findSnap } from './snap.js';

const camera: Camera2D = {
  centerModelMm: { x: 1000, y: 500 },
  pixelsPerMm: 0.1,
  viewportWidthPx: 800,
  viewportHeightPx: 600,
};
describe('camera and snapping', () => {
  it('round-trips model and screen coordinates', () => {
    const point = { x: 4200, y: -200 };
    expect(screenToModel(camera, modelToScreen(camera, point))).toEqual(point);
  });
  it('keeps the model point below the cursor fixed while zooming', () => {
    const cursor = { x: 100, y: 120 };
    expect(screenToModel(zoomCameraAt(camera, cursor, 2), cursor)).toEqual(
      screenToModel(camera, cursor),
    );
  });
  it('pans in screen space', () => {
    expect(panCamera(camera, { x: 10, y: -20 }).centerModelMm).toEqual({
      x: 900,
      y: 700,
    });
  });
  it('snaps to endpoints before an equally close grid point', () => {
    expect(
      findSnap(
        camera,
        modelToScreen(camera, { x: 0, y: 0 }),
        [{ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }],
        { tolerancePx: 5, gridSpacingMm: 100 },
      ),
    ).toMatchObject({ kind: 'ENDPOINT', point: { x: 0, y: 0 } });
  });
  it('finds segment intersections', () => {
    const cursor = modelToScreen(camera, { x: 500, y: 0 });
    expect(
      findSnap(
        camera,
        cursor,
        [
          { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
          { start: { x: 500, y: -500 }, end: { x: 500, y: 500 } },
        ],
        { tolerancePx: 1 },
      ),
    ).toMatchObject({ kind: 'INTERSECTION', point: { x: 500, y: 0 } });
  });
});
