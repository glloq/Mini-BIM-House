import type { Project } from '@house-technical-designer/core-domain';
import {
  isDimension,
  nextRevision,
} from '@house-technical-designer/core-domain';
import type {
  ChangeSet,
  CommandValidation,
  DispatchResult,
  EditorCommand,
  EditorProjectState,
} from './commands.js';

export interface ProjectCommandExecution {
  readonly nextState: Project;
  readonly inverse: ProjectCommand;
  readonly changes: ChangeSet;
}
export interface ProjectCommand {
  readonly id: string;
  readonly label: string;
  validate(project: Project): CommandValidation;
  execute(project: Project): ProjectCommandExecution;
}
interface HistoryEntry {
  readonly command: ProjectCommand;
  readonly inverse: ProjectCommand;
}

/**
 * Command dispatcher whose only persisted state is the canonical Project.
 *
 * Every applied command — including an undo or a redo — stamps a new revision
 * and a new `updatedAt`. The revision is a monotonic edit identifier held by the
 * dispatcher, not a name for a state: undoing an edit does not put back the
 * revision the project had before it, because the project has been edited
 * again. That is what lets a scenario recorded against revision 4 report a
 * mismatch after an undo instead of silently matching a project that is no
 * longer the one it was measured on.
 */
export class ProjectCommandDispatcher {
  #project: Project;
  #revision: string | undefined;
  #undo: HistoryEntry[] = [];
  #redo: HistoryEntry[] = [];
  readonly #now: () => string;
  constructor(
    project: Project,
    readonly historyLimit = 100,
    now: () => string = () => new Date().toISOString(),
  ) {
    if (!Number.isInteger(historyLimit) || historyLimit < 1)
      throw new RangeError('History limit must be a positive integer.');
    this.#project = project;
    this.#revision = project.metadata.projectRevision;
    this.#now = now;
  }
  /**
   * Runs one command against a project already stamped with the revision the
   * command is about to produce.
   *
   * Stamping first is what lets a command record its own revision — a scenario
   * is measured against the project as the command leaves it, not as it found
   * it. The stamp is written again afterwards so the revision holds whatever
   * the command returned, without counting the edit twice.
   */
  #apply(command: ProjectCommand): ProjectCommandExecution {
    const revision = nextRevision(this.#revision);
    const now = this.#now();
    const execution = command.execute(stamped(this.#project, revision, now));
    this.#revision = revision;
    this.#project = stamped(execution.nextState, revision, now);
    return execution;
  }
  get project(): Project {
    return this.#project;
  }
  /**
   * Ce qu'une commande toucherait, sans l'appliquer.
   *
   * Une politique d'édition a besoin de savoir sur quoi une commande va
   * écrire **avant** qu'elle écrive. Rien ne le déclare : `ChangeSet` est un
   * résultat, pas une intention, et il n'existe qu'une fois la commande
   * exécutée.
   *
   * Le faire dire à chaque commande — un champ `touches` — aurait été moins
   * cher et beaucoup moins sûr : une commande ajoutée demain sans ce champ
   * serait un trou silencieux dans la règle, et c'est précisément la classe de
   * trou qu'on est en train de fermer. Un essai à blanc est juste pour toutes
   * les commandes, celles qui existent et celles qui n'existent pas encore.
   *
   * Il est possible parce qu'`execute` est pure : elle rend un `nextState` et
   * ne touche pas au projet qu'on lui donne. Le prix est une exécution de plus
   * par geste, sur un objet en mémoire.
   */
  preview(command: ProjectCommand): DispatchResult {
    const validation = command.validate(this.#project);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    return {
      status: 'APPLIED',
      changes: command.execute(this.#project).changes,
    };
  }
  dispatch(command: ProjectCommand): DispatchResult {
    const validation = command.validate(this.#project);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    const execution = this.#apply(command);
    this.#undo.push({ command, inverse: execution.inverse });
    if (this.#undo.length > this.historyLimit) this.#undo.shift();
    this.#redo = [];
    return { status: 'APPLIED', changes: execution.changes };
  }
  undo(): DispatchResult {
    return this.applyHistory(this.#undo, this.#redo, true);
  }
  redo(): DispatchResult {
    return this.applyHistory(this.#redo, this.#undo, false);
  }
  private applyHistory(
    source: HistoryEntry[],
    destination: HistoryEntry[],
    inverse: boolean,
  ): DispatchResult {
    const entry = source.at(-1);
    if (entry === undefined) return { status: 'EMPTY_HISTORY' };
    const command = inverse ? entry.inverse : entry.command;
    const validation = command.validate(this.#project);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    source.pop();
    destination.push(entry);
    const execution = this.#apply(command);
    return { status: 'APPLIED', changes: execution.changes };
  }
}

function stamped(project: Project, revision: string, now: string): Project {
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: now,
      projectRevision: revision,
    },
  };
}

/**
 * Exact immutable replacement command suitable for building and network slices.
 *
 * A replacement may be given a check on what it produces. Replacing the whole
 * project — promoting a scenario, for one — must not be a way to put a state
 * into the editor that the file format would refuse to write: the caller
 * supplies the check, because it owns the definition of a valid project.
 */
export class ReplaceProjectCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly replace: (project: Project) => Project,
    readonly changes: ChangeSet,
    readonly rejectsResult?: (project: Project) => readonly string[],
  ) {}
  validate(project: Project): CommandValidation {
    if (this.rejectsResult === undefined) return { valid: true };
    const errors = this.rejectsResult(this.replace(project));
    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }
  execute(project: Project): ProjectCommandExecution {
    return {
      nextState: this.replace(project),
      changes: this.changes,
      inverse: new ReplaceProjectCommand(
        `${this.id}:inverse`,
        `Undo ${this.label}`,
        () => project,
        this.changes,
      ),
    };
  }
}

export const ASSEMBLY_INVALIDATION_DOMAINS = [
  'quantities',
  'thermal',
  'heating',
  'energy',
  'cost',
  'environmental',
  'drawing-overlays',
] as const;

/** Patches existing wall/opening tool commands back into the canonical Project. */
/**
 * Several project edits applied as one.
 *
 * Changing the assembly of twelve selected walls is one decision, and has to be
 * one entry in the history: undoing it puts back twelve walls, not the last
 * one. A refusal anywhere refuses the whole thing, so the project is never left
 * with half a change applied.
 */
export class ProjectTransactionCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly commands: readonly ProjectCommand[],
  ) {}
  validate(project: Project): CommandValidation {
    let current = project;
    for (const command of this.commands) {
      const validation = command.validate(current);
      if (!validation.valid)
        return {
          valid: false,
          errors: validation.errors.map((error) => `${command.id}: ${error}`),
        };
      current = command.execute(current).nextState;
    }
    return { valid: true };
  }
  execute(project: Project): ProjectCommandExecution {
    let current = project;
    const inverses: ProjectCommand[] = [];
    const changes: ChangeSet[] = [];
    for (const command of this.commands) {
      const execution = command.execute(current);
      current = execution.nextState;
      // Undoing runs them backwards: the last change made is the first undone.
      inverses.unshift(execution.inverse);
      changes.push(execution.changes);
    }
    return {
      nextState: current,
      inverse: new ProjectTransactionCommand(
        `${this.id}:inverse`,
        `Undo ${this.label}`,
        inverses,
      ),
      changes: {
        objectIds: [...new Set(changes.flatMap(({ objectIds }) => objectIds))],
        domains: [...new Set(changes.flatMap(({ domains }) => domains))],
        paths: [...new Set(changes.flatMap(({ paths }) => paths ?? []))],
      },
    };
  }
}

export class ProjectEditorCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly levelId: string,
    readonly command: EditorCommand,
  ) {}
  validate(project: Project): CommandValidation {
    const state = this.extract(project);
    return state === undefined
      ? { valid: false, errors: [`Unknown level ${this.levelId}.`] }
      : this.command.validate(state);
  }
  execute(project: Project): ProjectCommandExecution {
    const state = this.extract(project);
    if (state === undefined)
      throw new RangeError(`Unknown level ${this.levelId}.`);
    const execution = this.command.execute(state);
    const levels = project.building.levels.map((level) =>
      level.id === this.levelId
        ? {
            ...level,
            walls: execution.nextState.walls,
            openings: execution.nextState.openings,
            // Dimensions are level annotations, so an edit that adds or drops
            // one has to land back in the project rather than in a field the
            // command carried along.
            annotations: [
              ...level.annotations.filter((entry) => !isDimension(entry)),
              ...execution.nextState.dimensions,
            ],
          }
        : level,
    );
    return {
      nextState: {
        ...project,
        assemblies: execution.nextState.assemblies,
        building: { ...project.building, levels },
      },
      inverse: new ProjectEditorCommand(
        `${this.id}:inverse`,
        `Undo ${this.label}`,
        this.levelId,
        execution.inverse,
      ),
      changes: execution.changes,
    };
  }
  private extract(project: Project): EditorProjectState | undefined {
    const level = project.building.levels.find(({ id }) => id === this.levelId);
    return level === undefined
      ? undefined
      : {
          walls: level.walls,
          openings: level.openings,
          assemblies: project.assemblies ?? [],
          dimensions: level.annotations.filter(isDimension),
        };
  }
}
