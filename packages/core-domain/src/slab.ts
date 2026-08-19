import {
  validatePolygon,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { AssemblyId } from '@house-technical-designer/assemblies';
import type { LevelId, SlabId } from './ids.js';

export type SlabRole = 'FLOOR' | 'FOUNDATION' | 'TERRACE' | 'OTHER';

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
  return issues;
}
