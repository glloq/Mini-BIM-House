import type { Project } from '@house-technical-designer/core-domain';
import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';

const TOOLS: readonly { readonly id: EditorTool; readonly label: string }[] = [
  { id: 'SELECT', label: 'Sélection' },
  { id: 'WALL', label: 'Mur' },
  { id: 'OPENING', label: 'Ouverture' },
  { id: 'DIMENSION', label: 'Cotation' },
];

const SHORTCUT_BY_TOOL: Readonly<Record<EditorTool, string>> = {
  SELECT: 'tool.select',
  WALL: 'tool.wall',
  OPENING: 'tool.opening',
  DIMENSION: 'tool.dimension',
};

export interface ToolBarProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly assemblyId: string;
  readonly onAssemblyChange: (assemblyId: string) => void;
  readonly openingDraft: OpeningDraft;
  readonly onOpeningDraftChange: (draft: OpeningDraft) => void;
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
  assemblyId,
  onAssemblyChange,
  openingDraft,
  onOpeningDraftChange,
}: ToolBarProps) {
  const wallAssemblies = (project.assemblies ?? []).filter(
    ({ category }) => category === 'WALL' || category === 'PARTITION',
  );
  return (
    <div className="tool-bar">
      <div className="tool-group" role="group" aria-label="Outils de dessin">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={
              tool.id === editor.activeTool ? 'tool-active' : 'secondary'
            }
            aria-pressed={tool.id === editor.activeTool}
            title={`${tool.label} — raccourci${hint(SHORTCUT_BY_TOOL[tool.id])}`}
            onClick={() => dispatch({ type: 'SET_TOOL', tool: tool.id })}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {editor.activeTool === 'WALL' && (
        <div className="tool-group">
          <label>
            Assemblage
            <select
              value={assemblyId}
              onChange={(event) => onAssemblyChange(event.target.value)}
            >
              {wallAssemblies.map((assembly) => (
                <option key={assembly.id} value={assembly.id}>
                  {assembly.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Longueur (m)
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="libre"
              value={
                editor.directInput.lengthMm === undefined
                  ? ''
                  : editor.directInput.lengthMm / 1000
              }
              onChange={(event) =>
                dispatch({
                  type: 'SET_DIRECT_INPUT',
                  input: {
                    lengthMm:
                      event.target.value === ''
                        ? null
                        : event.target.valueAsNumber * 1000,
                  },
                })
              }
            />
          </label>
          <label>
            Angle (°)
            <input
              type="number"
              step="1"
              placeholder="libre"
              value={editor.directInput.angleDeg ?? ''}
              onChange={(event) =>
                dispatch({
                  type: 'SET_DIRECT_INPUT',
                  input: {
                    angleDeg:
                      event.target.value === ''
                        ? null
                        : event.target.valueAsNumber,
                  },
                })
              }
            />
          </label>
        </div>
      )}

      {editor.activeTool === 'OPENING' && (
        <div className="tool-group">
          <label>
            Type
            <select
              value={openingDraft.openingType}
              onChange={(event) =>
                onOpeningDraftChange({
                  ...openingDraft,
                  openingType: event.target.value as 'DOOR' | 'WINDOW',
                })
              }
            >
              <option value="DOOR">Porte</option>
              <option value="WINDOW">Fenêtre</option>
            </select>
          </label>
          {(
            [
              ['widthMm', 'Largeur (mm)'],
              ['heightMm', 'Hauteur (mm)'],
              ['sillHeightMm', 'Allège (mm)'],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                type="number"
                min="0"
                step="10"
                value={openingDraft[field]}
                onChange={(event) =>
                  onOpeningDraftChange({
                    ...openingDraft,
                    [field]: event.target.valueAsNumber,
                  })
                }
              />
            </label>
          ))}
        </div>
      )}

      <div className="tool-group" role="group" aria-label="Accrochage">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={editor.snap.enabled}
            onChange={(event) =>
              dispatch({
                type: 'SET_SNAP',
                snap: { enabled: event.target.checked },
              })
            }
          />
          Accrochage
        </label>
        {(
          [
            ['grid', 'Grille'],
            ['endpoint', 'Extrémités'],
            ['midpoint', 'Milieux'],
            ['intersection', 'Intersections'],
            ['orthogonal', 'Angles'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="checkbox">
            <input
              type="checkbox"
              disabled={!editor.snap.enabled}
              checked={editor.snap[key]}
              onChange={(event) =>
                dispatch({
                  type: 'SET_SNAP',
                  snap: { [key]: event.target.checked },
                })
              }
            />
            {label}
          </label>
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
