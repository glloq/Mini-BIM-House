import type {
  JsonValue,
  ModuleSettings,
  Project,
  ProjectMetadata,
  RegulatoryContext,
  Site,
  SiteObstacle,
  SiteObstacleKind,
} from '@house-technical-designer/core-domain';
import {
  entityId,
  isSiteObstacleKind,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import type { ChangeSet, CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

/**
 * Everything a project-wide setting can invalidate.
 *
 * The site orientation feeds the solar modules, the climate reference feeds
 * every weather-dependent one, and the module settings feed whichever module
 * declares them. Naming them all is honest; guessing which one cared is not.
 */
const SETTINGS_DOMAINS = [
  'thermal',
  'heating',
  'dhw',
  'ventilation',
  'iaq',
  'water',
  'wastewater',
  'rainwater',
  'electrical',
  'lighting',
  'photovoltaic',
  'battery',
  'energy',
  'hygrothermal',
  'acoustics',
  'cost',
  'environmental',
  'quantities',
  'compliance',
  'drawing-overlays',
] as const;

function changes(id: string): ChangeSet {
  return { objectIds: [id], domains: [...SETTINGS_DOMAINS] };
}

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

abstract class SettingsCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
  ) {}
  abstract validate(project: Project): CommandValidation;
  protected abstract apply(project: Project): Project;
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.apply(project),
      changes: changes(this.id),
      inverse: new RestoreSettingsCommand(
        `${this.id}:inverse`,
        `Annuler ${this.label}`,
        project,
      ),
    };
  }
}

/** Restores a previous project; used as the inverse of a settings edit. */
export class RestoreSettingsCommand implements ProjectCommand {
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
      changes: changes(this.id),
      inverse: new RestoreSettingsCommand(
        `${this.id}:inverse`,
        `Rétablir ${this.label}`,
        project,
      ),
    };
  }
}

/**
 * Metadata a user edits.
 *
 * `projectRevision` and `updatedAt` are not here: the dispatcher writes them on
 * every command, so a value typed by hand would be overwritten by the very
 * command carrying it.
 */
export interface ProjectMetadataPatch {
  readonly name?: string;
  readonly description?: string | null;
  readonly author?: string | null;
  readonly notes?: string | null;
}

/** Applies a patch whose `null` entries clear the field they name. */
function patched<T extends object>(
  current: T,
  patch: Readonly<Record<string, string | null | undefined>>,
): T {
  const next: Record<string, unknown> = { ...(current as object) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null || value.trim() === '') delete next[key];
    else next[key] = value;
  }
  return next as T;
}

export class UpdateProjectMetadataCommand extends SettingsCommand {
  constructor(readonly patch: ProjectMetadataPatch) {
    super('project:metadata', 'Modifier les informations du projet');
  }
  validate(): CommandValidation {
    return this.patch.name !== undefined && this.patch.name.trim() === ''
      ? rejected('Le nom du projet ne peut pas être vide.')
      : ok();
  }
  protected apply(project: Project): Project {
    const metadata = patched<ProjectMetadata>(project.metadata, {
      ...this.patch,
      // The name is required, so it is never cleared by an empty patch.
      ...(this.patch.name === undefined ? {} : { name: this.patch.name }),
    });
    return { ...project, metadata };
  }
}

export interface SitePatch {
  readonly northAngleDeg?: number;
  readonly altitudeM?: number | null;
  readonly latitudeDeg?: number | null;
  readonly longitudeDeg?: number | null;
  readonly climateProfileId?: string | null;
}

/**
 * Edits the site.
 *
 * Latitude and longitude are a pair: a location with only one of them is
 * meaningless to the solar modules, so half a location is refused rather than
 * completed with a zero.
 */
