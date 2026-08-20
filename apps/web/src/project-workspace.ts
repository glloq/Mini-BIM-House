import type { ProjectFile } from '@house-technical-designer/core-domain';
import { entityId, type Wall } from '@house-technical-designer/core-domain';
import {
  AddWallCommand,
  draftAssembly,
  draftAssemblyLayer,
  ProjectCommandDispatcher,
  ProjectEditorCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  genericMaterialCatalog,
  materialId,
} from '@house-technical-designer/materials';
import {
  exportSemanticSceneToSvg,
  GENERIC_TECHNICAL_PRINT,
  type DrawingView,
} from '@house-technical-designer/drawing-engine';
import {
  buildPlanView,
  type LayerVisibility,
} from '@house-technical-designer/view-query';

export interface ProjectSummary {
  readonly levels: number;
  readonly walls: number;
  readonly openings: number;
  readonly spaces: number;
  readonly systems: number;
  readonly materials: number;
}

export interface WallDraft {
  readonly startXmm: number;
  readonly startYmm: number;
  readonly endXmm: number;
  readonly endYmm: number;
  readonly assemblyId: string;
}

export function screenPointToModel(
  client: { readonly x: number; readonly y: number },
  bounds: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  viewport: DrawingView['viewport'],
): { readonly x: number; readonly y: number } {
  if (
    ![bounds.left, bounds.top, bounds.width, bounds.height].every(
      Number.isFinite,
    ) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  )
    throw new RangeError(
      'Les dimensions écran doivent être finies et positives.',
    );
  const x =
    viewport.min.x +
    ((client.x - bounds.left) / bounds.width) *
      (viewport.max.x - viewport.min.x);
  const y =
    viewport.min.y +
    ((client.y - bounds.top) / bounds.height) *
      (viewport.max.y - viewport.min.y);
  return { x: Math.round(x), y: Math.round(y) };
}

export type AddWallResult =
  | { readonly status: 'OK'; readonly file: ProjectFile }
  | { readonly status: 'ERROR'; readonly messages: readonly string[] };

export class ProjectEditingSession {
  readonly #source: ProjectFile;
  readonly #dispatcher: ProjectCommandDispatcher;

  constructor(file: ProjectFile) {
    this.#source = file;
    this.#dispatcher = new ProjectCommandDispatcher(file.project);
  }

