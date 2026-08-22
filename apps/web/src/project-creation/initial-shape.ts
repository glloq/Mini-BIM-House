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
  ProjectTransactionCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

import { addWallRunCommand } from '../editor/editing-commands.js';
import type { InitialBuildingShape } from '../ux/new-project-draft.js';
import { shapeIssues, shapeOutline } from './new-project.js';

// The build-ups the starting footprint is drawn with, named as the assembly
// catalogue names them. They were `assembly-exterior-wall` and
// `assembly-floor`, which were the identifiers of a list written out in the
// application; the list is data now, and these have to follow it or the
// footprint would reference build-ups the project does not carry.
export const EXTERIOR_WALL_ASSEMBLY = 'generic-wall-block-external-insulation';
export const GROUND_SLAB_ASSEMBLY = 'generic-floor-slab-on-ground';

export type InitialShapeResult =
  | { readonly status: 'NONE' }
  /**
   * One command, not a list.
   *
   * Six walls and a slab either arrive together or not at all: a footprint
   * half drawn — because the fifth wall was refused — is a shape nobody chose,
   * and undoing it would take seven presses. A transaction is also one entry
   * in the undo history, which is what « annuler l'emprise » means.
   */
  | { readonly status: 'OK'; readonly command: ProjectCommand }
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
  // The relations between the arm and the box are checked before anything is
  // drawn: a U whose arms cross produces a contour nobody could have drawn by
  // hand, and the walls that come out of it look like a defect in the tool.
  const wrong = shapeIssues(shape);
  if (wrong.length > 0) return { status: 'ERROR', message: wrong.join(' ') };
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
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      `initial-shape:${shape.kind}:${newId('')}`,
      'Poser l’emprise de départ',
      [walls.command, slab],
    ),
  };
}
