import { describe, expect, it } from 'vitest';
import {
  analyzeRoofSolarSurface,
  createRoofSolarSurface,
  validateRoofSolarSurface,
  type RoofSolarSurface,
} from './solar-surface.js';

const surface: RoofSolarSurface = {
  id: 'south-roof',
  sourceRoofFaceId: 'roof-face-1',
  polygon: {
    outer: [
      { x: 0, y: 0 },
      { x: 10_000, y: 0 },
      { x: 10_000, y: 5_000 },
      { x: 0, y: 5_000 },
    ],
  },
  azimuthDeg: 180,
  tiltDeg: 30,
  obstacles: [
    {
      id: 'chimney',
      footprint: {
        outer: [
          { x: 1_000, y: 1_000 },
          { x: 1_500, y: 1_000 },
          { x: 1_500, y: 1_500 },
          { x: 1_000, y: 1_500 },
        ],
      },
      heightMm: 800,
      enabled: true,
    },
  ],
  exclusionZones: [
    {
      id: 'ridge-clearance',
      polygon: {
        outer: [
          { x: 0, y: 4_500 },
          { x: 10_000, y: 4_500 },
          { x: 10_000, y: 5_000 },
          { x: 0, y: 5_000 },
        ],
      },
      reason: 'Design clearance',
      enabled: true,
    },
  ],
};

describe('roof solar surfaces', () => {
  it('creates a surface tied to source roof geometry', () => {
    expect(validateRoofSolarSurface(surface)).toEqual([]);
    expect(createRoofSolarSurface(surface)).toEqual(surface);
  });

  it('derives projected and inclined areas without persisting either', () => {
    const result = analyzeRoofSolarSurface(surface);
    expect(result.projectedAreaM2).toBe(50);
    expect(result.planeAreaM2).toBeCloseTo(50 / Math.cos(Math.PI / 6));
    expect('areaM2' in surface).toBe(false);
  });

  it('supports flat and steep roof faces with explicit orientation', () => {
    expect(
      analyzeRoofSolarSurface({ ...surface, tiltDeg: 0 }).planeAreaM2,
    ).toBe(50);
    expect(
      analyzeRoofSolarSurface({ ...surface, tiltDeg: 60 }).planeAreaM2,
    ).toBeCloseTo(100);
  });

  it('keeps an enabled obstacle with unknown height explicit', () => {
    const obstacle = surface.obstacles[0]!;
    const withoutHeight: RoofSolarSurface = {
      ...surface,
      obstacles: [
        {
          id: obstacle.id,
          footprint: obstacle.footprint,
          enabled: obstacle.enabled,
        },
      ],
    };
    expect(analyzeRoofSolarSurface(withoutHeight)).toMatchObject({
      status: 'PARTIAL',
      warnings: [{ code: 'PV_UNKNOWN_OBSTACLE_HEIGHT', severity: 'WARNING' }],
    });
    expect(createRoofSolarSurface(withoutHeight)).toEqual(withoutHeight);
  });

  it('rejects invalid orientation, polygons, obstacles, and duplicate IDs', () => {
    const invalid: RoofSolarSurface = {
      ...surface,
      azimuthDeg: 360,
      tiltDeg: 90,
      obstacles: [
        { ...surface.obstacles[0]!, heightMm: -1 },
        { ...surface.obstacles[0]! },
      ],
      exclusionZones: [
        {
          id: 'invalid',
          polygon: {
            outer: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ],
          },
          enabled: true,
        },
      ],
    };
    expect(validateRoofSolarSurface(invalid).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'PV_INVALID_ORIENTATION',
        'PV_INVALID_OBSTACLE',
        'PV_DUPLICATE_ID',
        'PV_INVALID_POLYGON',
      ]),
    );
    expect(() => createRoofSolarSurface(invalid)).toThrow(
      /orientation|height/i,
    );
  });
});
