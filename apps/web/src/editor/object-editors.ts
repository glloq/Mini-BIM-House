import type { Project } from '@house-technical-designer/core-domain';
import { ProjectTransactionCommand } from '@house-technical-designer/editor-core';
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
import type { ProjectCommand } from '@house-technical-designer/editor-core';
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

/**
 * A property several selected objects share, edited in one go.
 *
 * `values` says whether they agree: an assembly all twelve walls already use is
 * shown, and twelve different heights are shown as differing rather than as the
 * first one — writing that back would silently align eleven walls on a value
 * nobody chose.
 */
export interface SharedEdit {
  readonly id: string;
  readonly label: string;
  readonly control: InspectorEdit['control'];
  readonly hint?: string;
  /** Whether every selected object already carries the same value. */
  readonly uniform: boolean;
  /** The command applying one value to all of them, as a single history entry. */
  readonly apply: (value: string) => ProjectCommand | undefined;
}

/**
 * The properties every object of a selection offers, with a common value.
 *
 * Only properties all of them have are offered, and only when they are edited
 * the same way: a select and a number field sharing a name are not the same
 * property, and applying one to the other would write nonsense.
 */
export function sharedEditsFor(
  project: Project,
  selection: readonly string[],
): readonly SharedEdit[] {
  if (selection.length < 2) return [];
  const perObject = selection.map((objectId) => ({
    objectId,
    edits: editsFor(project, objectId),
  }));
  if (perObject.some(({ edits }) => edits.length === 0)) return [];
  const [first, ...rest] = perObject;
  if (first === undefined) return [];
  const shared: SharedEdit[] = [];
  for (const candidate of first.edits) {
    const matches = rest.map(({ edits }) =>
      edits.find(
        (edit) =>
          edit.id === candidate.id &&
          edit.control.kind === candidate.control.kind,
      ),
    );
    if (matches.some((match) => match === undefined)) continue;
    const others = matches as readonly InspectorEdit[];
    const uniform = others.every(
      (edit) =>
        String(edit.control.value) === String(candidate.control.value) &&
        (edit.control.kind !== 'SELECT' ||
          candidate.control.kind !== 'SELECT' ||
          edit.control.options.length === candidate.control.options.length),
    );
    shared.push({
      id: candidate.id,
      label: candidate.label,
      control: candidate.control,
      ...(candidate.hint === undefined ? {} : { hint: candidate.hint }),
      uniform,
      apply: (value) => {
        const commands = [candidate, ...others]
          .map((edit) => edit.apply(value))
          .filter(
            (command): command is ProjectCommand => command !== undefined,
          );
        // One value refused is the whole edit refused: half a selection changed
        // would be worse than none, and impossible to undo in one step.
        if (commands.length !== selection.length) return undefined;
        return new ProjectTransactionCommand(
          `multi:${candidate.id}:${selection.join(',')}`,
          `${candidate.label} · ${selection.length} objets`,
          commands,
        );
      },
    });
  }
  return shared;
}
