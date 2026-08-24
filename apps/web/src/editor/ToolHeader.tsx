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
import type { Project } from '@house-technical-designer/core-domain';

import type { CreationStageId } from '../ux/creation-stages.js';

import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { EntryButton } from './EntryButton.js';
import { shortcut } from './shortcut-hint.js';
import { ToolOptions } from './ToolOptions.js';
import type { ToolDrafts } from './tool-options.js';
import { toolById, type EditorToolDefinition } from './tool-registry.js';
import type { DesignState } from '../ux/design-state.js';
import type { UiTarget } from '../ux/ui-target.js';

import {
  COMMON_SECTION,
  availabilityOf,
  isEntryActive,
  entryAvailable,
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
  /** Prendre une entrée : l'outil, ses options, et la fiche qu'elle installe. */
  readonly onChooseEntry: (entry: ToolboxEntry) => void;
  /** Où aller quand le geste qui débloque une entrée n'est pas un outil. */
  readonly onNavigate: (target: UiTarget) => void;
}

export function ToolHeader({
  project,
  stage,
  context,
  view,
  design,
  editor,
  dispatch,
  drafts,
  onDraftChange,
  onChooseEntry,
  onNavigate,
}: ToolHeaderProps) {
  const common: ToolboxSection = {
    ...COMMON_SECTION,
    entries: COMMON_SECTION.entries.filter((candidate) =>
      entryAvailable(project, candidate),
    ),
  };
  const [moreOpen, setMoreOpen] = useState(false);
  const active = toolById(editor.activeTool);

  /*
   * Les recommandées d'abord.
   *
   * L'ordre du registre est celui d'un chantier ; celui de l'écran est celui
   * de ce qui reste à faire.
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
    // Prendre une entrée est le même geste ici et dans le sommaire : il est
    // écrit une fois, au-dessus, avec l'installation de la fiche qu'elle pose.
    onChooseEntry(candidate);
    // Le menu se referme sur ce qu'on vient d'y prendre : un dépliage qui
    // reste ouvert couvre le plan qu'on s'apprête à dessiner.
    setMoreOpen(false);
  };

  // La sélection est l'état de repos, pas un outil : elle ouvre la rangée
  // parce qu'on y revient sans arrêt.
  const select = common.entries.find(({ id }) => id === SELECT_ENTRY);
  const rest = common.entries.filter(({ id }) => id !== SELECT_ENTRY);
  const drawing = editor.activeTool !== 'SELECT';

  /*
   * Ce qu'on est en train de faire, montré à côté de la Sélection.
   *
   * La rangée ne propose plus ce que la sous-partie pose — c'est le sommaire
   * qui le fait, et le montrer deux fois faisait viser le mauvais des deux.
   * Elle montre en revanche l'outil en cours : un plan qui dessine sans dire
   * avec quoi est un plan qui surprend.
   *
   * L'entrée est cherchée dans tout l'espace et parmi les gestes communs,
   * puisque c'est de là qu'on a pu la prendre.
   */
  const reachable = [
    ...toolboxFor(project, stage, undefined, design).flatMap(
      ({ entries }) => entries,
    ),
    ...rest,
  ];
  const guest =
    select?.toolId === editor.activeTool
      ? undefined
      : (reachable.find((candidate) =>
          isEntryActive(project, candidate, editor.activeTool, drafts),
        ) ?? reachable.find(({ toolId }) => toolId === editor.activeTool));
  /*
   * L'outil pris ailleurs qu'ici — par la palette, par un raccourci.
   *
   * Les sept espaces sont séparés, et celui-ci ne propose pas les outils des
   * six autres. Mais on peut encore l'atteindre par la recherche, et un outil
   * actif qu'aucun bouton ne montre est un plan qui fait autre chose que ce
   * qu'il affiche.
   */
  const strayTool =
    guest === undefined &&
    select?.toolId !== editor.activeTool &&
    active !== undefined
      ? active
      : undefined;

  return (
    <div className="tool-header">
      <div className="tool-row">
        <div className="tool-tools" role="group" aria-label="Outils du plan">
          {/*
           * Le minimum, et rien de plus.
           *
           * La rangée montrait les mêmes boutons que la colonne de gauche —
           * « Mur » en haut, « Mur » à gauche — et l'un des deux était
           * toujours celui qu'on n'avait pas visé. Ce qu'on pose se choisit
           * dans le sommaire ; ce qui reste ici est ce qui n'a pas d'autre
           * place :
           *
           * - **la Sélection**, qui est l'état de repos et où l'on revient
           *   sans arrêt ;
           * - **l'outil en cours**, parce qu'un plan qui dessine sans dire
           *   avec quoi est un plan qui surprend ;
           * - **les gestes communs** — mesurer, coter, annoter — qui ne sont
           *   d'aucune sous-partie et servent dans toutes.
           */}
          {select !== undefined && (
            <EntryButton
              available={availabilityOf(select, design)}
              active={isEntryActive(project, select, editor.activeTool, drafts)}
              onChoose={choose}
              onNavigate={onNavigate}
            />
          )}
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
            title={`Les gestes communs (${rest.length})`}
            aria-label="Gestes communs"
          >
            +
          </summary>
          <div className="tool-more-menu">
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
                      active={isEntryActive(
                        project,
                        available.entry,
                        editor.activeTool,
                        drafts,
                      )}
                      onChoose={choose}
                      onNavigate={onNavigate}
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
