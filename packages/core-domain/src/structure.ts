import type { Point2D } from '@house-technical-designer/geometry';
import type { LevelId, StructuralMemberId } from './ids.js';

/**
 * What a structural member is.
 *
 * A column stands at a point, a beam runs between two, a footing sits under a
 * column. Nothing here computes anything: these are objects of the building,
 * and a structural calculation will later read them. Waiting for the engine
 * before allowing the objects would be waiting to describe a house before
 * being able to check it.
 */
export const STRUCTURAL_MEMBER_KINDS = ['COLUMN', 'BEAM', 'FOOTING'] as const;
export type StructuralMemberKind = (typeof STRUCTURAL_MEMBER_KINDS)[number];

export function isStructuralMemberKind(
  value: string,
): value is StructuralMemberKind {
  return (STRUCTURAL_MEMBER_KINDS as readonly string[]).includes(value);
}

export interface StructuralMember {
  readonly id: StructuralMemberId;
  readonly type: 'STRUCTURAL_MEMBER';
  readonly levelId: LevelId;
  readonly kind: StructuralMemberKind;
  /**
   * Where it stands: one point for a column or a footing, two for a beam.
   *
   * The same field for the three, because the difference is what the member is
   * and not how many points describe it.
   */
  readonly path: readonly Point2D[];
  /** Across the member, in millimetres. */
  readonly widthMm: number;
  /** Along the member's own depth, in millimetres. */
  readonly depthMm: number;
  /** Height above the storey it stands on, when it has one. */
  readonly elevationMm?: number;
  /** How tall a column is, or how deep a footing goes. */
  readonly heightMm?: number;
  /** The material it is made of, when the project names one. */
  readonly materialId?: string;
}

export function validateStructuralMember(
  member: StructuralMember,
): readonly string[] {
  const issues: string[] = [];
  if (!isStructuralMemberKind(member.kind))
    issues.push(`kind must be one of ${STRUCTURAL_MEMBER_KINDS.join(', ')}`);
  const wanted = member.kind === 'BEAM' ? 2 : 1;
  if (member.path.length !== wanted)
    issues.push(
      `a ${member.kind.toLowerCase()} is described by ${wanted} point(s)`,
    );
  if (
    member.path.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))
  )
    issues.push('path must be finite');
  if (member.kind === 'BEAM' && member.path.length === 2) {
    const [from, to] = member.path;
    if (
      from !== undefined &&
      to !== undefined &&
      from.x === to.x &&
      from.y === to.y
    )
      issues.push('a beam runs between two distinct points');
  }
  for (const [label, value] of [
    ['widthMm', member.widthMm],
    ['depthMm', member.depthMm],
  ] as const)
    if (!Number.isFinite(value) || value <= 0)
      issues.push(`${label} must be finite and greater than zero`);
  for (const [label, value] of [
    ['elevationMm', member.elevationMm],
    ['heightMm', member.heightMm],
  ] as const)
    if (value !== undefined && !Number.isFinite(value))
      issues.push(`${label} must be finite`);
  if (member.heightMm !== undefined && member.heightMm <= 0)
    issues.push('heightMm must be greater than zero');
  return issues;
}

/** The footprint a member covers on the plan, derived and never stored. */
export function structuralFootprint(
  member: StructuralMember,
): readonly Point2D[] {
  const half = member.widthMm / 2;
  const [from, to] = member.path;
  if (from === undefined) return [];
  if (member.kind !== 'BEAM' || to === undefined) {
    const depth = member.depthMm / 2;
    return [
      { x: from.x - half, y: from.y - depth },
      { x: from.x + half, y: from.y - depth },
      { x: from.x + half, y: from.y + depth },
      { x: from.x - half, y: from.y + depth },
    ];
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * half;
  const ny = (dx / length) * half;
  return [
    { x: from.x + nx, y: from.y + ny },
    { x: to.x + nx, y: to.y + ny },
    { x: to.x - nx, y: to.y - ny },
    { x: from.x - nx, y: from.y - ny },
  ];
}
