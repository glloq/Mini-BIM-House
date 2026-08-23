import type {
  ComponentCategory,
  ComponentInstance,
  Dimension,
  DoorSwing,
  Level,
  NetworkNode,
  Opening,
  Project,
  Roof,
  RoofEdge,
  RoofPlane,
  Slab,
  Space,
  Stair,
  StairLanding,
  StairType,
  StructuralMember,
  StructuralMemberKind,
  TextNote,
  Wall,
} from '@house-technical-designer/core-domain';
import {
  detectSpaceBoundaries,
  entityId,
  isComponentCategory,
  hostAccepts,
  levelHosts,
  HOST_TYPE_LABELS,
  isDimension,
  isDimensionType,
  isTextNote,
  textNoteId,
  validateTextNote,
  isDoorHinge,
  isDoorOpeningSide,
  isOpeningType,
  isSlabRole,
  isStairType,
  isStructuralMemberKind,
  isWallReferenceSide,
  isWallRole,
  validateComponentInstance,
  validateRoof,
  validateStair,
  validateStructuralMember,
} from '@house-technical-designer/core-domain';
import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import {
  polygonArea,
  validatePolygon,
} from '@house-technical-designer/geometry';
import {
  duplicatedLevel,
  levelContents,
  raisedContents,
} from './level-entities.js';
import { levelRemovalRefusal, removalRefusal } from './removal.js';
import type { CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

const BUILDING_DOMAINS = [
  'quantities',
  'thermal',
  'heating',
  'ventilation',
  'energy',
  'cost',
  'environmental',
  'drawing-overlays',
] as const;

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

abstract class BuildingCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
  abstract validate(project: Project): CommandValidation;
  protected abstract apply(project: Project): Project;
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.apply(project),
      changes: { objectIds: [this.id], domains: [...BUILDING_DOMAINS] },
      inverse: new RestoreBuildingCommand(
        `${this.id}:inverse`,
        `Annuler ${this.label}`,
        project,
      ),
    };
  }
}

class RestoreBuildingCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly previous: Project,
  ) {}
  validate(): CommandValidation {
    return ok();
  }
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.previous,
      changes: { objectIds: [this.id], domains: [...BUILDING_DOMAINS] },
      inverse: new RestoreBuildingCommand(
        `${this.id}:inverse`,
        `Rétablir ${this.label}`,
        project,
      ),
    };
  }
}

/** Levels always read bottom to top, whatever order they were created in. */
function sortedByElevation(levels: readonly Level[]): readonly Level[] {
  return [...levels].sort(
    (first, second) => first.elevationMm - second.elevationMm,
  );
}

function withLevels(project: Project, levels: readonly Level[]): Project {
  return { ...project, building: { ...project.building, levels } };
}

function mapLevel(
  project: Project,
  levelId: string,
  transform: (level: Level) => Level,
): Project {
  return withLevels(
    project,
    project.building.levels.map((level) =>
      level.id === levelId ? transform(level) : level,
    ),
  );
}

export interface LevelDraft {
  readonly id: string;
  readonly name: string;
  readonly elevationMm: number;
  readonly defaultStoreyHeightMm: number;
}

export class AddLevelCommand extends BuildingCommand {
  constructor(readonly draft: LevelDraft) {
    super(`level:add:${draft.id}`, `Ajouter le niveau ${draft.name}`);
  }
  validate(project: Project): CommandValidation {
    if (this.draft.name.trim() === '')
      return rejected('Le nom du niveau ne peut pas être vide.');
    if (
      !Number.isFinite(this.draft.defaultStoreyHeightMm) ||
      this.draft.defaultStoreyHeightMm <= 0
    )
      return rejected('La hauteur d’étage doit être finie et positive.');
    if (!Number.isFinite(this.draft.elevationMm))
      return rejected('L’altitude du niveau doit être finie.');
    return project.building.levels.some(({ id }) => id === this.draft.id)
      ? rejected(`Le niveau ${this.draft.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    const level: Level = {
      id: entityId<'Level'>(this.draft.id),
      name: this.draft.name,
      elevationMm: this.draft.elevationMm,
      defaultStoreyHeightMm: this.draft.defaultStoreyHeightMm,
      walls: [],
      slabs: [],
      roofs: [],
      openings: [],
      stairs: [],
      spaces: [],
      annotations: [],
    };
    return withLevels(
      project,
      sortedByElevation([...project.building.levels, level]),
    );
  }
}

/** Copies a level's walls, openings, slabs, roofs and spaces onto a new storey. */
export class DuplicateLevelCommand extends BuildingCommand {
  constructor(
    readonly sourceLevelId: string,
    readonly draft: LevelDraft,
  ) {
    super(
      `level:duplicate:${draft.id}`,
      `Dupliquer le niveau vers ${draft.name}`,
    );
  }
  private source(project: Project): Level | undefined {
    return project.building.levels.find(({ id }) => id === this.sourceLevelId);
  }
  /** The storey a stair copied onto the new level would arrive at. */
  private storeyAbove(project: Project): Level | undefined {
    return project.building.levels
      .filter(({ elevationMm }) => elevationMm > this.draft.elevationMm)
      .sort((first, second) => first.elevationMm - second.elevationMm)[0];
  }
  validate(project: Project): CommandValidation {
    const source = this.source(project);
    if (source === undefined)
      return rejected(`Le niveau ${this.sourceLevelId} est introuvable.`);
    if (project.building.levels.some(({ id }) => id === this.draft.id))
      return rejected(`Le niveau ${this.draft.id} existe déjà.`);
    // A stair climbs to a storey, and the copy has to climb to the storey above
    // where it lands. Copying it with the original's destination would leave a
    // stair on the first floor arriving in the ground floor's ceiling.
    if (source.stairs.length > 0 && this.storeyAbove(project) === undefined)
      return rejected(
        `Le niveau ${source.name} contient ${source.stairs.length} escalier(s), et aucun niveau ne se trouve au-dessus de ${this.draft.name} : la copie n'aurait nulle part où monter.`,
      );
    return ok();
  }
  protected apply(project: Project): Project {
    const source = this.source(project)!;
    return withLevels(
      project,
      sortedByElevation([
        ...project.building.levels,
        duplicatedLevel(source, this.draft, this.storeyAbove(project)?.id),
      ]),
    );
  }
}

export class UpdateLevelCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly changes: Partial<Omit<LevelDraft, 'id'>>,
  ) {
    super(`level:update:${levelId}`, 'Modifier un niveau');
  }
  validate(project: Project): CommandValidation {
    if (!project.building.levels.some(({ id }) => id === this.levelId))
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    const height = this.changes.defaultStoreyHeightMm;
    if (height !== undefined && (!Number.isFinite(height) || height <= 0))
      return rejected('La hauteur d’étage doit être finie et positive.');
    const elevation = this.changes.elevationMm;
    if (elevation !== undefined && !Number.isFinite(elevation))
      return rejected('L’altitude du niveau doit être finie.');
    if (this.changes.name !== undefined && this.changes.name.trim() === '')
      return rejected('Le nom du niveau ne peut pas être vide.');
    return ok();
  }
  protected apply(project: Project): Project {
    const previous = project.building.levels.find(
      ({ id }) => id === this.levelId,
    );
    const deltaZ =
      previous === undefined || this.changes.elevationMm === undefined
        ? 0
        : this.changes.elevationMm - previous.elevationMm;
    const moved = withLevels(
      project,
      sortedByElevation(
        project.building.levels.map((level) =>
          level.id === this.levelId ? raised(level, this.changes) : level,
        ),
      ),
    );
    return deltaZ === 0 ? moved : withRaisedNodes(moved, this.levelId, deltaZ);
  }
}

/**
 * The project with the network nodes of one level moved with it.
 *
 * A node's position is absolute, like a roof elevation. A node says which level
 * it belongs to; one written before that field is placed by the space it
 * serves, which is the only thing an older file states about where it is.
 */
