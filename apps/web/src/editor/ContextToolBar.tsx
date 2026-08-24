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
import type { Project } from '@house-technical-designer/core-domain';

import type { AlignEdge } from './editing-commands.js';
import type { EditorAction, EditorState } from './editor-state.js';
import { selectionCapabilities } from './object-editors.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
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
  readonly onTransform?: (kind: 'ROTATE' | 'MIRROR') => void;
  readonly onAlign?: (edge: AlignEdge) => void;
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

function hint(commandId: string): string {
  const binding = SHORTCUTS.find(({ id }) => id === commandId);
  return binding === undefined ? '' : ` (${shortcutLabel(binding)})`;
}

const ALIGNMENTS = [
  ['LEFT', 'Aligner à gauche'],
  ['RIGHT', 'Aligner à droite'],
  ['TOP', 'Aligner en haut'],
  ['BOTTOM', 'Aligner en bas'],
] as const;

export function ContextToolBar({
  project,
  editor,
  dispatch,
  onTransform,
  onAlign,
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
  const allowed = selectionCapabilities(project, editor.selection);
  // Selection is the resting state, not a tool being used: it is what the plan
  // does when nobody has asked for anything.
  const drawing = editor.activeTool !== 'SELECT';
  // Nothing to show still takes its place. A strip that appears and disappears
  // moves the drawing under the pointer, and a plan that jumps when something
  // is selected is a plan nobody can aim at.
  if (!drawing && selected === 0)
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
      {selected > 0 && (
        <>
          {/* Le quart de tour et le retournement se font autour du centre de la
              sélection ; ce qu'elle ne sait pas faire est grisé, parce que le
              proposer pour le refuser ensuite se lit comme une panne. */}
          <div
            className="tool-group"
            role="group"
            aria-label="Transformations rapides"
          >
            <button
              type="button"
              className="secondary"
              disabled={!allowed.rotatable}
              title="Pivoter la sélection d’un quart de tour autour de son centre"
              onClick={() => onTransform?.('ROTATE')}
            >
              Pivoter 90°{hint('edit.rotate')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!allowed.mirrorable}
              title="Retourner la sélection de gauche à droite"
              onClick={() => onTransform?.('MIRROR')}
            >
              Miroir gauche-droite{hint('edit.mirror')}
            </button>
          </div>
          <div className="tool-group" role="group" aria-label="Alignement">
            {ALIGNMENTS.map(([edge, label]) => (
              <button
                key={edge}
                type="button"
                className="secondary"
                disabled={selected < 2}
                title={
                  selected < 2
                    ? 'Sélectionnez au moins deux objets à aligner.'
                    : label
                }
                onClick={() => onAlign?.(edge)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
