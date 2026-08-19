import {
  polygonArea,
  validatePolygon,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import {
  numericValue,
  squareMillimetres,
  squareMillimetresToSquareMetres,
} from '@house-technical-designer/units';

export interface SolarObstacle {
  readonly id: string;
  /** Plan-projected footprint in persisted millimetre coordinates. */
  readonly footprint: Polygon2D;
  readonly heightMm?: number;
  readonly enabled: boolean;
}

export interface SolarExclusionZone {
  readonly id: string;
  readonly polygon: Polygon2D;
  readonly reason?: string;
  readonly enabled: boolean;
}

export interface RoofSolarSurface {
  readonly id: string;
  readonly sourceRoofFaceId: string;
  /** Horizontal plan projection in persisted millimetre coordinates. */
  readonly polygon: Polygon2D;
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
  readonly obstacles: readonly SolarObstacle[];
  readonly exclusionZones: readonly SolarExclusionZone[];
}

export interface SolarSurfaceAnalysis {
  readonly surfaceId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly projectedAreaM2: number;
  readonly planeAreaM2: number;
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
  readonly warnings: readonly SolarSurfaceIssue[];
}

export interface SolarSurfaceIssue {
  readonly code:
    | 'PV_INVALID_ID'
    | 'PV_INVALID_POLYGON'
    | 'PV_INVALID_ORIENTATION'
    | 'PV_DUPLICATE_ID'
    | 'PV_INVALID_OBSTACLE'
    | 'PV_UNKNOWN_OBSTACLE_HEIGHT';
  readonly path: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export function validateRoofSolarSurface(
  surface: RoofSolarSurface,
): readonly SolarSurfaceIssue[] {
  const issues: SolarSurfaceIssue[] = [];
  if (surface.id.trim() === '' || surface.sourceRoofFaceId.trim() === '')
    issues.push(
      issue(
        'PV_INVALID_ID',
        'id',
        'ERROR',
        'Solar surface and source roof face IDs must not be empty.',
      ),
    );
  appendPolygonIssues(surface.polygon, 'polygon', issues);
  if (
    !Number.isFinite(surface.azimuthDeg) ||
    surface.azimuthDeg < 0 ||
    surface.azimuthDeg >= 360 ||
    !Number.isFinite(surface.tiltDeg) ||
    surface.tiltDeg < 0 ||
    surface.tiltDeg >= 90
  )
    issues.push(
      issue(
        'PV_INVALID_ORIENTATION',
        'orientation',
        'ERROR',
        'Azimuth must be in [0, 360) and tilt in [0, 90).',
      ),
    );
  validateObstacles(surface.obstacles, issues);
  validateExclusions(surface.exclusionZones, issues);
  return issues;
}

export function createRoofSolarSurface(
  surface: RoofSolarSurface,
): RoofSolarSurface {
  const errors = validateRoofSolarSurface(surface).filter(
    ({ severity }) => severity === 'ERROR',
  );
  if (errors.length > 0)
    throw new RangeError(
      errors.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  return structuredClone(surface);
}

export function analyzeRoofSolarSurface(
  surface: RoofSolarSurface,
): SolarSurfaceAnalysis {
  const issues = validateRoofSolarSurface(surface);
  const errors = issues.filter(({ severity }) => severity === 'ERROR');
  if (errors.length > 0)
    throw new RangeError(
      errors.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  const projectedAreaM2 = numericValue(
    squareMillimetresToSquareMetres(
      squareMillimetres(polygonArea(surface.polygon)),
    ),
  );
  return {
    surfaceId: surface.id,
    status: issues.length === 0 ? 'OK' : 'PARTIAL',
    projectedAreaM2,
    planeAreaM2: projectedAreaM2 / Math.cos((surface.tiltDeg * Math.PI) / 180),
    azimuthDeg: surface.azimuthDeg,
    tiltDeg: surface.tiltDeg,
    warnings: issues,
  };
}

function validateObstacles(
  obstacles: readonly SolarObstacle[],
  issues: SolarSurfaceIssue[],
): void {
  const ids = new Set<string>();
  obstacles.forEach((obstacle, index) => {
    const path = `obstacles[${index}]`;
    validateUniqueId(obstacle.id, `${path}.id`, ids, issues);
    appendPolygonIssues(obstacle.footprint, `${path}.footprint`, issues);
    if (obstacle.heightMm === undefined) {
      if (obstacle.enabled)
        issues.push(
          issue(
            'PV_UNKNOWN_OBSTACLE_HEIGHT',
            `${path}.heightMm`,
            'WARNING',
            `Enabled obstacle ${obstacle.id} height is unknown.`,
          ),
        );
    } else if (!Number.isFinite(obstacle.heightMm) || obstacle.heightMm <= 0)
      issues.push(
        issue(
          'PV_INVALID_OBSTACLE',
          `${path}.heightMm`,
          'ERROR',
          `Obstacle ${obstacle.id} height must be finite and positive.`,
        ),
      );
  });
}

function validateExclusions(
  zones: readonly SolarExclusionZone[],
  issues: SolarSurfaceIssue[],
): void {
  const ids = new Set<string>();
  zones.forEach((zone, index) => {
    const path = `exclusionZones[${index}]`;
    validateUniqueId(zone.id, `${path}.id`, ids, issues);
    appendPolygonIssues(zone.polygon, `${path}.polygon`, issues);
    if (zone.reason !== undefined && zone.reason.trim() === '')
      issues.push(
        issue(
          'PV_INVALID_ID',
          `${path}.reason`,
          'ERROR',
          'Exclusion reason must not be empty when provided.',
        ),
      );
  });
}

function appendPolygonIssues(
  polygon: Polygon2D,
  path: string,
  issues: SolarSurfaceIssue[],
): void {
  for (const geometryIssue of validatePolygon(polygon))
    issues.push(
      issue('PV_INVALID_POLYGON', path, 'ERROR', geometryIssue.message),
    );
}

function validateUniqueId(
  id: string,
  path: string,
  ids: Set<string>,
  issues: SolarSurfaceIssue[],
): void {
  if (id.trim() === '')
    issues.push(issue('PV_INVALID_ID', path, 'ERROR', 'ID must not be empty.'));
  if (ids.has(id))
    issues.push(issue('PV_DUPLICATE_ID', path, 'ERROR', `Duplicate ID ${id}.`));
  ids.add(id);
}

function issue(
  code: SolarSurfaceIssue['code'],
  path: string,
  severity: SolarSurfaceIssue['severity'],
  message: string,
): SolarSurfaceIssue {
  return { code, path, severity, message };
}