function withRaisedNodes(
  project: Project,
  levelId: string,
  deltaZ: number,
): Project {
  const spacesOfLevel = new Set(
    project.building.levels
      .filter((level) => level.id === levelId)
      .flatMap(({ spaces }) => spaces.map(({ id }) => id as string)),
  );
  const belongs = (node: NetworkNode): boolean =>
    node.levelId === undefined
      ? node.spaceId !== undefined && spacesOfLevel.has(node.spaceId)
      : node.levelId === levelId;
  return {
    ...project,
    systems: (project.systems ?? []).map((network) => ({
      ...network,
      nodes: network.nodes.map((node) =>
        belongs(node)
          ? {
              ...node,
              position: { ...node.position, z: node.position.z + deltaZ },
            }
          : node,
      ),
    })),
  };
}

/**
 * A level after a change, with what it holds in absolute height moved with it.
 *
 * Roof planes carry a project elevation rather than an offset from their level.
 * Moving the level without moving them would leave the roof where the storey
 * used to be — a value nobody edited and nobody would suspect.
 */
function raised(level: Level, changes: Partial<Omit<LevelDraft, 'id'>>): Level {
  const next = { ...level, ...changes };
  return raisedContents(next, next.elevationMm - level.elevationMm);
}

export class RemoveLevelCommand extends BuildingCommand {
  constructor(readonly levelId: string) {
    super(`level:remove:${levelId}`, 'Supprimer un niveau');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if (project.building.levels.length === 1)
      return rejected('Un projet doit conserver au moins un niveau.');
    // Counted from the project's own index rather than from a list written
    // here. The list written here had fallen two families behind the model, so
    // a storey holding a whole roof, three posts and a heat pump counted as
    // empty and deleting it took all of them without a word.
    const contents = levelContents(level);
    if (contents.length > 0)
      return rejected(
        `Le niveau ${level.name} contient encore ${contents.length} objet(s). Videz-le avant de le supprimer.`,
      );
    // Empty is not the same as unreferenced. A storey holding nothing can
    // still be the storey a wall climbs to, the storey a stair arrives at, the
    // storey a node declares and the storey a saved view draws — and removing
    // it left four dangling references the importer would then refuse, which
    // is a file the application writes and cannot read back.
    const referenced = levelRemovalRefusal(project, this.levelId);
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return withLevels(
      project,
      project.building.levels.filter(({ id }) => id !== this.levelId),
    );
  }
}

export interface SpaceDraft {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly polygon: Polygon2D;
}

export class AddSpaceCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: SpaceDraft,
  ) {
    super(`space:add:${draft.id}`, `Ajouter la pièce ${draft.name}`);
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if (this.draft.name.trim() === '')
      return rejected('Le nom de la pièce ne peut pas être vide.');
    if (this.draft.polygon.outer.length < 3)
      return rejected('Une pièce demande au moins trois sommets.');
    return level.spaces.some(({ id }) => id === this.draft.id)
      ? rejected(`La pièce ${this.draft.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    const space: Space = {
      id: entityId<'Space'>(this.draft.id),
      type: 'SPACE',
      levelId: entityId<'Level'>(this.levelId),
      name: this.draft.name,
      category: this.draft.category,
      boundaryMode: 'MANUAL',
      manualPolygon: this.draft.polygon,
    };
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      spaces: [...level.spaces, space],
    }));
  }
}

export class UpdateSpaceCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly spaceId: string,
    readonly changes: { readonly name?: string; readonly category?: string },
  ) {
    super(`space:update:${spaceId}`, 'Modifier une pièce');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.spaces.some(({ id }) => id === this.spaceId) !== true)
      return rejected(`La pièce ${this.spaceId} est introuvable.`);
    return this.changes.name !== undefined && this.changes.name.trim() === ''
      ? rejected('Le nom de la pièce ne peut pas être vide.')
      : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      spaces: level.spaces.map((space) =>
        space.id === this.spaceId ? { ...space, ...this.changes } : space,
      ),
    }));
  }
}

export class RemoveSpaceCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly spaceId: string,
  ) {
    super(`space:remove:${spaceId}`, 'Supprimer une pièce');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.spaces.some(({ id }) => id === this.spaceId) !== true)
      return rejected(`La pièce ${this.spaceId} est introuvable.`);
    const referenced = removalRefusal(project, this.spaceId, 'Cette pièce');
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      spaces: level.spaces.filter(({ id }) => id !== this.spaceId),
    }));
  }
}

export interface SlabDraft {
  readonly id: string;
  readonly polygon: Polygon2D;
  readonly assemblyId: string;
  readonly role: Slab['role'];
  readonly elevationOffsetMm: number;
}

export class AddSlabCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: SlabDraft,
  ) {
    super(`slab:add:${draft.id}`, 'Ajouter une dalle');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if (this.draft.polygon.outer.length < 3)
      return rejected('Une dalle demande au moins trois sommets.');
    const assembly = (project.assemblies ?? []).find(
      ({ id }) => id === this.draft.assemblyId,
    );
    if (assembly === undefined)
      return rejected(`Assemblage inconnu : ${this.draft.assemblyId}.`);
    if (assembly.category !== 'FLOOR' && assembly.category !== 'CEILING')
      return rejected(
        `Un assemblage de catégorie ${assembly.category} ne peut pas porter une dalle.`,
      );
    return level.slabs.some(({ id }) => id === this.draft.id)
      ? rejected(`La dalle ${this.draft.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    const slab: Slab = {
      id: entityId<'Slab'>(this.draft.id),
      type: 'SLAB',
      levelId: entityId<'Level'>(this.levelId),
      polygon: this.draft.polygon,
      assemblyId: this.draft.assemblyId as Slab['assemblyId'],
      elevationOffsetMm: this.draft.elevationOffsetMm,
      role: this.draft.role,
    };
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      slabs: [...level.slabs, slab],
    }));
  }
}

export class RemoveSlabCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly slabId: string,
  ) {
    super(`slab:remove:${slabId}`, 'Supprimer une dalle');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.slabs.some(({ id }) => id === this.slabId) !== true)
      return rejected(`La dalle ${this.slabId} est introuvable.`);
    const referenced = removalRefusal(project, this.slabId, 'Cette dalle');
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      slabs: level.slabs.filter(({ id }) => id !== this.slabId),
    }));
  }
}

export interface RoofDraft {
  readonly id: string;
  readonly footprint: Polygon2D;
  readonly assemblyId: string;
  readonly slopeDeg: number;
  readonly azimuthDeg: number;
  readonly baseElevationMm: number;
}

