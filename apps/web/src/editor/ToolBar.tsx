import type { Project } from '@house-technical-designer/core-domain';
import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import type { AlignEdge } from './editing-commands.js';
import { ToolOptions } from './ToolOptions.js';
import type { ToolDrafts } from './tool-options.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
import { selectionCapabilities } from './object-editors.js';
import {
  EDITOR_LEVELS,
  EDITOR_LEVEL_HINTS,
  EDITOR_LEVEL_LABELS,
  TOOL_GROUP_LABELS,
  populatedToolGroupsAtLevel,
  toolsInGroupAtLevel,
} from './tool-registry.js';
import type { EditorLevel } from './tool-registry.js';

export interface ToolBarProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  /** What the user has chosen in the options of each tool. */
  readonly drafts: ToolDrafts;
  readonly onDraftChange: (key: string, value: string) => void;
  /** Turns or reflects the selection about its own centre. */
  readonly onTransform?: (kind: 'ROTATE' | 'MIRROR') => void;
  /** Lines the selection up on one edge of its own outline. */
  readonly onAlign?: (edge: AlignEdge) => void;
}

export interface OpeningDraft {
  readonly openingType: 'DOOR' | 'WINDOW';
  readonly widthMm: number;
  readonly heightMm: number;
  readonly sillHeightMm: number;
}

function hint(commandId: string): string {
  const binding = SHORTCUTS.find(({ id }) => id === commandId);
  return binding === undefined ? '' : ` (${shortcutLabel(binding)})`;
}

export function ToolBar({
  project,
  editor,
  dispatch,
  drafts,
  onDraftChange,
  onTransform,
  onAlign,
}: ToolBarProps) {
  const allowed = selectionCapabilities(project, editor.selection);
  return (
    <div className="tool-bar">
      {/* One group per family: the toolbar asks the registry what exists
          rather than holding its own list, so a new tool appears beside the
          ones it belongs with instead of at the end of a growing row. */}
      {/* Quarante boutons sont un mur pour qui dessine son premier plan et un
          jeu nécessaire pour qui monte un dossier. Rien n'est désactivé : ce
          qui change est ce qui est à l'écran, et le fichier est le même. */}
      <div className="tool-group" role="group" aria-label="Interface">
        <label>
          Interface
          <select
            aria-label="Niveau d’interface"
            value={editor.editorLevel}
            onChange={(event) =>
              dispatch({
                type: 'SET_EDITOR_LEVEL',
                level: event.target.value as EditorLevel,
              })
            }
          >
            {EDITOR_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EDITOR_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </label>
        <small className="hint">{EDITOR_LEVEL_HINTS[editor.editorLevel]}</small>
      </div>
      {populatedToolGroupsAtLevel(editor.editorLevel).map((group) => (
        <div
          className="tool-group"
          role="group"
          aria-label={`Outils · ${TOOL_GROUP_LABELS[group]}`}
          key={group}
        >
          {toolsInGroupAtLevel(group, editor.editorLevel).map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={
                tool.id === editor.activeTool ? 'tool-active' : 'secondary'
              }
              aria-pressed={tool.id === editor.activeTool}
              title={`${tool.hint} — raccourci${hint(tool.shortcutId)}`}
              onClick={() =>
                dispatch({ type: 'SET_TOOL', tool: tool.id as EditorTool })
              }
            >
              {tool.label}
            </button>
          ))}
        </div>
      ))}

      <ToolOptions
        project={project}
        tool={editor.activeTool}
        drafts={drafts}
        onChange={onDraftChange}
      />

      {/* Le quart de tour et le retournement gauche-droite se font autour du
          centre de la sélection, sans rien tracer ; les outils Pivoter et
          Miroir servent quand le centre ou l'axe comptent. Ce que la sélection
          ne sait pas faire est grisé : une ouverture suit son mur, une pièce
          suit les siens, et le proposer pour le refuser ensuite se lit comme
          une panne. */}
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
        {(
          [
            ['LEFT', 'Aligner à gauche'],
            ['RIGHT', 'Aligner à droite'],
            ['TOP', 'Aligner en haut'],
            ['BOTTOM', 'Aligner en bas'],
          ] as const
        ).map(([edge, label]) => (
          <button
            key={edge}
            type="button"
            className="secondary"
            disabled={editor.selection.length < 2}
            title={
              editor.selection.length < 2
                ? 'Sélectionnez au moins deux objets à aligner.'
                : label
            }
            onClick={() => onAlign?.(edge)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tool-group" role="group" aria-label="Navigation">
        <button
          type="button"
          className="secondary"
          onClick={() => dispatch({ type: 'RESET_VIEW' })}
        >
          Vue initiale{hint('view.reset')}
        </button>
      </div>
    </div>
  );
}
