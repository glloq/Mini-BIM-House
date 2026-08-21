import type {
  ComponentCategory,
  DimensionType,
  ProjectFile,
  SiteObstacleKind,
  SlabRole,
  StairType,
  StructuralMemberKind,
  WallRole,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import {
  addDimensionCommand,
  addTextNoteCommand,
  addEveryDetectedRoomCommand,
  addOpeningCommand,
  addRoofStructureCommand,
  addSiteOutlineCommand,
  addSlabFromPointsCommand,
  addSpaceAtPointCommand,
  addStairCommand,
  addStructuralMemberCommand,
  addWallCommand,
  addWallRectangleCommand,
  addWallRunCommand,
  placeComponentCommand,
  punchSlabHoleCommand,
  joinWallsCommand,
  offsetWallCommand,
  splitWallCommand,
  transformObjectsCommand,
  type EditingCommandResult,
} from './editing-commands.js';
import {
  branchCommand,
  placeNodeCommand,
  routeCommand,
} from '../networks/network-model.js';
import type { ToolOptionDefinition } from './tool-options.js';
import { OBJECT_FAMILIES } from './object-editors.js';
import {
  COMPONENT_CATEGORY_OPTIONS,
  DIMENSION_TYPE_OPTIONS,
  OPENING_TYPE_OPTIONS,
  SLAB_ROLE_OPTIONS,
  SITE_OBSTACLE_OPTIONS,
  SPACE_CATEGORY_OPTIONS,
  STAIR_TYPE_OPTIONS,
  STRUCTURAL_MEMBER_OPTIONS,
  WALL_ROLE_OPTIONS,
} from './domain-options.js';
import {
  NETWORK_DISCIPLINE_LABELS,
  networkNodeTemplates,
} from '@house-technical-designer/editor-core';

/**
 * The families a tool belongs to.
 *
 * A palette that keeps growing as one flat row becomes unreadable long before
 * it is complete: an editor covering a whole house needs architecture,
 * structure, components, networks, annotation and modification tools. The group
 * is declared by the tool rather than decided by the toolbar, so a new tool
 * appears where it belongs without the toolbar knowing what it is.
 */
export type ToolGroup =
  | 'SELECTION'
  | 'ARCHITECTURE'
  | 'STRUCTURE'
  | 'SITE'
  | 'COMPONENTS'
  | 'MODIFICATION'
  | 'NETWORKS'
  | 'ANNOTATION';

export const TOOL_GROUP_LABELS: Readonly<Record<ToolGroup, string>> = {
  SELECTION: 'Sélection',
  ARCHITECTURE: 'Architecture',
  STRUCTURE: 'Structure',
  SITE: 'Terrain',
  COMPONENTS: 'Composants',
  MODIFICATION: 'Modification',
  NETWORKS: 'Réseaux',
  ANNOTATION: 'Annotation',
};

/**
 * How much of the editor is shown.
 *
 * Not three products: one product with three amounts of it visible. Nothing is
 * disabled and nothing behaves differently — a project drawn in QUICK is the
 * same file as a project drawn in EXPERT, and switching levels changes what is
 * on screen and nothing else.
 */
export const EDITOR_LEVELS = ['QUICK', 'DESIGN', 'EXPERT'] as const;
export type EditorLevel = (typeof EDITOR_LEVELS)[number];

export const EDITOR_LEVEL_LABELS: Readonly<Record<EditorLevel, string>> = {
  QUICK: 'Essentiel',
  DESIGN: 'Conception',
  EXPERT: 'Expert',
};

export const EDITOR_LEVEL_HINTS: Readonly<Record<EditorLevel, string>> = {
  QUICK: 'De quoi dessiner une maison : sélection, murs, ouvertures, pièces.',
  DESIGN: 'Tout ce qu’un projet ordinaire demande, annotations comprises.',
  EXPERT: 'Tous les outils, réseaux et transformations compris.',
};

const LEVEL_ORDER: Readonly<Record<EditorLevel, number>> = {
  QUICK: 0,
  DESIGN: 1,
  EXPERT: 2,
};

/** Whether a tool is offered at this level of the interface. */
export function toolAtLevel(
  tool: EditorToolDefinition,
  level: EditorLevel,
): boolean {
  return LEVEL_ORDER[tool.level ?? 'DESIGN'] <= LEVEL_ORDER[level];
}

/** Everything a tool needs to turn clicks into a command. */
export interface ToolCommandContext {
  readonly file: ProjectFile;
  readonly levelId?: string;
  readonly points: readonly Point2D[];
  /**
   * What each click landed on, when it landed on something.
   *
   * A tool acting on existing objects — cutting the wall the user aimed at,
   * joining the two they pointed to — needs to know which ones, and the canvas
   * is what knows: it picks with the tolerance of the screen rather than a
   * distance in millimetres.
   */
  readonly picks: readonly (string | undefined)[];
  /**
   * What is selected, for a tool that acts on it.
   *
   * Turning or reflecting asks the plan where, and the selection what.
   */
  readonly selection: readonly string[];
  /** What the user chose in the tool's own options, by key. */
  readonly option: (key: string) => string;
  readonly optionNumber: (key: string) => number | undefined;
  /** A fresh identifier, so a tool never invents its own numbering. */
  readonly newId: (prefix: string) => string;
}

/**
 * One tool of the editor, declared in a single place.
 *
 * Everything the rest of the application asks about a tool is answered here:
 * how many clicks it takes, whether it drafts along the building axes, which
 * shortcut selects it, and what command its clicks produce. Before this, those
 * four answers lived in four separate `switch` statements plus the toolbar, and
 * adding a tool meant editing all of them — which is the reason an editor that
 * has to grow to stairs, columns, furniture, ducts and annotations could not.
 */
export interface EditorToolDefinition {
  readonly id: string;
  readonly group: ToolGroup;
  readonly label: string;
  /** What the tool is for, shown as its tooltip. */
  readonly hint: string;
  /** Identifier of the keyboard shortcut that selects it. */
  readonly shortcutId: string;
  /** Clicks the tool collects before it produces a command. */
  readonly requiredPoints: number;
  /**
   * The least experienced level of the interface that offers this tool.
   *
   * Forty-odd tools in one bar is a wall of buttons for someone drawing their
   * first plan, and a necessary set for someone drawing a set of documents.
   * The answer is not to remove tools, it is to say which ones are needed to
   * draw a house at all — walls, openings, rooms, selection — and to let the
   * rest appear when they are asked for. A tool that says nothing is available
   * from DESIGN onwards, which is where an ordinary project sits.
   */
  readonly level?: EditorLevel;
  /**
   * Whether what is being drafted is a wall.
   *
   * The preview shows the thickness of what will be built rather than a line:
   * a wall drawn to the edge of a room does not stop where its axis does. The
   * tool says so; the canvas used to name the wall tool itself, and a second
   * wall tool would have drawn nothing.
   */
  readonly drawsWalls?: true;
  /**
   * Whether the tool keeps taking points until the user says it is finished.
   *
   * A wall between two points is two clicks and everyone knows when it ends. A
   * run of walls around a house, the outline of a room, the path of a duct
   * have no number of points known in advance; asking for one would be asking
   * the user to count corners before drawing them. Such a tool collects until
   * Entrée, and `requiredPoints` then states the fewest it can accept.
   */
  readonly openEnded?: true;
  /**
   * Whether the point being drafted follows the angle and length constraints.
   *
   * A wall is drawn along the building axes. A dimension is not drawn at all:
   * it points at endpoints that already exist, and constraining the click would
   * pull it off the corner the user aimed at.
   */
  readonly constrainsDrafting?: boolean;
  /**
   * Whether the length and the angle can be typed while this tool drafts.
   *
   * A wall is drawn by saying how long and how steep; turning a selection is
   * three clicks and no number, and offering fields there would invite the user
   * to type into something nobody reads. A tool says what it accepts rather
   * than the canvas deciding for all of them.
   */
  readonly dynamicInput?: {
    readonly length: boolean;
    readonly angle: boolean;
  };
  /**
   * What this tool lets the user decide before drawing.
   *
   * The toolbar renders whatever is declared here and knows nothing about
   * walls or ducts, so a new tool brings its own controls with it.
   */
  readonly options?: readonly ToolOptionDefinition[];
  /** The command the collected clicks produce, when the tool produces one. */
  readonly createCommand?: (
    context: ToolCommandContext,
  ) => EditingCommandResult;
}

function levelOf(context: ToolCommandContext) {
  const levels = context.file.project.building.levels;
  return context.levelId === undefined
    ? levels[0]
    : levels.find(({ id }) => id === context.levelId);
}

export const EDITOR_TOOLS = [
  {
    id: 'SELECT',
    group: 'SELECTION',
    label: 'Sélection',
    hint: 'Sélectionner et modifier un objet',
    shortcutId: 'tool.select',
    requiredPoints: 0,
    level: 'QUICK',
    options: [
      {
        key: 'family',
        kind: 'SELECT',
        label: 'Filtrer sur',
        hint: 'Un clic ou une bande ne prend que cette famille.',
        choices: () => [
          { value: 'ALL', label: 'Tous les objets' },
          ...OBJECT_FAMILIES.map(({ id, label }) => ({ value: id, label })),
        ],
        // Nothing is filtered until the user asks for it: an editor that
        // silently ignored half the plan would be one nobody could trust.
        fallback: () => 'ALL',
      },
    ],
  },
  {
    id: 'WALL',
    group: 'ARCHITECTURE',
    label: 'Mur',
    hint: 'Dessiner un mur entre deux points',
    shortcutId: 'tool.wall',
    requiredPoints: 2,
    level: 'QUICK',
    drawsWalls: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'assemblyId',
        kind: 'SELECT',
        label: 'Assemblage',
        choices: ({ project }) =>
          (project.assemblies ?? [])
            .filter(
              ({ category }) => category === 'WALL' || category === 'PARTITION',
            )
            .map(({ id, name }) => ({ value: id, label: name })),
        fallback: ({ project }) =>
          (project.assemblies ?? []).find(
            ({ category }) => category === 'WALL' || category === 'PARTITION',
          )?.id ??
          project.assemblies?.[0]?.id ??
          '',
      },
      {
        key: 'role',
        kind: 'SELECT',
        label: 'Rôle',
        choices: () => WALL_ROLE_OPTIONS,
        // A partition assembly proposes the matching role; the user stays free
        // to say otherwise, and nothing is inferred at creation time.
        fallback: ({ project, value }) =>
          (project.assemblies ?? []).find(
            ({ id }) => id === value('assemblyId'),
          )?.category === 'PARTITION'
            ? 'PARTITION'
            : 'EXTERIOR',
      },
    ],
    createCommand: (context) =>
      addWallCommand(
        context.file,
        context.levelId,
        context.points,
        {
          assemblyId: context.option('assemblyId'),
          role: context.option('role') as WallRole,
        },
        context.newId('wall'),
      ),
  },
  {
    id: 'WALL_RUN',
    group: 'ARCHITECTURE',
    label: 'Mur continu',
    hint: 'Enchaîner les murs de coin en coin · Entrée termine, Échap annule',
    shortcutId: 'tool.wallRun',
    // Two points is the fewest a run can describe; there is no most.
    requiredPoints: 2,
    level: 'QUICK',
    openEnded: true,
    drawsWalls: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'assemblyId',
        kind: 'SELECT',
        label: 'Assemblage',
        choices: ({ project }) =>
          (project.assemblies ?? [])
            .filter(
              ({ category }) => category === 'WALL' || category === 'PARTITION',
            )
            .map(({ id, name }) => ({ value: id, label: name })),
        fallback: ({ project }) =>
          (project.assemblies ?? []).find(
            ({ category }) => category === 'WALL' || category === 'PARTITION',
          )?.id ??
          project.assemblies?.[0]?.id ??
          '',
      },
      {
        key: 'role',
        kind: 'SELECT',
        label: 'Rôle',
        choices: () => WALL_ROLE_OPTIONS,
        fallback: ({ project, value }) =>
          (project.assemblies ?? []).find(
            ({ id }) => id === value('assemblyId'),
          )?.category === 'PARTITION'
            ? 'PARTITION'
            : 'EXTERIOR',
      },
      {
        key: 'shape',
        kind: 'SELECT',
        label: 'Créer',
        hint: 'Un mur par côté peut porter son propre assemblage et ses ouvertures.',
        choices: () => [
          { value: 'SEGMENTS', label: 'Un mur par côté' },
          { value: 'POLYLINE', label: 'Un seul mur polyligne' },
        ],
        fallback: () => 'SEGMENTS',
      },
      {
        key: 'closed',
        kind: 'SELECT',
        label: 'Fermer',
        hint: 'Revient au premier point pour clore le contour.',
        choices: () => [
          { value: 'NO', label: 'Non' },
          { value: 'YES', label: 'Oui' },
        ],
        fallback: () => 'NO',
      },
    ],
    createCommand: (context) =>
      addWallRunCommand(
        context.file,
        context.levelId,
        context.points,
        {
          assemblyId: context.option('assemblyId'),
          role: context.option('role') as WallRole,
        },
        {
          asOneWall: context.option('shape') === 'POLYLINE',
          closed: context.option('closed') === 'YES',
          newId: context.newId,
        },
      ),
  },
  {
    id: 'WALL_RECTANGLE',
    group: 'ARCHITECTURE',
    label: 'Murs rectangle',
    hint: 'Enclore par deux coins opposés : quatre murs d’équerre',
    shortcutId: 'tool.wallRectangle',
    requiredPoints: 2,
    drawsWalls: true,
    options: [
      {
        key: 'assemblyId',
        kind: 'SELECT',
        label: 'Assemblage',
        choices: ({ project }) =>
          (project.assemblies ?? [])
            .filter(
              ({ category }) => category === 'WALL' || category === 'PARTITION',
            )
            .map(({ id, name }) => ({ value: id, label: name })),
        fallback: ({ project }) =>
          (project.assemblies ?? []).find(
            ({ category }) => category === 'WALL' || category === 'PARTITION',
          )?.id ??
          project.assemblies?.[0]?.id ??
          '',
      },
      {
        key: 'role',
        kind: 'SELECT',
        label: 'Rôle',
        choices: () => WALL_ROLE_OPTIONS,
        fallback: ({ project, value }) =>
          (project.assemblies ?? []).find(
            ({ id }) => id === value('assemblyId'),
          )?.category === 'PARTITION'
            ? 'PARTITION'
            : 'EXTERIOR',
      },
    ],
    createCommand: (context) =>
      addWallRectangleCommand(
        context.file,
        context.levelId,
        context.points,
        {
          assemblyId: context.option('assemblyId'),
          role: context.option('role') as WallRole,
        },
        context.newId,
      ),
  },
  {
    id: 'OPENING',
    group: 'ARCHITECTURE',
    label: 'Ouverture',
    hint: 'Percer une porte ou une fenêtre dans un mur',
    shortcutId: 'tool.opening',
    requiredPoints: 1,
    level: 'QUICK',
    options: [
      {
        key: 'openingType',
        kind: 'SELECT',
        label: 'Type',
        choices: () =>
          OPENING_TYPE_OPTIONS.filter(
            ({ value }) => value === 'DOOR' || value === 'WINDOW',
          ),
        fallback: () => 'WINDOW',
      },
      {
        key: 'widthMm',
        kind: 'NUMBER',
        label: 'Largeur',
        unit: 'mm',
        min: 100,
        step: 50,
        fallback: () => '1200',
      },
      {
        key: 'heightMm',
        kind: 'NUMBER',
        label: 'Hauteur',
        unit: 'mm',
        min: 100,
        step: 50,
        fallback: ({ value }) =>
          value('openingType') === 'DOOR' ? '2040' : '1350',
      },
      {
        key: 'sillHeightMm',
        kind: 'NUMBER',
        label: 'Allège',
        unit: 'mm',
        min: 0,
        step: 50,
        fallback: ({ value }) =>
          value('openingType') === 'DOOR' ? '0' : '900',
      },
    ],
    createCommand: (context) =>
      addOpeningCommand(
        context.file,
        context.levelId,
        context.points[context.points.length - 1]!,
        {
          openingType: context.option('openingType') as 'DOOR' | 'WINDOW',
          widthMm: context.optionNumber('widthMm') ?? 0,
          heightMm: context.optionNumber('heightMm') ?? 0,
          sillHeightMm: context.optionNumber('sillHeightMm') ?? 0,
        },
        context.newId('opening'),
      ),
  },
  {
    id: 'SPACE',
    group: 'ARCHITECTURE',
    label: 'Pièce',
    hint: 'Cliquer dans un contour fermé par les murs pour en faire une pièce',
    shortcutId: 'tool.space',
    requiredPoints: 1,
    level: 'QUICK',
    options: [
      {
        key: 'name',
        kind: 'TEXT',
        label: 'Nom',
        // A room with no name is a room nothing can name in a schedule; the
        // fallback is a placeholder the user is expected to replace, not a
        // value the application pretends to know.
        fallback: () => 'Nouvelle pièce',
      },
      {
        key: 'category',
        kind: 'SELECT',
        label: 'Usage',
        choices: () => SPACE_CATEGORY_OPTIONS,
        fallback: () => 'OTHER',
      },
      {
        key: 'scope',
        kind: 'SELECT',
        label: 'Créer',
        choices: () => [
          { value: 'ONE', label: 'Le contour visé' },
          { value: 'ALL', label: 'Tous les contours libres' },
        ],
        fallback: () => 'ONE',
      },
    ],
    createCommand: (context) => {
      if (context.option('scope') === 'ALL')
        return addEveryDetectedRoomCommand(
          context.file,
          context.levelId,
          { category: context.option('category') },
          context.newId,
        );
      const point = context.points[0];
      if (point === undefined)
        return { status: 'ERROR', message: 'Un point est attendu.' };
      return addSpaceAtPointCommand(
        context.file,
        context.levelId,
        point,
        {
          name: context.option('name'),
          category: context.option('category'),
        },
        context.newId('space'),
      );
    },
  },
  {
    id: 'SLAB',
    group: 'ARCHITECTURE',
    label: 'Dalle',
    hint: 'Poser une dalle : contour cliqué, ou contour de la pièce visée',
    shortcutId: 'tool.slab',
    // Three corners is the fewest a floor can have; there is no most.
    requiredPoints: 3,
    openEnded: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'assemblyId',
        kind: 'SELECT',
        label: 'Assemblage',
        choices: ({ project }) =>
          (project.assemblies ?? [])
            .filter(
              ({ category }) => category === 'FLOOR' || category === 'CEILING',
            )
            .map(({ id, name }) => ({ value: id, label: name })),
        fallback: ({ project }) =>
          (project.assemblies ?? []).find(
            ({ category }) => category === 'FLOOR' || category === 'CEILING',
          )?.id ?? '',
      },
      {
        key: 'role',
        kind: 'SELECT',
        label: 'Rôle',
        choices: () => SLAB_ROLE_OPTIONS,
        fallback: () => 'FLOOR',
      },
      {
        key: 'outline',
        kind: 'SELECT',
        label: 'Contour',
        hint: 'Le contour d’une pièce est celui que les murs enferment déjà.',
        choices: () => [
          { value: 'POINTS', label: 'Les points cliqués' },
          { value: 'ROOM', label: 'Le contour visé' },
        ],
        fallback: () => 'POINTS',
      },
    ],
    createCommand: (context) =>
      addSlabFromPointsCommand(
        context.file,
        context.levelId,
        context.points,
        {
          assemblyId: context.option('assemblyId'),
          role: context.option('role') as SlabRole,
          fromRoom: context.option('outline') === 'ROOM',
        },
        context.newId('slab'),
      ),
  },
  {
    id: 'SLAB_HOLE',
    group: 'ARCHITECTURE',
    label: 'Trémie',
    hint: 'Percer un contour dans la dalle qui passe dessous',
    shortcutId: 'tool.slabHole',
    requiredPoints: 3,
    level: 'EXPERT',
    openEnded: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    createCommand: (context) =>
      punchSlabHoleCommand(context.file, context.levelId, context.points),
  },
  {
    id: 'ROOF',
    group: 'ARCHITECTURE',
    label: 'Toiture',
    hint: 'Décrire une toiture par son contour · Entrée termine, Échap annule',
    shortcutId: 'tool.roof',
    requiredPoints: 3,
    openEnded: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'assemblyId',
        kind: 'SELECT',
        label: 'Assemblage',
        choices: ({ project }) =>
          (project.assemblies ?? [])
            .filter(
              ({ category }) => category === 'ROOF' || category === 'FLOOR',
            )
            .map(({ id, name }) => ({ value: id, label: name })),
        fallback: ({ project }) =>
          (project.assemblies ?? []).find(
            ({ category }) => category === 'ROOF' || category === 'FLOOR',
          )?.id ?? '',
      },
      {
        key: 'slopeDeg',
        kind: 'NUMBER',
        label: 'Pente des pans',
        unit: '°',
        step: 1,
        hint: 'Chaque côté part en pan ; l’inspecteur en fait des pignons.',
        fallback: () => '35',
      },
      {
        key: 'overhangMm',
        kind: 'NUMBER',
        label: 'Débord',
        unit: 'mm',
        step: 50,
        min: 0,
        fallback: () => '400',
      },
      {
        key: 'outline',
        kind: 'SELECT',
        label: 'Contour',
        choices: () => [
          { value: 'POINTS', label: 'Les points cliqués' },
          { value: 'WALLS', label: 'Le contour visé' },
        ],
        fallback: () => 'POINTS',
      },
    ],
    createCommand: (context) =>
      addRoofStructureCommand(
        context.file,
        context.levelId,
        context.points,
        {
          assemblyId: context.option('assemblyId'),
          slopeDeg: context.optionNumber('slopeDeg') ?? 35,
          overhangMm: context.optionNumber('overhangMm') ?? 400,
          fromWalls: context.option('outline') === 'WALLS',
        },
        context.newId('roof'),
      ),
  },
  {
    id: 'STAIR',
    group: 'ARCHITECTURE',
    label: 'Escalier',
    hint: 'Tracer la ligne de foulée · Entrée termine, Échap annule',
    shortcutId: 'tool.stair',
    requiredPoints: 2,
    openEnded: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'stairType',
        kind: 'SELECT',
        label: 'Type',
        choices: () => STAIR_TYPE_OPTIONS,
        fallback: () => 'STRAIGHT',
      },
      {
        key: 'riserCount',
        kind: 'NUMBER',
        label: 'Contremarches',
        step: 1,
        min: 2,
        hint: 'La hauteur de marche se déduit de la montée entre les niveaux.',
        // Sixteen risers for a storey of about 2,70 m gives roughly 17 cm,
        // which is where a house usually lands; the user changes it freely and
        // the inspector says whether the result is comfortable.
        fallback: () => '16',
      },
      {
        key: 'treadDepthMm',
        kind: 'NUMBER',
        label: 'Giron',
        unit: 'mm',
        step: 10,
        min: 1,
        fallback: () => '270',
      },
      {
        key: 'widthMm',
        kind: 'NUMBER',
        label: 'Emmarchement',
        unit: 'mm',
        step: 50,
        min: 1,
        fallback: () => '900',
      },
    ],
    createCommand: (context) =>
      addStairCommand(
        context.file,
        context.levelId,
        context.points,
        {
          stairType: context.option('stairType') as StairType,
          widthMm: context.optionNumber('widthMm') ?? 900,
          riserCount: Math.round(context.optionNumber('riserCount') ?? 16),
          treadDepthMm: context.optionNumber('treadDepthMm') ?? 270,
        },
        context.newId('stair'),
      ),
  },
  {
    id: 'COLUMN',
    group: 'STRUCTURE',
    label: 'Poteau',
    hint: 'Poser un poteau ou une fondation en un point',
    shortcutId: 'tool.column',
    // A column stands at a point; a beam runs between two. The difference is
    // what the member is, and it is what the two tools are for.
    requiredPoints: 1,
    options: [
      {
        key: 'kind',
        kind: 'SELECT',
        label: 'Élément',
        choices: () =>
          STRUCTURAL_MEMBER_OPTIONS.filter(({ value }) => value !== 'BEAM'),
        fallback: () => 'COLUMN',
      },
      {
        key: 'widthMm',
        kind: 'NUMBER',
        label: 'Largeur',
        unit: 'mm',
        step: 10,
        min: 1,
        fallback: () => '200',
      },
      {
        key: 'depthMm',
        kind: 'NUMBER',
        label: 'Profondeur',
        unit: 'mm',
        step: 10,
        min: 1,
        fallback: () => '200',
      },
      {
        key: 'heightMm',
        kind: 'NUMBER',
        label: 'Hauteur',
        unit: 'mm',
        step: 50,
        hint: 'Hauteur d’un poteau, profondeur d’une fondation.',
        fallback: ({ project }) =>
          String(project.building.levels[0]?.defaultStoreyHeightMm ?? 2500),
      },
    ],
    createCommand: (context) =>
      addStructuralMemberCommand(
        context.file,
        context.levelId,
        context.points,
        {
          kind: context.option('kind') as StructuralMemberKind,
          widthMm: context.optionNumber('widthMm') ?? 200,
          depthMm: context.optionNumber('depthMm') ?? 200,
          ...(context.optionNumber('heightMm') === undefined
            ? {}
            : { heightMm: context.optionNumber('heightMm')! }),
        },
        context.newId('member'),
      ),
  },
  {
    id: 'BEAM',
    group: 'STRUCTURE',
    label: 'Poutre',
    hint: 'Faire courir une poutre entre deux points',
    shortcutId: 'tool.beam',
    requiredPoints: 2,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'widthMm',
        kind: 'NUMBER',
        label: 'Largeur',
        unit: 'mm',
        step: 10,
        min: 1,
        fallback: () => '200',
      },
      {
        key: 'depthMm',
        kind: 'NUMBER',
        label: 'Profondeur',
        unit: 'mm',
        step: 10,
        min: 1,
        fallback: () => '200',
      },
    ],
    createCommand: (context) =>
      addStructuralMemberCommand(
        context.file,
        context.levelId,
        context.points,
        {
          kind: 'BEAM',
          widthMm: context.optionNumber('widthMm') ?? 200,
          depthMm: context.optionNumber('depthMm') ?? 200,
        },
        context.newId('member'),
      ),
  },
  {
    id: 'SITE',
    group: 'SITE',
    label: 'Terrain',
    hint: 'Tracer la parcelle ou ce qui l’entoure · Entrée termine',
    shortcutId: 'tool.site',
    requiredPoints: 3,
    openEnded: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'target',
        kind: 'SELECT',
        label: 'Tracer',
        choices: () => [
          { value: 'PARCEL', label: 'La parcelle' },
          { value: 'OBSTACLE', label: 'Un obstacle' },
        ],
        fallback: () => 'PARCEL',
      },
      {
        key: 'kind',
        kind: 'SELECT',
        label: 'Nature',
        hint: 'Un voisin, un arbre et une zone à laisser libre ne portent pas la même ombre.',
        choices: () => SITE_OBSTACLE_OPTIONS,
        fallback: () => 'BUILDING',
      },
      {
        key: 'heightMm',
        kind: 'NUMBER',
        label: 'Hauteur',
        unit: 'mm',
        step: 500,
        hint: 'Vide, la hauteur reste inconnue et l’ombre n’est pas calculée.',
        fallback: () => '',
      },
      {
        key: 'name',
        kind: 'TEXT',
        label: 'Nom',
        fallback: () => '',
      },
    ],
    createCommand: (context) =>
      addSiteOutlineCommand(
        context.points,
        {
          target: context.option('target') === 'PARCEL' ? 'PARCEL' : 'OBSTACLE',
          kind: context.option('kind') as SiteObstacleKind,
          ...(context.optionNumber('heightMm') === undefined
            ? {}
            : { heightMm: context.optionNumber('heightMm')! }),
          ...(context.option('name') === ''
            ? {}
            : { name: context.option('name') }),
        },
        context.newId('obstacle'),
      ),
  },
  {
    id: 'COMPONENT',
    group: 'COMPONENTS',
    label: 'Composant',
    hint: 'Poser un équipement, un appareil ou un meuble à un endroit du plan',
    shortcutId: 'tool.component',
    requiredPoints: 1,
    options: [
      {
        key: 'category',
        kind: 'SELECT',
        label: 'Catégorie',
        choices: () => COMPONENT_CATEGORY_OPTIONS,
        fallback: () => 'OTHER',
      },
      {
        key: 'definitionId',
        kind: 'SELECT',
        label: 'Modèle catalogue',
        hint: 'Les propriétés physiques restent celles du modèle.',
        choices: ({ project }) => [
          { value: '', label: 'Aucun modèle' },
          ...(project.equipment ?? []).map((definition) => ({
            value: definition.id,
            label: `${definition.kind} · ${definition.id}`,
          })),
        ],
        // Nothing is chosen for the user: a component standing for a model
        // nobody picked would be a claim the project cannot support.
        fallback: () => '',
      },
      {
        key: 'name',
        kind: 'TEXT',
        label: 'Nom',
        hint: 'Vide, le composant prend le nom de sa catégorie.',
        fallback: () => '',
      },
      {
        key: 'elevationMm',
        kind: 'NUMBER',
        label: 'Altitude sur le niveau',
        unit: 'mm',
        step: 10,
        fallback: () => '0',
      },
    ],
    createCommand: (context) => {
      const point = context.points[0];
      if (point === undefined)
        return { status: 'ERROR', message: 'Un point est attendu.' };
      return placeComponentCommand(
        context.file,
        context.levelId,
        point,
        {
          category: context.option('category') as ComponentCategory,
          definitionId: context.option('definitionId'),
          name: context.option('name'),
          elevationMm: context.optionNumber('elevationMm') ?? 0,
        },
        context.newId('component'),
      );
    },
  },
  {
    id: 'SPLIT',
    group: 'ARCHITECTURE',
    label: 'Scinder',
    hint: 'Couper un mur à l’endroit désigné',
    shortcutId: 'tool.split',
    requiredPoints: 1,
    level: 'EXPERT',
    createCommand: (context) => {
      const point = context.points[context.points.length - 1]!;
      const level = levelOf(context);
      const wall = level?.walls.find(
        ({ id }) => id === context.picks[context.picks.length - 1],
      );
      if (wall === undefined)
        return {
          status: 'ERROR',
          message: 'Cliquez sur le mur à scinder.',
        };
      if (wall.path.points.length !== 2)
        return {
          status: 'ERROR',
          message: 'Seul un mur droit peut être scindé.',
        };
      return splitWallCommand(
        context.file,
        context.levelId,
        wall.id,
        point,
        context.newId('wall'),
      );
    },
  },
  {
    id: 'OFFSET',
    group: 'MODIFICATION',
    label: 'Décaler',
    hint: 'Tracer un mur parallèle : le mur, puis le côté et la distance',
    shortcutId: 'tool.offset',
    requiredPoints: 2,
    level: 'EXPERT',
    createCommand: (context) => {
      const wallId = context.picks[0];
      const towards = context.points[1];
      if (wallId === undefined || towards === undefined)
        return {
          status: 'ERROR',
          message: 'Cliquez le mur à décaler, puis le côté voulu.',
        };
      return offsetWallCommand(
        context.file,
        context.levelId,
        wallId,
        towards,
        context.newId('wall'),
      );
    },
  },
  {
    id: 'JOIN',
    group: 'MODIFICATION',
    label: 'Joindre',
    hint: 'Amener deux murs à leur intersection',
    shortcutId: 'tool.join',
    requiredPoints: 2,
    level: 'EXPERT',
    createCommand: (context) => {
      const [firstId, secondId] = context.picks;
      const [firstAt, secondAt] = context.points;
      if (
        firstId === undefined ||
        secondId === undefined ||
        firstAt === undefined ||
        secondAt === undefined
      )
        return { status: 'ERROR', message: 'Cliquez deux murs.' };
      return joinWallsCommand(
        context.file,
        context.levelId,
        { wallId: firstId, at: firstAt },
        { wallId: secondId, at: secondAt },
        true,
      );
    },
  },
  {
    id: 'TRIM',
    group: 'MODIFICATION',
    label: 'Ajuster',
    hint: 'Allonger ou raccourcir un mur jusqu’à un autre',
    shortcutId: 'tool.trim',
    requiredPoints: 2,
    level: 'EXPERT',
    createCommand: (context) => {
      const [firstId, secondId] = context.picks;
      const [firstAt, secondAt] = context.points;
      if (
        firstId === undefined ||
        secondId === undefined ||
        firstAt === undefined ||
        secondAt === undefined
      )
        return {
          status: 'ERROR',
          message:
            'Cliquez le mur à ajuster, puis celui jusqu’auquel l’amener.',
        };
      // Only the first wall moves: the second one is the edge it is brought to.
      return joinWallsCommand(
        context.file,
        context.levelId,
        { wallId: firstId, at: firstAt },
        { wallId: secondId, at: secondAt },
        false,
      );
    },
  },
  {
    id: 'ROTATE',
    group: 'MODIFICATION',
    label: 'Pivoter',
    hint: 'Pivoter la sélection : centre, point de référence, position voulue',
    shortcutId: 'tool.rotate',
    // Centre, then the direction things point at now, then where that direction
    // should end up. Three clicks and no number to type.
    requiredPoints: 3,
    level: 'EXPERT',
    createCommand: (context) => {
      const [centre, from, to] = context.points;
      if (centre === undefined || from === undefined || to === undefined)
        return { status: 'ERROR', message: 'Trois points sont attendus.' };
      const bearing = (point: Point2D): number =>
        Math.atan2(point.y - centre.y, point.x - centre.x);
      const angleDeg = ((bearing(to) - bearing(from)) * 180) / Math.PI;
      return transformObjectsCommand(
        context.file,
        context.levelId,
        context.selection,
        { kind: 'ROTATE', centre, angleDeg },
      );
    },
  },
  {
    id: 'MIRROR',
    group: 'MODIFICATION',
    label: 'Miroir',
    hint: 'Retourner la sélection de part et d’autre d’un axe tracé',
    shortcutId: 'tool.mirror',
    requiredPoints: 2,
    level: 'EXPERT',
    constrainsDrafting: true,
    // The axis has a direction that matters and a length that does not.
    dynamicInput: { length: false, angle: true },
    createCommand: (context) => {
      const [from, to] = context.points;
      if (from === undefined || to === undefined)
        return { status: 'ERROR', message: 'Deux points sont attendus.' };
      if (from.x === to.x && from.y === to.y)
        return {
          status: 'ERROR',
          message: 'Un axe de miroir demande deux points distincts.',
        };
      return transformObjectsCommand(
        context.file,
        context.levelId,
        context.selection,
        { kind: 'MIRROR', from, to },
      );
    },
  },
  {
    id: 'NETWORK_ROUTE',
    group: 'NETWORKS',
    label: 'Tracer un tronçon',
    hint: 'Cliquer un port, les coudes, puis le port d’arrivée · Entrée termine',
    shortcutId: 'tool.networkRoute',
    // A port, a port: the corners in between are as many as the run needs.
    requiredPoints: 2,
    openEnded: true,
    constrainsDrafting: true,
    dynamicInput: { length: true, angle: true },
    options: [
      {
        key: 'networkId',
        kind: 'SELECT',
        // Placing a node, routing a run and the Networks workspace must all
        // speak of the same network, so the choice belongs to the plan.
        scope: 'SHARED',
        label: 'Réseau',
        choices: ({ project }) =>
          (project.systems ?? []).map((network) => ({
            value: network.id,
            label: `${NETWORK_DISCIPLINE_LABELS[network.discipline]} · ${network.id}`,
          })),
        fallback: ({ project }) => project.systems?.[0]?.id ?? '',
      },
      {
        key: 'slopePercent',
        kind: 'NUMBER',
        label: 'Pente',
        unit: '%',
        step: 0.5,
        hint: 'Une évacuation horizontale est une évacuation qui ne s’écoule pas.',
        // Gravity drainage needs a fall and nothing else does; the default
        // follows the discipline of the network chosen just beside rather
        // than a number written into the code.
        fallback: ({ project, value }) => {
          const network = (project.systems ?? []).find(
            ({ id }) => id === value('networkId'),
          );
          return network?.discipline === 'WASTEWATER' ||
            network?.discipline === 'RAINWATER'
            ? '2'
            : '0';
        },
      },
      {
        key: 'riseMm',
        kind: 'NUMBER',
        label: 'Montée en fin de tracé',
        unit: 'mm',
        step: 100,
        hint: 'Une colonne se voit : le tracé monte à la verticale au dernier coude.',
        fallback: () => '0',
      },
    ],
    createCommand: (context) => {
      const networkId = context.option('networkId');
      if (networkId === '')
        return {
          status: 'ERROR',
          message:
            'Aucun réseau actif : créez un réseau dans l’onglet Réseaux.',
        };
      return routeCommand(
        context.file.project,
        networkId,
        context.picks,
        context.points,
        {
          slopePercent: context.optionNumber('slopePercent') ?? 0,
          riseMm: context.optionNumber('riseMm') ?? 0,
        },
        context.newId('edge'),
      );
    },
  },
  {
    id: 'NETWORK_BRANCH',
    group: 'NETWORKS',
    label: 'Dériver',
    hint: 'Poser une pièce de dérivation sur un tronçon existant',
    shortcutId: 'tool.networkBranch',
    requiredPoints: 1,
    createCommand: (context) => {
      const point = context.points[0];
      const edgeId = context.picks[0];
      if (point === undefined)
        return { status: 'ERROR', message: 'Un point est attendu.' };
      if (edgeId === undefined)
        return {
          status: 'ERROR',
          message: 'Visez le tronçon à dériver.',
        };
      return branchCommand(context.file.project, edgeId, point, {
        nodeId: context.newId('node'),
        newId: context.newId,
      });
    },
  },
  {
    id: 'DIMENSION',
    group: 'ANNOTATION',
    label: 'Cotation',
    // Two endpoints to measure, then a point setting how far the dimension
    // line sits from them.
    hint: 'Coter entre deux extrémités de mur',
    shortcutId: 'tool.dimension',
    requiredPoints: 3,
    options: [
      {
        key: 'dimensionType',
        kind: 'SELECT',
        label: 'Type',
        choices: () => DIMENSION_TYPE_OPTIONS,
        fallback: () => 'ALIGNED',
      },
    ],
    createCommand: (context) =>
      addDimensionCommand(
        context.file,
        context.levelId,
        context.points,
        { dimensionType: context.option('dimensionType') as DimensionType },
        context.newId('dimension'),
      ),
  },
  {
    id: 'NOTE',
    group: 'ANNOTATION',
    label: 'Annotation',
    hint: 'Écrire sur le plan ce que le modèle ne dit pas',
    shortcutId: 'tool.note',
    // One point for the text; a second, optional, for what it points at.
    requiredPoints: 1,
    options: [
      {
        key: 'text',
        kind: 'TEXT',
        label: 'Texte',
        hint: 'Ce qui sera écrit sur le plan, tel quel.',
        fallback: () => '',
      },
      {
        key: 'heightMm',
        kind: 'NUMBER',
        label: 'Hauteur',
        unit: 'mm',
        step: 0.5,
        min: 0.5,
        hint: 'Hauteur des lettres sur le papier, à l’échelle de la feuille.',
        fallback: () => '2.5',
      },
    ],
    createCommand: (context) =>
      addTextNoteCommand(
        context.file,
        context.levelId,
        context.points,
        {
          text: context.option('text'),
          heightMm: context.optionNumber('heightMm') ?? 2.5,
        },
        context.newId('note'),
      ),
  },
  {
    id: 'NETWORK',
    group: 'NETWORKS',
    label: 'Réseau',
    hint: 'Poser un nœud sur le réseau actif',
    shortcutId: 'tool.network',
    requiredPoints: 1,
    options: [
      {
        key: 'networkId',
        kind: 'SELECT',
        // Placing a node, routing a run and the Networks workspace must all
        // speak of the same network, so the choice belongs to the plan.
        scope: 'SHARED',
        label: 'Réseau',
        choices: ({ project }) =>
          (project.systems ?? []).map((network) => ({
            value: network.id,
            label: `${NETWORK_DISCIPLINE_LABELS[network.discipline]} · ${network.id}`,
          })),
        fallback: ({ project }) => project.systems?.[0]?.id ?? '',
      },
      {
        key: 'nodeKind',
        kind: 'SELECT',
        label: 'Type de nœud',
        // The kinds one can place belong to the discipline of the network
        // chosen just beside: a luminaire is not a node an extract duct carries.
        choices: ({ project, value }) => {
          const network = (project.systems ?? []).find(
            ({ id }) => id === value('networkId'),
          );
          return network === undefined
            ? []
            : networkNodeTemplates(network.discipline).map((template) => ({
                value: template.kind,
                label: template.label,
              }));
        },
        fallback: ({ project, value }) => {
          const network = (project.systems ?? []).find(
            ({ id }) => id === value('networkId'),
          );
          return network === undefined
            ? ''
            : (networkNodeTemplates(network.discipline)[0]?.kind ?? '');
        },
      },
    ],
    createCommand: (context) => {
      const networkId = context.option('networkId');
      if (networkId === '')
        return {
          status: 'ERROR',
          message:
            'Aucun réseau actif : créez un réseau dans l’onglet Réseaux.',
        };
      const point = context.points[context.points.length - 1]!;
      const level = levelOf(context);
      return placeNodeCommand(context.file.project, networkId, {
        nodeId: `${networkId}:node-${context.newId('').slice(0, 8)}`,
        kind: context.option('nodeKind'),
        // The node says which storey it belongs to, so moving that storey
        // moves it too rather than leaving it at an elevation nobody edited.
        ...(level === undefined ? {} : { levelId: level.id }),
        position: { x: point.x, y: point.y, z: level?.elevationMm ?? 0 },
      });
    },
  },
] as const satisfies readonly EditorToolDefinition[];

