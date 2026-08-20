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

/** Exact immutable replacement command suitable for building and network slices. */
export class ReplaceProjectCommand implements ProjectCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly replace: (project: Project) => Project,
    readonly changes: ChangeSet,
  ) {}
  validate(): CommandValidation {
    return { valid: true };
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
