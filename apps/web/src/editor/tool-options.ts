import type { Project } from '@house-technical-designer/core-domain';

/** One choice a tool option offers, as the user reads it. */
export interface ToolOptionChoice {
  readonly value: string;
  readonly label: string;
}

/**
 * What an option can look at to answer.
 *
 * An option often depends on the project — the assemblies it holds, the
 * networks it carries — and sometimes on another option of the same tool: the
 * kinds of node one can place depend on the discipline of the network chosen
 * just beside.
 */
export interface ToolOptionContext {
  readonly project: Project;
  readonly value: (key: string) => string;
}

/**
 * One thing a tool lets the user decide before drawing.
 *
 * The toolbar used to hold a panel per tool, written by hand: the wall's
 * assembly and role, the opening's type and dimensions, the dimension's kind,
 * the network and the node. Every new tool meant another panel, and an editor
 * meant to cover stairs, columns, furniture, ducts and annotations would have
 * ended as a wall of controls nobody arranged.
 *
 * A tool now declares what it asks; the toolbar renders whatever is declared
 * and knows nothing about walls or ducts.
 */
export interface ToolOptionDefinition {
  readonly key: string;
  /**
   * Whether this choice belongs to the tool or to the whole plan.
   *
   * The network being worked on is not a property of one tool: placing a node
   * and routing a run must speak of the same one, and so must the Networks
   * workspace. An option declared shared is stored under its own name, so
   * every tool asking for it reads and writes the same value.
   */
  readonly scope?: 'SHARED';
  readonly kind: 'SELECT' | 'NUMBER' | 'TEXT';
  readonly label: string;
  readonly unit?: string;
  readonly min?: number;
  readonly step?: number;
  readonly hint?: string;
  /** The choices this option offers in this project. */
  readonly choices?: (
    context: ToolOptionContext,
  ) => readonly ToolOptionChoice[];
  /**
   * What the option means when the user has not chosen.
   *
   * It is computed from the project rather than fixed: the first assembly of
   * this project, the first network it carries. A default written into the code
   * would be a value nobody chose, pointing at something that may not exist.
   */
  readonly fallback: (context: ToolOptionContext) => string;
}

/** What the user has typed or chosen, by tool and by option. */
export type ToolDrafts = Readonly<Record<string, string>>;

/**
 * The key one option is stored under.
 *
 * Prefixed by the tool, so two tools never share a value by accident; bare
 * when the option is shared on purpose.
 */
export function draftKey(
  toolId: string,
  optionKey: string,
  shared = false,
): string {
  return shared ? optionKey : `${toolId}.${optionKey}`;
}

/** The key an option of this tool is stored under, scope included. */
export function storageKeyOf(
  toolId: string,
  option: ToolOptionDefinition,
): string {
  return draftKey(toolId, option.key, option.scope === 'SHARED');
}

/**
 * The value an option holds right now.
 *
 * A stored value that no longer exists in this project — an assembly that was
 * deleted, a network that was renamed — is not used: the option falls back to
 * what the project can actually offer, rather than drawing with a reference
 * pointing nowhere.
 */
export function optionValue(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
  key: string,
): string {
  const definition = options.find((option) => option.key === key);
  if (definition === undefined) return '';
  const context: ToolOptionContext = {
    project,
    value: (other) =>
      other === key
        ? (drafts[storageKeyOf(toolId, definition)] ?? '')
        : optionValue(project, toolId, options, drafts, other),
  };
  const held = drafts[storageKeyOf(toolId, definition)];
  if (held === undefined || held === '') return definition.fallback(context);
  if (definition.choices === undefined) return held;
  return definition.choices(context).some(({ value }) => value === held)
    ? held
    : definition.fallback(context);
}

/** The same, read as a number, or nothing when it is not one. */
export function optionNumber(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
  key: string,
): number | undefined {
  const raw = optionValue(project, toolId, options, drafts, key).replace(
    ',',
    '.',
  );
  const parsed = Number(raw);
  return raw.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
}
