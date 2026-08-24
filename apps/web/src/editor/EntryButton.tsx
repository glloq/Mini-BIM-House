/**
 * Une entrée de la boîte à outils, telle qu'on la voit.
 *
 * Sortie du header parce que deux endroits la montrent désormais : la rangée
 * contre le plan, où l'on prend vite, et le panneau de gauche, où l'on
 * parcourt. Une seule façon de dessiner une entrée, un seul endroit où la
 * corriger — c'est la même règle que pour les listes elles-mêmes.
 */
import { shortcut } from './shortcut-hint.js';
import { ToolIcon } from './tool-icons.js';
import { toolById } from './tool-registry.js';
import {
  unblockingEntry,
  type ToolboxAvailability,
  type ToolboxEntry,
} from './toolbox.js';

/**
 * Une entrée, et ce qu'elle vaut devant cette maison-là.
 *
 * Une entrée qui ne sert pas encore dit **pourquoi**, écrit sous son nom : un
 * bouton grisé en silence est une panne, et la personne le prend pour un
 * défaut du programme plutôt que pour une étape qui lui manque.
 *
 * Quand la condition se règle avec un outil, la tuile *est* le geste qui
 * débloque : cliquer « Porte » sans mur tracé prend l'outil Mur. Elle n'est
 * donc pas désactivée — un bouton qu'on annonce inerte et qui agit ment à qui
 * l'écoute — seulement marquée et expliquée. C'est là où rien ne débloque
 * — un étage se pose dans le menu du projet — que le bouton est vraiment
 * `disabled`, et il garde sa raison.
 */
export function EntryButton({
  available,
  active,
  onChoose,
}: {
  readonly available: ToolboxAvailability;
  readonly active: boolean;
  readonly onChoose: (entry: ToolboxEntry) => void;
}) {
  const { entry, enabled, recommended, requirement } = available;
  const tool = toolById(entry.toolId);
  const unblock = enabled ? undefined : unblockingEntry(requirement);
  const classes = ['toolbox-entry'];
  if (active) classes.push('active');
  if (recommended) classes.push('recommended');
  if (!enabled) classes.push('blocked');
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={active}
      {...(requirement === undefined
        ? {}
        : { 'aria-description': requirement.reason })}
      {...(unblock === undefined ? { disabled: !enabled } : {})}
      title={
        requirement === undefined
          ? `${entry.hint}${shortcut(tool?.shortcutId)}`
          : unblock === undefined
            ? `${entry.label} — ${requirement.reason}`
            : `${entry.label} — ${requirement.reason} Cliquez pour prendre « ${unblock.label} ».`
      }
      onClick={() => onChoose(unblock ?? entry)}
    >
      <ToolIcon icon={entry.icon} />
      <span>{entry.label}</span>
      {recommended && (
        <span className="entry-flag" aria-hidden="true">
          ●
        </span>
      )}
      {requirement !== undefined && (
        // Hors du nom accessible : « Porte » doit rester « Porte » pour qui
        // la cherche. La raison passe par `aria-description`, juste au-dessus.
        <span className="entry-reason" aria-hidden="true">
          {requirement.reason}
        </span>
      )}
    </button>
  );
}
