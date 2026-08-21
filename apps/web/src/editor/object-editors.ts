import type { Project } from '@house-technical-designer/core-domain';
import { ProjectTransactionCommand } from '@house-technical-designer/editor-core';
import {
  buildingElementSubject,
  componentSubject,
  dimensionSubject,
  noteSubject,
  roofStructureSubject,
  siteSubject,
  stairSubject,
  structureSubject,
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
  noteEditsFor,
  roofStructureEditsFor,
  stairEditsFor,
  structureEditsFor,
  networkEdgeEditsFor,
  networkNodeEditsFor,
  openingEditsFor,
  roofEditsFor,
  slabEditsFor,
  spaceEditsFor,
  wallEditsFor,
  type InspectorEdit,
} from './inspector-edits.js';
import {
  openingGrips,
  polygonGrips,
  routeGrips,
  wallGrips,
  type Grip,
} from './grips.js';
import {
  componentBounds,
  componentRelationships,
  roofStructureBounds,
  similarStructure,
  siteBounds,
  stairBounds,
  structureBounds,
  stairRelationships,
  networkBounds,
  noteBounds,
  networkNodeRelationships,
  networkRelationships,
  openingBounds,
  openingRelationships,
  roofBounds,
  similarComponents,
  similarNetworkObjects,
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
  componentPath,
  dimensionPath,
  networkPath,
  notePath,
  openingPath,
  roofPath,
  roofStructurePath,
  sitePath,
  slabPath,
  spacePath,
  stairPath,
  structurePath,
  wallPath,
  type PathProvider,
} from './object-paths.js';
import {
  componentListing,
  dimensionListing,
  noteListing,
  networkListing,
  openingListing,
  roofListing,
  roofStructureListing,
  siteListing,
  slabListing,
  spaceListing,
  stairListing,
  structureListing,
  wallListing,
  type ListingProvider,
  type ObjectListing,
} from './object-listing.js';
import {
  EVERYTHING_MOVES,
  NOTHING_MOVES,
  componentDuplicate,
  componentTransform,
  dimensionTransform,
  openingDuplicate,
  networkDuplicate,
  networkTransform,
  noteDuplicate,
  noteTransform,
  openingTransform,
  roofDuplicate,
  roofStructureDuplicate,
  roofStructureTransform,
  roofTransform,
  siteDuplicate,
  siteTransform,
  slabDuplicate,
  slabTransform,
  spaceTransform,
  stairDuplicate,
  stairTransform,
  structureDuplicate,
  structureTransform,
  wallDuplicate,
  wallTransform,
  type DuplicateProvider,
  type ObjectCapabilities,
  type PlanTransform,
  type TransformProvider,
} from './object-transform.js';
import {
  componentRemoval,
  dimensionRemoval,
  noteRemoval,
  roofStructureRemoval,
  siteRemoval,
  stairRemoval,
  structureRemoval,
  networkRemoval,
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
  /**
   * What can be done to an object of this family: move, turn, reflect, copy.
   *
   * Declared rather than discovered. Moving, turning and duplicating were three
   * chains of `if` over four families each, written when there were four
   * families; the ten added since fell through all three and were answered with
   * « cet objet ne se déplace pas depuis le plan », which was true of the code
   * and false of the object. A family that declares nothing here declares that
   * nothing moves, and the menu says so before the user tries.
   *
   * A function when one family holds objects that do not all behave alike: the
   * site holds obstacles, which move, and the parcel, which is the limit of the
   * ground and does not.
   */
  readonly capabilities?:
    | ObjectCapabilities
    | ((project: Project, objectId: string) => ObjectCapabilities);
  /** How an object of this family follows a move, a rotation or a mirror. */
  readonly transform?: TransformProvider;
  /** How an object of this family is copied a little to the side. */
  readonly duplicate?: DuplicateProvider;
  /**
   * What this family is called when several of its objects are listed.
   *
   * « Mur » names one, « Murs » names the drawer they are in; the tree and the
   * palette both need the second and both used to spell it themselves.
   */
  readonly listLabel?: string;
  /**
   * Whether this family belongs to a storey or to the project.
   *
   * A wall is on a floor; a network crosses them and the parcel is under all of
   * them. The tree puts the first under the storey it is drawing and the second
   * in sections of its own, and it is the family that says which it is.
   */
  readonly scope?: 'LEVEL' | 'PROJECT';
  /** Every object of this family, so anything can offer them all. */
  readonly list?: ListingProvider;
  /**
   * Where one of its objects lives in the project file.
   *
   * A scenario varies a value, and a value is named by a path. Until now the
   * paths a scenario could take were written out by hand — walls, assembly
   * layers, equipment — so pointing at a stair and changing its going was
   * answered with « ne peut pas encore varier ». A family that says where its
   * objects live makes every property the inspector offers a property a
   * variant can change.
   */
  readonly pathOf?: PathProvider;
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
    capabilities: EVERYTHING_MOVES,
    transform: wallTransform,
    duplicate: wallDuplicate,
    listLabel: 'Murs',
    scope: 'LEVEL',
    list: wallListing,
    pathOf: wallPath,
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
    // An opening is duplicated by the wall that carries it, and by nothing
    // else: put back on the same wall at the same place it would sit exactly
    // under the original.
    capabilities: { ...NOTHING_MOVES, duplicable: true },
    transform: openingTransform,
    duplicate: openingDuplicate,
    listLabel: 'Ouvertures',
    scope: 'LEVEL',
    list: openingListing,
    pathOf: openingPath,
  },
  {
    label: 'Pièce',
    kinds: ['SPACE'],
    inspect: spaceSubject,
    edits: spaceEditsFor,
    remove: spaceRemoval,
    bounds: spaceBounds,
    capabilities: NOTHING_MOVES,
    transform: spaceTransform,
    listLabel: 'Pièces',
    scope: 'LEVEL',
    list: spaceListing,
    pathOf: spacePath,
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
    capabilities: EVERYTHING_MOVES,
    transform: slabTransform,
    duplicate: slabDuplicate,
    listLabel: 'Dalles',
    scope: 'LEVEL',
    list: slabListing,
    pathOf: slabPath,
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
    capabilities: EVERYTHING_MOVES,
    transform: roofTransform,
    duplicate: roofDuplicate,
    listLabel: 'Toitures',
    scope: 'LEVEL',
    list: roofListing,
    pathOf: roofPath,
  },
  {
    label: 'Réseau',
    kinds: ['NETWORK_NODE', 'NETWORK_EDGE'],
    inspect: networkSubject,
    // A node and a segment are both of this family and are not edited alike:
    // a node stands somewhere, a segment is made of something.
    edits: (project, objectId) =>
      networkNodeEditsFor(project, objectId) ??
      networkEdgeEditsFor(project, objectId),
    grips: routeGrips,
    remove: networkRemoval,
    bounds: networkBounds,
    similar: similarNetworkObjects,
    relationships: (project, levelId, objectId) => {
      const node = networkNodeRelationships(project, levelId, objectId);
      return node.length > 0
        ? node
        : networkRelationships(project, levelId, objectId);
    },
    // A node travels and its segments follow; a segment carries its own
    // corners when its two nodes travel with it. Neither is copied alone: a
    // node reached by nothing is not a network.
    capabilities: {
      movable: true,
      rotatable: true,
      mirrorable: true,
      duplicable: false,
    },
    transform: networkTransform,
    duplicate: networkDuplicate,
    listLabel: 'Réseaux',
    scope: 'PROJECT',
    list: networkListing,
    pathOf: networkPath,
  },
  {
    label: 'Cote',
    kinds: ['DIMENSION'],
    inspect: dimensionSubject,
    edits: dimensionEditsFor,
    remove: dimensionRemoval,
    capabilities: NOTHING_MOVES,
    transform: dimensionTransform,
    listLabel: 'Cotes',
    scope: 'LEVEL',
    list: dimensionListing,
    pathOf: dimensionPath,
  },
  {
    label: 'Annotation',
    kinds: ['NOTE'],
    // What the model does not say and the drawing must: « existant à démolir »,
    // « cote à vérifier sur site ». Never read by a calculation, which is why
    // it is free text and stays free text.
    inspect: noteSubject,
    edits: noteEditsFor,
    remove: noteRemoval,
    bounds: noteBounds,
    listLabel: 'Annotations',
    scope: 'LEVEL',
    list: noteListing,
    pathOf: notePath,
    capabilities: EVERYTHING_MOVES,
    transform: noteTransform,
    duplicate: noteDuplicate,
  },
  {
    label: 'Toiture complète',
    kinds: ['ROOF_STRUCTURE'],
    inspect: roofStructureSubject,
    edits: roofStructureEditsFor,
    remove: roofStructureRemoval,
    bounds: roofStructureBounds,
    capabilities: EVERYTHING_MOVES,
    transform: roofStructureTransform,
    duplicate: roofStructureDuplicate,
    listLabel: 'Toitures complètes',
    scope: 'LEVEL',
    list: roofStructureListing,
    pathOf: roofStructurePath,
  },
  {
    label: 'Escalier',
    kinds: ['STAIR'],
    inspect: stairSubject,
    edits: stairEditsFor,
    remove: stairRemoval,
    bounds: stairBounds,
    relationships: stairRelationships,
    capabilities: EVERYTHING_MOVES,
    transform: stairTransform,
    duplicate: stairDuplicate,
    listLabel: 'Escaliers',
    scope: 'LEVEL',
    list: stairListing,
    pathOf: stairPath,
  },
  {
    label: 'Structure',
    kinds: ['STRUCTURE'],
    inspect: structureSubject,
    edits: structureEditsFor,
    remove: structureRemoval,
    bounds: structureBounds,
    similar: similarStructure,
    capabilities: EVERYTHING_MOVES,
    transform: structureTransform,
    duplicate: structureDuplicate,
    listLabel: 'Structure',
    scope: 'LEVEL',
    list: structureListing,
    pathOf: structurePath,
  },
  {
    label: 'Terrain',
    kinds: ['SITE'],
    inspect: siteSubject,
    remove: siteRemoval,
    bounds: siteBounds,
    // An obstacle moves and is copied; the parcel is the limit of the ground
    // and stays where the ground is.
    capabilities: (_project, objectId) =>
      objectId === 'site:parcel' ? NOTHING_MOVES : EVERYTHING_MOVES,
    transform: siteTransform,
    duplicate: siteDuplicate,
    listLabel: 'Terrain',
    scope: 'PROJECT',
    list: siteListing,
    pathOf: sitePath,
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
    capabilities: EVERYTHING_MOVES,
    transform: componentTransform,
    duplicate: componentDuplicate,
    listLabel: 'Composants',
    scope: 'LEVEL',
    list: componentListing,
    pathOf: componentPath,
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

/**
 * What the family of one object allows to be done to it.
 *
 * An identifier no family claims can have nothing done to it, which is not the
 * same as a family that refuses: the first is an object the project does not
 * hold, the second is an object that does not move.
 */
export function capabilitiesOf(
  project: Project,
  objectId: string,
): ObjectCapabilities {
  for (const editor of OBJECT_EDITORS) {
    if (editor.inspect(project, objectId) === undefined) continue;
    const declared = editor.capabilities;
    if (declared === undefined) return NOTHING_MOVES;
    return typeof declared === 'function'
      ? declared(project, objectId)
      : declared;
  }
  return NOTHING_MOVES;
}

/**
 * What a whole selection allows: what every one of its objects allows.
 *
 * One object that cannot turn makes the selection unable to turn, because
 * turning the rest around it would take the drawing apart.
 */
export function selectionCapabilities(
  project: Project,
  selection: readonly string[],
): ObjectCapabilities {
  if (selection.length === 0) return NOTHING_MOVES;
  return selection
    .map((objectId) => capabilitiesOf(project, objectId))
    .reduce((all, one) => ({
      movable: all.movable && one.movable,
      rotatable: all.rotatable && one.rotatable,
      mirrorable: all.mirrorable && one.mirrorable,
      duplicable: all.duplicable && one.duplicable,
    }));
}

/**
 * How one object follows a transform, whichever family it belongs to.
 *
 * `undefined` is an object no family claims; a refusal is a family that owns
 * it and says why it does not do that, in words the user reads.
 */
export function transformCommandsFor(
  project: Project,
  levelId: string,
  objectId: string,
  transform: PlanTransform,
  selection: ReadonlySet<string>,
):
  | { readonly status: 'OK'; readonly commands: readonly ProjectCommand[] }
  | { readonly status: 'REFUSED'; readonly message: string }
  | undefined {
  for (const editor of OBJECT_EDITORS) {
    const outcome = editor.transform?.(
      project,
      levelId,
      objectId,
      transform,
      selection,
    );
    if (outcome !== undefined) return outcome;
  }
  return undefined;
}

/** One family of objects to be listed, with what it holds. */
export interface ListedFamily {
  readonly label: string;
  readonly scope: 'LEVEL' | 'PROJECT';
  readonly objects: readonly ObjectListing[];
}

/**
 * Every object the project holds, family by family.
 *
 * The tree and the palette both asked this question and both answered it
 * themselves — nine families in one, five in the other — so an object could be
 * drawn, inspected, moved and impossible to find by name. One answer now, from
 * the families themselves.
 */
export function listedFamilies(
  project: Project,
  levelId: string | undefined,
): readonly ListedFamily[] {
  // Every family that can list, empty or not: a drawer with nothing in it is
  // how the tree says that a storey has no stairs, which is worth saying.
  return OBJECT_EDITORS.filter(
    (editor): editor is ObjectEditorDefinition & { list: ListingProvider } =>
      editor.list !== undefined,
  ).map((editor) => ({
    label: editor.listLabel ?? editor.label,
    scope: editor.scope ?? 'LEVEL',
    objects: editor.list(project, levelId),
  }));
}

/** Where one object lives in the project file, whichever family it belongs to. */
export function pathOfObject(
  project: Project,
  objectId: string,
): string | undefined {
  for (const editor of OBJECT_EDITORS) {
    const path = editor.pathOf?.(project, objectId);
    if (path !== undefined) return path;
  }
  return undefined;
}

/**
 * The value in the file that one inspector property writes to.
 *
 * Usually the object's own path plus the property's name, because the property
 * is named after the field it edits. A producer that edits something else —
 * a network segment writes into `properties/…` — says so itself.
 */
export function scenarioPathFor(
  project: Project,
  objectId: string,
  edit: InspectorEdit,
): string | undefined {
  if (edit.scenarioPath !== undefined) return edit.scenarioPath;
  const path = pathOfObject(project, objectId);
  return path === undefined ? undefined : `${path}/${edit.id}`;
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
