import type { Project } from '@house-technical-designer/core-domain';
import { ProjectTransactionCommand } from '@house-technical-designer/editor-core';
import {
  buildingElementSubject,
  componentSubject,
  dimensionSubject,
  stairSubject,
  field,
  networkSubject,
  openingSubject,
  spaceSubject,
  wallSubject,
  type InspectorSubject,
} from './inspector-model.js';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  componentEditsFor,
  dimensionEditsFor,
  stairEditsFor,
  networkNodeEditsFor,
  openingEditsFor,
  roofEditsFor,
  slabEditsFor,
  spaceEditsFor,
  wallEditsFor,
  type InspectorEdit,
} from './inspector-edits.js';
import { openingGrips, polygonGrips, wallGrips, type Grip } from './grips.js';
import {
  componentBounds,
  componentRelationships,
  stairBounds,
  stairRelationships,
  networkNodeBounds,
  networkNodeRelationships,
  openingBounds,
  openingRelationships,
  roofBounds,
  similarComponents,
  similarOpenings,
  similarSlabs,
  similarWalls,
  slabBounds,
  spaceBounds,
  wallBounds,
  wallContextActions,
  wallRelationships,
} from './object-facts.js';
import {
  componentRemoval,
  dimensionRemoval,
  stairRemoval,
  networkNodeRemoval,
  openingRemoval,
  roofRemoval,
  slabRemoval,
  spaceRemoval,
  wallRemoval,
  type RemovalProvider,
} from './object-removal.js';

/** What an object is, as the inspector names it. */
export type ObjectKind = Exclude<InspectorSubject['kind'], 'UNKNOWN'>;

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
  /**
   * The kinds of subject this family stands for.
   *
   * Two entries share one description — a slab and a roof are both building
   * elements — so the label alone does not say which object belongs to which
   * family. Filtering a selection, and telling the user what was filtered,
   * both need that answer.
   */
  readonly kinds: readonly ObjectKind[];
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
  /**
   * How an object of this family is deleted.
   *
   * Selecting, inspecting, editing and deleting are four questions about the
   * same object; the fourth used to be answered somewhere else, for three
   * families out of seven.
   */
  readonly remove?: RemovalProvider;
  /**
   * The extent of one object on the plan.
   *
   * Framing an object, placing a menu beside it and telling what a band caught
   * all ask the same question; asking the drawing engine for it means building
   * a whole view to measure one wall.
   */
  readonly bounds?: (
    project: Project,
    levelId: string,
    objectId: string,
  ) => ObjectBounds | undefined;
  /**
   * The objects of this family that are like this one.
   *
   * What « like » means belongs to the family: two walls of the same assembly
   * and the same role, two openings of the same type and size. Changing the
   * assembly of every partition of a storey starts with finding them.
   */
  readonly similar?: (
    project: Project,
    levelId: string,
    objectId: string,
  ) => readonly string[];
  /**
   * What this family offers beyond what every object offers.
   *
   * Deleting, duplicating and framing are the same for all of them and belong
   * to the application; reversing the reference face of a wall belongs to
   * walls.
   */
  readonly contextActions?: (
    project: Project,
    levelId: string,
    objectId: string,
  ) => readonly ObjectContextAction[];
  /**
   * The objects this one holds, hangs on, or is joined to.
   *
   * The domain already refuses to delete a wall that still hosts an opening;
   * the refusal named a rule, and the user then looked for the openings by
   * eye. What an object is tied to is a fact of its family, and nothing but
   * the family can state it.
   */
  readonly relationships?: (
    project: Project,
    levelId: string,
    objectId: string,
  ) => readonly ObjectRelationship[];
}

/** One tie an object has to others, named as the user would name it. */
export interface ObjectRelationship {
  readonly role: string;
  readonly objectIds: readonly string[];
}

export interface ObjectBounds {
  readonly min: { readonly x: number; readonly y: number };
  readonly max: { readonly x: number; readonly y: number };
}

/** One action a family offers on one of its objects. */
export interface ObjectContextAction {
  readonly id: string;
  readonly label: string;
  readonly command: () => ProjectCommand | undefined;
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
    kinds: ['WALL'],
    inspect: wallSubject,
    edits: wallEditsFor,
    grips: wallGrips,
    remove: wallRemoval,
    bounds: wallBounds,
    similar: similarWalls,
    contextActions: wallContextActions,
    relationships: wallRelationships,
  },
  {
    label: 'Ouverture',
    kinds: ['OPENING'],
    inspect: openingSubject,
    edits: openingEditsFor,
    grips: openingGrips,
    remove: openingRemoval,
    bounds: openingBounds,
    similar: similarOpenings,
    relationships: openingRelationships,
  },
  {
    label: 'Pièce',
    kinds: ['SPACE'],
    inspect: spaceSubject,
    edits: spaceEditsFor,
    remove: spaceRemoval,
    bounds: spaceBounds,
  },
  {
    label: 'Dalle',
    kinds: ['SLAB'],
    inspect: buildingElementSubject,
    edits: slabEditsFor,
    grips: polygonGrips,
    remove: slabRemoval,
    bounds: slabBounds,
    similar: similarSlabs,
  },
  {
    label: 'Toiture',
    kinds: ['ROOF'],
    // Slabs and roofs share one description; only their editable properties
    // differ, so the roof entry answers for the properties the slab entry
    // declined.
    inspect: buildingElementSubject,
    edits: roofEditsFor,
    grips: polygonGrips,
    remove: roofRemoval,
    bounds: roofBounds,
  },
  {
    label: 'Réseau',
    kinds: ['NETWORK_NODE', 'NETWORK_EDGE'],
    inspect: networkSubject,
    edits: networkNodeEditsFor,
    remove: networkNodeRemoval,
    bounds: networkNodeBounds,
    relationships: networkNodeRelationships,
  },
  {
    label: 'Cote',
    kinds: ['DIMENSION'],
    inspect: dimensionSubject,
    edits: dimensionEditsFor,
    remove: dimensionRemoval,
  },
  {
    label: 'Escalier',
    kinds: ['STAIR'],
    inspect: stairSubject,
    edits: stairEditsFor,
    remove: stairRemoval,
    bounds: stairBounds,
    relationships: stairRelationships,
  },
  {
    label: 'Composant',
    kinds: ['COMPONENT'],
    inspect: componentSubject,
    edits: componentEditsFor,
    remove: componentRemoval,
    bounds: componentBounds,
    similar: similarComponents,
    relationships: componentRelationships,
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
  /** What the property means, which is what made it shareable. */
  readonly semanticId: string;
  readonly label: string;
  readonly control: InspectorEdit['control'];
  readonly hint?: string;
  /** Whether every selected object already carries the same value. */
  readonly uniform: boolean;
  /** The command applying one value to all of them, as a single history entry. */
  readonly apply: (value: string) => ProjectCommand | undefined;
}

