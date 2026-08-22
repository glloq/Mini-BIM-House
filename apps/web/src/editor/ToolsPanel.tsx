/**
 * The tools of the space one is standing in, in the context panel.
 *
 * They were a row above the drawing, and a row of forty buttons is a wall for
 * whoever is drawing their first plan. In a column, grouped by trade, they
 * answer « que puis-je faire ici » — and the drawing gets its width back.
 *
 * There is no « simple » mode and no « expert » mode. The common tools of each
 * trade are visible and the rest are one disclosure away, on the same screen,
 * for everyone: two modes would be two products, and the person who picked the
 * simple one would never learn that the other tool exists.
 */
import { useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';

import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { ToolOptions } from './ToolOptions.js';
import type { ToolDrafts } from './tool-options.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
import {
  TOOL_GROUP_LABELS,
  populatedToolGroups,
  toolAtLevel,
  toolsInGroup,
  type EditorToolDefinition,
  type ToolGroup,
} from './tool-registry.js';

export interface ToolsPanelProps {
  readonly project: Project;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly drafts: ToolDrafts;
  readonly onDraftChange: (key: string, value: string) => void;
  /** The trades worth offering tools for, when the scope narrows them. */
  readonly groups?: readonly ToolGroup[];
}

function hint(commandId: string | undefined): string {
  if (commandId === undefined) return '';
  const binding = SHORTCUTS.find(({ id }) => id === commandId);
  return binding === undefined ? '' : ` (${shortcutLabel(binding)})`;
}

/** Whether this tool is one of the ones shown without asking. */
function isCommon(tool: EditorToolDefinition): boolean {
  return toolAtLevel(tool, 'DESIGN');
}

export function ToolsPanel({
  project,
  editor,
  dispatch,
  drafts,
  onDraftChange,
  groups,
}: ToolsPanelProps) {
  const shown =
    groups === undefined
      ? populatedToolGroups()
      : populatedToolGroups().filter((group) => groups.includes(group));
  return (
    <div className="tools-panel">
      {shown.map((group) => (
        <ToolGroupSection
          key={group}
          group={group}
          project={project}
          editor={editor}
          dispatch={dispatch}
          drafts={drafts}
          onDraftChange={onDraftChange}
        />
      ))}
    </div>
  );
}

function ToolGroupSection({
  group,
  project,
  editor,
  dispatch,
  drafts,
  onDraftChange,
}: {
  readonly group: ToolGroup;
} & Omit<ToolsPanelProps, 'groups'>) {
  const tools = toolsInGroup(group);
  const common = tools.filter(isCommon);
  const advanced = tools.filter((tool) => !isCommon(tool));
  // What the active tool lets one decide before drawing sits under the tool
  // itself: choosing a wall assembly is part of choosing the wall tool, not a
  // separate errand at the top of the window.
  const owns = tools.some(({ id }) => id === editor.activeTool);
  const holdsActive = advanced.some(({ id }) => id === editor.activeTool);
  // Opened by hand, and kept open. Deriving the state from the active tool
  // alone would close the disclosure on the next render, the moment before the
  // person reaches the tool they had just revealed.
  const [opened, setOpened] = useState(false);
  return (
    <section
      className="context-group"
      aria-label={`Outils · ${TOOL_GROUP_LABELS[group]}`}
    >
      <p className="context-group-label">{TOOL_GROUP_LABELS[group]}</p>
      {common.map((tool) => (
        <ToolButton
          key={tool.id}
          tool={tool}
          active={tool.id === editor.activeTool}
          dispatch={dispatch}
        />
      ))}
      {advanced.length > 0 && (
        <details
          className="tools-advanced"
          open={opened || holdsActive}
          onToggle={(event) => setOpened(event.currentTarget.open)}
        >
          <summary>Plus d’outils</summary>
          {advanced.map((tool) => (
            <ToolButton
              key={tool.id}
              tool={tool}
              active={tool.id === editor.activeTool}
              dispatch={dispatch}
            />
          ))}
        </details>
      )}
      {owns && (
        <ToolOptions
          project={project}
          tool={editor.activeTool}
          drafts={drafts}
          onChange={onDraftChange}
        />
      )}
    </section>
  );
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
      title={`${tool.hint} — raccourci${hint(tool.shortcutId)}`}
      onClick={() =>
        dispatch({ type: 'SET_TOOL', tool: tool.id as EditorTool })
      }
    >
      {tool.label}
    </button>
  );
}