/**
 * A tool of the editor.
 *
 * The type is derived from the registry rather than written beside it: a tool
 * that is registered exists, and one that is not cannot be referred to.
 */
export type EditorTool = (typeof EDITOR_TOOLS)[number]['id'];

export function toolDefinition(tool: EditorTool): EditorToolDefinition {
  return EDITOR_TOOLS.find(({ id }) => id === tool)!;
}

/** The tools of one family, in the order they were registered. */
/** The tools of one group that this level of the interface offers. */
export function toolsInGroupAtLevel(
  group: ToolGroup,
  level: EditorLevel,
): readonly EditorToolDefinition[] {
  return toolsInGroup(group).filter((tool) => toolAtLevel(tool, level));
}

/** The groups that hold at least one tool at this level. */
export function populatedToolGroupsAtLevel(
  level: EditorLevel,
): readonly ToolGroup[] {
  return (Object.keys(TOOL_GROUP_LABELS) as readonly ToolGroup[]).filter(
    (group) => toolsInGroupAtLevel(group, level).length > 0,
  );
}

export function toolsInGroup(
  group: ToolGroup,
): readonly EditorToolDefinition[] {
  return EDITOR_TOOLS.filter((tool) => tool.group === group);
}

/**
 * The families that hold at least one tool, in palette order.
 *
 * The order comes from the labels, which name every family exactly once: a
 * family added to the type and forgotten here used to hide every tool in it.
 */
