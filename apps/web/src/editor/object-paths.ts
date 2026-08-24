import type { Project } from '@house-technical-designer/core-domain';

/**
 * Where an object lives in the project file.
 *
 * A path addresses by identity — `building/levels/rdc/stairs/escalier-1` names
 * that stair whatever position it holds in the list — which is what lets a
 * scenario written today still mean something after twelve walls have been
 * drawn. This is the one place that knows, for each family, how to spell it.
 */
export type PathProvider = (
  project: Project,
  objectId: string,
) => string | undefined;

function inLevels(
  project: Project,
  objectId: string,
  collection: (
    level: Project['building']['levels'][number],
  ) => readonly { readonly id: string }[] | undefined,
  name: string,
): string | undefined {
  for (const level of project.building.levels)
    if ((collection(level) ?? []).some(({ id }) => id === objectId))
      return `building/levels/${level.id}/${name}/${objectId}`;
  return undefined;
}

export const wallPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.walls, 'walls');

export const openingPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.openings, 'openings');

export const spacePath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.spaces, 'spaces');

import { readSlabHoleId } from './polygon-surface.js';

export const slabPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.slabs, 'slabs');

/**
 * Une trémie n'a pas de champ à elle : elle est un anneau de sa dalle.
 *
 * Le chemin le dit tel quel — la dalle, puis le rang du trou — pour qu'un
 * scénario puisse en varier un sans que rien n'ait à deviner.
 */
export const slabHolePath: PathProvider = (project, objectId) => {
  const hole = readSlabHoleId(objectId);
  if (hole === undefined) return undefined;
  const slab = inLevels(project, hole.slabId, (level) => level.slabs, 'slabs');
  return slab === undefined ? undefined : `${slab}/polygon/holes/${hole.index}`;
};

export const roofPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.roofs, 'roofs');

export const roofStructurePath: PathProvider = (project, objectId) =>
  inLevels(
    project,
    objectId,
    (level) => level.roofStructures,
    'roofStructures',
  );

export const stairPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.stairs, 'stairs');

export const structurePath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.structure, 'structure');

export const componentPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.components, 'components');

export const dimensionPath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.annotations, 'annotations');

export const notePath: PathProvider = (project, objectId) =>
  inLevels(project, objectId, (level) => level.annotations, 'annotations');

export const networkPath: PathProvider = (project, objectId) => {
  for (const network of project.systems ?? []) {
    if (network.nodes.some(({ id }) => id === objectId))
      return `systems/${network.id}/nodes/${objectId}`;
    if (network.edges.some(({ id }) => id === objectId))
      return `systems/${network.id}/edges/${objectId}`;
  }
  return undefined;
};

/**
 * The site: one parcel, and the obstacles standing on it.
 *
 * The parcel has no identifier of its own — there is one — so the plan calls it
 * `site:parcel` and the file calls it `site/parcelBoundary`.
 */
export const sitePath: PathProvider = (project, objectId) => {
  if (objectId === 'site:parcel')
    return project.site.parcelBoundary === undefined
      ? undefined
      : 'site/parcelBoundary';
  return (project.site.obstacles ?? []).some(({ id }) => id === objectId)
    ? `site/obstacles/${objectId}`
    : undefined;
};
