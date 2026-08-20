import type { Project } from '@house-technical-designer/core-domain';

/**
 * One thing the palette can do, whatever kind of thing it is.
 *
 * A tool, a workspace, a level, a command and an object of the project are
 * different in every other part of the application and identical here: a line
 * the user reads, and something that happens when they choose it.
 */
export interface PaletteEntry {
  readonly id: string;
  readonly label: string;
  /** Which family the line belongs to, shown beside it. */
  readonly group: string;
  /** A shortcut, a level name, whatever tells two similar lines apart. */
  readonly hint?: string;
  readonly run: () => void;
}

/** Text stripped of what should not decide whether a word matches. */
function folded(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * How well an entry answers what was typed.
 *
 * Lower is better. A label starting with the query is what the user meant far
 * more often than one merely containing it somewhere, and a word starting with
 * it comes in between — typing "mur" should offer the wall tool before the
 * south wall of the ground floor.
 */
function rank(entry: PaletteEntry, query: string): number | undefined {
  const label = folded(entry.label);
  const hint = folded(entry.hint ?? '');
  const needle = folded(query);
  if (needle === '') return 2;
  if (label.startsWith(needle)) return 0;
  if (label.split(/[\s:·—-]+/u).some((word) => word.startsWith(needle)))
    return 1;
  if (label.includes(needle)) return 2;
  if (hint.includes(needle)) return 3;
  // The identifier is the last resort: it is how the model names an object, and
  // sometimes what the user has in front of them.
  if (folded(entry.id).includes(needle)) return 4;
  return undefined;
}

/** The entries answering a query, best first, cut to what a list can show. */
export function filterEntries(
  entries: readonly PaletteEntry[],
  query: string,
  limit = 12,
): readonly PaletteEntry[] {
  return entries
    .map((entry) => ({ entry, score: rank(entry, query) }))
    .filter(
      (scored): scored is { entry: PaletteEntry; score: number } =>
        scored.score !== undefined,
    )
    .sort((first, second) => first.score - second.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

/** What the palette can name in the project itself. */
export interface ObjectEntrySource {
  readonly project: Project;
  readonly levelId?: string;
  /** How an object is described, so the palette shows what the inspector would. */
  readonly describe: (objectId: string) => string;
  readonly select: (objectId: string) => void;
}

/**
 * The objects the palette can take the user to.
 *
 * Only the storey being drawn is offered. Naming an object of another level
 * would select something the plan is not showing, and the whole project would
 * have to be walked on every keystroke.
 */
export function objectEntries(
  source: ObjectEntrySource,
): readonly PaletteEntry[] {
  const levels = source.project.building.levels;
  const level =
    source.levelId === undefined
      ? levels[0]
      : levels.find(({ id }) => id === source.levelId);
  if (level === undefined) return [];
  const ids = [
    ...level.walls.map(({ id }) => id as string),
    ...level.openings.map(({ id }) => id as string),
    ...level.spaces.map(({ id }) => id as string),
    ...level.slabs.map(({ id }) => id as string),
    ...level.roofs.map(({ id }) => id as string),
  ];
  return ids.map((objectId) => ({
    id: objectId,
    label: source.describe(objectId),
    group: 'Objets',
    hint: level.name,
    run: () => source.select(objectId),
  }));
}