export class AddRoofCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: RoofDraft,
  ) {
    super(`roof:add:${draft.id}`, 'Ajouter un pan de toiture');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if (this.draft.footprint.outer.length < 3)
      return rejected('Un pan de toiture demande au moins trois sommets.');
    if (this.draft.slopeDeg < 0 || this.draft.slopeDeg >= 90)
      return rejected('La pente doit rester dans l’intervalle [0°, 90°[.');
    if (this.draft.azimuthDeg < 0 || this.draft.azimuthDeg >= 360)
      return rejected('L’azimut doit rester dans l’intervalle [0°, 360°[.');
    const assembly = (project.assemblies ?? []).find(
      ({ id }) => id === this.draft.assemblyId,
    );
    if (assembly === undefined)
      return rejected(`Assemblage inconnu : ${this.draft.assemblyId}.`);
    if (assembly.category !== 'ROOF' && assembly.category !== 'FLOOR')
      return rejected(
        `Un assemblage de catégorie ${assembly.category} ne peut pas porter une toiture.`,
      );
    return level.roofs.some(({ id }) => id === this.draft.id)
      ? rejected(`Le pan ${this.draft.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    const roof: RoofPlane = {
      id: entityId<'RoofPlane'>(this.draft.id),
      type: 'ROOF_PLANE',
      levelId: entityId<'Level'>(this.levelId),
      footprint: this.draft.footprint,
      assemblyId: this.draft.assemblyId as RoofPlane['assemblyId'],
      slopeDeg: this.draft.slopeDeg,
      azimuthDeg: this.draft.azimuthDeg,
      baseElevationMm: this.draft.baseElevationMm,
    };
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofs: [...level.roofs, roof],
    }));
  }
}

export class RemoveRoofCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly roofId: string,
  ) {
    super(`roof:remove:${roofId}`, 'Supprimer un pan de toiture');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.roofs.some(({ id }) => id === this.roofId) !== true)
      return rejected(`Le pan ${this.roofId} est introuvable.`);
    const referenced = removalRefusal(project, this.roofId, 'Ce pan');
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofs: level.roofs.filter(({ id }) => id !== this.roofId),
    }));
  }
}

/**
 * Why a thing of this model may not hang there, when it may not.
 *
 * Two questions, and only the first was being asked. « Is this object a
 * support? » a wall is, a room is not. « Does *this* model accept *this kind*
 * of support? » a radiator hangs on a wall, a heat pump stands on the ground,
 * a roof window belongs to a roof. Answering only the first let a radiator be
 * fixed to a roof because a roof is a support of something.
 *
 * The rule is read from the project's own copy of the catalogue entry, not
 * from a catalogue: a house drawn today must open the same way in two years,
 * and the editor, the importer and the checks must all answer alike.
 */
function hostRefusal(
  project: Project,
  level: Level,
  definitionId: string | undefined,
  hostObjectId: string | undefined,
): string | undefined {
  const hosts = levelHosts(level);
  if (hostObjectId !== undefined && !hosts.has(hostObjectId))
    return `${hostObjectId} n'est pas un support de ce niveau : un composant se fixe à un mur, une dalle, une toiture, une baie ou un autre appareil, jamais à une pièce ni à une fiche catalogue.`;
  if (definitionId === undefined) return undefined;
  const allowed = (project.equipment ?? []).find(
    ({ id }) => id === definitionId,
  )?.allowedHosts;
  if (allowed === undefined || allowed.length === 0) return undefined;
  const named = allowed.map((host) => HOST_TYPE_LABELS[host]).join(', ');
  if (hostObjectId === undefined)
    return allowed.includes('SITE')
      ? undefined
      : `Ce modèle se fixe à : ${named}. Il ne peut pas être posé sans support.`;
  return hostAccepts(allowed, hosts.get(hostObjectId))
    ? undefined
    : `Ce modèle se fixe à : ${named}, et ${hostObjectId} n'en est pas un.`;
}

/**
 * The catalogue version a placement records, when the entry states one.
 *
 * The user never types this: they choose a model, and the application writes
 * down which version of it they chose. Without it, correcting a catalogue
 * entry would change every house already designed with it, and nothing would
 * say so.
 */
function pinnedVersion(
  project: Project,
  definitionId: string,
): { readonly definitionVersion?: string } {
  const version = (project.equipment ?? []).find(
    ({ id }) => id === definitionId,
  )?.version;
  return version === undefined ? {} : { definitionVersion: version };
}

/** What placing a component asks for. */
export interface ComponentDraft {
  readonly id: string;
  readonly category: ComponentCategory;
  readonly definitionId?: string;
  readonly name?: string;
  readonly position: Point2D;
  readonly elevationMm: number;
  readonly rotationDeg: number;
  readonly hostObjectId?: string;
  readonly spaceId?: string;
}

/**
 * Places one thing in the building.
 *
 * The catalogue describes a model of heat pump; this is the heat pump standing
 * at these coordinates on this storey. Nothing that the definition already
 * says is copied here: two answers to one question is how a project ends up
 * disagreeing with itself.
 */
export class AddComponentCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: ComponentDraft,
  ) {
    super(`component:add:${draft.id}`, 'Poser un composant');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if ((level.components ?? []).some(({ id }) => id === this.draft.id))
      return rejected(`Le composant ${this.draft.id} existe déjà.`);
    if (
      this.draft.definitionId !== undefined &&
      !(project.equipment ?? []).some(
        ({ id }) => id === this.draft.definitionId,
      )
    )
      return rejected(
        `Le modèle ${this.draft.definitionId} est introuvable dans la bibliothèque.`,
      );
    if (
      this.draft.spaceId !== undefined &&
      !level.spaces.some(({ id }) => id === this.draft.spaceId)
    )
      return rejected(
        `La pièce ${this.draft.spaceId} n'est pas sur ce niveau.`,
      );
    const refusal = hostRefusal(
      project,
      level,
      this.draft.definitionId,
      this.draft.hostObjectId,
    );
    if (refusal !== undefined) return rejected(refusal);
    const issues = validateComponentInstance(this.instance(project));
    return issues.length > 0
      ? rejected(...issues.map(({ path, message }) => `${path}: ${message}`))
      : ok();
  }
  private instance(project: Project): ComponentInstance {
    return {
      id: entityId<'ComponentInstance'>(this.draft.id),
      type: 'COMPONENT_INSTANCE',
      levelId: entityId<'Level'>(this.levelId),
      category: this.draft.category,
      ...(this.draft.definitionId === undefined
        ? {}
        : {
            definitionId: this.draft.definitionId,
            ...pinnedVersion(project, this.draft.definitionId),
          }),
      ...(this.draft.name === undefined ? {} : { name: this.draft.name }),
      position: this.draft.position,
      elevationMm: this.draft.elevationMm,
      rotationDeg: this.draft.rotationDeg,
      ...(this.draft.hostObjectId === undefined
        ? {}
        : { hostObjectId: this.draft.hostObjectId }),
      ...(this.draft.spaceId === undefined
        ? {}
        : { spaceId: entityId<'Space'>(this.draft.spaceId) }),
    };
  }
  protected apply(project: Project): Project {
    const component = this.instance(project);
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      components: [...(level.components ?? []), component],
    }));
  }
}

/** What a component edit may change. */
export interface ComponentPatch {
  readonly category?: ComponentCategory;
  readonly definitionId?: string | null;
  readonly name?: string | null;
  readonly position?: Point2D;
  readonly elevationMm?: number;
  readonly rotationDeg?: number;
  readonly spaceId?: string | null;
  readonly hostObjectId?: string | null;
}

