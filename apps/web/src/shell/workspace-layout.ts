/**
 * How wide the panels are, and whether they are shown at all.
 *
 * A drawing application is used on whatever screen the person has, and the
 * useful width of the plan is what is left once the panels have taken theirs.
 * Deciding that once and finding the same arrangement the next day is the
 * difference between a workspace and a page.
 *
 * This is a preference of the person, not a fact of the project: it is kept in
 * the browser and never travels with the file.
 */
export interface WorkspaceLayout {
  readonly sidebarPx: number;
  readonly inspectorPx: number;
  readonly sidebarShown: boolean;
  /**
   * L'épingle de l'inspecteur, et non sa présence.
   *
   * Le panneau paraît de lui-même quand on désigne quelque chose. Ce drapeau
   * dit qu'on veut le garder ouvert même sans rien de désigné — pour lire les
   * propriétés de la vue. Il part fermé : au repos, la largeur est au dessin.
   */
  readonly inspectorShown: boolean;
}

export const LAYOUT_KEY = 'house-technical-designer:layout';

/** What a panel may be narrowed or widened to, in pixels. */
export const MINIMUM_PANEL_PX = 180;
export const MAXIMUM_PANEL_PX = 520;

export const DEFAULT_LAYOUT: WorkspaceLayout = {
  sidebarPx: 220,
  inspectorPx: 280,
  sidebarShown: true,
  inspectorShown: false,
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
  return {
    sidebarPx: boundedWidth(
      typeof record.sidebarPx === 'number'
        ? record.sidebarPx
        : DEFAULT_LAYOUT.sidebarPx,
    ),
    inspectorPx: boundedWidth(
      typeof record.inspectorPx === 'number'
        ? record.inspectorPx
        : DEFAULT_LAYOUT.inspectorPx,
    ),
    sidebarShown: readBoolean(record.sidebarShown, true),
    inspectorShown: readBoolean(record.inspectorShown, false),
  };
}

/** How wide the edge between two panels is, in pixels. */
export const SEPARATOR_PX = 6;

/**
 * The columns the workspace grid is built from.
 *
 * Five tracks, always: the two edges keep their place even when the panel
 * beside them is hidden, so that showing it again does not renumber the
 * columns under the drawing.
 */
export function gridColumns(layout: WorkspaceLayout): string {
  const sidebar = layout.sidebarShown ? `${layout.sidebarPx}px` : '0px';
  const inspector = layout.inspectorShown ? `${layout.inspectorPx}px` : '0px';
  const left = layout.sidebarShown ? `${SEPARATOR_PX}px` : '0px';
  const right = layout.inspectorShown ? `${SEPARATOR_PX}px` : '0px';
  return `${sidebar} ${left} minmax(0, 1fr) ${right} ${inspector}`;
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
