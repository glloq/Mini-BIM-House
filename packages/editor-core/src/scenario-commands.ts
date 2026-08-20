import type {
  Project,
  Scenario,
  ScenarioOverride,
} from '@house-technical-designer/core-domain';
import { resolveProjectPath } from '@house-technical-designer/core-domain';
import type { ChangeSet, CommandValidation } from './commands.js';
import type {
  ProjectCommand,
  ProjectCommandExecution,
} from './project-commands.js';

/** A scenario changes what the modules read, so it invalidates all of them. */
const SCENARIO_DOMAINS = ['scenarios', 'calculations'] as const;

function changes(id: string): ChangeSet {
  return { objectIds: [id], domains: [...SCENARIO_DOMAINS] };
}

function ok(): CommandValidation {
  return { valid: true };
}

function rejected(...errors: readonly string[]): CommandValidation {
  return { valid: false, errors: [...errors] };
}

export function projectScenarios(project: Project): readonly Scenario[] {
  return project.scenarios ?? [];
}

function withScenarios(
  project: Project,
  scenarios: readonly Scenario[],
): Project {
  return { ...project, scenarios };
}

function mapScenario(
  project: Project,
  scenarioId: string,
  transform: (scenario: Scenario) => Scenario,
): Project {
  return withScenarios(
    project,
    projectScenarios(project).map((scenario) =>
      scenario.id === scenarioId ? transform(scenario) : scenario,
    ),
  );
}

abstract class ScenarioCommand implements ProjectCommand {
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
      inverse: new RestoreScenariosCommand(
        `${this.id}:inverse`,
        `Annuler ${this.label}`,
        projectScenarios(project),
      ),
    };
  }
}

/** Restores a previous set of scenarios; the inverse of a scenario edit. */
export class RestoreScenariosCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly previous: readonly Scenario[],
  ) {}
  validate(): CommandValidation {
    return ok();
  }
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: withScenarios(project, this.previous),
      changes: changes(this.id),
      inverse: new RestoreScenariosCommand(
        `${this.id}:inverse`,
        `Rétablir ${this.label}`,
        projectScenarios(project),
      ),
    };
  }
}