export class UpdateSiteCommand extends SettingsCommand {
  constructor(readonly patch: SitePatch) {
    super('project:site', 'Modifier le site');
  }
  validate(project: Project): CommandValidation {
    const errors: string[] = [];
    const north = this.patch.northAngleDeg;
    if (
      north !== undefined &&
      (!Number.isFinite(north) || north < 0 || north >= 360)
    )
      errors.push("L'orientation du nord doit être comprise entre 0 et 360°.");
    const altitude = this.patch.altitudeM;
    if (
      altitude !== undefined &&
      altitude !== null &&
      !Number.isFinite(altitude)
    )
      errors.push("L'altitude doit être un nombre fini.");
    const latitude = resolvedCoordinate(
      this.patch.latitudeDeg,
      project.site.location?.latitudeDeg,
    );
    const longitude = resolvedCoordinate(
      this.patch.longitudeDeg,
      project.site.location?.longitudeDeg,
    );
    if ((latitude === undefined) !== (longitude === undefined))
      errors.push(
        'Une localisation demande une latitude et une longitude : renseignez les deux ou aucune.',
      );
    if (latitude !== undefined && (latitude < -90 || latitude > 90))
      errors.push('La latitude doit être comprise entre -90 et 90°.');
    if (longitude !== undefined && (longitude < -180 || longitude > 180))
      errors.push('La longitude doit être comprise entre -180 et 180°.');
    return errors.length > 0 ? rejected(...errors) : ok();
  }
  protected apply(project: Project): Project {
    const latitudeDeg = resolvedCoordinate(
      this.patch.latitudeDeg,
      project.site.location?.latitudeDeg,
    );
    const longitudeDeg = resolvedCoordinate(
      this.patch.longitudeDeg,
      project.site.location?.longitudeDeg,
    );
    // The optional fields are dropped from the base and re-added only when
    // they resolve to a value: clearing one has to actually clear it.
    const {
      location: _previousLocation,
      altitudeM: _previousAltitude,
      climateProfileId: _previousClimate,
      ...rest
    } = project.site;
    const site: Site = {
      ...rest,
      ...(this.patch.northAngleDeg === undefined
        ? {}
        : { northAngleDeg: this.patch.northAngleDeg }),
      ...(latitudeDeg === undefined || longitudeDeg === undefined
        ? {}
        : { location: { latitudeDeg, longitudeDeg } }),
      ...altitudeEntry(project.site.altitudeM, this.patch.altitudeM),
      ...climateEntry(
        project.site.climateProfileId,
        this.patch.climateProfileId,
      ),
    };
    return { ...project, site };
  }
}

function resolvedCoordinate(
  patched: number | null | undefined,
  current: number | undefined,
): number | undefined {
  if (patched === null) return undefined;
  if (patched === undefined) return current;
  return Number.isFinite(patched) ? patched : undefined;
}

function altitudeEntry(
  current: number | undefined,
  patch: number | null | undefined,
) {
  const value = patch === null ? undefined : (patch ?? current);
  return value === undefined ? {} : { altitudeM: value };
}

function climateEntry(
  current: string | undefined,
  patch: string | null | undefined,
) {
  const value = patch === null || patch === '' ? undefined : (patch ?? current);
  return value === undefined ? {} : { climateProfileId: value };
}

export interface RegulatoryContextPatch {
  readonly country?: string;
  readonly region?: string | null;
  readonly projectType?: string | null;
  readonly referenceDate?: string | null;
}

export class UpdateRegulatoryContextCommand extends SettingsCommand {
  constructor(readonly patch: RegulatoryContextPatch) {
    super('project:regulatory', 'Modifier le contexte réglementaire');
  }
  validate(): CommandValidation {
    if (this.patch.country !== undefined && this.patch.country.trim() === '')
      return rejected('Le pays ne peut pas être vide.');
    const date = this.patch.referenceDate;
    if (
      date !== undefined &&
      date !== null &&
      date !== '' &&
      Number.isNaN(Date.parse(date))
    )
      return rejected('La date de référence doit être une date valide.');
    return ok();
  }
  protected apply(project: Project): Project {
    const current: RegulatoryContext = project.regulatoryContext ?? {
      country: 'FR',
      enabledRulePacks: [],
    };
    const next = patched<RegulatoryContext>(current, {
      region: this.patch.region,
      projectType: this.patch.projectType,
      referenceDate: this.patch.referenceDate,
      ...(this.patch.country === undefined
        ? {}
        : { country: this.patch.country }),
    });
    return { ...project, regulatoryContext: next };
  }
}

/**
 * Activates or deactivates the rule packs the project is checked against.
 *
 * The list is what the project claims to be assessed under. Nothing is added
 * implicitly: a project with an empty list is checked against no text, and the
 * interface says so rather than implying a default jurisdiction.
 */