export class UpdateComponentCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly componentId: string,
    readonly patch: ComponentPatch,
  ) {
    super(`component:update:${componentId}`, 'Modifier un composant');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const component = (level?.components ?? []).find(
      ({ id }) => id === this.componentId,
    );
    if (component === undefined || level === undefined)
      return rejected(`Le composant ${this.componentId} est introuvable.`);
    const category = rejectedEnumValue(
      this.patch.category,
      isComponentCategory,
    );
    if (category !== undefined)
      return rejected(`Catégorie de composant inconnue : ${category}.`);
    if (
      typeof this.patch.definitionId === 'string' &&
      !(project.equipment ?? []).some(
        ({ id }) => id === this.patch.definitionId,
      )
    )
      return rejected(`Le modèle ${this.patch.definitionId} est introuvable.`);
    if (
      typeof this.patch.spaceId === 'string' &&
      !level.spaces.some(({ id }) => id === this.patch.spaceId)
    )
      return rejected(
        `La pièce ${this.patch.spaceId} n'est pas sur ce niveau.`,
      );
    // Read from what the edit will produce rather than from the patch: a patch
    // that changes only the model has to be checked against the host the
    // component already hangs on, and the other way round.
    const edited = this.patched(project, component);
    const refusal = hostRefusal(
      project,
      level,
      edited.definitionId,
      edited.hostObjectId,
    );
    if (refusal !== undefined) return rejected(refusal);
    const issues = validateComponentInstance(this.patched(project, component));
    return issues.length > 0
      ? rejected(...issues.map(({ path, message }) => `${path}: ${message}`))
      : ok();
  }
  private patched(
    project: Project,
    component: ComponentInstance,
  ): ComponentInstance {
    const {
      definitionId: _definition,
      definitionVersion: _version,
      name: _name,
      spaceId: _space,
      hostObjectId: _host,
      ...rest
    } = component;
    const hostObjectId =
      this.patch.hostObjectId === undefined
        ? component.hostObjectId
        : (this.patch.hostObjectId ?? undefined);
    const definitionId =
      this.patch.definitionId === undefined
        ? component.definitionId
        : (this.patch.definitionId ?? undefined);
    const name =
      this.patch.name === undefined
        ? component.name
        : (this.patch.name ?? undefined);
    const spaceId =
      this.patch.spaceId === undefined
        ? component.spaceId
        : this.patch.spaceId === null
          ? undefined
          : entityId<'Space'>(this.patch.spaceId);
    return {
      ...rest,
      ...(this.patch.category === undefined
        ? {}
        : { category: this.patch.category }),
      ...(this.patch.position === undefined
        ? {}
        : { position: this.patch.position }),
      ...(this.patch.elevationMm === undefined
        ? {}
        : { elevationMm: this.patch.elevationMm }),
      ...(this.patch.rotationDeg === undefined
        ? {}
        : { rotationDeg: this.patch.rotationDeg }),
      ...(definitionId === undefined
        ? {}
        : {
            definitionId,
            // Changing the model changes which version was chosen; keeping the
            // old pin would say the house was designed with figures it never
            // saw.
            ...(definitionId === component.definitionId
              ? component.definitionVersion === undefined
                ? {}
                : { definitionVersion: component.definitionVersion }
              : pinnedVersion(project, definitionId)),
          }),
      ...(name === undefined || name.trim() === '' ? {} : { name }),
      ...(spaceId === undefined ? {} : { spaceId }),
      ...(hostObjectId === undefined ? {} : { hostObjectId }),
    };
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      components: (level.components ?? []).map((component) =>
        component.id === this.componentId
          ? this.patched(project, component)
          : component,
      ),
    }));
  }
}

export class RemoveComponentCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly componentId: string,
  ) {
    super(`component:remove:${componentId}`, 'Supprimer un composant');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (
      (level?.components ?? []).some(({ id }) => id === this.componentId) !==
      true
    )
      return rejected(`Le composant ${this.componentId} est introuvable.`);
    const referenced = removalRefusal(
      project,
      this.componentId,
      'Ce composant',
    );
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      components: (level.components ?? []).filter(
        ({ id }) => id !== this.componentId,
      ),
    }));
  }
}

/** What building a stair asks for. */
export interface StairDraft {
  readonly id: string;
  readonly topLevelId: string;
  readonly stairType: StairType;
  readonly widthMm: number;
  readonly riserCount: number;
  readonly treadDepthMm: number;
  readonly path: readonly Point2D[];
  readonly landings?: readonly StairLanding[];
}

function stairOf(levelId: string, draft: StairDraft): Stair {
  return {
    id: entityId<'Stair'>(draft.id),
    type: 'STAIR',
    levelId: entityId<'Level'>(levelId),
    topLevelId: entityId<'Level'>(draft.topLevelId),
    stairType: draft.stairType,
    widthMm: draft.widthMm,
    riserCount: draft.riserCount,
    treadDepthMm: draft.treadDepthMm,
    path: { points: draft.path.map((point) => ({ ...point })) },
    ...(draft.landings === undefined || draft.landings.length === 0
      ? {}
      : { landings: draft.landings }),
  };
}

/** The storey a stair may arrive at: one that stands above the one it leaves. */
function reachableStorey(
  project: Project,
  levelId: string,
  topLevelId: string,
): string | undefined {
  const level = project.building.levels.find(({ id }) => id === levelId);
  const top = project.building.levels.find(({ id }) => id === topLevelId);
  if (top === undefined) return `Le niveau ${topLevelId} est introuvable.`;
  if (level !== undefined && top.elevationMm <= level.elevationMm)
    return `Le niveau ${top.name} n'est pas au-dessus de ${level.name} : un escalier n'y monte pas.`;
  return undefined;
}

export class AddStairCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: StairDraft,
  ) {
    super(`stair:add:${draft.id}`, 'Ajouter un escalier');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if (level.stairs.some(({ id }) => id === this.draft.id))
      return rejected(`L'escalier ${this.draft.id} existe déjà.`);
    const unreachable = reachableStorey(
      project,
      this.levelId,
      this.draft.topLevelId,
    );
    if (unreachable !== undefined) return rejected(unreachable);
    const issues = validateStair(stairOf(this.levelId, this.draft));
    return issues.length > 0
      ? rejected(...issues.map(({ path, message }) => `${path}: ${message}`))
      : ok();
  }
  protected apply(project: Project): Project {
    const stair = stairOf(this.levelId, this.draft);
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      stairs: [...level.stairs, stair],
    }));
  }
}

/** What a stair edit may change. */
export interface StairPatch {
  readonly topLevelId?: string;
  readonly stairType?: StairType;
  readonly widthMm?: number;
  readonly riserCount?: number;
  readonly treadDepthMm?: number;
  readonly path?: readonly Point2D[];
  readonly landings?: readonly StairLanding[];
}

export class UpdateStairCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly stairId: string,
    readonly patch: StairPatch,
  ) {
    super(`stair:update:${stairId}`, 'Modifier un escalier');
  }
  private patched(stair: Stair): Stair {
    return {
      ...stair,
      ...(this.patch.topLevelId === undefined
        ? {}
        : { topLevelId: entityId<'Level'>(this.patch.topLevelId) }),
      ...(this.patch.stairType === undefined
        ? {}
        : { stairType: this.patch.stairType }),
      ...(this.patch.widthMm === undefined
        ? {}
        : { widthMm: this.patch.widthMm }),
      ...(this.patch.riserCount === undefined
        ? {}
        : { riserCount: this.patch.riserCount }),
      ...(this.patch.treadDepthMm === undefined
        ? {}
        : { treadDepthMm: this.patch.treadDepthMm }),
      ...(this.patch.path === undefined
        ? {}
        : { path: { points: this.patch.path.map((point) => ({ ...point })) } }),
      ...(this.patch.landings === undefined
        ? {}
        : { landings: this.patch.landings }),
    };
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const stair = level?.stairs.find(({ id }) => id === this.stairId);
    if (stair === undefined)
      return rejected(`L'escalier ${this.stairId} est introuvable.`);
    if (this.patch.topLevelId !== undefined) {
      const unreachable = reachableStorey(
        project,
        this.levelId,
        this.patch.topLevelId,
      );
      if (unreachable !== undefined) return rejected(unreachable);
    }
    const type = rejectedEnumValue(this.patch.stairType, isStairType);
    if (type !== undefined)
      return rejected(`Type d'escalier inconnu : ${type}.`);
    const issues = validateStair(this.patched(stair));
    return issues.length > 0
      ? rejected(...issues.map(({ path, message }) => `${path}: ${message}`))
      : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      stairs: level.stairs.map((stair) =>
        stair.id === this.stairId ? this.patched(stair) : stair,
      ),
    }));
  }
}

export class RemoveStairCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly stairId: string,
  ) {
    super(`stair:remove:${stairId}`, 'Supprimer un escalier');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.stairs.some(({ id }) => id === this.stairId) !== true)
      return rejected(`L'escalier ${this.stairId} est introuvable.`);
    const referenced = removalRefusal(project, this.stairId, 'Cet escalier');
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      stairs: level.stairs.filter(({ id }) => id !== this.stairId),
    }));
  }
}

