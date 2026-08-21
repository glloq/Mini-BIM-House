import type { Project } from '@house-technical-designer/core-domain';
import { listedFamilies } from '../editor/object-editors.js';

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
 * Every family, not the five that happened to be written down here: the walls,
 * the openings, the rooms, the slabs and the roof planes were listed, and the
 * stairs, the roofs, the posts, the placed things, the pipes and the ground
 * were not. An object nobody can find by name is an object that only exists if
 * it is already on the screen.
 *
 * A storey's objects are those of the storey being drawn — naming one from
 * another floor would select something the plan is not showing. What belongs to
 * the project rather than to a floor — the networks, the parcel — is offered
 * whatever plan is open, because that is where it lives.
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
  return listedFamilies(source.project, level.id).flatMap((family) =>
    family.objects.map(({ objectId, label }) => ({
      id: objectId,
      // What the inspector would say, so the palette and the panel name the
      // same object the same way.
      label: source.describe(objectId) || label,
      group: 'Objets',
      hint:
        family.scope === 'PROJECT'
          ? family.label
          : `${family.label} · ${level.name}`,
      run: () => source.select(objectId),
    })),
  );
}
