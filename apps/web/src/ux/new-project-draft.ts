/**
 * What is asked before a project exists, and nothing more.
 *
 * The modal it replaces asked for a name, an author, an ISO country, a number
 * of levels, one height for all of them, whether there is a basement, a north
 * angle in degrees, a latitude, a longitude and an altitude — ten answers, in
 * a box, before the first wall. Half of them are not decisions: they are
 * measurements that are taken later, graphically, on the very drawing this box
 * stands in the way of.
 *
 * A draft holds only the structuring decisions — what this project is, how it
 * starts, what it is made of vertically, roughly where it stands, and what
 * trades will be worked on — and every one of them stays changeable
 * afterwards. Nothing here is a fact the project could not be told later.
 */
import type {
  DesignDomainId,
  ProjectIntent,
} from '@house-technical-designer/core-domain';

/** How the first version of the model comes into being. */
export const PROJECT_START_MODES = [
  'GUIDED',
  'BLANK',
  'IMPORT_PLAN',
  'TEMPLATE',
  'DUPLICATE',
] as const;
export type ProjectStartMode = (typeof PROJECT_START_MODES)[number];

export function isProjectStartMode(value: string): value is ProjectStartMode {
  return (PROJECT_START_MODES as readonly string[]).includes(value);
}

export interface ProjectStartModeDescriptor {
  readonly id: ProjectStartMode;
  readonly label: string;
  readonly description: string;
  /** Whether choosing it requires something else: a file, a template, a project. */
  readonly needs?: 'FILE' | 'TEMPLATE' | 'PROJECT';
}

export const PROJECT_START_MODE_DESCRIPTORS = {
  GUIDED: {
    id: 'GUIDED',
    label: 'Être guidé',
    description:
      'Quelques questions, puis une première esquisse qu’on peut tout de suite modifier.',
  },
  BLANK: {
    id: 'BLANK',
    label: 'Partir d’une page blanche',
    description: 'Le plan vide, les outils, rien d’autre.',
  },
  IMPORT_PLAN: {
    id: 'IMPORT_PLAN',
    label: 'Importer un plan',
    description: 'Une image ou un DXF posé sous le dessin, à repasser.',
    needs: 'FILE',
  },
  TEMPLATE: {
    id: 'TEMPLATE',
    label: 'Partir d’un modèle',
    description: 'Un projet type, à ajuster.',
    needs: 'TEMPLATE',
  },
  DUPLICATE: {
    id: 'DUPLICATE',
    label: 'Dupliquer un projet',
    description: 'Repartir d’un projet déjà ouvert une fois.',
    needs: 'PROJECT',
  },
} as const satisfies Record<ProjectStartMode, ProjectStartModeDescriptor>;

export const PROJECT_START_MODE_REGISTRY: Readonly<
  Record<ProjectStartMode, ProjectStartModeDescriptor>
> = PROJECT_START_MODE_DESCRIPTORS;

/**
 * What a storey is, in the stack the person builds.
 *
 * « Nombre de niveaux + une hauteur + une case sous-sol » cannot say two
 * basements, a mezzanine, a half-level, an attic or a plant room, and a house
 * that has any of those had to be described wrong and corrected afterwards.
 */
export const LEVEL_DRAFT_KINDS = [
  'BASEMENT',
  'GROUND',
  'STOREY',
  'MEZZANINE',
  'ATTIC',
  'TECHNICAL',
] as const;
export type LevelDraftKind = (typeof LEVEL_DRAFT_KINDS)[number];

export const LEVEL_DRAFT_KIND_LABELS: Readonly<Record<LevelDraftKind, string>> =
  {
    BASEMENT: 'Sous-sol',
    GROUND: 'Rez-de-chaussée',
    STOREY: 'Étage',
    MEZZANINE: 'Mezzanine',
    ATTIC: 'Combles',
    TECHNICAL: 'Niveau technique',
  };

export interface NewProjectLevelDraft {
  readonly id: string;
  readonly name: string;
  readonly kind: LevelDraftKind;
  /** This storey's own height in millimetres; storeys differ. */
  readonly heightMm: number;
}

/**
 * Roughly where the house stands.
 *
 * The address comes first because it is what a person knows. Coordinates are
 * what the sun calculation needs, and « à déterminer » is a legitimate answer:
 * an unknown latitude stays unknown rather than becoming zero degrees, which
 * is a real place in the Atlantic.
 */
export interface NewProjectLocationDraft {
  readonly address?: string;
  readonly countryCode?: string;
  readonly latitudeDeg?: number;
  readonly longitudeDeg?: number;
  readonly altitudeM?: number;
}

/**
 * The rough footprint the first walls are drawn from.
 *
 * Optional, and the default is « je dessinerai moi-même ». Whatever it
 * produces is produced by the ordinary commands — `AddWallCommand`,
 * `AddSlabCommand` — so the result is a building like any other, and not a
 * shape only the creation page knows how to make.
 */
export const INITIAL_SHAPE_KINDS = [
  'NONE',
  'RECTANGLE',
  'L',
  'T',
  'U',
] as const;
export type InitialShapeKind = (typeof INITIAL_SHAPE_KINDS)[number];

export const INITIAL_SHAPE_LABELS: Readonly<Record<InitialShapeKind, string>> =
  {
    NONE: 'Je dessinerai moi-même',
    RECTANGLE: 'Rectangle',
    L: 'En L',
    T: 'En T',
    U: 'En U',
  };

export interface InitialBuildingShape {
  readonly kind: InitialShapeKind;
  readonly widthMm?: number;
  readonly depthMm?: number;
  /** The arm of an L, T or U, in millimetres. */
  readonly wingMm?: number;
  /**
   * Ce que les dimensions mesurent.
   *
   * Un plan d'architecte est coté à l'intérieur, et quelqu'un qui dit « dix
   * mètres par huit » parle presque toujours de la pièce, pas du dehors. Le
   * contour tracé devient donc la face intérieure des murs, sauf mention
   * contraire. Absent, c'est l'intérieur.
   */
  readonly measuredOn?: 'INTERIOR' | 'EXTERIOR';
}

export interface NewProjectMetadataDraft {
  readonly name: string;
  readonly author?: string;
  readonly description?: string;
}

export type DraftUnitSystem = 'METRIC';

export interface NewProjectDraft {
  readonly metadata: NewProjectMetadataDraft;
  readonly intent: ProjectIntent;
  readonly startMode: ProjectStartMode;
  readonly templateId?: string;
  readonly units: DraftUnitSystem;
  readonly levels: readonly NewProjectLevelDraft[];
  readonly location: NewProjectLocationDraft;
  readonly enabledDomains: readonly DesignDomainId[];
  readonly initialShape?: InitialBuildingShape;
}