export class AddScenarioCommand extends ScenarioCommand {
  constructor(readonly scenario: Scenario) {
    super(
      `scenario:add:${scenario.id}`,
      `Ajouter le scénario ${scenario.name}`,
    );
  }
  validate(project: Project): CommandValidation {
    if (this.scenario.name.trim() === '')
      return rejected('Un scénario demande un nom.');
    return projectScenarios(project).some(({ id }) => id === this.scenario.id)
      ? rejected(`Le scénario ${this.scenario.id} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    return withScenarios(project, [
      ...projectScenarios(project),
      {
        ...structuredClone(this.scenario),
        // A scenario is measured against a version of the project, and the
        // version it starts from is the one this very command produces. The
        // caller does not have to guess it, and cannot get it wrong.
        baseProjectRevision: project.metadata.projectRevision ?? '',
      },
    ]);
  }
}

/**
 * Records a scenario against the project's current revision.
 *
 * A mismatch says the scenario was written for another version of the project;
 * only the user knows whether it still means what it meant. Rebasing is that
 * decision, made explicitly, rather than a warning that quietly disappears.
 */
export class RebaseScenarioCommand extends ScenarioCommand {
  constructor(readonly scenarioId: string) {
    super(
      `scenario:rebase:${scenarioId}`,
      'Rattacher un scénario à la révision actuelle',
    );
  }
  validate(project: Project): CommandValidation {
    return projectScenarios(project).some(({ id }) => id === this.scenarioId)
      ? ok()
      : rejected(`Le scénario ${this.scenarioId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return mapScenario(project, this.scenarioId, (scenario) => ({
      ...scenario,
      baseProjectRevision: project.metadata.projectRevision ?? '',
    }));
  }
}

export class RenameScenarioCommand extends ScenarioCommand {
  constructor(
    readonly scenarioId: string,
    readonly name: string,
  ) {
    super(`scenario:rename:${scenarioId}`, 'Renommer un scénario');
  }
  validate(project: Project): CommandValidation {
    if (this.name.trim() === '') return rejected('Un scénario demande un nom.');
    return projectScenarios(project).some(({ id }) => id === this.scenarioId)
      ? ok()
      : rejected(`Le scénario ${this.scenarioId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return mapScenario(project, this.scenarioId, (scenario) => ({
      ...scenario,
      name: this.name,
    }));
  }
}

export class RemoveScenarioCommand extends ScenarioCommand {
  constructor(readonly scenarioId: string) {
    super(`scenario:remove:${scenarioId}`, 'Supprimer un scénario');
  }
  validate(project: Project): CommandValidation {
    return projectScenarios(project).some(({ id }) => id === this.scenarioId)
      ? ok()
      : rejected(`Le scénario ${this.scenarioId} est introuvable.`);
  }
  protected apply(project: Project): Project {
    return withScenarios(
      project,
      projectScenarios(project).filter(({ id }) => id !== this.scenarioId),
    );
  }
}

export class DuplicateScenarioCommand extends ScenarioCommand {
  constructor(
    readonly scenarioId: string,
    readonly newId: string,
    readonly newName: string,
  ) {
    super(`scenario:duplicate:${scenarioId}`, 'Dupliquer un scénario');
  }
  validate(project: Project): CommandValidation {
    const scenarios = projectScenarios(project);
    if (!scenarios.some(({ id }) => id === this.scenarioId))
      return rejected(`Le scénario ${this.scenarioId} est introuvable.`);
    return scenarios.some(({ id }) => id === this.newId)
      ? rejected(`Le scénario ${this.newId} existe déjà.`)
      : ok();
  }
  protected apply(project: Project): Project {
    const source = projectScenarios(project).find(
      ({ id }) => id === this.scenarioId,
    )!;
    return withScenarios(project, [
      ...projectScenarios(project),
      {
        ...structuredClone(source),
        id: this.newId,
        name: this.newName,
        baseProjectRevision: project.metadata.projectRevision ?? '',
      },
    ]);
  }
}

/**
 * Adds one change to a scenario.
 *
 * The path has to name something the project already declares: a scenario
 * varies what exists, it does not invent nodes the base project never had.
 */
export class AddScenarioOverrideCommand extends ScenarioCommand {
  constructor(
    readonly scenarioId: string,
    readonly override: ScenarioOverride,
  ) {
    super(
      `scenario:override:add:${scenarioId}:${override.path}`,
      'Ajouter un changement au scénario',
    );
  }
  validate(project: Project): CommandValidation {
    const scenario = projectScenarios(project).find(
      ({ id }) => id === this.scenarioId,
    );
    if (scenario === undefined)
      return rejected(`Le scénario ${this.scenarioId} est introuvable.`);
    if (this.override.path.trim() === '')
      return rejected('Un changement doit nommer ce qu’il modifie.');
    if (
      this.override.operation !== 'REMOVE' &&
      this.override.value === undefined
    )
      return rejected('Un changement doit porter une valeur.');
    if (resolve(project, this.override.path) === undefined)
      return rejected(
        `Le projet ne déclare rien à « ${this.override.path} » : un scénario ne fait varier que ce qui existe.`,
      );
    return scenario.overrides.some(({ path }) => path === this.override.path)
      ? rejected('Ce scénario modifie déjà cette valeur.')
      : ok();
  }
  protected apply(project: Project): Project {
    return mapScenario(project, this.scenarioId, (scenario) => ({
      ...scenario,
      overrides: [...scenario.overrides, structuredClone(this.override)],
    }));
  }
}

export class RemoveScenarioOverrideCommand extends ScenarioCommand {
  constructor(
    readonly scenarioId: string,
    readonly path: string,
  ) {
    super(
      `scenario:override:remove:${scenarioId}:${path}`,
      'Retirer un changement du scénario',
    );
  }
  validate(project: Project): CommandValidation {
    const scenario = projectScenarios(project).find(
      ({ id }) => id === this.scenarioId,
    );
    if (scenario === undefined)
      return rejected(`Le scénario ${this.scenarioId} est introuvable.`);
    return scenario.overrides.some(({ path }) => path === this.path)
      ? ok()
      : rejected('Ce changement n’existe pas dans ce scénario.');
  }
  protected apply(project: Project): Project {
    return mapScenario(project, this.scenarioId, (scenario) => ({
      ...scenario,
      overrides: scenario.overrides.filter(({ path }) => path !== this.path),
    }));
  }
}

/**
 * The value a `/`-separated path names in the project, or nothing.
 *
 * It is what tells a scenario editor the value it is about to replace, and
 * what lets a change be refused when it names something that does not exist.
 */
export function resolve(project: Project, path: string): unknown {
  return resolveProjectPath(project, path);
}
