import type {
  Level,
  Project,
  RoofPlane,
  Slab,
  Space,
} from '@house-technical-designer/core-domain';
import {
  detectSpaceBoundaries,
  entityId,
} from '@house-technical-designer/core-domain';
import type { Polygon2D } from '@house-technical-designer/geometry';
import { polygonArea } from '@house-technical-designer/geometry';
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
  validate(project: Project): CommandValidation {
    if (this.source(project) === undefined)
      return rejected(`Le niveau ${this.sourceLevelId} est introuvable.`);
    return project.building.levels.some(({ id }) => id === this.draft.id)
      ? rejected(`Le niveau ${this.draft.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    const source = this.source(project)!;
    const levelId = entityId<'Level'>(this.draft.id);
    const suffix = `@${this.draft.id}`;
    const level: Level = {
      id: levelId,
      name: this.draft.name,
      elevationMm: this.draft.elevationMm,
      defaultStoreyHeightMm: this.draft.defaultStoreyHeightMm,
      walls: source.walls.map((wall) => ({
        ...wall,
        id: entityId<'Wall'>(`${wall.id}${suffix}`),
        levelId,
      })),
      openings: source.openings.map((opening) => ({
        ...opening,
        id: entityId<'Opening'>(`${opening.id}${suffix}`),
        hostElementId: entityId<'Wall'>(`${opening.hostElementId}${suffix}`),
      })),
      slabs: source.slabs.map((slab) => ({
        ...slab,
        id: entityId<'Slab'>(`${slab.id}${suffix}`),
        levelId,
      })),
      roofs: source.roofs.map((roof) => ({
        ...roof,
        id: entityId<'RoofPlane'>(`${roof.id}${suffix}`),
        levelId,
      })),
      spaces: source.spaces.map((space) => ({
        ...space,
        id: entityId<'Space'>(`${space.id}${suffix}`),
        levelId,
      })),
      stairs: [],
      annotations: [],
    };
    return withLevels(
      project,
      sortedByElevation([...project.building.levels, level]),
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
    return withLevels(
      project,
      sortedByElevation(
        project.building.levels.map((level) =>
          level.id === this.levelId ? { ...level, ...this.changes } : level,
        ),
      ),
    );
  }
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
    const contents =
      level.walls.length +
      level.openings.length +
      level.slabs.length +
      level.roofs.length +
      level.spaces.length;
    return contents === 0
      ? ok()
      : rejected(
          `Le niveau ${level.name} contient encore ${contents} objet(s). Videz-le avant de le supprimer.`,
        );
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
    const zones = project.building.zones.filter(({ spaceIds }) =>
      spaceIds.includes(this.spaceId as never),
    );
    return zones.length === 0
      ? ok()
      : rejected(
          `La pièce appartient encore à ${zones.length} zone(s) : ${zones.map(({ name }) => name).join(', ')}.`,
        );
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
    return level?.slabs.some(({ id }) => id === this.slabId) === true
      ? ok()
      : rejected(`La dalle ${this.slabId} est introuvable.`);
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
    return level?.roofs.some(({ id }) => id === this.roofId) === true
      ? ok()
      : rejected(`Le pan ${this.roofId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return mapLevel(project, this.levelId, (level) => ({
      ...level,
      roofs: level.roofs.filter(({ id }) => id !== this.roofId),
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