/** What describing a roof by its outline asks for. */
export interface RoofStructureDraft {
  readonly id: string;
  readonly footprint: Polygon2D;
  readonly edges: readonly RoofEdge[];
  readonly assemblyId: string;
  readonly baseElevationMm: number;
}

function roofStructureOf(levelId: string, draft: RoofStructureDraft): Roof {
  return {
    id: entityId<'Roof'>(draft.id),
    type: 'ROOF',
    levelId: entityId<'Level'>(levelId),
    footprint: draft.footprint,
    edges: draft.edges,
    assemblyId: draft.assemblyId as Roof['assemblyId'],
    baseElevationMm: draft.baseElevationMm,
  };
}

export class AddRoofStructureCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: RoofStructureDraft,
  ) {
    super(`roof-structure:add:${draft.id}`, 'Ajouter une toiture');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if ((level.roofStructures ?? []).some(({ id }) => id === this.draft.id))
      return rejected(`La toiture ${this.draft.id} existe déjà.`);
    const assembly = (project.assemblies ?? []).find(
      ({ id }) => id === this.draft.assemblyId,
    );
    if (assembly === undefined)
      return rejected(`Assemblage inconnu : ${this.draft.assemblyId}.`);
    // The same categories a plane drawn by hand accepts: a warm flat roof is
    // built like a floor, and refusing that here would refuse what the older
    // tool already allows.
    if (assembly.category !== 'ROOF' && assembly.category !== 'FLOOR')
      return rejected(
        `Un assemblage de catégorie ${assembly.category} ne peut pas porter une toiture.`,
      );
    const issues = validateRoof(roofStructureOf(this.levelId, this.draft));
    return issues.length > 0 ? rejected(...issues) : ok();
  }
  protected apply(project: Project): Project {
    const roof = roofStructureOf(this.levelId, this.draft);
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofStructures: [...(level.roofStructures ?? []), roof],
    }));
  }
}

/** What a roof edit may change. */
export interface RoofStructurePatch {
  readonly footprint?: Polygon2D;
  readonly edges?: readonly RoofEdge[];
  readonly assemblyId?: string;
  readonly baseElevationMm?: number;
}

export class UpdateRoofStructureCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly roofId: string,
    readonly patch: RoofStructurePatch,
  ) {
    super(`roof-structure:update:${roofId}`, 'Modifier une toiture');
  }
  private patched(roof: Roof): Roof {
    return {
      ...roof,
      ...(this.patch.footprint === undefined
        ? {}
        : { footprint: this.patch.footprint }),
      ...(this.patch.edges === undefined ? {} : { edges: this.patch.edges }),
      ...(this.patch.assemblyId === undefined
        ? {}
        : { assemblyId: this.patch.assemblyId as Roof['assemblyId'] }),
      ...(this.patch.baseElevationMm === undefined
        ? {}
        : { baseElevationMm: this.patch.baseElevationMm }),
    };
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const roof = (level?.roofStructures ?? []).find(
      ({ id }) => id === this.roofId,
    );
    if (roof === undefined)
      return rejected(`La toiture ${this.roofId} est introuvable.`);
    if (!assemblyExists(project, this.patch.assemblyId))
      return rejected(`L'assemblage ${this.patch.assemblyId} est introuvable.`);
    const issues = validateRoof(this.patched(roof));
    return issues.length > 0 ? rejected(...issues) : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofStructures: (level.roofStructures ?? []).map((roof) =>
        roof.id === this.roofId ? this.patched(roof) : roof,
      ),
    }));
  }
}

export class RemoveRoofStructureCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly roofId: string,
  ) {
    super(`roof-structure:remove:${roofId}`, 'Supprimer une toiture');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (!(level?.roofStructures ?? []).some(({ id }) => id === this.roofId))
      return rejected(`La toiture ${this.roofId} est introuvable.`);
    const referenced = removalRefusal(project, this.roofId, 'Cette toiture');
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofStructures: (level.roofStructures ?? []).filter(
        ({ id }) => id !== this.roofId,
      ),
    }));
  }
}

/** What placing a structural member asks for. */
export interface StructuralMemberDraft {
  readonly id: string;
  readonly kind: StructuralMemberKind;
  readonly path: readonly Point2D[];
  readonly widthMm: number;
  readonly depthMm: number;
  readonly elevationMm?: number;
  readonly heightMm?: number;
  readonly materialId?: string;
}

function memberOf(
  levelId: string,
  draft: StructuralMemberDraft,
): StructuralMember {
  return {
    id: entityId<'StructuralMember'>(draft.id),
    type: 'STRUCTURAL_MEMBER',
    levelId: entityId<'Level'>(levelId),
    kind: draft.kind,
    path: draft.path.map((point) => ({ ...point })),
    widthMm: draft.widthMm,
    depthMm: draft.depthMm,
    ...(draft.elevationMm === undefined
      ? {}
      : { elevationMm: draft.elevationMm }),
    ...(draft.heightMm === undefined ? {} : { heightMm: draft.heightMm }),
    ...(draft.materialId === undefined ? {} : { materialId: draft.materialId }),
  };
}

export class AddStructuralMemberCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: StructuralMemberDraft,
  ) {
    super(`structure:add:${draft.id}`, 'Ajouter un élément de structure');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if ((level.structure ?? []).some(({ id }) => id === this.draft.id))
      return rejected(`L'élément ${this.draft.id} existe déjà.`);
    if (
      this.draft.materialId !== undefined &&
      !(project.materialLibrary?.materials ?? []).some(
        ({ id }) => id === this.draft.materialId,
      )
    )
      return rejected(`Le matériau ${this.draft.materialId} est introuvable.`);
    const issues = validateStructuralMember(memberOf(this.levelId, this.draft));
    return issues.length > 0 ? rejected(...issues) : ok();
  }
  protected apply(project: Project): Project {
    const member = memberOf(this.levelId, this.draft);
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      structure: [...(level.structure ?? []), member],
    }));
  }
}

/** What a structural member edit may change. */
export interface StructuralMemberPatch {
  readonly kind?: StructuralMemberKind;
  readonly path?: readonly Point2D[];
  readonly widthMm?: number;
  readonly depthMm?: number;
  readonly elevationMm?: number;
  readonly heightMm?: number;
  readonly materialId?: string | null;
}

export class UpdateStructuralMemberCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly memberId: string,
    readonly patch: StructuralMemberPatch,
  ) {
    super(`structure:update:${memberId}`, 'Modifier un élément de structure');
  }
  private patched(member: StructuralMember): StructuralMember {
    const { materialId: _material, ...rest } = member;
    const materialId =
      this.patch.materialId === undefined
        ? member.materialId
        : (this.patch.materialId ?? undefined);
    return {
      ...rest,
      ...(this.patch.kind === undefined ? {} : { kind: this.patch.kind }),
      ...(this.patch.path === undefined
        ? {}
        : { path: this.patch.path.map((point) => ({ ...point })) }),
      ...(this.patch.widthMm === undefined
        ? {}
        : { widthMm: this.patch.widthMm }),
      ...(this.patch.depthMm === undefined
        ? {}
        : { depthMm: this.patch.depthMm }),
      ...(this.patch.elevationMm === undefined
        ? {}
        : { elevationMm: this.patch.elevationMm }),
      ...(this.patch.heightMm === undefined
        ? {}
        : { heightMm: this.patch.heightMm }),
      ...(materialId === undefined ? {} : { materialId }),
    };
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const member = (level?.structure ?? []).find(
      ({ id }) => id === this.memberId,
    );
    if (member === undefined)
      return rejected(`L'élément ${this.memberId} est introuvable.`);
    const kind = rejectedEnumValue(this.patch.kind, isStructuralMemberKind);
    if (kind !== undefined)
      return rejected(`Type d'élément de structure inconnu : ${kind}.`);
    if (
      typeof this.patch.materialId === 'string' &&
      !(project.materialLibrary?.materials ?? []).some(
        ({ id }) => id === this.patch.materialId,
      )
    )
      return rejected(`Le matériau ${this.patch.materialId} est introuvable.`);
    const issues = validateStructuralMember(this.patched(member));
    return issues.length > 0 ? rejected(...issues) : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      structure: (level.structure ?? []).map((member) =>
        member.id === this.memberId ? this.patched(member) : member,
      ),
    }));
  }
}

