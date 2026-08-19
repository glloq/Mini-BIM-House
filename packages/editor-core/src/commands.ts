import type { Assembly } from '@house-technical-designer/assemblies';
import type { Opening, Wall } from '@house-technical-designer/core-domain';
import type { Dimension } from './dimension.js';

export interface EditorProjectState {
  readonly walls: readonly Wall[];
  readonly assemblies: readonly Assembly[];
  readonly openings: readonly Opening[];
  readonly dimensions: readonly Dimension[];
}
export interface ChangeSet {
  readonly objectIds: readonly string[];
  readonly domains: readonly string[];
  readonly paths?: readonly string[];
}
export type CommandValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly string[] };
export interface CommandExecution {
  readonly nextState: EditorProjectState;
  readonly inverse: EditorCommand;
  readonly changes: ChangeSet;
}
export interface EditorCommand {
  readonly id: string;
  readonly label: string;
  validate(state: EditorProjectState): CommandValidation;
  execute(state: EditorProjectState): CommandExecution;
}
export type DispatchResult =
  | { readonly status: 'APPLIED'; readonly changes: ChangeSet }
  | { readonly status: 'REJECTED'; readonly errors: readonly string[] }
  | { readonly status: 'EMPTY_HISTORY' };
interface HistoryEntry {
  readonly command: EditorCommand;
  readonly inverse: EditorCommand;
}

export class CommandDispatcher {
  readonly #historyLimit: number;
  #state: EditorProjectState;
  #undo: HistoryEntry[] = [];
  #redo: HistoryEntry[] = [];
  constructor(initialState: EditorProjectState, historyLimit = 100) {
    if (!Number.isInteger(historyLimit) || historyLimit < 1)
      throw new RangeError('History limit must be a positive integer.');
    this.#state = initialState;
    this.#historyLimit = historyLimit;
  }
  get state(): EditorProjectState {
    return this.#state;
  }
  dispatch(command: EditorCommand): DispatchResult {
    const validation = command.validate(this.#state);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    const execution = command.execute(this.#state);
    this.#state = execution.nextState;
    this.#undo.push({ command, inverse: execution.inverse });
    if (this.#undo.length > this.#historyLimit) this.#undo.shift();
    this.#redo = [];
    return { status: 'APPLIED', changes: execution.changes };
  }
  undo(): DispatchResult {
    const entry = this.#undo.at(-1);
    if (entry === undefined) return { status: 'EMPTY_HISTORY' };
    const validation = entry.inverse.validate(this.#state);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    const execution = entry.inverse.execute(this.#state);
    this.#undo.pop();
    this.#state = execution.nextState;
    this.#redo.push(entry);
    return { status: 'APPLIED', changes: execution.changes };
  }
  redo(): DispatchResult {
    const entry = this.#redo.at(-1);
    if (entry === undefined) return { status: 'EMPTY_HISTORY' };
    const validation = entry.command.validate(this.#state);
    if (!validation.valid)
      return { status: 'REJECTED', errors: validation.errors };
    const execution = entry.command.execute(this.#state);
    this.#redo.pop();
    this.#state = execution.nextState;
    this.#undo.push({ command: entry.command, inverse: execution.inverse });
    return { status: 'APPLIED', changes: execution.changes };
  }
}

export class TransactionCommand implements EditorCommand {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly commands: readonly EditorCommand[],
  ) {}
  validate(state: EditorProjectState): CommandValidation {
    let current = state;
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
  execute(state: EditorProjectState): CommandExecution {
    let current = state;
    const inverses: EditorCommand[] = [];
    const changes: ChangeSet[] = [];
    for (const command of this.commands) {
      const execution = command.execute(current);
      current = execution.nextState;
      inverses.unshift(execution.inverse);
      changes.push(execution.changes);
    }
    return {
      nextState: current,
      inverse: new TransactionCommand(
        `${this.id}:inverse`,
        `Undo ${this.label}`,
        inverses,
      ),
      changes: mergeChangeSets(changes),
    };
  }
}

function mergeChangeSets(changes: readonly ChangeSet[]): ChangeSet {
  return {
    objectIds: [...new Set(changes.flatMap(({ objectIds }) => objectIds))],
    domains: [...new Set(changes.flatMap(({ domains }) => domains))],
    paths: [...new Set(changes.flatMap(({ paths }) => paths ?? []))],
  };
}
