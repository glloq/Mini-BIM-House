/**
 * Les sous-parties, dépliables, dans la colonne — et ce qu'elles posent.
 *
 * Elles étaient une rangée de boutons au-dessus du plan, et ce qu'elles
 * posaient était un panneau séparé à gauche : deux endroits pour une seule
 * idée, avec les mêmes boutons répétés dans les deux. On cliquait « Murs » en
 * haut, on lisait « Ajouter · Murs » à gauche, et le même « Mur » se trouvait
 * aux deux places — l'un des deux étant toujours celui qu'on n'avait pas visé.
 *
 * Une seule liste, à gauche, où l'ouverte montre ce qu'elle sait poser. C'est
 * la forme d'un sommaire : on voit les parties, on ouvre celle qu'on travaille,
 * et ce qu'on y trouve est ce qu'on y met.
 *
 * ## Une seule ouverte
 *
 * Ouvrir une sous-partie ferme la précédente, parce que l'espace le dit :
 * `navigation.sections` retient laquelle, et le dépliage n'est que son reflet.
 * Rien n'est mémorisé ici — replier tout n'aurait aucun sens, il faut bien
 * travailler quelque part.
 *
 * ## Aucune liste n'est écrite ici
 *
 * `toolboxFor` répond, comme pour la rangée d'outils. Une seconde liste des
 * mêmes boutons serait une seconde liste à corriger.
 *
 * Voir `docs/UX_ARCHITECTURE_V4.md` §2.
 */
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';

import { EntryButton } from '../editor/EntryButton.js';
import type { EditorState } from '../editor/editor-state.js';
import type { ToolDrafts } from '../editor/tool-options.js';
import {
  availabilityOf,
  isEntryActive,
  toolboxFor,
  type ToolboxEntry,
  type ToolboxSection,
} from '../editor/toolbox.js';
import { networksOfDomain } from '../systems/discipline-scope.js';
import type { CreationStageId } from '../ux/creation-stages.js';
import type { DesignState } from '../ux/design-state.js';

export interface SectionListProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  /** La sous-partie ouverte ; les autres sont repliées. */
  readonly section?: string;
  readonly design: DesignState;
  readonly editor: EditorState;
  readonly drafts: ToolDrafts;
  readonly onChooseEntry: (entry: ToolboxEntry) => void;
  readonly onOpenSection: (section: {
    readonly id: string;
    readonly domain?: DesignDomainId;
  }) => void;
  /**
   * Le reste du métier, quand la sous-partie pose des équipements.
   *
   * Une sous-partie nomme trois à huit choses ; la nomenclature en tient
   * quarante par métier. Le bouton n'est pas une entrée de plus — il ne pose
   * rien par lui-même — c'est la porte vers celles qu'on n'a pas nommées.
   */
  readonly onBrowseFamilies: (section: {
    readonly label: string;
    readonly domain?: DesignDomainId;
  }) => void;
}

/**
 * Les recommandées d'abord, les inertes en dernier.
 *
 * L'ordre du registre est celui d'un chantier ; celui de l'écran est celui de
 * ce qui reste à faire.
 */
function ordered(section: ToolboxSection, design: DesignState) {
  const graded = section.entries.map((entry) => availabilityOf(entry, design));
  return [
    ...graded.filter(({ recommended }) => recommended),
    ...graded.filter(({ recommended, enabled }) => !recommended && enabled),
    ...graded.filter(({ enabled }) => !enabled),
  ];
}

export function SectionList({
  project,
  stage,
  section,
  design,
  editor,
  drafts,
  onChooseEntry,
  onOpenSection,
  onBrowseFamilies,
}: SectionListProps) {
  const sections = toolboxFor(project, stage, undefined, design);
  if (sections.length === 0) return null;
  // Une seule sous-partie n'a rien à choisir : elle s'ouvre sans son sommaire.
  const only = sections.length === 1 ? sections[0] : undefined;
  const open = sections.some(({ id }) => id === section)
    ? section
    : sections[0]?.id;

  /*
   * Une sous-partie qui pose des équipements en pose bien plus qu'elle n'en
   * nomme : c'est la seule à qui la porte de la nomenclature veut dire
   * quelque chose. Un mur ne se choisit pas dans un catalogue d'appareils.
   */
  const equips = (held: ToolboxSection) =>
    held.entries.some(({ toolId }) => toolId === 'COMPONENT');

  const entries = (held: ToolboxSection) => (
    <>
      <div className="add-grid">
        {ordered(held, design).map((available) => (
          <EntryButton
            key={available.entry.id}
            available={available}
            active={isEntryActive(
              project,
              available.entry,
              editor.activeTool,
              drafts,
            )}
            onChoose={onChooseEntry}
          />
        ))}
      </div>
      {equips(held) && (
        <button
          type="button"
          className="section-more"
          title={`Tout ce que la nomenclature tient en ${held.label.toLowerCase()}`}
          onClick={() =>
            onBrowseFamilies({
              label: held.label,
              ...(held.domain === undefined ? {} : { domain: held.domain }),
            })
          }
        >
          Autre…
        </button>
      )}
    </>
  );

  if (only !== undefined)
    return (
      <nav className="section-list" aria-label="Sous-parties">
        <p className="context-group-label">{only.label}</p>
        {entries(only)}
      </nav>
    );

  return (
    <nav className="section-list" aria-label="Sous-parties">
      {sections.map((held) => (
        <details
          key={held.id}
          className="section-fold"
          open={held.id === open}
          onToggle={(event) => {
            if (!event.currentTarget.open) return;
            onOpenSection({
              id: held.id,
              ...(held.domain === undefined ? {} : { domain: held.domain }),
            });
          }}
        >
          <summary
            // Le nom accessible est celui de la sous-partie, et rien d'autre :
            // le compte qui la suit changerait son nom quand le projet change,
            // et plus rien ne la trouverait.
            aria-label={held.label}
            aria-current={held.id === open ? 'true' : undefined}
            title={`${held.label} — ${held.entries.length} outil${
              held.entries.length > 1 ? 's' : ''
            }${
              held.domain === undefined
                ? ''
                : `, ${networksOfDomain(project, held.domain)} réseau(x) tracé(s)`
            }`}
          >
            {held.label}
            {/*
             * Ce que ce métier a déjà de tracé — et non le nombre d'outils :
             * « rien à voir » et « rien de tracé » sont deux réponses
             * différentes, et c'est la seconde qu'on cherche.
             *
             * Hors du nom accessible : sans cela « Eau » s'appelle « Eau 2 »
             * et change de nom quand le projet change.
             */}
            {held.domain !== undefined &&
              networksOfDomain(project, held.domain) > 0 && (
                <span className="section-count" aria-hidden="true">
                  {networksOfDomain(project, held.domain)}
                </span>
              )}
          </summary>
          {entries(held)}
        </details>
      ))}
    </nav>
  );
}
