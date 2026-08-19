import type { GeometryTolerance } from './types.js';

/** Centralized defaults; callers may explicitly supply another tolerance. */
export const DEFAULT_GEOMETRY_TOLERANCE: GeometryTolerance = Object.freeze({
  pointMergeMm: 1e-6,
  collinearMm: 1e-6,
  angularRad: 1e-9,
  areaMm2: 1e-6,
});

export const SNAP_EPS_MM = 0.5;
export const TOPOLOGY_EPS_MM = 0.1;
