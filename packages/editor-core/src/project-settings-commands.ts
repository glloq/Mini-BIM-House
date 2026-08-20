import type {
  JsonValue,
  ModuleSettings,
  Project,
  ProjectMetadata,
  RegulatoryContext,
  Site,
} from '@house-technical-designer/core-domain';
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
