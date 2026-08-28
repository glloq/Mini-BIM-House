/**
 * Which parts of the envelope belong to which room.
 *
 * The heating load of a room was the building's total transmission, shared out
 * in proportion to floor area. It is an honest fallback and it was recorded as
 * one, but it cannot tell two rooms of 15 m² apart when one has three façades
 * and a large north window and the other has one façade and a small south one.
 * They received almost the same load, and the radiator sized from it was wrong
 * in both.
 *
 * What a room actually loses through is knowable: the walls that enclose it,
 * the openings cut into those walls, and its share of what is above and below.
 * The first two are the ones that differ from room to room.
 */
import {
  polygonArea,
  polygonContains,
  type Point2D,
} from '@house-technical-designer/geometry';

import { resolveEnvelope, type EnvelopeElement } from './envelope.js';
import { resolveSpaceGeometry, spaceAnchor } from './resolved-geometry.js';
import { detectSpaceBoundaries } from './space.js';
import type { Level, Project } from './types.js';

export interface RoomEnvelope {
  readonly spaceId: string;
  readonly levelId: string;
  /** The elements this room loses heat through, by identity. */
  readonly elementIds: readonly string[];
  /**
   * How the horizontal elements were shared out.
   *
   * A floor and a roof are not attributed to a room by geometry here: what is
   * above and below is shared by area, and this says which share this room
   * took so a reader can tell the two halves of the answer apart.
   */
  readonly horizontalShare: number;
  /** Why this room could not be given its own walls, when it could not. */
  readonly unresolved?: string;
}

/** Where a room stands, however it was described. */
function roomPoint(level: Level, spaceId: string): Point2D | undefined {
  const space = level.spaces.find(({ id }) => id === spaceId);
  if (space === undefined) return undefined;
  if (space.boundaryMode === 'AUTO') return space.anchor;
  return spaceAnchor(resolveSpaceGeometry(space, level));
}

function roomAreaM2(level: Level, spaceId: string): number | undefined {
  const space = level.spaces.find(({ id }) => id === spaceId);
  if (space === undefined) return undefined;
  const geometry = resolveSpaceGeometry(space, level);
  return geometry.polygon === undefined
    ? undefined
    : polygonArea(geometry.polygon) / 1_000_000;
}

/**
 * The envelope, room by room.
 *
 * Walls and their openings are attributed by geometry: the enclosure the room
 * stands in is the set of walls around it. Roofs, ceilings and ground floors
 * are shared by floor area within the storey — they genuinely are shared, and
 * a room does not own a piece of roof the way it owns a façade.
 */
export function envelopeByRoom(project: Project): readonly RoomEnvelope[] {
  const elements = resolveEnvelope(project);
  const byLevel = new Map<string, EnvelopeElement[]>();
  for (const element of elements) {
    const bucket = byLevel.get(element.levelId) ?? [];
    bucket.push(element);
    byLevel.set(element.levelId, bucket);
  }
  const rooms: RoomEnvelope[] = [];
  for (const level of project.building.levels) {
    const levelElements = byLevel.get(level.id) ?? [];
    const vertical = levelElements.filter(
      ({ kind }) =>
        kind === 'WALL_OPAQUE' || kind === 'WINDOW' || kind === 'DOOR',
    );
    const horizontal = levelElements.filter(
      ({ kind }) =>
        kind === 'ROOF' || kind === 'CEILING' || kind === 'FLOOR_GROUND',
    );
    const detection = detectSpaceBoundaries(level.walls);
    const areas = new Map(
      level.spaces.map(({ id }) => [id as string, roomAreaM2(level, id) ?? 0]),
    );
    const totalArea = [...areas.values()].reduce((sum, area) => sum + area, 0);
    // The wall an opening was cut into, so a window follows its wall.
    const openingWall = new Map<string, string>();
    for (const opening of level.openings)
      openingWall.set(opening.id, opening.host.id);

    for (const space of level.spaces) {
      const share = totalArea > 0 ? (areas.get(space.id) ?? 0) / totalArea : 0;
      const point = roomPoint(level, space.id);
      const face =
        point === undefined || detection.status !== 'OK'
          ? undefined
          : detection.boundaries.find(({ polygon }) =>
              polygonContains(polygon, point),
            );
      if (face === undefined) {
        rooms.push({
          spaceId: space.id,
          levelId: level.id,
          elementIds: horizontal.map(({ id }) => id),
          horizontalShare: share,
          unresolved: `Les murs du niveau ${level.name} n’entourent pas ${space.name} d’un enclos identifiable : ses parois verticales ne lui sont pas attribuées.`,
        });
        continue;
      }
      const walls = new Set<string>(
        face.sourceWallIds.map((id) => id as unknown as string),
      );
      const own = vertical.filter((element) => {
        if (element.kind === 'WALL_OPAQUE')
          return walls.has(element.sourceEntityId);
        const host = openingWall.get(element.sourceEntityId);
        return host !== undefined && walls.has(host);
      });
      rooms.push({
        spaceId: space.id,
        levelId: level.id,
        elementIds: [
          ...own.map(({ id }) => id),
          ...horizontal.map(({ id }) => id),
        ],
        horizontalShare: share,
      });
    }
  }
  return rooms;
}