export class RemoveStructuralMemberCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly memberId: string,
  ) {
    super(`structure:remove:${memberId}`, 'Supprimer un élément de structure');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (!(level?.structure ?? []).some(({ id }) => id === this.memberId))
      return rejected(`L'élément ${this.memberId} est introuvable.`);
    const referenced = removalRefusal(project, this.memberId, 'Cet élément');
    return referenced === undefined ? ok() : rejected(referenced);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      structure: (level.structure ?? []).filter(
        ({ id }) => id !== this.memberId,
      ),
    }));
  }
}

export interface DetectedRoom {
  readonly polygon: Polygon2D;
  readonly areaM2: number;
  readonly sourceWallIds: readonly string[];
  /** Identifier of the space already covering this boundary, when there is one. */
  readonly existingSpaceId?: string;
}

/**
 * Finds the rooms a level's walls enclose.
 *
 * Detected boundaries are never persisted: they are proposals the user turns
 * into spaces, and an already covered boundary is reported as such rather than
 * silently duplicated.
 */
export function detectRooms(
  project: Project,
  levelId: string,
): readonly DetectedRoom[] {
  const level = project.building.levels.find(({ id }) => id === levelId);
  if (level === undefined) return [];
  const detection = detectSpaceBoundaries(level.walls);
  if (detection.status !== 'OK') return [];
  const existing = level.spaces.filter(
    (space) => space.boundaryMode === 'MANUAL',
  );
  return [...detection.boundaries]
    .map((boundary) => {
      const areaMm2 = Math.abs(polygonArea(boundary.polygon));
      const centre = boundary.polygon.outer.reduce(
        (total, point) => ({
          x: total.x + point.x / boundary.polygon.outer.length,
          y: total.y + point.y / boundary.polygon.outer.length,
        }),
        { x: 0, y: 0 },
      );
      const covering = existing.find((space) => {
        if (space.boundaryMode !== 'MANUAL') return false;
        const points = space.manualPolygon.outer;
        let inside = false;
        for (
          let index = 0, previous = points.length - 1;
          index < points.length;
          previous = index, index += 1
        ) {
          const current = points[index]!;
          const last = points[previous]!;
          if (current.y > centre.y === last.y > centre.y) continue;
          const crossingX =
            ((last.x - current.x) * (centre.y - current.y)) /
              (last.y - current.y) +
            current.x;
          if (centre.x < crossingX) inside = !inside;
        }
        return inside;
      });
      return {
        polygon: boundary.polygon,
        areaM2: areaMm2 / 1_000_000,
        sourceWallIds: [...boundary.sourceWallIds],
        ...(covering === undefined ? {} : { existingSpaceId: covering.id }),
      };
    })
    .sort((first, second) => second.areaM2 - first.areaM2);
}

/**
 * What an element edit may change.
 *
 * A patch names only the fields it changes. Anything absent keeps its current
 * value: an edit never rewrites a field the user did not touch.
 */
export interface WallPatch {
  readonly assemblyId?: string;
  readonly role?: Wall['role'];
  readonly heightMm?: number;
  readonly baseOffsetMm?: number;
  readonly referenceSide?: Wall['referenceSide'];
}

/**
 * The value, when it is not one the domain accepts.
 *
 * The type system already believes these values are valid, so this check looks
 * redundant — and it is not. The value may have been cast on its way out of an
 * interface, and a command must never write something the persisted contract
 * forbids. Taking it as a plain string is what lets the guard actually run.
 */
function rejectedEnumValue(
  value: string | undefined,
  accepts: (candidate: string) => boolean,
): string | undefined {
  if (value === undefined) return undefined;
  return accepts(value) ? undefined : value;
}

function finitePositive(value: number | undefined, label: string): string[] {
  if (value === undefined) return [];
  if (!Number.isFinite(value)) return [`${label} doit être un nombre fini.`];
  return value > 0 ? [] : [`${label} doit être strictement positif.`];
}

function assemblyExists(project: Project, assemblyId: string | undefined) {
  return (
    assemblyId === undefined ||
    (project.assemblies ?? []).some(({ id }) => id === assemblyId)
  );
}

/**
 * How high a wall stands, as one decision rather than three fields.
 *
 * A wall either has a height of its own or reaches a storey above. Those are
 * two shapes of the same wall and not two fields that may both be set: a patch
 * that could leave a height behind on a wall reaching a level would persist a
 * number nobody reads and that nothing keeps true.
 */
export type WallHeight =
  | { readonly mode: 'EXPLICIT'; readonly heightMm: number }
  | {
      readonly mode: 'TO_LEVEL';
      readonly topLevelId: string;
      readonly topOffsetMm?: number;
    };

/**
 * Sets how high a wall stands, dropping whatever the other shape carried.
 *
 * The domain has accepted `TO_LEVEL` walls since the beginning and no screen
 * could produce one: a storey height changed under a wall built to it, and the
 * wall stayed where it was.
 */
export class SetWallHeightCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly wallId: string,
    readonly height: WallHeight,
  ) {
    super(`wall:height:${wallId}`, 'Modifier la hauteur d’un mur');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const wall = level?.walls.find(({ id }) => id === this.wallId);
    if (wall === undefined)
      return rejected(`Le mur ${this.wallId} est introuvable.`);
    if (this.height.mode === 'EXPLICIT') {
      const errors = finitePositive(this.height.heightMm, 'La hauteur du mur');
      return errors.length > 0 ? rejected(...errors) : ok();
    }
    const height = this.height;
    const top = project.building.levels.find(
      ({ id }) => id === height.topLevelId,
    );
    if (top === undefined)
      return rejected(
        `Le niveau supérieur ${height.topLevelId} est introuvable.`,
      );
    if (level !== undefined && top.elevationMm <= level.elevationMm)
      return rejected(
        `Le niveau ${top.name} n'est pas au-dessus de ${level.name} : un mur ne peut pas y monter.`,
      );
    if (
      height.topOffsetMm !== undefined &&
      !Number.isFinite(height.topOffsetMm)
    )
      return rejected('Le décalage en tête doit être un nombre fini.');
    return ok();
  }
  protected apply(project: Project): Project {
    const height = this.height;
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      walls: level.walls.map((wall) => {
        if (wall.id !== this.wallId) return wall;
        const {
          heightMm: _height,
          topLevelId: _top,
          topOffsetMm: _offset,
          ...rest
        } = wall as Wall & {
          heightMm?: number;
          topLevelId?: string;
          topOffsetMm?: number;
        };
        return (
          height.mode === 'EXPLICIT'
            ? { ...rest, heightMode: 'EXPLICIT', heightMm: height.heightMm }
            : {
                ...rest,
                heightMode: 'TO_LEVEL',
                topLevelId: height.topLevelId,
                ...(height.topOffsetMm === undefined
                  ? {}
                  : { topOffsetMm: height.topOffsetMm }),
              }
        ) as Wall;
      }),
    }));
  }
}

