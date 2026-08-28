import type { ProjectFile } from '@house-technical-designer/core-domain';
import { APPLICATION_VERSION } from './version.js';
import { CURRENT_PROJECT_SCHEMA_VERSION } from '@house-technical-designer/project-io';
import { entityId, type Wall } from '@house-technical-designer/core-domain';
import {
  AddWallCommand,
  ProjectCommandDispatcher,
  ProjectEditorCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
// The basket, not the shelf. Importing the three catalogues here put every
// material, build-up and menuiserie in the first payload the browser fetches —
// because creating a project is something the application must be able to do
// before anything is loaded, and a blank project was handed all of them.
import { STARTER_LIBRARY } from '@house-technical-designer/catalog-registry/starter';
import { creationStage, type CreationStageId } from './ux/creation-stages.js';
import { ownerStageOf } from './ux/ownership.js';
import { changedObjects } from './ux/model-diff.js';
import {
  ARCHITECTURAL_CLEAN_PRINT,
  exportSemanticSceneToSvg,
  graphicProfileForMode,
  type DrawingView,
} from '@house-technical-designer/drawing-engine';
import {
  buildPlanView,
  type DimensionDisplayMode,
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

  addWall(
    draft: WallDraft,
    wallId: string,
    stage: CreationStageId = 'BUILDING',
  ): AddWallResult {
    const command = createAddWallCommand(this.file, draft, wallId);
    if (command.status === 'ERROR') return command;
    return this.dispatch(command.command, stage);
  }

  /**
   * Runs any project command so panels edit through the same undo history.
   *
   * Et c'est ici que la frontière d'édition tient, parce que c'est le seul
   * passage. Le clic, la poignée, l'inspecteur, le menu contextuel, `Delete`,
   * un raccourci, la palette, l'arborescence, un constat : tous les gestes
   * finissent par une commande, et une commande passe par cette méthode. La
   * règle posée sur chacun de ces chemins aurait été la même règle écrite huit
   * fois, dont une oubliée — c'est exactement ce qui se passait, seule la
   * sélection au plan étant filtrée.
   *
   * L'essai à blanc dit ce que la commande **toucherait**, puisque rien ne le
   * déclare à l'avance. Si l'un de ces objets appartient à un autre espace, la
   * commande n'est pas jouée et le refus dit lequel et où aller.
   *
   * Une commande qui ne touche aucun objet reconnu — un réglage de projet, une
   * entrée de bibliothèque, un niveau — n'est refusée par personne : c'est la
   * règle « sans propriétaire, partout ».
   */
  dispatch(command: ProjectCommand, stage: CreationStageId): AddWallResult {
    const refusal = this.#refusal(command, stage);
    if (refusal !== undefined) return { status: 'ERROR', messages: [refusal] };
    const result = this.#dispatcher.dispatch(command);
    return dispatchResult(result, this.file);
  }

  /**
   * La phrase à dire quand cet espace ne possède pas ce que la commande touche.
   *
   * Ce qu'elle touche est **comparé**, pas demandé : le `ChangeSet` d'une
   * commande dit l'identifiant de la commande et non celui des objets. Voir
   * `model-diff.ts`, qui porte la mesure.
   *
   * Un objet retiré n'existe plus dans le projet d'après, et un objet posé
   * n'existait pas dans celui d'avant : le propriétaire se cherche donc dans
   * celui des deux qui porte l'objet. Sans ça, poser un mur depuis Systèmes
   * serait passé — le mur neuf n'étant reconnu par personne dans le projet
   * d'avant, donc sans propriétaire, donc permis.
   */
  #refusal(
    command: ProjectCommand,
    stage: CreationStageId,
  ): string | undefined {
    const before = this.#dispatcher.project;
    if (!command.validate(before).valid) return undefined;
    const after = command.execute(before).nextState;
    for (const objectId of changedObjects(before, after)) {
      const owner =
        ownerStageOf(before, objectId) ?? ownerStageOf(after, objectId);
      if (owner === undefined || owner === stage) continue;
      return `Cet objet appartient à ${creationStage(owner).label} : c'est là qu'il se modifie.`;
    }
    return undefined;
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
/**
 * The build-ups a new project starts with.
 *
 * They were written out here, layer by layer, in the application — three walls
 * and a roof composed in TypeScript beside the code that draws them. A
 * build-up is data: it belongs in the assembly catalogue, where a gate reads
 * it, where its layers are checked to name materials that exist, and where
 * somebody can add a fifth without touching the application at all.
 *
 * Then a project was handed all thirty-five of them, which is the other
 * mistake: a basket is not a shelf. Six now — one per kind of surface a house
 * shell is made of — and the rest is picked from the catalogue.
 */
export function starterAssemblies() {
  return STARTER_LIBRARY.assemblies;
}

export function createBlankProject(now: string): ProjectFile {
  return {
    format: 'house-technical-designer-project',
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    applicationVersion: APPLICATION_VERSION,
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
      materialLibrary: { materials: STARTER_LIBRARY.materials },
      assemblies: starterAssemblies(),
      // The models a window can be. The pointer existed and the catalogue did
      // not, so every opening was drawn with a transmittance nobody had
      // stated.
      openingTypes: STARTER_LIBRARY.openingTypes,
      // Vide, et rempli par l'assistant de création : les fiches viennent du
      // catalogue générique, qui pèse soixante-dix kio et n'a rien à faire
      // dans le premier chargement de quelqu'un qui ouvre un fichier existant.
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
  /**
   * The charter the sheet is drawn with, on paper.
   *
   * A screen charter has no business here — colour that separates five
   * networks on a screen becomes five indistinguishable greys on paper — so
   * whatever is named is paired with its printed counterpart.
   */
  readonly graphicProfileId?: string;
  /** What the sheet dimensions. Its own dimensions when unstated. */
  readonly dimensions?: DimensionDisplayMode;
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
  const charter =
    (options.graphicProfileId === undefined
      ? undefined
      : graphicProfileForMode(options.graphicProfileId, 'PRINT')) ??
    ARCHITECTURAL_CLEAN_PRINT;
  const level =
    options.levelId === undefined
      ? file.project.building.levels[0]
      : file.project.building.levels.find(({ id }) => id === options.levelId);
  const plan = buildPlanView(file.project, {
    ...(level === undefined ? {} : { levelId: level.id }),
    layers: options.layers,
    ...(options.scale === undefined ? {} : { scale: options.scale }),
    ...(options.dimensions === undefined
      ? {}
      : { dimensions: options.dimensions }),
    graphicProfileId: charter.profile.id,
  });
  const levelSuffix =
    level === undefined ? '' : `-${safeFileStem(level.name).toLowerCase()}`;
  return exportSemanticSceneToSvg({
    view: plan.view,
    scene: plan.scene,
    profile: charter.profile,
    styles: charter.styles,
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
