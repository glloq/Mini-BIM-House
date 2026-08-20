import type { Level, Project } from '@house-technical-designer/core-domain';
import {
  UpdateWallCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';
import { openingAnchor } from './grips.js';
import type {
  ObjectBounds,
  ObjectContextAction,
  ObjectRelationship,
} from './object-editors.js';

function levelOf(project: Project, levelId: string): Level | undefined {
  return project.building.levels.find(({ id }) => id === levelId);
}

function extentOf(points: readonly Point2D[]): ObjectBounds | undefined {
  if (points.length === 0) return undefined;
  return {
    min: {
      x: Math.min(...points.map(({ x }) => x)),
      y: Math.min(...points.map(({ y }) => y)),
    },
    max: {
      x: Math.max(...points.map(({ x }) => x)),
      y: Math.max(...points.map(({ y }) => y)),
    },
  };
}

export function wallBounds(
  project: Project,
  levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  const wall = levelOf(project, levelId)?.walls.find(
    ({ id }) => id === objectId,
  );
  return wall === undefined ? undefined : extentOf(wall.path.points);
}

export function slabBounds(
  project: Project,
  levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  const slab = levelOf(project, levelId)?.slabs.find(
    ({ id }) => id === objectId,
  );
  return slab === undefined ? undefined : extentOf(slab.polygon.outer);
}

export function roofBounds(
  project: Project,
  levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  const roof = levelOf(project, levelId)?.roofs.find(
    ({ id }) => id === objectId,
  );
  return roof === undefined ? undefined : extentOf(roof.footprint.outer);
}

/**
 * Where an opening sits, read from the wall that hosts it.
 *
 * An opening holds a distance along its wall rather than a position: where it
 * is on the plan is a fact of the wall, and asking the wall is the only way to
 * answer without repeating what the drawing engine already knows.
 */
export function openingBounds(
  project: Project,
  levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  const level = levelOf(project, levelId);
  const opening = level?.openings.find(({ id }) => id === objectId);
  if (level === undefined || opening === undefined) return undefined;
  const host = level.walls.find(({ id }) => id === opening.hostElementId);
  if (host === undefined) return undefined;
  const start = openingAnchor(host.path.points, opening.offsetAlongHostMm, 0);
  const end = openingAnchor(
    host.path.points,
    opening.offsetAlongHostMm + opening.widthMm,
    0,
  );
  return start === undefined || end === undefined
    ? undefined
    : extentOf([start, end]);
}

/**
 * The extent of a room, when the room states one.
 *
 * A room whose boundary is detected from the walls has no outline of its own;
 * measuring it means measuring the walls, which is the drawing engine's work
 * rather than a fact of the model.
 */
export function spaceBounds(
  project: Project,
  levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  const space = levelOf(project, levelId)?.spaces.find(
    ({ id }) => id === objectId,
  );
  return space === undefined || space.boundaryMode !== 'MANUAL'
    ? undefined
    : extentOf(space.manualPolygon.outer);
}

export function networkNodeBounds(
  project: Project,
  _levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  const node = (project.systems ?? [])
    .flatMap((network) => network.nodes)
    .find(({ id }) => id === objectId);
  return node === undefined ? undefined : extentOf([node.position]);
}

/**
 * Walls built the same way and playing the same part.
 *
 * Two exterior walls of the same assembly are alike; the same assembly used as
 * a partition is not the same thing, and changing all of one would change the
 * other by surprise.
 */
export function similarWalls(
  project: Project,
  levelId: string,
  objectId: string,
): readonly string[] {
  const level = levelOf(project, levelId);
  const wall = level?.walls.find(({ id }) => id === objectId);
  if (level === undefined || wall === undefined) return [];
  return level.walls
    .filter(
      (candidate) =>
        candidate.assemblyId === wall.assemblyId &&
        candidate.role === wall.role,
    )
    .map(({ id }) => id as string);
}

/** Openings of the same kind and the same size. */
export function similarOpenings(
  project: Project,
  levelId: string,
  objectId: string,
): readonly string[] {
  const level = levelOf(project, levelId);
  const opening = level?.openings.find(({ id }) => id === objectId);
  if (level === undefined || opening === undefined) return [];
  return level.openings
    .filter(
      (candidate) =>
        candidate.openingType === opening.openingType &&
        candidate.widthMm === opening.widthMm &&
        candidate.heightMm === opening.heightMm,
    )
    .map(({ id }) => id as string);
}

/** Slabs built the same way and playing the same part. */
export function similarSlabs(
  project: Project,
  levelId: string,
  objectId: string,
): readonly string[] {
  const level = levelOf(project, levelId);
  const slab = level?.slabs.find(({ id }) => id === objectId);
  if (level === undefined || slab === undefined) return [];
  return level.slabs
    .filter(
      (candidate) =>
        candidate.assemblyId === slab.assemblyId &&
        candidate.role === slab.role,
    )
    .map(({ id }) => id as string);
}

/**
 * What a wall offers that other objects do not.
 *
 * Which face the drawn line stands for is a decision taken when the wall is
 * drawn and regretted afterwards: the layers go on the other side, and the
 * whole wall has to move by its own thickness to fix it by hand.
 */
export function wallContextActions(
  project: Project,
  levelId: string,
  objectId: string,
): readonly ObjectContextAction[] {
  const wall = levelOf(project, levelId)?.walls.find(
    ({ id }) => id === objectId,
  );
  if (wall === undefined) return [];
  const opposite =
    wall.referenceSide === 'LEFT'
      ? 'RIGHT'
      : wall.referenceSide === 'RIGHT'
        ? 'LEFT'
        : 'CENTER';
  return [
    {
      id: 'wall.flipReference',
      label:
        wall.referenceSide === 'CENTER'
          ? 'Face de référence : sur l’axe'
          : `Basculer la face de référence sur ${opposite === 'LEFT' ? 'gauche' : 'droite'}`,
      command: (): ProjectCommand | undefined =>
        wall.referenceSide === 'CENTER'
          ? undefined
          : new UpdateWallCommand(levelId, wall.id, {
              referenceSide: opposite,
            }),
    },
  ];
}

/**
 * What a wall carries, and what it cannot be taken away from.
 *
 * The domain refuses to delete a wall that still hosts an opening, and it is
 * right; before this, the refusal named a rule and not the three openings the
 * user then had to look for by eye.
 */
export function wallRelationships(
  project: Project,
  levelId: string,
  objectId: string,
): readonly ObjectRelationship[] {
  const level = levelOf(project, levelId);
  const wall = level?.walls.find(({ id }) => id === objectId);
  if (level === undefined || wall === undefined) return [];
  const openings = level.openings
    .filter(({ hostElementId }) => hostElementId === wall.id)
    .map(({ id }) => id as string);
  return openings.length === 0
    ? []
    : [{ role: 'Ouvertures portées', objectIds: openings }];
}

/** The wall an opening is cut into. */
export function openingRelationships(
  project: Project,
  levelId: string,
  objectId: string,
): readonly ObjectRelationship[] {
  const level = levelOf(project, levelId);
  const opening = level?.openings.find(({ id }) => id === objectId);
  if (level === undefined || opening === undefined) return [];
  const host = level.walls.find(({ id }) => id === opening.hostElementId);
  return host === undefined ? [] : [{ role: 'Mur hôte', objectIds: [host.id] }];
}

/**
 * The nodes a node is connected to, through the segments of its network.
 *
 * A segment joins two ports and a port belongs to a node; asking what a
 * manifold feeds means following that chain, which nothing else in the editor
 * does today.
 */
export function networkNodeRelationships(
  project: Project,
  _levelId: string,
  objectId: string,
): readonly ObjectRelationship[] {
  for (const network of project.systems ?? []) {
    if (!network.nodes.some(({ id }) => id === objectId)) continue;
    const nodeOfPort = new Map(
      network.ports.map((port) => [port.id, port.nodeId] as const),
    );
    const neighbours = new Set<string>();
    for (const edge of network.edges) {
      const from = nodeOfPort.get(edge.fromPortId);
      const to = nodeOfPort.get(edge.toPortId);
      if (from === objectId && to !== undefined) neighbours.add(to);
      if (to === objectId && from !== undefined) neighbours.add(from);
    }
    return neighbours.size === 0
      ? []
      : [{ role: 'Nœuds raccordés', objectIds: [...neighbours] }];
  }
  return [];
}
