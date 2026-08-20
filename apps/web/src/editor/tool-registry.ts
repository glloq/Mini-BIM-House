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
  joinWallsCommand,
  offsetWallCommand,
  splitWallCommand,
  transformObjectsCommand,
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
  'SELECTION' | 'ARCHITECTURE' | 'MODIFICATION' | 'NETWORKS' | 'ANNOTATION';

export const TOOL_GROUP_LABELS: Readonly<Record<ToolGroup, string>> = {
  SELECTION: 'Sélection',
  ARCHITECTURE: 'Architecture',
  MODIFICATION: 'Modification',
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
    constrainsDrafting: true,
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
    'MODIFICATION',
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
