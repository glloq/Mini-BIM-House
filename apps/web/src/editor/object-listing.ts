import type { Project } from '@house-technical-designer/core-domain';
import { isDimension, isTextNote } from '@house-technical-designer/core-domain';

import { slabHoles } from './polygon-surface.js';

/**
 * One object a family holds, named as the user would name it.
 *
 * The identifier and the label travel as two fields rather than as one packed
 * string: the tree once packed them and two families out of nine used a
 * different separator, so clicking them selected nothing.
 */
export interface ObjectListing {
  readonly objectId: string;
  readonly label: string;
}

/**
 * Every object of one family, on one storey.
 *
 * Listing is the fourth thing the application does with a family, after
 * describing, editing and deleting it, and it was the one still written by
 * hand in two places: the project tree walked nine families, the command
 * palette walked five, and the families added since fell out of both. What
 * cannot be found cannot be selected, whatever else works on it.
 */
export type ListingProvider = (
  project: Project,
  levelId: string | undefined,
) => readonly ObjectListing[];

function levelOf(project: Project, levelId: string | undefined) {
  const levels = project.building.levels;
  return levelId === undefined
    ? levels[0]
    : levels.find(({ id }) => id === levelId);
}

/** An object named by its identifier, which is all some families have. */
const byId = (objects: readonly { readonly id: string }[] | undefined) =>
  (objects ?? []).map(({ id }) => ({ objectId: id, label: id }));

export const wallListing: ListingProvider = (project, levelId) =>
  byId(levelOf(project, levelId)?.walls);

export const openingListing: ListingProvider = (project, levelId) =>
  byId(levelOf(project, levelId)?.openings);

export const spaceListing: ListingProvider = (project, levelId) =>
  (levelOf(project, levelId)?.spaces ?? []).map(({ id, name }) => ({
    objectId: id,
    label: name,
  }));

export const slabListing: ListingProvider = (project, levelId) =>
  byId(levelOf(project, levelId)?.slabs);

/** Les trémies, nommées par leur rang dans la dalle qu'elles percent. */
export const slabHoleListing: ListingProvider = (project, levelId) =>
  slabHoles(project, levelId).map(({ objectId, slabId }, index) => ({
    objectId,
    label: `Trémie ${index + 1} · ${slabId}`,
  }));

export const roofListing: ListingProvider = (project, levelId) =>
  byId(levelOf(project, levelId)?.roofs);

export const roofStructureListing: ListingProvider = (project, levelId) =>
  byId(levelOf(project, levelId)?.roofStructures);

export const stairListing: ListingProvider = (project, levelId) =>
  byId(levelOf(project, levelId)?.stairs);

export const dimensionListing: ListingProvider = (project, levelId) =>
  byId(
    (levelOf(project, levelId)?.annotations ?? []).filter((annotation) =>
      isDimension(annotation),
    ),
  );

/** A note is named by what it says, which is the only name it has. */
export const noteListing: ListingProvider = (project, levelId) =>
  (levelOf(project, levelId)?.annotations ?? [])
    .filter((annotation) => isTextNote(annotation))
    .map((note) => ({ objectId: note.id, label: note.text }));

const STRUCTURE_LABELS: Readonly<Record<string, string>> = {
  COLUMN: 'Poteau',
  BEAM: 'Poutre',
  FOOTING: 'Fondation',
};

export const structureListing: ListingProvider = (project, levelId) =>
  (levelOf(project, levelId)?.structure ?? []).map((member) => ({
    objectId: member.id,
    label: `${STRUCTURE_LABELS[member.kind] ?? member.kind} ${member.id}`,
  }));

export const componentListing: ListingProvider = (project, levelId) =>
  (levelOf(project, levelId)?.components ?? []).map((component) => ({
    objectId: component.id,
    label: component.name ?? component.category,
  }));

/**
 * The network objects of the whole project, storey or no storey.
 *
 * A network belongs to the building rather than to one of its floors — a
 * column of pipe crosses three — so what is listed does not depend on which
 * plan is open.
 */
export const networkListing: ListingProvider = (project) =>
  (project.systems ?? []).flatMap((network) => [
    ...network.nodes.map((node) => ({
      objectId: node.id,
      label: `${node.kind} · ${node.id}`,
    })),
    ...network.edges.map((edge) => ({
      objectId: edge.id,
      label: `${edge.kind} · ${edge.id}`,
    })),
  ]);

export const siteListing: ListingProvider = (project) => [
  ...(project.site.parcelBoundary === undefined
    ? []
    : [{ objectId: 'site:parcel', label: 'Parcelle' }]),
  ...(project.site.obstacles ?? []).map((obstacle) => ({
    objectId: obstacle.id,
    label: obstacle.name ?? obstacle.kind ?? obstacle.id,
  })),
];
