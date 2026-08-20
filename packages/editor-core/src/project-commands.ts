import type { Project } from '@house-technical-designer/core-domain';
import { isDimension } from '@house-technical-designer/core-domain';
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

/** Command dispatcher whose only persisted state is the canonical Project. */
export class ProjectCommandDispatcher {
  #project: Project;
  #undo: HistoryEntry[] = [];
  #redo: HistoryEntry[] = [];
  constructor(
    project: Project,
    readonly historyLimit = 100,
  ) {
    if (!Number.isInteger(historyLimit) || historyLimit < 1)
      throw new RangeError('History limit must be a positive integer.');
    this.#project = project;
  }
  get project(): Project {
    return this.#project;
  }
  dispatch(command: ProjectCommand): DispatchResult {
    const validation = command.validate(this.#project);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    const execution = command.execute(this.#project);
    this.#project = execution.nextState;
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
    const execution = command.execute(this.#project);
    source.pop();
    destination.push(entry);
    this.#project = execution.nextState;
    return { status: 'APPLIED', changes: execution.changes };
  }
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
