/**
 * Ce que l'outil actif et la sélection rendent possible — et rien quand ni
 * l'un ni l'autre ne rend rien possible.
 *
 * La barre universelle montrait les mêmes quarante boutons quoi qu'on fasse,
 * donc elle ne disait rien de ce qu'on faisait. Celle-ci est vide quand aucun
 * outil n'est actif et que rien n'est sélectionné, ce qui est déjà une
 * information : le plan attend.
 *
 * Elle dit surtout **ce que l'outil attend**. « Mur » ne disait pas s'il faut
 * cliquer une fois ou deux, ni comment on arrête un tracé qui ne s'arrête pas
 * tout seul : on le découvrait en essayant, c'est-à-dire en se trompant. La
 * phrase est dérivée du registre, jamais écrite par un outil.
 */
import { useEffect, useState } from 'react';

import type { Project } from '@house-technical-designer/core-domain';

import type { CreationStageId } from '../ux/creation-stages.js';
import type { EditorAction, EditorState } from './editor-state.js';
import {
  contextBarActions,
  type ObjectAction,
  type ObjectActionContext,
  type ObjectActionHost,
} from './object-actions.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
import { objectActionsInStage } from './stage-editing.js';
import { toolInstruction } from './tool-instruction.js';
import {
  completionLabel,
  completionModeOf,
  requiredPoints,
  toolDefinition,
} from './tool-registry.js';

export interface ContextToolBarProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  /**
   * L'espace depuis lequel on regarde, parce que la barre écrit.
   *
   * Elle offrait « Pivoter » et « Retourner » sur un mur regardé depuis
   * Systèmes, où les deux commandes sont refusées. Elle ne décide pas de la
   * règle : elle demande à `stage-editing.ts` ce qui aboutit ici.
   */
  readonly stage: CreationStageId;
  /** L'étage regardé, dont les gestes d'une famille ont besoin. */
  readonly levelId: string | undefined;
  /**
   * Ce que l'application sait faire de la sélection.
   *
   * Une seule entrée plutôt qu'un rappel par geste : la barre n'a plus à
   * connaître la liste des gestes, c'est le registre qui la tient.
   */
  readonly actions: ObjectActionHost;
  /** Abandonner le tracé en cours, sans quitter l'outil. */
  readonly onCancel?: () => void;
  /**
   * Achever le tracé en cours — fermer la surface, ou terminer le chemin.
   *
   * Le geste existait, et il n'existait qu'au clavier : « Ctrl+Entrée », écrit
   * dans une boîte flottante. Quelqu'un qui dessine à la souris n'avait aucun
   * moyen de finir ce qu'il avait commencé.
   */
  readonly onFinish?: () => void;
}

function hint(commandId: string | undefined): string {
  const binding = SHORTCUTS.find(({ id }) => id === commandId);
  return binding === undefined ? '' : ` (${shortcutLabel(binding)})`;
}

