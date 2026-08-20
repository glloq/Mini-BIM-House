import type {
  DimensionType,
  Project,
  WallRole,
} from '@house-technical-designer/core-domain';
import {
  NETWORK_DISCIPLINE_LABELS,
  networkNodeTemplates,
} from '@house-technical-designer/editor-core';
import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
import {
  TOOL_GROUP_LABELS,
  populatedToolGroups,
  toolsInGroup,
} from './tool-registry.js';
import {
  DIMENSION_TYPE_OPTIONS,
  OPENING_TYPE_OPTIONS,
  WALL_ROLE_OPTIONS,
} from './domain-options.js';

export interface ToolBarProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly assemblyId: string;
  readonly onAssemblyChange: (assemblyId: string) => void;
  readonly wallRole: WallRole;
  readonly onWallRoleChange: (role: WallRole) => void;
  readonly openingDraft: OpeningDraft;
  readonly onOpeningDraftChange: (draft: OpeningDraft) => void;
  readonly dimensionType: DimensionType;
  readonly onDimensionTypeChange: (type: DimensionType) => void;
  /** Network the node tool adds to; empty while the project has none. */
  readonly networkId: string;
  readonly onNetworkChange: (networkId: string) => void;
  readonly nodeKind: string;
  readonly onNodeKindChange: (kind: string) => void;
  /** Turns or reflects the selection about its own centre. */
  readonly onTransform?: (kind: 'ROTATE' | 'MIRROR') => void;
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
  wallRole,
  onWallRoleChange,
  openingDraft,
  onOpeningDraftChange,
  dimensionType,
  onDimensionTypeChange,
  networkId,
  onNetworkChange,
  nodeKind,
  onNodeKindChange,
  onTransform,
}: ToolBarProps) {
  const networks = project.systems ?? [];
  const activeNetwork = networks.find(({ id }) => id === networkId);
  const wallAssemblies = (project.assemblies ?? []).filter(
    ({ category }) => category === 'WALL' || category === 'PARTITION',
  );
  return (
    <div className="tool-bar">
      {/* One group per family: the toolbar asks the registry what exists
          rather than holding its own list, so a new tool appears beside the
          ones it belongs with instead of at the end of a growing row. */}
      {populatedToolGroups().map((group) => (
        <div
          className="tool-group"
          role="group"
          aria-label={`Outils · ${TOOL_GROUP_LABELS[group]}`}
          key={group}
        >
          {toolsInGroup(group).map((tool) => (
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

      {editor.activeTool === 'WALL' && (
        <div className="tool-group">
          <div className="field">
            <label htmlFor="tool-wall-assembly">Assemblage</label>
            <select
              id="tool-wall-assembly"
              value={assemblyId}
              onChange={(event) => onAssemblyChange(event.target.value)}
            >
              {wallAssemblies.map((assembly) => (
                <option key={assembly.id} value={assembly.id}>
                  {assembly.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tool-wall-role">Rôle</label>
            <select
              id="tool-wall-role"
              value={wallRole}
              onChange={(event) =>
                onWallRoleChange(event.target.value as WallRole)
              }
            >
              {WALL_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
              {OPENING_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
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

      {editor.activeTool === 'DIMENSION' && (
        <div className="tool-group">
          <div className="field">
            <label htmlFor="tool-dimension-type">Type de cote</label>
            <select
              id="tool-dimension-type"
              value={dimensionType}
              onChange={(event) =>
                onDimensionTypeChange(event.target.value as DimensionType)
              }
            >
              {DIMENSION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="hint">
            Cliquez deux angles de murs, puis un troisième point pour placer la
            ligne de cote.
          </p>
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

      <div className="tool-group" role="group" aria-label="Modification">
        <button
          type="button"
          className="secondary"
          disabled={editor.selection.length === 0}
          title="Pivoter la sélection d’un quart de tour autour de son centre"
          onClick={() => onTransform?.('ROTATE')}
        >
          Pivoter 90°{hint('edit.rotate')}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={editor.selection.length === 0}
          title="Retourner la sélection de gauche à droite"
          onClick={() => onTransform?.('MIRROR')}
        >
          Miroir{hint('edit.mirror')}
        </button>
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
