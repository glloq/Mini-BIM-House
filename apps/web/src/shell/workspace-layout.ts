/**
 * How wide the panel is, and whether it is shown at all.
 *
 * A drawing application is used on whatever screen the person has, and the
 * useful width of the plan is what is left once the panels have taken theirs.
 * Deciding that once and finding the same arrangement the next day is the
 * difference between a workspace and a page.
 *
 * This is a preference of the person, not a fact of the project: it is kept in
 * the browser and never travels with the file.
 *
 * **Il n'y a plus qu'un panneau, et il est à gauche.** La coque tenait deux
 * colonnes de part et d'autre du dessin : les outils à gauche, les propriétés
 * de la sélection à droite. Deux colonnes veulent dire deux largeurs à régler,
 * deux bords à tirer, et surtout un plan qui rétrécissait de 294 px — panneau,
 * bord et gouttière — chaque fois qu'on désignait un objet, c'est-à-dire à
 * chaque geste. La droite est désormais au plan, toujours ; ce que
 * l'inspecteur montrait est descendu dans la colonne de gauche, qui le montre
 * à la place des outils. Voir `column-mode.ts` pour la bascule.
 */
export interface WorkspaceLayout {
  readonly sidebarPx: number;
  readonly sidebarShown: boolean;
}

export const LAYOUT_KEY = 'house-technical-designer:layout';

/** What a panel may be narrowed or widened to, in pixels. */
export const MINIMUM_PANEL_PX = 180;
export const MAXIMUM_PANEL_PX = 520;

export const DEFAULT_LAYOUT: WorkspaceLayout = {
  sidebarPx: 220,
  sidebarShown: true,
};

/** A width the grid can actually use, whatever it was asked for. */
export function boundedWidth(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_LAYOUT.sidebarPx;
  return Math.min(MAXIMUM_PANEL_PX, Math.max(MINIMUM_PANEL_PX, Math.round(px)));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * The layout a stored value describes.
 *
 * Anything unreadable — another version, a hand-edited entry, a half-written
 * record — falls back to the default rather than leaving the application with
 * a panel of NaN pixels.
 */
export function parseLayout(stored: string | null): WorkspaceLayout {
  if (stored === null) return DEFAULT_LAYOUT;
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return DEFAULT_LAYOUT;
  }
  if (typeof value !== 'object' || value === null) return DEFAULT_LAYOUT;
  const record = value as Record<string, unknown>;
  // Un enregistrement d'avant la colonne unique porte encore `inspectorPx` et
  // `inspectorShown` : ils décrivent une colonne qui n'existe plus, et les
  // ignorer vaut mieux que de refuser la largeur que la personne avait réglée.
  return {
    sidebarPx: boundedWidth(
      typeof record.sidebarPx === 'number'
        ? record.sidebarPx
        : DEFAULT_LAYOUT.sidebarPx,
    ),
    sidebarShown: readBoolean(record.sidebarShown, true),
  };
}

/** How wide the edge between two panels is, in pixels. */
export const SEPARATOR_PX = 6;

/**
 * The columns the workspace grid is built from.
 *
 * Trois pistes, toujours : la colonne, son bord, le dessin. Le bord garde sa
 * place même quand la colonne est repliée, pour que la remontrer ne renumérote
 * pas les colonnes sous le dessin.
 *
 * Les deux pistes de droite ont disparu avec l'inspecteur, et pas seulement
 * leurs 286 px : une piste de zéro pixel garde sa gouttière, et la grille en
 * dépensait deux — seize pixels de dessin payés pour deux colonnes vides.
 */
export function gridColumns(layout: WorkspaceLayout): string {
  const sidebar = layout.sidebarShown ? `${layout.sidebarPx}px` : '0px';
  const edge = layout.sidebarShown ? `${SEPARATOR_PX}px` : '0px';
  return `${sidebar} ${edge} minmax(0, 1fr)`;
}

/** Reads the layout this browser remembers, if it remembers one. */
export function loadLayout(storage: Storage | undefined): WorkspaceLayout {
  if (storage === undefined) return DEFAULT_LAYOUT;
  try {
    return parseLayout(storage.getItem(LAYOUT_KEY));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/** Keeps the layout for the next session; a refusal is not worth reporting. */
export function saveLayout(
  storage: Storage | undefined,
  layout: WorkspaceLayout,
): void {
  if (storage === undefined) return;
  try {
    storage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // A private window or a full quota costs the preference, nothing else.
  }
}
