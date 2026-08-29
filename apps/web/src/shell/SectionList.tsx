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
 * ## Une seule ouverte, et ce que ça coûte
 *
 * Ouvrir une sous-partie ferme la précédente, parce que l'espace le dit :
 * `navigation.sections` retient laquelle, et le dépliage n'est que son reflet.
 * Rien n'est mémorisé ici — replier tout n'aurait aucun sens, il faut bien
 * travailler quelque part.
 *
 * Ça se paie, et le prix est mesuré : l'enchaînement le plus ordinaire du
 * dessin — un mur, une porte dans ce mur, un autre mur — coûte onze gestes,
 * dont un pour rouvrir « Murs » que l'ouverture d'« Ouvertures » avait
 * refermé. Dix suffiraient si les replis restaient ouverts.
 *
 * Essayé, mesuré, défait. Laisser plusieurs replis ouverts fait paraître
 * ensemble des entrées qui portent le même nom dans des sous-parties
 * différentes : deux boutons « Tracer un tronçon » — l'un pour une
 * canalisation, l'autre pour un circuit — et autant de « Autre… ». À l'œil on
 * les départage par le titre sous lequel ils sont rangés ; pour qui écoute la
 * page, ce sont deux boutons identiques. Un geste gagné contre un écran
 * ambigu n'est pas un bon échange, et lever l'ambiguïté demanderait de
 * renommer les entrées de toute la boîte — un autre chantier, qu'on n'ouvre
 * pas pour un geste.
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
  isEntryActive,
  sectionFamilyDomains,
  toolboxFor,
  type ToolboxEntry,
  type ToolboxSection,
} from '../editor/toolbox.js';
import { networksOfDomain } from '../systems/discipline-scope.js';
import type { CreationStageId } from '../ux/creation-stages.js';
import { ordered } from './toolbox-order.js';
import type { DesignState } from '../ux/design-state.js';
import type { UiTarget } from '../ux/ui-target.js';

export interface SectionListProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  /**
   * La sous-partie que l'espace se rappelle : celle qui s'ouvre en arrivant.
   *
   * Les autres ne sont plus refermées pour autant — voir `useState` plus bas.
   */
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
  /** Où aller quand le geste qui débloque une entrée n'est pas un outil. */
  readonly onNavigate: (target: UiTarget) => void;
  readonly onBrowseFamilies: (section: {
    readonly label: string;
    readonly domain?: DesignDomainId;
    /**
     * Tous les métiers que cette sous-partie sert, et non le premier seul.
     *
     * Neuf sous-parties sur vingt en mêlent au moins deux : la cuisine pose
     * de l'électroménager, du mobilier et de la plomberie ; l'extérieur, du
     * mobilier et de l'arrosage. N'en ouvrir qu'un laissait l'autre moitié de
     * ce qu'elles posent derrière un élargissement à la main.
     */
    readonly domains?: readonly DesignDomainId[];
  }) => void;
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
  onNavigate,
  onBrowseFamilies,
}: SectionListProps) {
  const sections = toolboxFor(project, stage, undefined, design);
  const open = sections.some(({ id }) => id === section)
    ? section
    : sections[0]?.id;
  if (sections.length === 0) return null;
  // Une seule sous-partie n'a rien à choisir : elle s'ouvre sans son sommaire.
  const only = sections.length === 1 ? sections[0] : undefined;

  /*
   * Une sous-partie qui pose des équipements en pose bien plus qu'elle n'en
   * nomme : c'est la seule à qui la porte de la nomenclature veut dire
   * quelque chose. Un mur ne se choisit pas dans un catalogue d'appareils.
   */
  const equips = (held: ToolboxSection) =>
    held.entries.some(({ toolId }) => toolId === 'COMPONENT');

  /**
   * Le métier sur lequel la nomenclature s'ouvre depuis cette sous-partie.
   *
   * Le plus servi par ses propres entrées, et le métier déclaré à défaut —
   * `sectionFamilyDomains` tient la table et un test la prouve contre la
   * nomenclature.
   */
  const openOn = (held: ToolboxSection): DesignDomainId | undefined =>
    sectionFamilyDomains(held)[0] ?? held.domain;

  const entries = (held: ToolboxSection) => {
    const opened = openOn(held);
    return (
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
              onNavigate={onNavigate}
            />
          ))}
        </div>
        {equips(held) && (
          <button
            type="button"
            className="section-more"
            /*
             * Le nom porte la sous-partie, pas seulement « Autre… ».
             *
             * Plusieurs replis peuvent être ouverts en même temps, donc
             * plusieurs de ces boutons paraissent ensemble. Trois boutons qui
             * s'appellent tous « Autre… » sont trois boutons qu'on ne
             * distingue qu'à l'œil, en regardant sous quel titre ils sont
             * rangés — et pas du tout pour qui écoute la page. Le mot reste
             * court à l'écran, où la colonne dit déjà où l'on est.
             */
            aria-label={`Autre… — ${held.label}`}
            title={`Tout ce que la nomenclature tient en ${held.label.toLowerCase()}`}
            onClick={() =>
              onBrowseFamilies({
                label: held.label,
                /*
                 * Les métiers que ses entrées **utilisent**, pas celui qu'elle
                 * déclare.
                 *
                 * La salle de bain est du Mobilier — c'est là qu'on la meuble —
                 * et six de ses sept entrées posent des familles de Plomberie.
                 * Son « Autre… » ouvrait donc la nomenclature sur Mobilier, où
                 * chercher « bidet » ne rend rien : il fallait d'abord élargir
                 * le métier à la main, un geste de plus sur le chemin de toutes
                 * les familles que la boîte à outils ne nomme pas.
                 *
                 * Et tous ceux qu'elle sert, pas seulement le plus servi. Neuf
                 * sous-parties sur vingt en mêlent au moins deux, et n'en
                 * ouvrir qu'un laissait l'autre moitié de ce qu'elles posent
                 * hors de vue : quatre cent quatre-vingt-quatorze familles
                 * atteignables sans rien élargir, contre huit cent sept.
                 * Choisir un métier dans la liste déroulante remplace
                 * l'ouverture — c'est un choix, il ne s'y ajoute pas.
                 */
                ...(opened === undefined
                  ? {}
                  : { domains: sectionFamilyDomains(held) }),
              })
            }
          >
            Autre…
          </button>
        )}
      </>
    );
  };

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