export class UpdateWallCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly wallId: string,
    readonly patch: WallPatch,
  ) {
    super(`wall:update:${wallId}`, 'Modifier un mur');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.walls.some(({ id }) => id === this.wallId) !== true)
      return rejected(`Le mur ${this.wallId} est introuvable.`);
    if (!assemblyExists(project, this.patch.assemblyId))
      return rejected(`L'assemblage ${this.patch.assemblyId} est introuvable.`);
    // A command may never write a value the persisted contract forbids, even
    // when the caller's type says it cannot happen: the interface that built
    // the value is not the one that has to be right.
    const side = rejectedEnumValue(
      this.patch.referenceSide,
      isWallReferenceSide,
    );
    if (side !== undefined)
      return rejected(`Face de référence inconnue : ${side}.`);
    const role = rejectedEnumValue(this.patch.role, isWallRole);
    if (role !== undefined) return rejected(`Rôle de mur inconnu : ${role}.`);
    const wall = level.walls.find(({ id }) => id === this.wallId)!;
    if (this.patch.heightMm !== undefined && wall.heightMode !== 'EXPLICIT')
      return rejected(
        'Ce mur tient sa hauteur du niveau supérieur : elle ne se saisit pas ici.',
      );
    const errors = [
      ...finitePositive(this.patch.heightMm, 'La hauteur du mur'),
      ...(this.patch.baseOffsetMm === undefined ||
      Number.isFinite(this.patch.baseOffsetMm)
        ? []
        : ['Le décalage en pied doit être un nombre fini.']),
    ];
    return errors.length > 0 ? rejected(...errors) : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      walls: level.walls.map((wall) =>
        wall.id === this.wallId
          ? ({
              ...wall,
              ...this.patch,
              ...(this.patch.assemblyId === undefined
                ? {}
                : { assemblyId: this.patch.assemblyId as Wall['assemblyId'] }),
            } as Wall)
          : wall,
      ),
    }));
  }
}

export interface OpeningPatch {
  readonly openingType?: Opening['openingType'];
  readonly widthMm?: number;
  readonly heightMm?: number;
  readonly sillHeightMm?: number;
  readonly offsetAlongHostMm?: number;
  /**
   * The model of menuiserie this hole is, or `null` to have none.
   *
   * It is what carries the transmittance the envelope needs, and it had no way
   * of being set: the field existed on the opening and nothing wrote it.
   */
  readonly definitionId?: string | null;
  /**
   * Which way the door opens, against its host wall's own path.
   *
   * Only a door has one, and the swing every door had before it could be
   * asked stays the default: a file written earlier opens unchanged.
   */
  readonly swing?: DoorSwing;
}

/**
 * Edits an opening, keeping it inside the wall that hosts it.
 *
 * The host wall is the constraint: an opening wider than what remains of its
 * wall is refused rather than clamped, because clamping would silently change
 * a value the user typed.
 */
export class UpdateOpeningCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly openingId: string,
    readonly patch: OpeningPatch,
  ) {
    super(`opening:update:${openingId}`, 'Modifier une ouverture');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const opening = level?.openings.find(({ id }) => id === this.openingId);
    if (level === undefined || opening === undefined)
      return rejected(`L'ouverture ${this.openingId} est introuvable.`);
    const openingType = rejectedEnumValue(
      this.patch.openingType,
      isOpeningType,
    );
    if (openingType !== undefined)
      return rejected(`Type d'ouverture inconnu : ${openingType}.`);
    // A model the project does not carry is a pointer at nothing, and the
    // importer would refuse the file it produced.
    const definitionId = this.patch.definitionId;
    if (
      typeof definitionId === 'string' &&
      !(project.openingTypes ?? []).some(({ id }) => id === definitionId)
    )
      return rejected(`La menuiserie ${definitionId} est introuvable.`);
    const errors = [
      ...finitePositive(this.patch.widthMm, "La largeur de l'ouverture"),
      ...finitePositive(this.patch.heightMm, "La hauteur de l'ouverture"),
    ];
    const swing = this.patch.swing;
    if (swing !== undefined) {
      if (!isDoorHinge(swing.hinge))
        errors.push(`Gond inconnu : ${String(swing.hinge)}.`);
      if (!isDoorOpeningSide(swing.opensTo))
        errors.push(`Sens d'ouverture inconnu : ${String(swing.opensTo)}.`);
      if ((this.patch.openingType ?? opening.openingType) !== 'DOOR')
        errors.push("Seule une porte possède un sens d'ouverture.");
      const angle = swing.openingAngleDeg;
      if (
        angle !== undefined &&
        (!Number.isFinite(angle) || angle <= 0 || angle > 180)
      )
        errors.push("L'angle d'ouverture doit être compris entre 0 et 180°.");
    }
    const sill = this.patch.sillHeightMm;
    if (sill !== undefined && (!Number.isFinite(sill) || sill < 0))
      errors.push("L'allège doit être un nombre fini positif ou nul.");
    const offset = this.patch.offsetAlongHostMm;
    if (offset !== undefined && (!Number.isFinite(offset) || offset < 0))
      errors.push('La position sur le mur doit être positive ou nulle.');
    const host = level.walls.find(({ id }) => id === opening.hostElementId);
    if (host !== undefined) {
      const next = { ...opening, ...this.patch };
      const start = host.path.points[0];
      const end = host.path.points.at(-1);
      if (start !== undefined && end !== undefined) {
        const wallLengthMm = Math.hypot(end.x - start.x, end.y - start.y);
        if (next.offsetAlongHostMm + next.widthMm > wallLengthMm)
          errors.push(
            `L'ouverture dépasserait le mur qui la porte (${Math.round(wallLengthMm)} mm).`,
          );
      }
      // A wall whose top follows another level has no explicit height here;
      // the vertical fit is then checked when that height is resolved, not
      // guessed from a value this command does not have.
      if (
        host.heightMode === 'EXPLICIT' &&
        next.sillHeightMm + next.heightMm > host.heightMm
      )
        errors.push(
          `L'ouverture dépasserait la hauteur du mur (${host.heightMm} mm).`,
        );
    }
    return errors.length > 0 ? rejected(...errors) : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      openings: level.openings.map((opening) => {
        if (opening.id !== this.openingId) return opening;
        const { definitionId, ...rest } = this.patch;
        const next = { ...opening, ...rest };
        if (definitionId === undefined) return next;
        if (definitionId === null) {
          const { definitionId: _cleared, ...without } = next;
          return without;
        }
        return { ...next, definitionId };
      }),
    }));
  }
}

export interface SlabPatch {
  readonly assemblyId?: string;
  readonly role?: Slab['role'];
  readonly elevationOffsetMm?: number;
  /** The footprint, when the user reshapes it. */
  readonly polygon?: Polygon2D;
}

export class UpdateSlabCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly slabId: string,
    readonly patch: SlabPatch,
  ) {
    super(`slab:update:${slabId}`, 'Modifier une dalle');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.slabs.some(({ id }) => id === this.slabId) !== true)
      return rejected(`La dalle ${this.slabId} est introuvable.`);
    if (!assemblyExists(project, this.patch.assemblyId))
      return rejected(`L'assemblage ${this.patch.assemblyId} est introuvable.`);
    const slabRole = rejectedEnumValue(this.patch.role, isSlabRole);
    if (slabRole !== undefined)
      return rejected(`Rôle de dalle inconnu : ${slabRole}.`);
    if (
      this.patch.elevationOffsetMm !== undefined &&
      !Number.isFinite(this.patch.elevationOffsetMm)
    )
      return rejected('Le décalage de la dalle doit être un nombre fini.');
    const shape = badPolygon(this.patch.polygon, 'La dalle');
    return shape === undefined ? ok() : rejected(...shape);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      slabs: level.slabs.map((slab) =>
        slab.id === this.slabId ? ({ ...slab, ...this.patch } as Slab) : slab,
      ),
    }));
  }
}

export interface RoofPatch {
  readonly assemblyId?: string;
  readonly slopeDeg?: number;
  readonly azimuthDeg?: number;
  readonly baseElevationMm?: number;
  /** The footprint, when the user reshapes it. */
  readonly footprint?: Polygon2D;
}

