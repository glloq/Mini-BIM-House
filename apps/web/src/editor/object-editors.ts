import type { Project } from '@house-technical-designer/core-domain';
import {
  buildingElementSubject,
  dimensionSubject,
  field,
  networkSubject,
  openingSubject,
  spaceSubject,
  wallSubject,
  type InspectorSubject,
} from './inspector-model.js';
import {
  dimensionEditsFor,
  networkNodeEditsFor,
  openingEditsFor,
  roofEditsFor,
  slabEditsFor,
  spaceEditsFor,
  wallEditsFor,
  type InspectorEdit,
} from './inspector-edits.js';
import { openingGrips, polygonGrips, wallGrips, type Grip } from './grips.js';

/**
 * Everything the editor knows how to do with one family of objects.
 *
 * A wall, a duct, a stair and a piece of furniture are each described,
 * inspected, edited and dragged differently, and until now each of those four
 * questions was answered by its own chain of `if` statements — one in the
 * inspector, one in the property panel, one in the canvas. Adding a family
 * meant finding all three; forgetting one meant an object that could be
 * selected and not edited.
 *
 * Here a family is declared once. What it cannot answer it leaves undefined,
 * and the next family is asked: an identifier that belongs to none of them is
 * shown as an object the project does not hold, which is the truth.
 */
export interface ObjectEditorDefinition {
  /** What this family is called in the interface. */
  readonly label: string;
  /** What the inspector shows, or nothing when the id is not of this family. */
  readonly inspect: (
    project: Project,
    objectId: string,
  ) => InspectorSubject | undefined;
  /** The properties the panel offers for editing. */
  readonly edits?: (
    project: Project,
    objectId: string,
  ) => readonly InspectorEdit[] | undefined;
  /** The handles the plan draws when one object of this family is selected. */
  readonly grips?: (
    project: Project,
    levelId: string | undefined,
    objectId: string,
  ) => readonly Grip[] | undefined;
}

/**
 * The families the editor can edit today.
 *
 * The order matters only in that the first family recognising an identifier
 * answers for it; identifiers are unique across a project, so no two families
 * can claim the same one.
 */
export const OBJECT_EDITORS: readonly ObjectEditorDefinition[] = [
  {
    label: 'Mur',
    inspect: wallSubject,
    edits: wallEditsFor,
    grips: wallGrips,
  },
  {
    label: 'Ouverture',
    inspect: openingSubject,
    edits: openingEditsFor,
    grips: openingGrips,
  },
  {
    label: 'Pièce',
    inspect: spaceSubject,
    edits: spaceEditsFor,
  },
  {
    label: 'Dalle',
    inspect: buildingElementSubject,
    edits: slabEditsFor,
    grips: polygonGrips,
  },
  {
    label: 'Toiture',
    // Slabs and roofs share one description; only their editable properties
    // differ, so the roof entry answers for the properties the slab entry
    // declined.
    inspect: buildingElementSubject,
    edits: roofEditsFor,
    grips: polygonGrips,
  },
  {
    label: 'Réseau',
    inspect: networkSubject,
    edits: networkNodeEditsFor,
  },
  {
    label: 'Cote',
    inspect: dimensionSubject,
    edits: dimensionEditsFor,
  },
];

/**
 * Describes the selected object for the inspector.
 *
 * Every value is derived on read: the inspector shows facts and what follows
 * from them, and says plainly when the model does not carry a value.
 */
export function inspectObject(
  project: Project,
  objectId: string,
): InspectorSubject {
  for (const editor of OBJECT_EDITORS) {
    const subject = editor.inspect(project, objectId);
    if (subject !== undefined) return subject;
  }
  return {
    objectId,
    kind: 'UNKNOWN',
    title: objectId,
    sections: [
      {
        title: 'Références',
        fields: [
          field(
            'Identifiant',
            objectId,
            'Cet objet n’a pas été retrouvé dans le projet.',
          ),
        ],
      },
    ],
  };
}

/** The properties the selected object offers for editing. */
export function editsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] {
  for (const editor of OBJECT_EDITORS) {
    const edits = editor.edits?.(project, objectId);
    if (edits !== undefined) return edits;
  }
  return [];
}

/**
 * The handles the plan draws for the current selection.
 *
 * Handles are shown for a single selected object: dragging one moves a precise
 * point of a precise object, and a handle standing for several would have to
 * guess which.
 */
export function gripsFor(
  project: Project,
  levelId: string | undefined,
  selection: readonly string[],
): readonly Grip[] {
  if (selection.length !== 1) return [];
  const objectId = selection[0]!;
  for (const editor of OBJECT_EDITORS) {
    const grips = editor.grips?.(project, levelId, objectId);
    if (grips !== undefined) return grips;
  }
  return [];
}