/**
 * Whether two menus offer the same choices.
 *
 * Counting them was not enough: two lists of four assemblies can be four
 * different assemblies, and applying one to the other would set a wall to a
 * floor build-up.
 */
function sameChoices(
  first: InspectorEdit['control'],
  second: InspectorEdit['control'],
): boolean {
  if (first.kind !== 'SELECT' || second.kind !== 'SELECT') return true;
  const values = (control: typeof first) =>
    control.kind === 'SELECT'
      ? control.options.map(({ value }) => value).join('\u0000')
      : '';
  return values(first) === values(second);
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
          // The meaning is what has to match, not the field name: a wall and a
          // slab both have a `role`, and writing one into the other would write
          // nonsense.
          edit.semanticId === candidate.semanticId &&
          edit.control.kind === candidate.control.kind &&
          sameChoices(edit.control, candidate.control),
      ),
    );
    if (matches.some((match) => match === undefined)) continue;
    const others = matches as readonly InspectorEdit[];
    const uniform = others.every(
      (edit) => String(edit.control.value) === String(candidate.control.value),
    );
    shared.push({
      id: candidate.id,
      semanticId: candidate.semanticId,
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

/**
 * The command that deletes one object, whichever family it belongs to.
 *
 * Nothing is returned for an object no family can take back — an equipment
 * definition, an object of another storey — and the caller says so rather than
 * deleting something else.
 */
export function removalCommandFor(
  project: Project,
  levelId: string,
  objectId: string,
): ProjectCommand | undefined {
  for (const editor of OBJECT_EDITORS) {
    const command = editor.remove?.(project, levelId, objectId);
    if (command !== undefined) return command;
  }
  return undefined;
}

/** The extent of one object, whichever family it belongs to. */
export function boundsOf(
  project: Project,
  levelId: string,
  objectId: string,
): ObjectBounds | undefined {
  for (const editor of OBJECT_EDITORS) {
    const bounds = editor.bounds?.(project, levelId, objectId);
    if (bounds !== undefined) return bounds;
  }
  return undefined;
}

/**
 * The objects like this one, itself included.
 *
 * Nothing is returned for a family that does not say what « like » means: an
 * empty answer is honest, a list of everything would not be.
 */
export function similarTo(
  project: Project,
  levelId: string,
  objectId: string,
): readonly string[] {
  for (const editor of OBJECT_EDITORS) {
    const similar = editor.similar?.(project, levelId, objectId);
    if (similar !== undefined && similar.length > 0) return similar;
  }
  return [];
}

/** What this object's own family offers on it. */
export function contextActionsFor(
  project: Project,
  levelId: string,
  objectId: string,
): readonly ObjectContextAction[] {
  for (const editor of OBJECT_EDITORS) {
    const actions = editor.contextActions?.(project, levelId, objectId);
    if (actions !== undefined && actions.length > 0) return actions;
  }
  return [];
}

/**
 * What this object is tied to, whichever family it belongs to.
 *
 * A family with nothing to say answers nothing: an empty list is honest, and
 * a list of everything on the storey would not be.
 */
export function relationshipsOf(
  project: Project,
  levelId: string,
  objectId: string,
): readonly ObjectRelationship[] {
  for (const editor of OBJECT_EDITORS) {
    const ties = editor.relationships?.(project, levelId, objectId);
    if (ties !== undefined && ties.length > 0) return ties;
  }
  return [];
}

/** One family, as the interface offers it for filtering. */
export interface ObjectFamily {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly ObjectKind[];
}

/**
 * The families a selection can be restricted to.
 *
 * Built from the registry rather than written beside it: a family added
 * tomorrow appears in the filter without anyone remembering to add it, which
 * is the whole point of the registry.
 */
export const OBJECT_FAMILIES: readonly ObjectFamily[] = OBJECT_EDITORS.flatMap(
  (editor) => {
    const first = editor.kinds[0];
    return first === undefined
      ? []
      : [{ id: first, label: editor.label, kinds: editor.kinds }];
  },
);

/** The family one object belongs to, or nothing when there is no such object. */
export function familyOf(
  project: Project,
  objectId: string,
): ObjectFamily | undefined {
  const { kind } = inspectObject(project, objectId);
  return OBJECT_FAMILIES.find((family) =>
    (family.kinds as readonly string[]).includes(kind),
  );
}
