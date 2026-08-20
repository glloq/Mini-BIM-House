import type {
  DimensionType,
  ProjectFile,
  WallRole,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import {
  addDimensionCommand,
  addOpeningCommand,
  addWallCommand,
  splitWallCommand,
  type EditingCommandResult,
  type OpeningToolDraft,
} from './editing-commands.js';
import { placeNodeCommand } from '../networks/network-model.js';

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
  'SELECTION' | 'ARCHITECTURE' | 'NETWORKS' | 'ANNOTATION';

export const TOOL_GROUP_LABELS: Readonly<Record<ToolGroup, string>> = {
  SELECTION: 'Sélection',
  ARCHITECTURE: 'Architecture',
  NETWORKS: 'Réseaux',
  ANNOTATION: 'Annotation',
};

/** What the toolbar currently holds for each tool that drafts something. */
export interface ToolDrafts {
  readonly wallAssemblyId: string;
  readonly wallRole: WallRole;
  readonly opening: OpeningToolDraft;
  readonly dimensionType: DimensionType;
  /** The network a node is added to, when the project has one. */
  readonly networkId?: string;
  readonly nodeKind: string;
}

/** Everything a tool needs to turn clicks into a command. */
export interface ToolCommandContext {
  readonly file: ProjectFile;
  readonly levelId?: string;
  readonly points: readonly Point2D[];
  readonly drafts: ToolDrafts;
  /**
   * What the last click landed on, when it landed on something.
   *
   * A tool acting on an existing object — cutting a wall where the user aimed —
   * needs to know which one, and the canvas is what knows: it picks with the
   * tolerance of the screen rather than a distance in millimetres.
   */
  readonly pickedObjectId?: string;
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
   * Whether the point being drafted follows the angle and length constraints.
   *
   * A wall is drawn along the building axes. A dimension is not drawn at all:
   * it points at endpoints that already exist, and constraining the click would
   * pull it off the corner the user aimed at.
   */
  readonly constrainsDrafting?: boolean;
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
  },
  {
    id: 'WALL',
    group: 'ARCHITECTURE',
    label: 'Mur',
    hint: 'Dessiner un mur entre deux points',
    shortcutId: 'tool.wall',
    requiredPoints: 2,
    constrainsDrafting: true,
    createCommand: (context) =>
      addWallCommand(
        context.file,
        context.levelId,
        context.points,
        {
          assemblyId: context.drafts.wallAssemblyId,
          role: context.drafts.wallRole,
        },
        context.newId('wall'),
      ),
  },
  {
    id: 'OPENING',
    group: 'ARCHITECTURE',
    label: 'Ouverture',
    hint: 'Percer une porte ou une fenêtre dans un mur',
    shortcutId: 'tool.opening',
    requiredPoints: 1,
    createCommand: (context) =>
      addOpeningCommand(
        context.file,
        context.levelId,
        context.points[context.points.length - 1]!,
        context.drafts.opening,
        context.newId('opening'),
      ),
  },
  {
    id: 'SPLIT',
    group: 'ARCHITECTURE',
    label: 'Scinder',
    hint: 'Couper un mur à l’endroit désigné',
    shortcutId: 'tool.split',
    requiredPoints: 1,
    createCommand: (context) => {
      const point = context.points[context.points.length - 1]!;
      const level = levelOf(context);
      const wall = level?.walls.find(({ id }) => id === context.pickedObjectId);
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
    id: 'DIMENSION',
    group: 'ANNOTATION',
    label: 'Cotation',
    // Two endpoints to measure, then a point setting how far the dimension
    // line sits from them.
    hint: 'Coter entre deux extrémités de mur',
    shortcutId: 'tool.dimension',
    requiredPoints: 3,
    createCommand: (context) =>
      addDimensionCommand(
        context.file,
        context.levelId,
        context.points,
        { dimensionType: context.drafts.dimensionType },
        context.newId('dimension'),
      ),
  },
  {
    id: 'NETWORK',
    group: 'NETWORKS',
    label: 'Réseau',
    hint: 'Poser un nœud sur le réseau actif',
    shortcutId: 'tool.network',
    requiredPoints: 1,
    createCommand: (context) => {
      const networkId = context.drafts.networkId;
      if (networkId === undefined)
        return {
          status: 'ERROR',
          message:
            'Aucun réseau actif : créez un réseau dans l’onglet Réseaux.',
        };
      const point = context.points[context.points.length - 1]!;
      const level = levelOf(context);
      return placeNodeCommand(context.file.project, networkId, {
        nodeId: `${networkId}:node-${context.newId('').slice(0, 8)}`,
        kind: context.drafts.nodeKind,
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
export function toolsInGroup(
  group: ToolGroup,
): readonly EditorToolDefinition[] {
  return EDITOR_TOOLS.filter((tool) => tool.group === group);
}

/** The families that hold at least one tool, in palette order. */
export function populatedToolGroups(): readonly ToolGroup[] {
  const order: readonly ToolGroup[] = [
    'SELECTION',
    'ARCHITECTURE',
    'NETWORKS',
    'ANNOTATION',
  ];
  return order.filter((group) => toolsInGroup(group).length > 0);
}

/** Number of points a tool needs before it can produce a command. */
export function requiredPoints(tool: EditorTool): number {
  return toolDefinition(tool).requiredPoints;
}

/** Whether a tool drafts along constrained angles and lengths. */
export function constrainsDrafting(tool: EditorTool): boolean {
  return toolDefinition(tool).constrainsDrafting === true;
}
