/**
 * Les outils de la sous-partie, contre le plan, sur une rangée.
 *
 * `ToolsPanel` montrait les vingt-cinq outils du registre dans une colonne,
 * tous à la fois. La boîte à outils les a filtrés par étape, puis par
 * sous-partie. Il restait à les sortir de la colonne : une colonne d'outils
 * prend de la largeur au plan en permanence pour des boutons qu'on regarde une
 * seconde, alors qu'une rangée au-dessus du dessin est là où la main va.
 *
 * Trois zones et deux lignes :
 *
 * - **au centre**, de trois à huit boutons — ce que la sous-partie propose —
 *   avec la Sélection en tête et `+` à la fin ;
 * - **à droite**, ce que le contexte rend possible et ce que le plan montre ;
 * - **en seconde ligne**, les options de l'outil actif, et rien quand aucun
 *   outil n'est actif.
 *
 * La première ligne est toujours là, exprès. Une rangée qui apparaît quand on
 * sélectionne quelque chose déplace le dessin sous le pointeur au moment
 * précis où l'on vise — c'est la panne qu'on a déjà payée une fois avec
 * l'inspecteur qui se repliait tout seul. La seconde ligne, elle, ne paraît
 * qu'au moment où l'on prend un outil, et prendre un outil n'est jamais un
 * moment où l'on vise.
 *
 * Une entrée n'est pas un outil : c'est un outil plus ce qu'on aurait choisi
 * juste après. La choisir prend l'outil **et** remplit ses options — poser un
 * WC, c'est l'outil composant avec la fiche WC déjà désignée.
 *
 * Voir `docs/UX_ARCHITECTURE_V4.md` §2.
 */
import { useState, type ReactNode } from 'react';
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';

import type { CreationStageId } from '../ux/creation-stages.js';

import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { EntryButton } from './EntryButton.js';
import { shortcut } from './shortcut-hint.js';
import { ToolOptions } from './ToolOptions.js';
import type { ToolDrafts } from './tool-options.js';
import { toolById, type EditorToolDefinition } from './tool-registry.js';
import type { DesignState } from '../ux/design-state.js';

import {
  COMMON_SECTION,
  availabilityOf,
  draftsForEntry,
  entryAvailable,
  leftoverTools,
  missingFicheFamilies,
  toolboxFor,
  type ToolboxAvailability,
  type ToolboxEntry,
  type ToolboxSection,
} from './toolbox.js';

/** L'entrée de sélection, qui ouvre la rangée plutôt que de suivre les autres. */
const SELECT_ENTRY = 'common.select';

export interface ToolHeaderProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  readonly domain?: DesignDomainId;
  /**
   * La sous-partie ouverte, quand la rangée en a désigné une.
   *
   * Une seule est montrée : l'espace dit de quelle partie de la maison on
   * s'occupe, la rangée dit laquelle de ses parties, et la colonne montre ce
   * qu'il faut pour celle-là. Absente, on retombe sur tout ce que l'espace
   * propose — c'est ce que faisaient les neuf étapes.
   */
  readonly section?: string;
  /** Ce que le contexte rend possible : la barre d'actions, montée à côté. */
  readonly context: ReactNode;
  /** Ce que le plan montre : la variante et l'affichage, montés à côté. */
  readonly view: ReactNode;
  /** Ce que la maison est, pour savoir quels outils servent vraiment. */
  readonly design: DesignState;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly drafts: ToolDrafts;
  readonly onDraftChange: (key: string, value: string) => void;
  /** Poser plusieurs options d'un coup : une entrée en remplit souvent trois. */
  readonly onDraftsChange: (drafts: ToolDrafts) => void;
  /** Ouvrir la bibliothèque d'équipements, d'où viennent les fiches. */
  readonly onOpenLibrary: () => void;
}

