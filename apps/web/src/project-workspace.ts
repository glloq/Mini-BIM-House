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
  createSemanticScene,
  drawingViewId,
  exportSemanticSceneToSvg,
  graphicProfileId,
  type DrawingView,
  type GraphicProfile,
  type ScenePrimitive,
} from '@house-technical-designer/drawing-engine';

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

export function projectPlan(file: ProjectFile) {
  const level = file.project.building.levels[0];
  const points = level?.walls.flatMap(({ path }) => path.points) ?? [];
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const padding = 500;
  const viewport = {
    min: {
      x: points.length === 0 ? 0 : Math.min(...xs) - padding,
      y: points.length === 0 ? 0 : Math.min(...ys) - padding,
    },
    max: {
      x: points.length === 0 ? 10_000 : Math.max(...xs) + padding,
      y: points.length === 0 ? 8_000 : Math.max(...ys) + padding,
    },
  };
  const view: DrawingView = {
    id: drawingViewId('workspace-plan'),
    type: 'PLAN',
    ...(level === undefined ? {} : { levelId: level.id }),
    scale: 50,
    viewport,
    visibleDisciplines: ['ARCHITECTURE'],
    graphicProfileId: graphicProfileId('workspace-profile'),
  };
  const primitives: ScenePrimitive[] = (level?.walls ?? []).map((wall) => ({
    id: `wall:${wall.id}`,
    sourceObjectId: wall.id,
    semanticRole: 'WALL_CUT',
    geometry: {
      kind: 'POLYLINE',
      polyline: { points: wall.path.points, closed: false },
    },
    layer: 'architecture.walls',
    zIndex: 10,
    discipline: 'ARCHITECTURE',
  }));
  const profile: GraphicProfile = {
    id: view.graphicProfileId,
    name: 'Profil espace de travail',
    roleTokens: { WALL_CUT: 'wall-cut' },
  };
  return { view, profile, scene: createSemanticScene(view, primitives) };
}

export function exportProjectPlan(file: ProjectFile) {
  const plan = projectPlan(file);
  return exportSemanticSceneToSvg({
    ...plan,
    styles: {
      tokens: {
        'wall-cut': { stroke: '#172126', strokeWidthPaperMm: 0.5 },
      },
    },
    fileName: `${safeFileStem(file.project.metadata.name)}-plan.svg`,
    metadata: {
      title: `${file.project.metadata.name} — plan`,
      projectId: file.project.id,
      ...(file.project.metadata.projectRevision === undefined
        ? {}
        : { revision: file.project.metadata.projectRevision }),
    },
  });
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
