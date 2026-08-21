import type { Project } from '@house-technical-designer/core-domain';
import {
  dimensionId,
  entityId,
  isDimension,
  isTextNote,
} from '@house-technical-designer/core-domain';
import {
  DeleteDimensionCommand,
  DeleteOpeningCommand,
  DeleteWallCommand,
  ProjectEditorCommand,
  RemoveComponentCommand,
  RemoveSiteObstacleCommand,
  RemoveStairCommand,
  RemoveTextNoteCommand,
  RemoveStructuralMemberCommand,
  RemoveNetworkEdgeCommand,
  RemoveNetworkNodeCommand,
  RemoveRoofCommand,
  RemoveRoofStructureCommand,
  RemoveSlabCommand,
  RemoveSpaceCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

/**
 * How one family of objects is removed.
 *
 * Deleting used to know about three families out of seven, so a slab could be
 * selected, inspected, dragged and not deleted — the plan offered an object it
 * could not take back. Each family now says how it goes, beside where it says
 * how it is drawn and edited.
 */
export type RemovalProvider = (
  project: Project,
  levelId: string,
  objectId: string,
) => ProjectCommand | undefined;

function levelOf(project: Project, levelId: string) {
  return project.building.levels.find(({ id }) => id === levelId);
}

/** Wraps a command of the level editor so it can travel with the others. */
function onLevel(
  levelId: string,
  id: string,
  label: string,
  command: ConstructorParameters<typeof ProjectEditorCommand>[3],
): ProjectCommand {
  return new ProjectEditorCommand(id, label, levelId, command);
}

export const wallRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.walls.some(({ id }) => id === objectId) === true
    ? onLevel(
        levelId,
        `delete-wall:${objectId}`,
        'Supprimer un mur',
        new DeleteWallCommand(
          `delete-wall:${objectId}`,
          entityId<'Wall'>(objectId),
        ),
      )
    : undefined;

export const openingRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.openings.some(({ id }) => id === objectId) === true
    ? onLevel(
        levelId,
        `delete-opening:${objectId}`,
        'Supprimer une ouverture',
        new DeleteOpeningCommand(
          `delete-opening:${objectId}`,
          entityId<'Opening'>(objectId),
        ),
      )
    : undefined;

export const dimensionRemoval: RemovalProvider = (project, levelId, objectId) =>
  // A level carries dimensions and notes; only a dimension is deleted here.
  levelOf(project, levelId)?.annotations.some(
    (annotation) => annotation.id === objectId && isDimension(annotation),
  ) === true
    ? onLevel(
        levelId,
        `delete-dimension:${objectId}`,
        'Supprimer une cote',
        new DeleteDimensionCommand(
          `delete-dimension:${objectId}`,
          dimensionId(objectId),
        ),
      )
    : undefined;

export const spaceRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.spaces.some(({ id }) => id === objectId) === true
    ? new RemoveSpaceCommand(levelId, objectId)
    : undefined;

export const slabRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.slabs.some(({ id }) => id === objectId) === true
    ? new RemoveSlabCommand(levelId, objectId)
    : undefined;

export const roofRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.roofs.some(({ id }) => id === objectId) === true
    ? new RemoveRoofCommand(levelId, objectId)
    : undefined;

export const noteRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.annotations.some(
    (annotation) => annotation.id === objectId && isTextNote(annotation),
  ) === true
    ? new RemoveTextNoteCommand(levelId, objectId)
    : undefined;

/**
 * How a network object is taken back off the plan.
 *
 * A run of pipe is selected, inspected, framed and dragged like everything
 * else; it was the one thing on the plan that could not be deleted, because
 * removal only knew about nodes. A node still goes with the ports and the
 * segments that existed only for it: the command of the domain drops them
 * together, because a segment reaching a node that is gone is not a segment
 * but a dangling reference the reader refuses.
 */
export const networkRemoval: RemovalProvider = (
  project,
  _levelId,
  objectId,
) => {
  for (const network of project.systems ?? []) {
    if (network.nodes.some(({ id }) => id === objectId))
      return new RemoveNetworkNodeCommand(network.id, objectId);
    if (network.edges.some(({ id }) => id === objectId))
      return new RemoveNetworkEdgeCommand(network.id, objectId);
  }
  return undefined;
};

export const componentRemoval: RemovalProvider = (
  project,
  levelId,
  objectId,
) =>
  (levelOf(project, levelId)?.components ?? []).some(
    ({ id }) => id === objectId,
  )
    ? new RemoveComponentCommand(levelId, objectId)
    : undefined;

export const stairRemoval: RemovalProvider = (project, levelId, objectId) =>
  levelOf(project, levelId)?.stairs.some(({ id }) => id === objectId) === true
    ? new RemoveStairCommand(levelId, objectId)
    : undefined;

export const roofStructureRemoval: RemovalProvider = (
  project,
  levelId,
  objectId,
) =>
  (levelOf(project, levelId)?.roofStructures ?? []).some(
    ({ id }) => id === objectId,
  )
    ? new RemoveRoofStructureCommand(levelId, objectId)
    : undefined;

export const structureRemoval: RemovalProvider = (
  project,
  levelId,
  objectId,
) =>
  (levelOf(project, levelId)?.structure ?? []).some(({ id }) => id === objectId)
    ? new RemoveStructuralMemberCommand(levelId, objectId)
    : undefined;

export const siteRemoval: RemovalProvider = (project, _levelId, objectId) =>
  (project.site.obstacles ?? []).some(({ id }) => id === objectId)
    ? new RemoveSiteObstacleCommand(objectId)
    : undefined;
