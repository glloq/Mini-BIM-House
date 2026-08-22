/**
 * The stack of storeys, as a stack.
 *
 * « Nombre de niveaux + une hauteur + une case sous-sol » cannot describe two
 * basements, a mezzanine, a half-level, converted attics or a plant room — and
 * a house with any of those had to be entered wrong and corrected afterwards,
 * which is worse than not being asked.
 *
 * The list runs from the bottom up. Elevations are derived from it and never
 * typed: a storey's height is a fact about that storey, and where it sits
 * follows from what is underneath.
 */
import {
  LEVEL_DRAFT_KIND_LABELS,
  type LevelDraftKind,
  type NewProjectLevelDraft,
} from '../ux/new-project-draft.js';

/** What each kind of storey is worth in height when it is created. */
export const DEFAULT_HEIGHT_MM: Readonly<Record<LevelDraftKind, number>> = {
  BASEMENT: 2300,
  GROUND: 2500,
  STOREY: 2500,
  MEZZANINE: 1300,
  ATTIC: 2200,
  TECHNICAL: 2000,
};

/** How many storeys one stack may hold before the page stops being a page. */
export const MAX_LEVELS = 20;

export const DEFAULT_LEVEL_STACK: readonly NewProjectLevelDraft[] = [
  {
    id: 'ground',
    name: LEVEL_DRAFT_KIND_LABELS.GROUND,
    kind: 'GROUND',
    heightMm: DEFAULT_HEIGHT_MM.GROUND,
  },
];

/** Whether this kind sits below the ground floor. */
export function isBelowGround(kind: LevelDraftKind): boolean {
  return kind === 'BASEMENT';
}

export interface StackedLevel {
  readonly level: NewProjectLevelDraft;
  readonly elevationMm: number;
}

/**
 * Where each storey sits, read from the stack.
 *
 * The ground floor is the origin — a house is measured from the ground it is
 * entered by. Everything above adds the height of what is under it; everything
 * below subtracts its own.
 */
export function stackedLevels(
  stack: readonly NewProjectLevelDraft[],
): readonly StackedLevel[] {
  const groundIndex = stack.findIndex(({ kind }) => !isBelowGround(kind));
  // A stack that is all basement has no ground to measure from; the lowest
  // storey becomes the origin rather than the whole house going negative.
  const origin = groundIndex === -1 ? 0 : groundIndex;
  const placed: StackedLevel[] = [];
  let elevationMm = 0;
  for (let index = origin; index < stack.length; index += 1) {
    const level = stack[index]!;
    placed.push({ level, elevationMm });
    elevationMm += level.heightMm;
  }
  elevationMm = 0;
  for (let index = origin - 1; index >= 0; index -= 1) {
    const level = stack[index]!;
    elevationMm -= level.heightMm;
    placed.unshift({ level, elevationMm });
  }
  return placed;
}

/** A name that says what this storey is, without repeating one already used. */
export function nextLevelName(
  stack: readonly NewProjectLevelDraft[],
  kind: LevelDraftKind,
): string {
  const base = LEVEL_DRAFT_KIND_LABELS[kind];
  const taken = new Set(stack.map(({ name }) => name));
  if (!taken.has(base)) return base;
  for (let index = 2; index <= MAX_LEVELS + 1; index += 1) {
    const candidate = `${base} ${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

function nextLevelId(stack: readonly NewProjectLevelDraft[]): string {
  const taken = new Set(stack.map(({ id }) => id));
  for (let index = 1; index <= MAX_LEVELS + 1; index += 1) {
    const candidate = `level-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `level-${stack.length + 1}`;
}

/**
 * Adds a storey where that kind belongs.
 *
 * A basement goes to the bottom, everything else to the top: nobody adds a
 * basement above the roof, and having to drag it there would be the interface
 * asking the person to correct a choice it made for them.
 */
export function addLevel(
  stack: readonly NewProjectLevelDraft[],
  kind: LevelDraftKind,
): readonly NewProjectLevelDraft[] {
  if (stack.length >= MAX_LEVELS) return stack;
  const level: NewProjectLevelDraft = {
    id: nextLevelId(stack),
    name: nextLevelName(stack, kind),
    kind,
    heightMm: DEFAULT_HEIGHT_MM[kind],
  };
  return isBelowGround(kind) ? [level, ...stack] : [...stack, level];
}

export function removeLevel(
  stack: readonly NewProjectLevelDraft[],
  id: string,
): readonly NewProjectLevelDraft[] {
  // A building with no storeys is not a smaller building.
  if (stack.length <= 1) return stack;
  return stack.filter((level) => level.id !== id);
}

export function moveLevel(
  stack: readonly NewProjectLevelDraft[],
  id: string,
  direction: -1 | 1,
): readonly NewProjectLevelDraft[] {
  const index = stack.findIndex((level) => level.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= stack.length) return stack;
  const moved = [...stack];
  const [level] = moved.splice(index, 1);
  moved.splice(target, 0, level!);
  return moved;
}

export function updateLevel(
  stack: readonly NewProjectLevelDraft[],
  id: string,
  patch: Partial<Omit<NewProjectLevelDraft, 'id'>>,
): readonly NewProjectLevelDraft[] {
  return stack.map((level) =>
    level.id === id ? { ...level, ...patch } : level,
  );
}

/** Why this stack cannot become a building, if it cannot. */
export function levelStackIssues(
  stack: readonly NewProjectLevelDraft[],
): readonly string[] {
  const issues: string[] = [];
  if (stack.length === 0) issues.push('Un bâtiment compte au moins un niveau.');
  if (stack.length > MAX_LEVELS)
    issues.push(
      `Cette page crée au plus ${MAX_LEVELS} niveaux ; les suivants s’ajoutent depuis « Niveaux et pièces ».`,
    );
  const names = new Set<string>();
  for (const level of stack) {
    if (level.name.trim() === '') issues.push('Un niveau a besoin d’un nom.');
    else if (names.has(level.name))
      issues.push(`Deux niveaux s’appellent « ${level.name} ».`);
    names.add(level.name);
    if (!(level.heightMm > 0))
      issues.push(
        `La hauteur de « ${level.name} » doit être supérieure à zéro.`,
      );
  }
  return issues;
}
