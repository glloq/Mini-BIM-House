/**
 * Turning a chosen footprint into a building.
 *
 * The point of doing it here, with the ordinary commands, is that there is
 * nothing special about the result: the walls the creation page draws are the
 * walls the wall tool draws, they take the same assemblies, they can be moved,
 * split and deleted, and the importer would accept them from any other source.
 * A shape only the creation page knows how to make would be a second kind of
 * building, and the second kind is always the one that breaks.
 */
import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  AddSlabCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

import { addWallRunCommand } from '../editor/editing-commands.js';
import type { InitialBuildingShape } from '../ux/new-project-draft.js';
import { shapeOutline } from './new-project.js';

export const EXTERIOR_WALL_ASSEMBLY = 'assembly-exterior-wall';
export const GROUND_SLAB_ASSEMBLY = 'assembly-floor';

export type InitialShapeResult =
  | { readonly status: 'NONE' }
  | { readonly status: 'OK'; readonly commands: readonly ProjectCommand[] }
  | { readonly status: 'ERROR'; readonly message: string };

/**
 * The commands that draw the starting footprint.
 *
 * One wall per side rather than one polyline: the first thing anyone does to a
 * starting shape is give one side a different assembly or put a door in it,
 * and that is a per-side decision.
 */
export function initialShapeCommands(
  file: ProjectFile,
  shape: InitialBuildingShape,
  newId: (prefix: string) => string,
): InitialShapeResult {
  if (shape.kind === 'NONE') return { status: 'NONE' };
  const outline = shapeOutline(shape);
  if (outline.length < 3)
    return { status: 'ERROR', message: 'Cette emprise n’a pas de contour.' };
  const level = file.project.building.levels.find(
    ({ elevationMm }) => elevationMm === 0,
  );
  if (level === undefined)
    return {
      status: 'ERROR',
      message: 'Aucun niveau au sol : l’emprise n’a rien où se poser.',
    };
  const walls = addWallRunCommand(
    file,
    level.id,
    outline,
    { assemblyId: EXTERIOR_WALL_ASSEMBLY, role: 'EXTERIOR' },
    { asOneWall: false, closed: true, newId },
  );
  if (walls.status === 'ERROR') return walls;
  const slab = new AddSlabCommand(level.id, {
    id: newId('slab'),
    polygon: { outer: [...outline] },
    assemblyId: GROUND_SLAB_ASSEMBLY,
    role: 'FLOOR',
    elevationOffsetMm: 0,
  });
  return { status: 'OK', commands: [walls.command, slab] };
}
