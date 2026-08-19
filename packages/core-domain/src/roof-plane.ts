import {
  validatePolygon,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { AssemblyId } from '@house-technical-designer/assemblies';
import type { LevelId, RoofPlaneId } from './ids.js';

/** MVP planar roof contract. Connected roof topology is deliberately deferred. */
export interface RoofPlane {
  readonly id: RoofPlaneId;
  readonly type: 'ROOF_PLANE';
  readonly levelId: LevelId;
  readonly footprint: Polygon2D;
  readonly assemblyId: AssemblyId;
  readonly slopeDeg: number;
  readonly azimuthDeg: number;
  readonly baseElevationMm: number;
}

export function validateRoofPlane(roof: RoofPlane): readonly string[] {
  const issues = validatePolygon(roof.footprint).map(({ message }) => message);
  if (
    !Number.isFinite(roof.slopeDeg) ||
    roof.slopeDeg < 0 ||
    roof.slopeDeg >= 90
  )
    issues.push('slopeDeg must be finite and in [0, 90)');
  if (!Number.isFinite(roof.azimuthDeg))
    issues.push('azimuthDeg must be finite');
  if (!Number.isFinite(roof.baseElevationMm))
    issues.push('baseElevationMm must be finite');
  return issues;
}
