import type { Level, Project } from './types.js';
import type { Slab } from './slab.js';
import { allRoofPlanes } from './roof.js';
import {
  resolveRoofGeometry,
  resolveWallGeometry,
  type ResolvedWallGeometry,
} from './resolved-geometry.js';
import { polygonArea } from '@house-technical-designer/geometry';

/**
 * What separates the heated inside of the house from everything else.
 *
 * The thermal calculation used to be a list of exterior walls and nothing
 * else. A window was subtracted from its wall and never put back as a window:
 * a wall of twenty square metres with four of glass was computed as sixteen
 * square metres of masonry and four square metres of nothing. The roof was in
 * the model, resolved, and absent from the envelope. So were the floors.
 *
 * This says what the envelope is — one list, one kind per element, one
 * boundary condition — and leaves what each element is *made of* to whoever
 * holds the assemblies and the catalogue. Nothing here is persisted.
 */
export const ENVELOPE_ELEMENT_KINDS = [
  'WALL_OPAQUE',
  'WINDOW',
  'DOOR',
  'ROOF',
  'FLOOR_GROUND',
  'CEILING',
  'OTHER',
] as const;
export type EnvelopeElementKind = (typeof ENVELOPE_ELEMENT_KINDS)[number];

/** What is on the other side of an element. */
export const BOUNDARY_CONDITIONS = ['EXTERIOR', 'GROUND', 'UNHEATED'] as const;
export type BoundaryCondition = (typeof BOUNDARY_CONDITIONS)[number];

export interface EnvelopeElement {
  readonly id: string;
  /** The object of the project this stands for. */
  readonly sourceEntityId: string;
  readonly kind: EnvelopeElementKind;
  readonly levelId: string;
  readonly boundaryCondition: BoundaryCondition;
  /** The whole of it, openings included. */
  readonly grossAreaM2?: number;
  /** What is left once the openings are taken out. */
  readonly netAreaM2?: number;
  /** What it is built of, for an element built of layers. */
  readonly assemblyId?: string;
  /** The catalogue entry it stands for, for an element bought as a whole. */
  readonly definitionId?: string;
  /** Why its area is unknown, when it is. */
  readonly unresolved?: string;
}

function slabAreaM2(slab: Slab): number {
  return polygonArea(slab.polygon) / 1_000_000;
}

/**
 * What a slab bounds.
 *
 * A floor on the lowest storey sits on the ground; a floor between two heated
 * storeys separates nothing and is not part of the envelope. A terrace is a
 * roof one can stand on. A ceiling on the topmost storey closes the house.
 * These are stated rules, and a slab the rules do not cover stays out of the
 * envelope rather than being counted as an outside wall.
 */
function slabEnvelope(
  slab: Slab,
  level: Level,
  lowest: boolean,
  highest: boolean,
): { kind: EnvelopeElementKind; boundary: BoundaryCondition } | undefined {
  switch (slab.role) {
    case 'FOUNDATION':
      return { kind: 'FLOOR_GROUND', boundary: 'GROUND' };
    case 'FLOOR':
      return lowest ? { kind: 'FLOOR_GROUND', boundary: 'GROUND' } : undefined;
    case 'TERRACE':
      return { kind: 'ROOF', boundary: 'EXTERIOR' };
    case 'CEILING':
      return highest && level.roofs.length === 0
        ? { kind: 'CEILING', boundary: 'EXTERIOR' }
        : undefined;
    default:
      return undefined;
  }
}

function openingKind(openingType: string): EnvelopeElementKind {
  if (openingType === 'WINDOW') return 'WINDOW';
  if (openingType === 'DOOR') return 'DOOR';
  return 'OTHER';
}

/**
 * The envelope a project describes.
 *
 * Every exterior wall net of what is cut through it, every one of those
 * openings as itself, every roof plane, and the slabs that actually separate
 * the heated house from the ground or the sky.
 */
export function resolveEnvelope(project: Project): readonly EnvelopeElement[] {
  const levels = project.building.levels;
  const elevations = levels.map(({ elevationMm }) => elevationMm);
  const lowest = Math.min(...elevations);
  const highest = Math.max(...elevations);
  const elements: EnvelopeElement[] = [];

  for (const level of levels) {
    const exterior = new Set(
      level.walls
        .filter(({ role }) => role === 'EXTERIOR')
        .map(({ id }) => id as string),
    );
    for (const wall of level.walls) {
      if (wall.role !== 'EXTERIOR') continue;
      const resolved: ResolvedWallGeometry = resolveWallGeometry(
        project,
        wall,
        level,
      );
      elements.push({
        id: `envelope:wall:${wall.id}`,
        sourceEntityId: wall.id,
        kind: 'WALL_OPAQUE',
        levelId: level.id,
        boundaryCondition: 'EXTERIOR',
        assemblyId: wall.assemblyId,
        ...(resolved.grossAreaM2 === undefined
          ? {}
          : { grossAreaM2: resolved.grossAreaM2 }),
        ...(resolved.netAreaM2 === undefined
          ? {}
          : { netAreaM2: resolved.netAreaM2 }),
        ...(resolved.unresolved === undefined
          ? {}
          : { unresolved: resolved.unresolved }),
      });
    }
    // A window taken out of a wall is not a hole in the house: it is a window,
    // and it carries a transmittance of its own.
    for (const opening of level.openings) {
      if (!exterior.has(opening.hostElementId)) continue;
      const areaM2 = (opening.widthMm * opening.heightMm) / 1_000_000;
      elements.push({
        id: `envelope:opening:${opening.id}`,
        sourceEntityId: opening.id,
        kind: openingKind(opening.openingType),
        levelId: level.id,
        boundaryCondition: 'EXTERIOR',
        grossAreaM2: areaM2,
        netAreaM2: areaM2,
        ...(opening.definitionId === undefined
          ? {}
          : { definitionId: opening.definitionId }),
      });
    }
    for (const plane of allRoofPlanes(level)) {
      const resolved = resolveRoofGeometry(plane, level);
      elements.push({
        id: `envelope:roof:${plane.id}`,
        sourceEntityId: plane.id,
        kind: 'ROOF',
        levelId: level.id,
        boundaryCondition: 'EXTERIOR',
        assemblyId: plane.assemblyId,
        grossAreaM2: resolved.surfaceAreaM2,
        netAreaM2: resolved.surfaceAreaM2,
      });
    }
    for (const slab of level.slabs) {
      const bound = slabEnvelope(
        slab,
        level,
        level.elevationMm === lowest,
        level.elevationMm === highest,
      );
      if (bound === undefined) continue;
      const areaM2 = slabAreaM2(slab);
      elements.push({
        id: `envelope:slab:${slab.id}`,
        sourceEntityId: slab.id,
        kind: bound.kind,
        levelId: level.id,
        boundaryCondition: bound.boundary,
        assemblyId: slab.assemblyId,
        grossAreaM2: areaM2,
        netAreaM2: areaM2,
      });
    }
  }
  return elements;
}

/** The envelope's total area, counting only what could be measured. */
export function envelopeAreaM2(elements: readonly EnvelopeElement[]): number {
  return elements.reduce((sum, { netAreaM2 }) => sum + (netAreaM2 ?? 0), 0);
}
