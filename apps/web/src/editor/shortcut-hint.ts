import { SHORTCUTS, shortcutLabel } from './shortcuts.js';

/**
 * Le raccourci d'un outil, écrit entre parenthèses.
 *
 * Une ligne dans son propre fichier parce qu'un module qui exporte un
 * composant n'exporte que des composants — sans quoi le rechargement à chaud
 * remplace le module entier à chaque frappe.
 */
export function shortcut(commandId: string | undefined): string {
  if (commandId === undefined) return '';
  const binding = SHORTCUTS.find(({ id }) => id === commandId);
  return binding === undefined ? '' : ` (${shortcutLabel(binding)})`;
}
