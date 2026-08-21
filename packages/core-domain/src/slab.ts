import {
  validatePolygon,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { AssemblyId } from '@house-technical-designer/assemblies';
import type { LevelId, SlabId } from './ids.js';

/**
 * What a horizontal element is for.
 *
 * A ceiling is one of them: a suspended ceiling is a horizontal element with
 * its own build-up, sitting at an offset from the storey, and the assemblies
 * already carry a CEILING category it can be made of. Giving it a family of
 * its own would have been a second type describing the same geometry, and two
 * types describing one thing eventually disagree.
 */
export const SLAB_ROLES = [
  'FLOOR',
  'CEILING',
  'FOUNDATION',
  'TERRACE',
  'OTHER',
] as const;
export type SlabRole = (typeof SLAB_ROLES)[number];

export function isSlabRole(value: string): value is SlabRole {
  return (SLAB_ROLES as readonly string[]).includes(value);
}

export interface Slab {
  readonly id: SlabId;
  readonly type: 'SLAB';
  readonly levelId: LevelId;
  readonly polygon: Polygon2D;
  readonly assemblyId: AssemblyId;
  readonly elevationOffsetMm: number;
  readonly role: SlabRole;
}

export function validateSlab(slab: Slab): readonly string[] {
  const issues = validatePolygon(slab.polygon).map(({ message }) => message);
  if (!Number.isFinite(slab.elevationOffsetMm))
    issues.push('elevationOffsetMm must be finite');
  if (!isSlabRole(slab.role))
    issues.push(`role must be one of ${SLAB_ROLES.join(', ')}`);
  return issues;
}
