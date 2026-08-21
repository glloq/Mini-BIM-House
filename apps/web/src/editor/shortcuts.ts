/**
 * Central keyboard shortcut registry.
 *
 * Every binding lives here rather than in the components that react to it, so
 * the set can be listed, documented and checked for conflicts in one place.
 */
export type ShortcutCommandId =
  | 'tool.select'
  | 'tool.wall'
  | 'tool.wallRun'
  | 'tool.wallRectangle'
  | 'tool.opening'
  | 'tool.space'
  | 'tool.slab'
  | 'tool.slabHole'
  | 'tool.dimension'
  | 'tool.network'
  | 'tool.split'
  | 'tool.rotate'
  | 'tool.mirror'
  | 'tool.offset'
  | 'tool.join'
  | 'tool.trim'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.delete'
  | 'edit.cancel'
  | 'edit.finish'
  | 'edit.duplicate'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.rotate'
  | 'edit.mirror'
  | 'file.save'
  | 'view.zoomFit'
  | 'view.zoomSelection'
  | 'view.reset'
  | 'palette.open';

export interface ShortcutBinding {
  readonly id: ShortcutCommandId;
  readonly label: string;
  /** Physical key, matched against KeyboardEvent.key, case-insensitively. */
  readonly key: string;
  readonly ctrlOrMeta?: boolean;
  readonly shift?: boolean;
  readonly group: 'Outils' | 'Édition' | 'Vue' | 'Fichier';
}

export const SHORTCUTS: readonly ShortcutBinding[] = [
  { id: 'tool.select', label: 'Sélection', key: 'Escape', group: 'Outils' },
  { id: 'tool.wall', label: 'Mur', key: 'w', group: 'Outils' },
  { id: 'tool.wallRun', label: 'Mur continu', key: 'c', group: 'Outils' },
  {
    id: 'tool.wallRectangle',
    label: 'Murs rectangle',
    key: 'w',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.opening', label: 'Ouverture', key: 'o', group: 'Outils' },
  { id: 'tool.space', label: 'Pièce', key: 'i', group: 'Outils' },
  { id: 'tool.slab', label: 'Dalle', key: 'l', group: 'Outils' },
  {
    id: 'tool.slabHole',
    label: 'Trémie',
    key: 'l',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.dimension', label: 'Cotation', key: 'd', group: 'Outils' },
  { id: 'tool.network', label: 'Réseau', key: 'r', group: 'Outils' },
  { id: 'tool.split', label: 'Scinder un mur', key: 'x', group: 'Outils' },
  { id: 'tool.rotate', label: 'Pivoter', key: 'p', group: 'Outils' },
  { id: 'tool.mirror', label: 'Miroir', key: 'm', group: 'Outils' },
  { id: 'tool.offset', label: 'Décaler', key: 'e', group: 'Outils' },
  { id: 'tool.join', label: 'Joindre', key: 'j', group: 'Outils' },
  { id: 'tool.trim', label: 'Ajuster', key: 't', group: 'Outils' },
  {
    id: 'edit.undo',
    label: 'Annuler',
    key: 'z',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.redo',
    label: 'Rétablir',
    key: 'z',
    ctrlOrMeta: true,
    shift: true,
    group: 'Édition',
  },
  { id: 'edit.delete', label: 'Supprimer', key: 'Delete', group: 'Édition' },
  {
    id: 'edit.finish',
    label: 'Terminer le tracé',
    key: 'Enter',
    group: 'Édition',
  },
  {
    id: 'edit.duplicate',
    label: 'Dupliquer la sélection',
    key: 'd',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.copy',
    label: 'Copier la sélection',
    key: 'c',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.paste',
    label: 'Coller sur le niveau affiché',
    key: 'v',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.rotate',
    label: 'Pivoter la sélection d’un quart de tour',
    key: 'r',
    shift: true,
    group: 'Édition',
  },
  {
    id: 'edit.mirror',
    label: 'Retourner la sélection de gauche à droite',
    key: 'm',
    shift: true,
    group: 'Édition',
  },
  {
    id: 'edit.cancel',
    label: 'Annuler l’action',
    key: 'Escape',
    group: 'Édition',
  },
  {
    id: 'file.save',
    label: 'Enregistrer',
    key: 's',
    ctrlOrMeta: true,
    group: 'Fichier',
  },
  { id: 'view.zoomFit', label: 'Zoom étendu', key: 'f', group: 'Vue' },
  {
    id: 'view.zoomSelection',
    label: 'Zoom sélection',
    key: 'f',
    shift: true,
    group: 'Vue',
  },
  { id: 'view.reset', label: 'Réinitialiser la vue', key: '0', group: 'Vue' },
  {
    id: 'palette.open',
    label: 'Palette de commandes',
    key: 'k',
    ctrlOrMeta: true,
    group: 'Édition',
  },
];

export interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

function matches(binding: ShortcutBinding, event: KeyEventLike): boolean {
  if (event.altKey) return false;
  if (binding.key.toLowerCase() !== event.key.toLowerCase()) return false;
  const ctrlOrMeta = event.ctrlKey || event.metaKey;
  if ((binding.ctrlOrMeta ?? false) !== ctrlOrMeta) return false;
  return (binding.shift ?? false) === event.shiftKey;
}

/**
 * Resolves a key event to a command.
 *
 * More specific bindings win: `Ctrl+Shift+Z` never resolves to `Ctrl+Z`, and a
 * bare `Escape` cancels the action in progress before it changes tool.
 */
export function resolveShortcut(
  event: KeyEventLike,
): ShortcutCommandId | undefined {
  const candidates = SHORTCUTS.filter((binding) => matches(binding, event));
  if (candidates.length === 0) return undefined;
  const shifted = candidates.find(({ shift }) => shift === true);
  if (shifted !== undefined) return shifted.id;
  return candidates[0]!.id;
}

/** Human-readable form of a binding, for menus and the help panel. */
export function shortcutLabel(binding: ShortcutBinding): string {
  const parts: string[] = [];
  if (binding.ctrlOrMeta === true) parts.push('Ctrl');
  if (binding.shift === true) parts.push('Maj');
  parts.push(
    binding.key === 'Escape'
      ? 'Échap'
      : binding.key === 'Delete'
        ? 'Suppr'
        : binding.key.toUpperCase(),
  );
  return parts.join(' + ');
}

/**
 * A keystroke typed inside a form control belongs to that control, except for
 * the application-wide chords that keep working everywhere.
 */
export function shouldIgnoreTarget(
  tagName: string | undefined,
  event: KeyEventLike,
): boolean {
  const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName ?? '');
  if (!editable) return false;
  return !(event.ctrlKey || event.metaKey);
}