export function ToolHeader({
  project,
  stage,
  domain,
  section,
  context,
  view,
  design,
  editor,
  dispatch,
  drafts,
  onDraftChange,
  onDraftsChange,
  onOpenLibrary,
}: ToolHeaderProps) {
  // La sous-partie est cherchée parmi toutes celles de l'espace, et non parmi
  // celles que le métier laisse passer : « Ossature » nomme la structure, et
  // la chercher à travers le filtre d'architecture reviendrait à la perdre au
  // moment même où on la désigne.
  const chosen = toolboxFor(project, stage, undefined, design).find(
    ({ id }) => id === section,
  );
  const sections =
    chosen === undefined
      ? toolboxFor(project, stage, domain, design)
      : [chosen];
  const common: ToolboxSection = {
    ...COMMON_SECTION,
    entries: COMMON_SECTION.entries.filter((candidate) =>
      entryAvailable(project, candidate),
    ),
  };
  const entries = sections.flatMap(({ entries: held }) => held);
  // Ce que la sous-partie ne propose pas reste à un dépliage, sur le même
  // écran : une sous-partie filtre ce qui est proposé, elle ne restreint
  // jamais ce qui est possible. Le calcul vit dans le registre, où un test le
  // tient : les deux ensembles réunis font le registre entier.
  const others = leftoverTools(
    project,
    stage,
    chosen === undefined ? domain : undefined,
    design,
  ).filter((tool) => !entries.some(({ toolId }) => toolId === tool.id));
  const [moreOpen, setMoreOpen] = useState(false);
  const active = toolById(editor.activeTool);

  /*
   * Les recommandées d'abord.
   *
   * L'ordre du registre est celui d'un chantier ; celui de l'écran est celui
   * de ce qui reste à faire. Trier plutôt que masquer : la personne retrouve
   * ses outils au même endroit, avec le plus utile en tête.
   */
  const ordered = (
    candidates: readonly ToolboxEntry[],
  ): ToolboxAvailability[] => {
    const graded = candidates.map((candidate) =>
      availabilityOf(candidate, design),
    );
    return [
      ...graded.filter(({ recommended }) => recommended),
      ...graded.filter(({ recommended, enabled }) => !recommended && enabled),
      ...graded.filter(({ enabled }) => !enabled),
    ];
  };

  const choose = (candidate: ToolboxEntry): void => {
    dispatch({ type: 'SET_TOOL', tool: candidate.toolId as EditorTool });
    const prefilled = draftsForEntry(project, candidate);
    if (Object.keys(prefilled).length > 0) onDraftsChange(prefilled);
    // Le menu se referme sur ce qu'on vient d'y prendre : un dépliage qui
    // reste ouvert couvre le plan qu'on s'apprête à dessiner.
    setMoreOpen(false);
  };

  // La sélection est l'état de repos, pas un outil : elle ouvre la rangée
  // parce qu'on y revient sans arrêt, et elle n'a rien à mettre en seconde
  // ligne.
  const select = common.entries.find(({ id }) => id === SELECT_ENTRY);
  const rest = common.entries.filter(({ id }) => id !== SELECT_ENTRY);
  const drawing = editor.activeTool !== 'SELECT';
  /*
   * L'outil pris dans le « + » reste sous la main.
   *
   * Sinon il disparaît au moment même où l'on s'en sert : la rangée montre ce
   * que la sous-partie propose, plus ce qu'on est en train de faire.
   */
  const guest =
    entries.some(({ toolId }) => toolId === editor.activeTool) ||
    select?.toolId === editor.activeTool
      ? undefined
      : rest.find(({ toolId }) => toolId === editor.activeTool);
  const strayTool =
    guest === undefined
      ? others.find(({ id }) => id === editor.activeTool)
      : undefined;

  // Une sous-partie qui pose des fiches et n'en trouve aucune n'a rien à
  // montrer : dire d'où elles viennent vaut mieux qu'une rangée vide.
  const missing = missingFicheFamilies(project, stage);

  return (
    <div className="tool-header">
      <div className="tool-row">
        <div
          className="tool-tools"
          role="group"
          aria-label={rowLabel(sections)}
        >
          {select !== undefined && (
            <EntryButton
              available={availabilityOf(select, design)}
              active={select.toolId === editor.activeTool}
              onChoose={choose}
            />
          )}
          {ordered(entries).map((available) => (
            <EntryButton
              key={available.entry.id}
              available={available}
              active={available.entry.toolId === editor.activeTool}
              onChoose={choose}
            />
          ))}
          {guest !== undefined && (
            <EntryButton
              available={availabilityOf(guest, design)}
              active
              onChoose={choose}
            />
          )}
          {strayTool !== undefined && (
            <ToolButton tool={strayTool} active dispatch={dispatch} />
          )}
        </div>
        <details
          className="tool-more"
          open={moreOpen}
          onToggle={(event) => setMoreOpen(event.currentTarget.open)}
        >
          <summary
            title={`Le reste des outils (${rest.length + others.length})`}
            aria-label="Autres outils"
          >
            +
          </summary>
          <div className="tool-more-menu">
            {entries.length === 0 && missing.length > 0 && (
              <p className="hint">
                Cette sous-partie pose des fiches du catalogue —{' '}
                {missing.slice(0, 3).join(', ')}
                {missing.length > 3 ? '…' : ''} — et ce projet n’en tient
                aucune.{' '}
                <button type="button" className="link" onClick={onOpenLibrary}>
                  Ouvrir la bibliothèque d’équipements
                </button>
              </p>
            )}
            {rest.length > 0 && (
              <section
                className="toolbox-section"
                aria-label="Outils · Communs"
              >
                <p className="context-group-label">{common.label}</p>
                <div className="toolbox-grid">
                  {ordered(rest).map((available) => (
                    <EntryButton
                      key={available.entry.id}
                      available={available}
                      active={available.entry.toolId === editor.activeTool}
                      onChoose={choose}
                    />
                  ))}
                </div>
              </section>
            )}
            {others.length > 0 && (
              <section
                className="toolbox-section"
                aria-label="Outils · Tous les outils"
              >
                <p className="context-group-label">
                  Tous les outils ({others.length})
                </p>
                <div className="toolbox-list">
                  {others.map((tool) => (
                    <ToolButton
                      key={tool.id}
                      tool={tool}
                      active={tool.id === editor.activeTool}
                      dispatch={dispatch}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </details>
        {/*
         * À droite, ce que le plan montre — et rien de ce que le contexte
         * rend possible. Cette zone-là est petite et fixe exprès : c'est la
         * seule façon qu'elle a de ne jamais déborder sur les outils.
         */}
        <div className="tool-row-end">
          {/*
           * Ce que la sélection accepte de prendre se règle ici.
           *
           * La sélection est l'état de repos : ses options seraient une
           * seconde ligne qui ne disparaît jamais, c'est-à-dire une rangée de
           * plus. Un champ, à droite, à côté de ce qui commande le plan.
           */}
          {!drawing && (
            <ToolOptions
              project={project}
              tool={editor.activeTool}
              drafts={drafts}
              onChange={onDraftChange}
            />
          )}
          {view}
        </div>
      </div>

      {/*
       * La seconde ligne : ce que le contexte rend possible, et ce que l'outil
       * actif laisse décider. Choisir un assemblage fait partie du choix de
       * l'outil mur ; ce n'est pas une course séparée dans une colonne.
       *
       * Elle est posée par-dessus le plan, pas au-dessus de lui, si bien
       * qu'elle peut aller et venir sans jamais changer la taille du dessin.
       * Vide, elle ne montre rien et ne prend rien.
       */}
      <div className="tool-line">
        {context}
        {drawing && active !== undefined && (
          <ToolOptions
            project={project}
            tool={editor.activeTool}
            drafts={drafts}
            onChange={onDraftChange}
          />
        )}
      </div>
    </div>
  );
}

/** Ce que la rangée s'appelle : le nom de la sous-partie qu'elle sert. */
function rowLabel(sections: readonly ToolboxSection[]): string {
  const only = sections.length === 1 ? sections[0]?.label : undefined;
  return only === undefined ? 'Outils' : `Outils · ${only}`;
}

function ToolButton({
  tool,
  active,
  dispatch,
}: {
  readonly tool: EditorToolDefinition;
  readonly active: boolean;
  readonly dispatch: (action: EditorAction) => void;
}) {
  return (
    <button
      type="button"
      className={active ? 'active' : undefined}
      aria-pressed={active}
      title={`${tool.hint} — raccourci${shortcut(tool.shortcutId)}`}
      onClick={() =>
        dispatch({ type: 'SET_TOOL', tool: tool.id as EditorTool })
      }
    >
      {tool.label}
    </button>
  );
}