export class SetEnabledRulePacksCommand extends SettingsCommand {
  constructor(readonly packIds: readonly string[]) {
    super('project:rule-packs', 'Modifier les référentiels activés');
  }
  validate(): CommandValidation {
    return this.packIds.some((id) => id.trim() === '')
      ? rejected('Un identifiant de référentiel ne peut pas être vide.')
      : new Set(this.packIds).size === this.packIds.length
        ? ok()
        : rejected('Un référentiel ne peut être activé qu’une fois.');
  }
  protected apply(project: Project): Project {
    const current: RegulatoryContext = project.regulatoryContext ?? {
      country: 'FR',
      enabledRulePacks: [],
    };
    return {
      ...project,
      regulatoryContext: { ...current, enabledRulePacks: [...this.packIds] },
    };
  }
}

/**
 * Writes one module's calculation settings.
 *
 * A setting the user clears is removed rather than stored as zero: the module
 * then reports the input as missing, which is the truth, instead of computing
 * with a number nobody chose.
 */
export class UpdateModuleSettingsCommand extends SettingsCommand {
  constructor(
    readonly moduleId: string,
    readonly moduleVersion: string,
    readonly methodId: string,
    readonly settings: Readonly<Record<string, JsonValue>>,
    readonly precisionTarget?: ModuleSettings['precisionTarget'],
  ) {
    super(
      `project:module-settings:${moduleId}`,
      'Modifier un réglage de calcul',
    );
  }
  validate(): CommandValidation {
    if (this.moduleId.trim() === '')
      return rejected("L'identifiant du module ne peut pas être vide.");
    return this.methodId.trim() === ''
      ? rejected('La méthode de calcul doit être nommée.')
      : ok();
  }
  protected apply(project: Project): Project {
    const entry: ModuleSettings = {
      moduleId: this.moduleId,
      moduleVersion: this.moduleVersion,
      methodId: this.methodId,
      settings: this.settings,
      ...(this.precisionTarget === undefined
        ? {}
        : { precisionTarget: this.precisionTarget }),
    };
    return {
      ...project,
      calculationSettings: {
        ...project.calculationSettings,
        [this.moduleId]: entry,
      },
    };
  }
}

/**
 * Draws the parcel the house sits on.
 *
 * The site already held a boundary and no screen could produce one: the
 * distances to the limits, the shading of a neighbour and where a building may
 * stand all rest on it, and all of them stopped there.
 */
export class SetParcelBoundaryCommand extends SettingsCommand {
  constructor(readonly outline: readonly Point2D[] | undefined) {
    super('project:site:parcel', 'Tracer la parcelle');
  }
  validate(): CommandValidation {
    if (this.outline === undefined) return ok();
    if (this.outline.length < 3)
      return rejected('Une parcelle demande au moins trois sommets.');
    return this.outline.every(
      ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
    )
      ? ok()
      : rejected('Les sommets de la parcelle doivent être mesurables.');
  }
  protected apply(project: Project): Project {
    const { parcelBoundary: _previous, ...site } = project.site;
    return {
      ...project,
      site:
        this.outline === undefined
          ? site
          : {
              ...site,
              parcelBoundary: {
                outer: this.outline.map((point) => ({ ...point })),
              },
            },
    };
  }
}

/** What placing something on the site asks for. */
export interface SiteObstacleDraft {
  readonly id: string;
  readonly outline: readonly Point2D[];
  readonly kind: SiteObstacleKind;
  readonly heightMm?: number;
  readonly name?: string;
}

export class AddSiteObstacleCommand extends SettingsCommand {
  constructor(readonly draft: SiteObstacleDraft) {
    super(`project:site:obstacle:${draft.id}`, 'Ajouter un obstacle de site');
  }
  validate(project: Project): CommandValidation {
    if ((project.site.obstacles ?? []).some(({ id }) => id === this.draft.id))
      return rejected(`L'obstacle ${this.draft.id} existe déjà.`);
    if (this.draft.outline.length < 3)
      return rejected('Un obstacle demande au moins trois sommets.');
    // The type says this cannot happen; the value may have been cast on its
    // way out of an interface, and a command must never write what the
    // persisted contract forbids.
    const kind: string = this.draft.kind;
    if (!isSiteObstacleKind(kind))
      return rejected(`Type d'obstacle inconnu : ${kind}.`);
    if (
      this.draft.heightMm !== undefined &&
      (!Number.isFinite(this.draft.heightMm) || this.draft.heightMm <= 0)
    )
      return rejected('La hauteur d’un obstacle doit être positive.');
    return this.draft.outline.every(
      ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
    )
      ? ok()
      : rejected('Les sommets d’un obstacle doivent être mesurables.');
  }
  protected apply(project: Project): Project {
    const obstacle: SiteObstacle = {
      id: entityId(this.draft.id),
      boundary: { outer: this.draft.outline.map((point) => ({ ...point })) },
      kind: this.draft.kind,
      ...(this.draft.heightMm === undefined
        ? {}
        : { heightMm: this.draft.heightMm }),
      ...(this.draft.name === undefined || this.draft.name.trim() === ''
        ? {}
        : { name: this.draft.name }),
    };
    return {
      ...project,
      site: {
        ...project.site,
        obstacles: [...(project.site.obstacles ?? []), obstacle],
      },
    };
  }
}