export function populatedToolGroups(): readonly ToolGroup[] {
  return (Object.keys(TOOL_GROUP_LABELS) as readonly ToolGroup[]).filter(
    (group) => toolsInGroup(group).length > 0,
  );
}

/** What this tool lets the user decide before drawing, if anything. */
export function optionsOf(tool: EditorTool): readonly ToolOptionDefinition[] {
  return toolDefinition(tool).options ?? [];
}

/** What the tool accepts being typed while it drafts, if anything. */
export function dynamicInputOf(
  tool: EditorTool,
): { readonly length: boolean; readonly angle: boolean } | undefined {
  return toolDefinition(tool).dynamicInput;
}

/** Number of points a tool needs before it can produce a command. */
export function requiredPoints(tool: EditorTool): number {
  return toolDefinition(tool).requiredPoints;
}

/** Whether the tool draws until the user says it is finished. */
export function isOpenEnded(tool: EditorTool): boolean {
  return toolDefinition(tool).openEnded === true;
}

/** Whether what this tool drafts is a wall, thickness and all. */
export function drawsWalls(tool: EditorTool): boolean {
  return toolDefinition(tool).drawsWalls === true;
}

/** Whether a tool drafts along constrained angles and lengths. */
export function constrainsDrafting(tool: EditorTool): boolean {
  return toolDefinition(tool).constrainsDrafting === true;
}
