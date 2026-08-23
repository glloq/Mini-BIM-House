/**
 * Les parties de la partie, sur une rangée, sous les sept espaces.
 *
 * Un espace est une partie de la maison ; une sous-partie est ce qu'on y fait.
 * Bâtiment tient les murs, les ouvertures, les pièces et l'ossature ; Systèmes
 * tient douze spécialités. Les montrer toutes en même temps rendait la colonne
 * de gauche illisible — quatre titres et quarante boutons dépliés — alors
 * qu'on n'en travaille qu'une à la fois.
 *
 * Dans Systèmes, choisir une sous-partie **est** choisir un métier : la rangée
 * et le sélecteur de discipline disent la même chose, et `activeSectionId` les
 * fait dériver d'une seule décision plutôt que de les synchroniser.
 *
 * Les sous-parties viennent de la boîte à outils, pas du registre des espaces :
 * ce sont celles que ce projet-là peut vraiment servir. Un espace qui n'en a
 * qu'une n'affiche pas de rangée — une rangée à un bouton ne choisit rien.
 *
 * Voir `docs/UX_ARCHITECTURE_V4.md` §2.
 */
import type { DesignDomainId } from '@house-technical-designer/core-domain';

export interface SectionChoice {
  readonly id: string;
  readonly label: string;
  readonly domain?: DesignDomainId;
  /** Combien d'outils elle met sous la main. */
  readonly toolCount: number;
}

export interface SectionBarProps {
  /** L'espace où l'on est, pour dire « BÂTIMENT › MURS » d'un seul regard. */
  readonly stageLabel: string;
  readonly sections: readonly SectionChoice[];
  readonly activeId?: string;
  readonly onSelect: (section: SectionChoice) => void;
}

export function SectionBar({
  stageLabel,
  sections,
  activeId,
  onSelect,
}: SectionBarProps) {
  if (sections.length < 2) return null;
  return (
    <nav className="section-bar" aria-label="Sous-parties">
      <span className="section-place">{stageLabel}</span>
      {sections.map((section) => {
        const current = section.id === activeId;
        return (
          <button
            key={section.id}
            type="button"
            className={current ? 'section-entry active' : 'section-entry'}
            aria-current={current ? 'true' : undefined}
            title={`${section.label} — ${section.toolCount} outil${
              section.toolCount > 1 ? 's' : ''
            }`}
            onClick={() => onSelect(section)}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
