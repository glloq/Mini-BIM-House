/**
 * Ce qu'on peut ajouter ici, et rien d'autre.
 *
 * La colonne de gauche montrait ce que le projet **contient** : les niveaux,
 * les murs déjà tracés, les réseaux déjà posés. C'est utile pour retrouver et
 * pour corriger, et c'est inutile pour créer — or créer est ce qu'on fait
 * quatre-vingt-dix pour cent du temps. Le header sait déjà ce qu'on veut
 * poser ; la colonne, elle, continuait de raconter le passé.
 *
 * Elle montre donc d'abord **ce que cette sous-partie sait poser**, en toutes
 * lettres, et ce que le projet contient est passé au-dessous, à un dépliage.
 *
 * ## Ce qui la distingue de la rangée d'outils
 *
 * La rangée tient de trois à huit boutons : ce qu'on prend vite, sans lire.
 * Le panneau tient **tout** ce que la sous-partie sait poser — y compris ce
 * que la rangée range sous « + » — avec les noms écrits et les raisons des
 * entrées qui ne servent pas encore. L'une est la main, l'autre est l'étal.
 *
 * ## Aucune liste n'est écrite ici
 *
 * `toolboxFor` répond déjà, et c'est le même appel que fait le header. Une
 * seconde liste des mêmes boutons serait une seconde liste à corriger, et
 * c'est exactement ce qui a produit les treize destinations.
 */
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';

import { EntryButton } from '../editor/EntryButton.js';
import type {
  EditorAction,
  EditorState,
  EditorTool,
} from '../editor/editor-state.js';
import {
  availabilityOf,
  draftsForEntry,
  isEntryActive,
  toolboxFor,
  type ToolboxEntry,
} from '../editor/toolbox.js';
import type { ToolDrafts } from '../editor/tool-options.js';
import type { CreationStageId } from '../ux/creation-stages.js';
import type { DesignState } from '../ux/design-state.js';

export interface AddPanelProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  readonly domain?: DesignDomainId;
  /** La sous-partie ouverte : c'est elle qui décide de tout ce panneau. */
  readonly section?: string;
  readonly design: DesignState;
  readonly editor: EditorState;
  /** Ce qui est réglé : c'est lui qui dit laquelle des entrées est en cours. */
  readonly drafts: ToolDrafts;
  readonly dispatch: (action: EditorAction) => void;
  readonly onDraftsChange: (drafts: ToolDrafts) => void;
}

export function AddPanel({
  project,
  stage,
  domain,
  section,
  design,
  editor,
  drafts,
  dispatch,
  onDraftsChange,
}: AddPanelProps) {
  // La sous-partie est cherchée parmi toutes celles de l'espace, comme dans le
  // header : un métier ne doit pas pouvoir faire disparaître la sous-partie
  // qu'on vient de désigner.
  const all = toolboxFor(project, stage, undefined, design);
  const chosen = all.find(({ id }) => id === section);
  const shown =
    chosen === undefined
      ? toolboxFor(project, stage, domain, design)
      : [chosen];
  const entries = shown.flatMap(({ entries: held }) => held);
  if (entries.length === 0) return null;

  const choose = (candidate: ToolboxEntry): void => {
    dispatch({ type: 'SET_TOOL', tool: candidate.toolId as EditorTool });
    const prefilled = draftsForEntry(project, candidate);
    if (Object.keys(prefilled).length > 0) onDraftsChange(prefilled);
  };

  /*
   * Les recommandées d'abord, les inertes en dernier.
   *
   * Le même ordre que la rangée, pour la même raison : l'ordre du registre est
   * celui d'un chantier, celui de l'écran est celui de ce qui reste à faire.
   */
  const graded = entries.map((candidate) => availabilityOf(candidate, design));
  const ordered = [
    ...graded.filter(({ recommended }) => recommended),
    ...graded.filter(({ recommended, enabled }) => !recommended && enabled),
    ...graded.filter(({ enabled }) => !enabled),
  ];

  return (
    <section
      className="add-panel"
      aria-label={`Ajouter · ${chosen?.label ?? 'cet espace'}`}
    >
      <p className="context-group-label">Ajouter</p>
      <div className="add-grid">
        {ordered.map((available) => (
          <EntryButton
            key={available.entry.id}
            available={available}
            active={isEntryActive(
              project,
              available.entry,
              editor.activeTool,
              drafts,
            )}
            onChoose={choose}
          />
        ))}
      </div>
    </section>
  );
}