  get file(): ProjectFile {
    return { ...this.#source, project: this.#dispatcher.project };
  }

  addWall(draft: WallDraft, wallId: string): AddWallResult {
    const command = createAddWallCommand(this.file, draft, wallId);
    if (command.status === 'ERROR') return command;
    const result = this.#dispatcher.dispatch(command.command);
    return dispatchResult(result, this.file);
  }

  /** Runs any project command so panels edit through the same undo history. */
  dispatch(command: ProjectCommand): AddWallResult {
    const result = this.#dispatcher.dispatch(command);
    return dispatchResult(result, this.file);
  }

  undo(): AddWallResult {
    return dispatchResult(this.#dispatcher.undo(), this.file);
  }

  redo(): AddWallResult {
    return dispatchResult(this.#dispatcher.redo(), this.file);
  }
}

export function addWallToProject(
  file: ProjectFile,
  draft: WallDraft,
  wallId: string,
): AddWallResult {
  return new ProjectEditingSession(file).addWall(draft, wallId);
}

function createAddWallCommand(
  file: ProjectFile,
  draft: WallDraft,
  wallId: string,
):
  | { readonly status: 'OK'; readonly command: ProjectEditorCommand }
  | { readonly status: 'ERROR'; readonly messages: readonly string[] } {
  const level = file.project.building.levels[0];
  if (level === undefined)
    return {
      status: 'ERROR',
      messages: ['Le projet ne contient aucun niveau.'],
    };
  const assembly = file.project.assemblies?.find(
    ({ id }) => id === draft.assemblyId,
  );
  if (assembly === undefined)
    return {
      status: 'ERROR',
      messages: [`Assemblage inconnu : ${draft.assemblyId || 'aucun'}.`],
    };
  const wall: Wall = {
    id: entityId<'Wall'>(wallId),
    type: 'WALL',
    levelId: level.id,
    path: {
      points: [
        { x: draft.startXmm, y: draft.startYmm },
        { x: draft.endXmm, y: draft.endYmm },
      ],
    },
    referenceSide: 'CENTER',
    assemblyId: assembly.id,
    baseOffsetMm: 0,
    heightMode: 'EXPLICIT',
    heightMm: level.defaultStoreyHeightMm,
    role: 'EXTERIOR',
  };
  return {
    status: 'OK',
    command: new ProjectEditorCommand(
      `add-wall:${wall.id}`,
      'Ajouter un mur',
      level.id,
      new AddWallCommand(`add-wall:${wall.id}`, wall),
    ),
  };
}

function dispatchResult(
  result: ReturnType<ProjectCommandDispatcher['dispatch']>,
  file: ProjectFile,
): AddWallResult {
  if (result.status === 'APPLIED') return { status: 'OK', file };
  return {
    status: 'ERROR',
    messages:
      result.status === 'REJECTED'
        ? result.errors
        : ['Aucune commande disponible dans cet historique.'],
  };
}

/**
 * Assemblies a new project starts with.
 *
 * Drawing a wall requires an assembly, so an empty library would make a new
 * project unusable until the user built one by hand. These starters are ordinary
 * project data: they use the generic material catalogue and can be edited,
 * duplicated or deleted like any other assembly.
 */
export function starterAssemblies() {
  return [
    draftAssembly('assembly-exterior-wall', 'Mur extérieur isolé', 'WALL', [
      draftAssemblyLayer(
        'exterior-wall-masonry',
        materialId('generic-concrete-block'),
        200,
        'STRUCTURAL',
      ),
      draftAssemblyLayer(
        'exterior-wall-insulation',
        materialId('generic-rock-wool'),
        160,
        'INSULATION',
      ),
      draftAssemblyLayer(
        'exterior-wall-board',
        materialId('generic-gypsum-board'),
        13,
        'FINISH',
      ),
    ]),
    draftAssembly('assembly-partition', 'Cloison intérieure', 'PARTITION', [
      draftAssemblyLayer(
        'partition-board-inner',
        materialId('generic-gypsum-board'),
        13,
        'FINISH',
      ),
      draftAssemblyLayer(
        'partition-insulation',
        materialId('generic-glass-wool'),
        70,
        'INSULATION',
      ),
      draftAssemblyLayer(
        'partition-board-outer',
        materialId('generic-gypsum-board'),
        13,
        'FINISH',
      ),
    ]),
    draftAssembly('assembly-floor', 'Plancher sur terre-plein', 'FLOOR', [
      draftAssemblyLayer(
        'floor-concrete',
        materialId('generic-concrete'),
        150,
        'STRUCTURAL',
      ),
      draftAssemblyLayer(
        'floor-insulation',
        materialId('generic-xps'),
        100,
        'INSULATION',
      ),
    ]),
    draftAssembly('assembly-roof', 'Toiture isolée', 'ROOF', [
      draftAssemblyLayer(
        'roof-structure',
        materialId('generic-softwood'),
        200,
        'STRUCTURAL',
      ),
      draftAssemblyLayer(
        'roof-insulation',
        materialId('generic-wood-fibre'),
        300,
        'INSULATION',
      ),
      draftAssemblyLayer(
        'roof-board',
        materialId('generic-gypsum-board'),
        13,
        'FINISH',
      ),
    ]),
  ];
}

export function createBlankProject(now: string): ProjectFile {
  return {
    format: 'house-technical-designer-project',
    schemaVersion: '1.0.0',
    applicationVersion: '0.1.0',
    project: {
      id: 'untitled-project' as ProjectFile['project']['id'],
      metadata: {
        name: 'Nouveau projet',
        createdAt: now,
        updatedAt: now,
        projectRevision: '1',
      },
      site: { northAngleDeg: 0 },
      building: {
        levels: [
          {
            id: 'ground' as ProjectFile['project']['building']['levels'][number]['id'],
            name: 'Rez-de-chaussée',
            elevationMm: 0,
            defaultStoreyHeightMm: 2500,
            walls: [],
            openings: [],
            slabs: [],
            roofs: [],
            spaces: [],
            stairs: [],
            annotations: [],
          },
        ],
        zones: [],
      },
      materialLibrary: { materials: genericMaterialCatalog() },
      assemblies: starterAssemblies(),
      equipment: [],
      systems: [],
      scenarios: [],
      calculationSettings: {},
      drawingViews: [],
      regulatoryContext: { country: 'FR', enabledRulePacks: [] },
    },
    references: {},
    extensions: {},
  };
}

/**
 * What the creation assistant asks before a project exists.
 *
 * Everything here is something only the user knows and that nothing can be
 * deduced from later without guessing: how the building is stacked, and where
 * it stands. What is left blank stays blank — the assistant fills nothing in
 * on the user's behalf, so an unanswered question shows up as a missing input
 * rather than as a value nobody chose.
 */
export interface NewProjectDraft {
  readonly name: string;
  readonly author?: string;
  /** Storeys above ground, the ground floor included. */
  readonly levelCount: number;
  readonly storeyHeightMm: number;
  readonly basement: boolean;
  readonly northAngleDeg: number;
  readonly latitudeDeg?: number;
  readonly longitudeDeg?: number;
  readonly altitudeM?: number;
  readonly country: string;
}

export const DEFAULT_NEW_PROJECT: NewProjectDraft = {
  name: 'Nouveau projet',
  levelCount: 1,
  storeyHeightMm: 2500,
  basement: false,
  northAngleDeg: 0,
  country: 'FR',
};

/** How many storeys one project may be given from the assistant. */
export const MAX_WIZARD_LEVELS = 20;

/** Why a draft cannot become a project, if it cannot. */
export function newProjectIssue(draft: NewProjectDraft): string | undefined {
  if (draft.name.trim() === '') return 'Le projet a besoin d’un nom.';
  if (!Number.isInteger(draft.levelCount) || draft.levelCount < 1)
    return 'Un bâtiment compte au moins un niveau.';
  if (draft.levelCount > MAX_WIZARD_LEVELS)
    return `L’assistant crée au plus ${MAX_WIZARD_LEVELS} niveaux ; les suivants s’ajoutent depuis « Niveaux et pièces ».`;
  if (!(draft.storeyHeightMm > 0))
    return 'La hauteur d’étage doit être supérieure à zéro.';
  if (draft.country.trim() === '')
    return 'Le pays décide des jeux de règles applicables.';
  return undefined;
}

function levelName(index: number): string {
  if (index === 0) return 'Rez-de-chaussée';
  return `Étage ${index}`;
}

function levelId(index: number): string {
  return index === 0 ? 'ground' : `level-${index}`;
}

/**
 * The project a filled-in assistant describes.
 *
 * The blank project is the base: the assistant decides the metadata, the site
 * and the stack of levels, and everything else — generic library, starter
 * assemblies, empty networks — is what a new project already had.
 */
export function projectFromDraft(
  draft: NewProjectDraft,
  now: string,
): ProjectFile {
  const blank = createBlankProject(now);
  const template = blank.project.building.levels[0]!;
  const above = Array.from({ length: draft.levelCount }, (_unused, index) => ({
    ...template,
    id: levelId(index) as (typeof template)['id'],
    name: levelName(index),
    elevationMm: index * draft.storeyHeightMm,
    defaultStoreyHeightMm: draft.storeyHeightMm,
  }));
  const levels = draft.basement
    ? [
        {
          ...template,
          id: 'basement' as (typeof template)['id'],
          name: 'Sous-sol',
          elevationMm: -draft.storeyHeightMm,
          defaultStoreyHeightMm: draft.storeyHeightMm,
        },
        ...above,
      ]
    : above;
  const located =
    draft.latitudeDeg === undefined || draft.longitudeDeg === undefined
      ? {}
      : {
          location: {
            latitudeDeg: draft.latitudeDeg,
            longitudeDeg: draft.longitudeDeg,
          },
        };
  return {
    ...blank,
    project: {
      ...blank.project,
      metadata: {
        ...blank.project.metadata,
        name: draft.name.trim(),
        ...(draft.author === undefined || draft.author.trim() === ''
          ? {}
          : { author: draft.author.trim() }),
      },
      site: {
        ...blank.project.site,
        northAngleDeg: draft.northAngleDeg,
        ...located,
        ...(draft.altitudeM === undefined
          ? {}
          : { altitudeM: draft.altitudeM }),
      },
      building: { ...blank.project.building, levels },
      regulatoryContext: {
        country: draft.country.trim().toUpperCase(),
        enabledRulePacks: [],
      },
    },
  };
}

export function summarizeProject(file: ProjectFile): ProjectSummary {
  const levels = file.project.building.levels;
  return {
    levels: levels.length,
    walls: levels.reduce((sum, level) => sum + level.walls.length, 0),
    openings: levels.reduce((sum, level) => sum + level.openings.length, 0),
    spaces: levels.reduce((sum, level) => sum + level.spaces.length, 0),
    systems: file.project.systems?.length ?? 0,
    materials: file.project.materialLibrary?.materials.length ?? 0,
  };
}

/** What the export has to be told, because the drawing depends on it. */
export interface PlanExportOptions {
  /** Level drawn; the first level when the caller names none. */
  readonly levelId?: string;
  /** Layers on at export time, so the sheet matches what the user sees. */
  readonly layers: LayerVisibility;
  /** Drawing scale denominator: 50 means 1:50. */
  readonly scale?: number;
}

/**
 * Exports the plan the user is looking at.
 *
 * The scene comes from the same `buildPlanView` the canvas draws, so the file
 * carries the layered walls, the cut openings, the rooms, the slabs, the roofs,
 * the technical networks and the dimensions — not a simplified redrawing of
 * them. What differs from the screen is deliberate and explicit: the print
 * profile replaces the screen one, and the exported sheet names its level, its
 * scale and the layers it was drawn with.
 */
export function exportProjectPlan(
  file: ProjectFile,
  options: PlanExportOptions,
) {
  const level =
    options.levelId === undefined
      ? file.project.building.levels[0]
      : file.project.building.levels.find(({ id }) => id === options.levelId);
  const plan = buildPlanView(file.project, {
    ...(level === undefined ? {} : { levelId: level.id }),
    layers: options.layers,
    ...(options.scale === undefined ? {} : { scale: options.scale }),
    graphicProfileId: GENERIC_TECHNICAL_PRINT.profile.id,
  });
  const levelSuffix =
    level === undefined ? '' : `-${safeFileStem(level.name).toLowerCase()}`;
  return exportSemanticSceneToSvg({
    view: plan.view,
    scene: plan.scene,
    profile: GENERIC_TECHNICAL_PRINT.profile,
    styles: GENERIC_TECHNICAL_PRINT.styles,
    fileName: `${safeFileStem(file.project.metadata.name)}${levelSuffix}-plan.svg`,
    metadata: {
      title: `${file.project.metadata.name} — ${level?.name ?? 'plan'} — 1:${plan.view.scale}`,
      projectId: file.project.id,
      ...(file.project.metadata.projectRevision === undefined
        ? {}
        : { revision: file.project.metadata.projectRevision }),
    },
  });
}

/** Issues the plan raised while it was built, so an export can report them. */
export function planExportIssues(
  file: ProjectFile,
  options: PlanExportOptions,
) {
  return buildPlanView(file.project, {
    ...(options.levelId === undefined ? {} : { levelId: options.levelId }),
    layers: options.layers,
  }).issues;
}

/**
 * Reduces a name to a stem a browser will actually use.
 *
 * Chromium ignores a download attribute holding non-ASCII characters and saves
 * the file as "download" instead, so an accented project name has to be folded
 * before it reaches the anchor.
 */
export function safeFileStem(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9 _.-]/gu, '')
    .trim()
    .replace(/\s+/gu, '-');
  return normalized === '' ? 'projet' : normalized;
}
