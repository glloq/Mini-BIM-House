/**
 * What the current tool and the current selection make possible — and nothing
 * when neither makes anything possible.
 *
 * The universal toolbar was always the same forty buttons, whatever was being
 * done, so it said nothing about what was being done. This one is empty when
 * no tool is active and nothing is selected, which is itself information: the
 * plan is waiting.
 */
import type { Project } from '@house-technical-designer/core-domain';

import type { AlignEdge } from './editing-commands.js';
import type { EditorAction, EditorState } from './editor-state.js';
import { selectionCapabilities } from './object-editors.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
import { toolDefinition } from './tool-registry.js';

export interface ContextToolBarProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly onTransform?: (kind: 'ROTATE' | 'MIRROR') => void;
  readonly onAlign?: (edge: AlignEdge) => void;
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
}: ContextToolBarProps) {
  const definition = toolDefinition(editor.activeTool);
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
          <button
            type="button"
            className="ghost"
            title="Revenir à la sélection"
            onClick={() => dispatch({ type: 'SET_TOOL', tool: 'SELECT' })}
          >
            Terminer
          </button>
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