export class UpdateRoofCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly roofId: string,
    readonly patch: RoofPatch,
  ) {
    super(`roof:update:${roofId}`, 'Modifier un pan de toiture');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level?.roofs.some(({ id }) => id === this.roofId) !== true)
      return rejected(`Le pan de toiture ${this.roofId} est introuvable.`);
    if (!assemblyExists(project, this.patch.assemblyId))
      return rejected(`L'assemblage ${this.patch.assemblyId} est introuvable.`);
    const errors: string[] = [];
    const slope = this.patch.slopeDeg;
    if (
      slope !== undefined &&
      (!Number.isFinite(slope) || slope < 0 || slope >= 90)
    )
      errors.push('La pente doit être comprise entre 0 et 90 degrés exclus.');
    const azimuth = this.patch.azimuthDeg;
    if (
      azimuth !== undefined &&
      (!Number.isFinite(azimuth) || azimuth < 0 || azimuth >= 360)
    )
      errors.push("L'azimut doit être compris entre 0 et 360 degrés exclus.");
    if (
      this.patch.baseElevationMm !== undefined &&
      !Number.isFinite(this.patch.baseElevationMm)
    )
      errors.push("L'altitude de base doit être un nombre fini.");
    errors.push(
      ...(badPolygon(this.patch.footprint, 'Le pan de toiture') ?? []),
    );
    return errors.length > 0 ? rejected(...errors) : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofs: level.roofs.map((roof) =>
        roof.id === this.roofId
          ? ({ ...roof, ...this.patch } as RoofPlane)
          : roof,
      ),
    }));
  }
}

/**
 * Why a reshaped footprint would be refused, when it would.
 *
 * A polygon that crosses itself or collapses onto a line is not a surface, and
 * a quantity taken from it would be meaningless. It is refused while the drag
 * is still in the user's hands rather than stored and reported later.
 */
function badPolygon(
  polygon: Polygon2D | undefined,
  what: string,
): readonly string[] | undefined {
  if (polygon === undefined) return undefined;
  const issues = validatePolygon(polygon);
  return issues.length === 0
    ? undefined
    : issues.map(({ message }) => `${what} : ${message}.`);
}

export interface DimensionPatch {
  readonly type?: Dimension['type'];
  readonly offsetMm?: number;
  /** `null` drops the imposed text and restores the measured value. */
  readonly overrideText?: string | null;
}

/** What placing a note on a storey asks for. */
export interface TextNoteDraft {
  readonly id: string;
  readonly at: Point2D;
  readonly text: string;
  readonly heightMm?: number;
  readonly rotationDeg?: number;
  readonly leaderTo?: Point2D;
}

function noteOf(draft: TextNoteDraft): TextNote {
  return {
    id: textNoteId(draft.id),
    kind: 'TEXT',
    at: { ...draft.at },
    text: draft.text,
    ...(draft.heightMm === undefined ? {} : { heightMm: draft.heightMm }),
    ...(draft.rotationDeg === undefined
      ? {}
      : { rotationDeg: draft.rotationDeg }),
    ...(draft.leaderTo === undefined
      ? {}
      : { leaderTo: { ...draft.leaderTo } }),
  };
}

/**
 * Writes something on the drawing that the model does not say.
 *
 * « Reprise en sous-œuvre », « existant à démolir » : a drawing carries what
 * the building is and what the person drawing it wants read, and only the
 * first had anywhere to live. A note is never read by a calculation, which is
 * why nothing here tries to make sense of what it says.
 */
export class AddTextNoteCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly draft: TextNoteDraft,
  ) {
    super(`note:add:${draft.id}`, 'Ajouter une annotation');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    if (level === undefined)
      return rejected(`Le niveau ${this.levelId} est introuvable.`);
    if (level.annotations.some(({ id }) => id === this.draft.id))
      return rejected(`L'annotation ${this.draft.id} existe déjà.`);
    const issues = validateTextNote(noteOf(this.draft));
    return issues.length > 0
      ? rejected(...issues.map(({ path, message }) => `${path}: ${message}`))
      : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      annotations: [...level.annotations, noteOf(this.draft)],
    }));
  }
}

/** What a note may have changed. */
export interface TextNotePatch {
  readonly text?: string;
  readonly at?: Point2D;
  readonly heightMm?: number;
  readonly rotationDeg?: number;
  readonly leaderTo?: Point2D | null;
}

export class UpdateTextNoteCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly noteId: string,
    readonly patch: TextNotePatch,
  ) {
    super(`note:update:${noteId}`, 'Modifier une annotation');
  }
  private patched(note: TextNote): TextNote {
    const { leaderTo: _previous, ...rest } = note;
    const leaderTo =
      this.patch.leaderTo === undefined
        ? note.leaderTo
        : (this.patch.leaderTo ?? undefined);
    return {
      ...rest,
      ...(this.patch.text === undefined ? {} : { text: this.patch.text }),
      ...(this.patch.at === undefined ? {} : { at: { ...this.patch.at } }),
      ...(this.patch.heightMm === undefined
        ? {}
        : { heightMm: this.patch.heightMm }),
      ...(this.patch.rotationDeg === undefined
        ? {}
        : { rotationDeg: this.patch.rotationDeg }),
      ...(leaderTo === undefined ? {} : { leaderTo: { ...leaderTo } }),
    };
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    const note = (level?.annotations ?? []).find(
      (annotation): annotation is TextNote =>
        annotation.id === this.noteId && isTextNote(annotation),
    );
    if (note === undefined)
      return rejected(`L'annotation ${this.noteId} est introuvable.`);
    const issues = validateTextNote(this.patched(note));
    return issues.length > 0
      ? rejected(...issues.map(({ path, message }) => `${path}: ${message}`))
      : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      annotations: level.annotations.map((annotation) =>
        annotation.id === this.noteId && isTextNote(annotation)
          ? this.patched(annotation)
          : annotation,
      ),
    }));
  }
}

export class RemoveTextNoteCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly noteId: string,
  ) {
    super(`note:remove:${noteId}`, 'Supprimer une annotation');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    return (level?.annotations ?? []).some(
      (annotation) => annotation.id === this.noteId && isTextNote(annotation),
    )
      ? ok()
      : rejected(`L'annotation ${this.noteId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      annotations: level.annotations.filter(({ id }) => id !== this.noteId),
    }));
  }
}

export class UpdateDimensionCommand extends BuildingCommand {
  constructor(
    readonly levelId: string,
    readonly dimensionId: string,
    readonly patch: DimensionPatch,
  ) {
    super(`dimension:update:${dimensionId}`, 'Modifier une cote');
  }
  validate(project: Project): CommandValidation {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    // A level carries dimensions and notes; the identifier has to name a
    // dimension, not merely an annotation.
    if (
      !(level?.annotations ?? []).some(
        (annotation) =>
          annotation.id === this.dimensionId && isDimension(annotation),
      )
    )
      return rejected(`La cote ${this.dimensionId} est introuvable.`);
    const dimensionType = rejectedEnumValue(this.patch.type, isDimensionType);
    if (dimensionType !== undefined)
      return rejected(`Type de cote inconnu : ${dimensionType}.`);
    return this.patch.offsetMm !== undefined &&
      !Number.isFinite(this.patch.offsetMm)
      ? rejected('Le décalage de la cote doit être un nombre fini.')
      : ok();
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      annotations: level.annotations.map((annotation) => {
        if (annotation.id !== this.dimensionId || !isDimension(annotation))
          return annotation;
        const { overrideText: _dropped, ...rest } = annotation;
        const text =
          this.patch.overrideText === undefined
            ? annotation.overrideText
            : this.patch.overrideText;
        return {
          ...rest,
          ...(this.patch.type === undefined ? {} : { type: this.patch.type }),
          ...(this.patch.offsetMm === undefined
            ? {}
            : { offsetMm: this.patch.offsetMm }),
          ...(text === null || text === undefined || text.trim() === ''
            ? {}
            : { overrideText: text }),
        };
      }),
    }));
  }
}