export function ContextToolBar({
  project,
  editor,
  dispatch,
  stage,
  levelId,
  actions,
  onCancel,
  onFinish,
}: ContextToolBarProps) {
  const definition = toolDefinition(editor.activeTool);
  const instruction = toolInstruction(editor);
  const drafting = editor.pendingPoints.length > 0;
  // Fermer une surface et terminer un chemin ne sont pas le même geste, et le
  // registre est le seul à savoir lequel des deux cet outil attend.
  const mode = completionModeOf(editor.activeTool);
  const minimum = requiredPoints(editor.activeTool);
  const selected = editor.selection.length;
  /*
   * Ce que le registre propose sur cette sélection-là, filtré par l'espace.
   *
   * La barre ne décide plus de rien : elle ne sait ni qu'un mur se scinde, ni
   * qu'une pièce ne pivote pas, ni qu'un tronçon ne se modifie pas depuis
   * Bâtiment. Elle affiche.
   */
  const context: ObjectActionContext = {
    project,
    levelId,
    selection: editor.selection,
    host: actions,
  };
  const { shown, folded } = contextBarActions(
    objectActionsInStage(stage, context),
  );
  /*
   * Le « … » se referme quand la sélection change.
   *
   * Il est ouvert sur les quatre alignements d'une sélection multiple ; on
   * clique un mur, et le dépliage resterait ouvert sur les gestes du mur, dont
   * on n'a rien demandé. Un dépliage porte sur ce qu'on regardait, pas sur la
   * barre.
   */
  const [foldOpen, setFoldOpen] = useState(false);
  const selectionKey = editor.selection.join(',');
  useEffect(() => setFoldOpen(false), [selectionKey]);

  const actionButton = (action: ObjectAction) => (
    <button
      key={action.id}
      type="button"
      className="secondary"
      disabled={!action.enabled(context)}
      /*
       * Un bouton gris qui ne dit pas pourquoi se lit comme une panne.
       *
       * On reclique, on cherche le réglage qui le libérerait, il n'existe pas.
       * Quand l'action déclare son motif, c'est lui qu'on lit — « Répartir
       * demande au moins trois objets : avec deux, il n'y a qu'un intervalle,
       * et un seul intervalle est déjà régulier » — et non ce qu'elle ferait
       * si elle pouvait. Les gestes qui n'en déclarent pas gardent leur
       * infobulle : le motif est facultatif, pas une phrase à inventer.
       */
      title={
        action.unavailableReason?.(context) ??
        `${action.hint}${hint(action.shortcutId)}`
      }
      onClick={() => action.run(context)}
    >
      {action.label}
      {hint(action.shortcutId)}
    </button>
  );
  // Selection is the resting state, not a tool being used: it is what the plan
  // does when nobody has asked for anything.
  const drawing = editor.activeTool !== 'SELECT';
  // Nothing to show still takes its place. A strip that appears and disappears
  // moves the drawing under the pointer, and a plan that jumps when something
  // is selected is a plan nobody can aim at.
  //
  // Une sélection sans aucune action se traite comme une sélection vide : une
  // bande grise et muette au-dessus du dessin ne dit rien de plus qu'une bande
  // absente, et coûte la place. Le cas se produit — plusieurs objets pris à la
  // bande depuis un espace qui n'en possède aucun —, et c'est le panneau des
  // propriétés qui dit alors où aller les modifier.
  if (!drawing && (selected === 0 || shown.length === 0))
    return <div className="context-tool-bar is-empty" aria-hidden="true" />;

  return (
    <div
      className="context-tool-bar"
      // The bar scrolls when it carries more than fits; a scrollable region
      // that cannot be reached by keyboard is unreachable for anyone not using
      // a pointer, which the automated audit is right to call a failure.
      tabIndex={0}
      role="group"
      aria-label="Actions du contexte"
    >
      {drawing && (
        <span className="context-tool-name">
          {definition.label}
          {/* « Terminer » et « Terminer le tracé » côte à côte : deux boutons
              qui commencent par le même mot et ne font pas la même chose. Ce
              bouton-ci repose l'outil ; il le dit. */}
          <button
            type="button"
            className="ghost"
            title="Reposer l’outil et revenir à la sélection"
            onClick={() => dispatch({ type: 'SET_TOOL', tool: 'SELECT' })}
          >
            Quitter l’outil
          </button>
          {drafting && (
            <button
              type="button"
              className="ghost"
              title="Abandonner le tracé en cours sans quitter l’outil"
              onClick={() => onCancel?.()}
            >
              Annuler le tracé
            </button>
          )}
        </span>
      )}
      {/*
        Finir à la souris, comme on a commencé à la souris.
        « Ctrl+Entrée » était le seul moyen d'achever une surface, et il était
        écrit dans une boîte flottante que rien n'oblige à lire. Les deux
        gestes sont ici, nommés par ce qu'ils font : une surface se ferme, un
        chemin se termine, et un sommet de trop se retire tout seul.
      */}
      {mode !== undefined && drafting && (
        <div className="tool-group" role="group" aria-label="Achever le tracé">
          <button
            type="button"
            className="primary"
            disabled={editor.pendingPoints.length < minimum}
            title={
              editor.pendingPoints.length < minimum
                ? `${minimum} points au minimum.`
                : `${completionLabel(mode)} — Entrée, ou Ctrl+Entrée depuis les champs`
            }
            onClick={() => onFinish?.()}
          >
            {completionLabel(mode)}
          </button>
          <button
            type="button"
            className="secondary"
            title="Retirer le dernier sommet posé, et lui seul"
            onClick={() => dispatch({ type: 'UNDO_POINT' })}
          >
            Annuler dernier sommet
          </button>
        </div>
      )}
      {/*
        Ce que l'outil attend, écrit. Un outil qui n'annonce pas sa prochaine
        action se découvre en se trompant, et rien à l'écran ne disait qu'un
        mur continu se termine par Entrée.
      */}
      {drawing && (
        <span className="context-instruction">
          {instruction.next}
          {instruction.finish !== undefined && (
            <small> · {instruction.finish}</small>
          )}
          {instruction.measures !== undefined && (
            <strong className="draft-measures">{instruction.measures}</strong>
          )}
        </span>
      )}
      {/*
        Ce qui compte pour cet objet-là, et le reste à un dépliage.

        La barre montrait six boutons identiques quel que soit l'objet —
        pivoter, retourner, et quatre alignements —, c'est-à-dire la panoplie
        du mobilier appliquée à un mur, à une gaine et à une parcelle. Elle en
        montre maintenant deux à cinq, choisis par le registre pour la famille
        désignée, et range le reste derrière un « … » qui dit combien.
      */}
      {selected > 0 && shown.length > 0 && (
        <div
          className="tool-group"
          role="group"
          aria-label="Actions de la sélection"
        >
          {shown.map(actionButton)}
          {folded.length > 0 && (
            <button
              type="button"
              className="secondary"
              aria-expanded={foldOpen}
              title={
                foldOpen
                  ? 'Replier les autres actions de cette sélection'
                  : `${folded.length} autre(s) action(s) sur cette sélection`
              }
              onClick={() => setFoldOpen((open) => !open)}
            >
              {/* La barre tient sur une ligne et défile : les actions repliées
                  s'ajoutent à sa suite plutôt que dans un panneau flottant,
                  qui serait coupé par le bandeau qui la porte. */}
              {foldOpen ? '‹ Moins' : `… (${folded.length})`}
            </button>
          )}
          {foldOpen && folded.map(actionButton)}
        </div>
      )}
    </div>
  );
}
