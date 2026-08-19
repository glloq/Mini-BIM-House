import type { Project } from '@house-technical-designer/core-domain';
import {
  NETWORK_DISCIPLINE_LABELS,
  networkNodeTemplates,
} from '@house-technical-designer/editor-core';
import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';

const TOOLS: readonly { readonly id: EditorTool; readonly label: string }[] = [
  { id: 'SELECT', label: 'Sélection' },
  { id: 'WALL', label: 'Mur' },
  { id: 'OPENING', label: 'Ouverture' },
  { id: 'DIMENSION', label: 'Cotation' },
  { id: 'NETWORK', label: 'Réseau' },
];

const SHORTCUT_BY_TOOL: Readonly<Record<EditorTool, string>> = {
  SELECT: 'tool.select',
  WALL: 'tool.wall',
  OPENING: 'tool.opening',
  DIMENSION: 'tool.dimension',
  NETWORK: 'tool.network',
};

export interface ToolBarProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly assemblyId: string;
  readonly onAssemblyChange: (assemblyId: string) => void;
  readonly openingDraft: OpeningDraft;
  readonly onOpeningDraftChange: (draft: OpeningDraft) => void;
  /** Network the node tool adds to; empty while the project has none. */
  readonly networkId: string;
  readonly onNetworkChange: (networkId: string) => void;
  readonly nodeKind: string;
  readonly onNodeKindChange: (kind: string) => void;
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
  networkId,
  onNetworkChange,
  nodeKind,
  onNodeKindChange,
}: ToolBarProps) {
  const networks = project.systems ?? [];
  const activeNetwork = networks.find(({ id }) => id === networkId);
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

      {editor.activeTool === 'NETWORK' && (
        <div className="tool-group">
          {networks.length === 0 ? (
            <p className="hint">
              Aucun réseau : créez-en un dans l’onglet « Réseaux » avant de
              poser des nœuds.
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="tool-network">Réseau</label>
                <select
                  id="tool-network"
                  value={networkId}
                  onChange={(event) => onNetworkChange(event.target.value)}
                >
                  {networks.map((network) => (
                    <option key={network.id} value={network.id}>
                      {NETWORK_DISCIPLINE_LABELS[network.discipline]} ·{' '}
                      {network.systemType}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="tool-node-kind">Type de nœud</label>
                <select
                  id="tool-node-kind"
                  value={nodeKind}
                  onChange={(event) => onNodeKindChange(event.target.value)}
                >
                  {(activeNetwork === undefined
                    ? []
                    : networkNodeTemplates(activeNetwork.discipline)
                  ).map((template) => (
                    <option key={template.kind} value={template.kind}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
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
