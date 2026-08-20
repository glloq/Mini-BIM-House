import type {
  Project,
  Zone,
  ZoneType,
} from '@house-technical-designer/core-domain';
import { entityId, isZoneType } from '@house-technical-designer/core-domain';
import type { ChangeSet, CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

/**
 * A zone groups rooms for one purpose: a heated volume, a ventilation group, a
 * fire compartment. It carries no geometry of its own, so an edit invalidates
 * the modules that read groups rather than the drawing.
 */
const ZONE_DOMAINS = [
  'thermal',
  'ventilation',
  'iaq',
  'acoustics',
  'lighting',
  'quantities',
] as const;

function changes(id: string): ChangeSet {
  return { objectIds: [id], domains: [...ZONE_DOMAINS] };
}

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

export function projectZones(project: Project): readonly Zone[] {
  return project.building.zones;
}

/** Every room the project holds, whichever level it is on. */
export function projectSpaceIds(project: Project): readonly string[] {
  return project.building.levels.flatMap(({ spaces }) =>
    spaces.map(({ id }) => id as string),
  );
}

function withZones(project: Project, zones: readonly Zone[]): Project {
  return { ...project, building: { ...project.building, zones } };
}

abstract class ZoneCommand implements ProjectCommand {
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
      inverse: new RestoreZonesCommand(
        `${this.id}:inverse`,
        `Annuler ${this.label}`,
        projectZones(project),
      ),
    };
  }
}

/** Restores a previous set of zones; the inverse of a zone edit. */
export class RestoreZonesCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly previous: readonly Zone[],
  ) {}
  validate(): CommandValidation {
    return ok();
  }
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: withZones(project, this.previous),
      changes: changes(this.id),
      inverse: new RestoreZonesCommand(
        `${this.id}:inverse`,
        `Rétablir ${this.label}`,
        projectZones(project),
      ),
    };
  }
}

export interface ZoneDraft {
  readonly id: string;
  readonly name: string;
  readonly type: ZoneType;
}

export class AddZoneCommand extends ZoneCommand {
  constructor(readonly draft: ZoneDraft) {
    super(`zone:add:${draft.id}`, `Ajouter la zone ${draft.name}`);
  }
  validate(project: Project): CommandValidation {
    if (this.draft.name.trim() === '')
      return rejected('Une zone demande un nom.');
    if (!isZoneType(this.draft.type))
      return rejected(`Type de zone inconnu : ${String(this.draft.type)}.`);
    return projectZones(project).some(({ id }) => id === this.draft.id)
      ? rejected(`La zone ${this.draft.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return withZones(project, [
      ...projectZones(project),
      {
        id: entityId<'Zone'>(this.draft.id),
        type: this.draft.type,
        name: this.draft.name,
        spaceIds: [],
        properties: {},
      },
    ]);
  }
}

export interface ZonePatch {
  readonly name?: string;
  readonly type?: ZoneType;
}

export class UpdateZoneCommand extends ZoneCommand {
  constructor(
    readonly zoneId: string,
    readonly patch: ZonePatch,
  ) {
    super(`zone:update:${zoneId}`, 'Modifier une zone');
  }
  validate(project: Project): CommandValidation {
    if (!projectZones(project).some(({ id }) => id === this.zoneId))
      return rejected(`La zone ${this.zoneId} est introuvable.`);
    if (this.patch.name !== undefined && this.patch.name.trim() === '')
      return rejected('Une zone demande un nom.');
    if (this.patch.type !== undefined && !isZoneType(this.patch.type))
      return rejected(`Type de zone inconnu : ${String(this.patch.type)}.`);
    return ok();
  }
  protected apply(project: Project): Project {
    return withZones(
      project,
      projectZones(project).map((zone) =>
        zone.id === this.zoneId ? { ...zone, ...this.patch } : zone,
      ),
    );
  }
}

/**
 * Puts a room in a zone, or takes it out.
 *
 * A zone naming a room the project does not hold would keep that room from
 * being deleted while pointing at nothing, so the membership is checked here.
 */
export class SetZoneMembershipCommand extends ZoneCommand {
  constructor(
    readonly zoneId: string,
    readonly spaceId: string,
    readonly member: boolean,
  ) {
    super(
      `zone:membership:${zoneId}:${spaceId}`,
      member ? 'Ajouter une pièce à une zone' : 'Retirer une pièce d’une zone',
    );
  }
  validate(project: Project): CommandValidation {
    if (!projectZones(project).some(({ id }) => id === this.zoneId))
      return rejected(`La zone ${this.zoneId} est introuvable.`);
    return this.member && !projectSpaceIds(project).includes(this.spaceId)
      ? rejected(`La pièce ${this.spaceId} est introuvable.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return withZones(
      project,
      projectZones(project).map((zone) => {
        if (zone.id !== this.zoneId) return zone;
        const without = zone.spaceIds.filter(
          (id) => (id as string) !== this.spaceId,
        );
        return {
          ...zone,
          spaceIds: this.member
            ? [...without, entityId<'Space'>(this.spaceId)]
            : without,
        };
      }),
    );
  }
}

export class RemoveZoneCommand extends ZoneCommand {
  constructor(readonly zoneId: string) {
    super(`zone:remove:${zoneId}`, 'Supprimer une zone');
  }
  validate(project: Project): CommandValidation {
    return projectZones(project).some(({ id }) => id === this.zoneId)
      ? ok()
      : rejected(`La zone ${this.zoneId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return withZones(
      project,
      projectZones(project).filter(({ id }) => id !== this.zoneId),
    );
  }
}