/** What an obstacle already on the site may have changed. */
export interface SiteObstaclePatch {
  readonly outline?: readonly Point2D[];
  readonly kind?: SiteObstacleKind;
  readonly heightMm?: number | null;
  readonly name?: string | null;
}

/**
 * Changes an obstacle that already stands on the site.
 *
 * A tree could be planted and pulled up, and nothing in between: moving it,
 * turning it or renaming it meant deleting it and drawing it again, which lost
 * everything the plan pointed at it with.
 */
export class UpdateSiteObstacleCommand extends SettingsCommand {
  constructor(
    readonly obstacleId: string,
    readonly patch: SiteObstaclePatch,
  ) {
    super(
      `project:site:obstacle:update:${obstacleId}`,
      'Modifier un obstacle de site',
    );
  }
  private patched(obstacle: SiteObstacle): SiteObstacle {
    const { heightMm: _height, name: _name, ...rest } = obstacle;
    const heightMm =
      this.patch.heightMm === undefined
        ? obstacle.heightMm
        : (this.patch.heightMm ?? undefined);
    const name =
      this.patch.name === undefined
        ? obstacle.name
        : (this.patch.name ?? undefined);
    return {
      ...rest,
      ...(this.patch.outline === undefined
        ? {}
        : {
            boundary: {
              outer: this.patch.outline.map((point) => ({ ...point })),
            },
          }),
      ...(this.patch.kind === undefined ? {} : { kind: this.patch.kind }),
      ...(heightMm === undefined ? {} : { heightMm }),
      ...(name === undefined || name.trim() === '' ? {} : { name }),
    };
  }
  validate(project: Project): CommandValidation {
    const obstacle = (project.site.obstacles ?? []).find(
      ({ id }) => id === this.obstacleId,
    );
    if (obstacle === undefined)
      return rejected(`L'obstacle ${this.obstacleId} est introuvable.`);
    if (this.patch.outline !== undefined) {
      if (this.patch.outline.length < 3)
        return rejected('Un obstacle demande au moins trois sommets.');
      if (
        !this.patch.outline.every(
          ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
        )
      )
        return rejected('Les sommets d’un obstacle doivent être mesurables.');
    }
    const kind: string | undefined = this.patch.kind;
    if (kind !== undefined && !isSiteObstacleKind(kind))
      return rejected(`Type d'obstacle inconnu : ${kind}.`);
    if (
      typeof this.patch.heightMm === 'number' &&
      (!Number.isFinite(this.patch.heightMm) || this.patch.heightMm <= 0)
    )
      return rejected('La hauteur d’un obstacle doit être positive.');
    return ok();
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      site: {
        ...project.site,
        obstacles: (project.site.obstacles ?? []).map((obstacle) =>
          obstacle.id === this.obstacleId ? this.patched(obstacle) : obstacle,
        ),
      },
    };
  }
}

export class RemoveSiteObstacleCommand extends SettingsCommand {
  constructor(readonly obstacleId: string) {
    super(
      `project:site:obstacle:remove:${obstacleId}`,
      'Supprimer un obstacle de site',
    );
  }
  validate(project: Project): CommandValidation {
    return (project.site.obstacles ?? []).some(
      ({ id }) => id === this.obstacleId,
    )
      ? ok()
      : rejected(`L'obstacle ${this.obstacleId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return {
      ...project,
      site: {
        ...project.site,
        obstacles: (project.site.obstacles ?? []).filter(
          ({ id }) => id !== this.obstacleId,
        ),
      },
    };
  }
}
