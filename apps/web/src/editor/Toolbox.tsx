/**
 * Ce qu'on a sous la main, à l'étape où l'on est.
 *
 * `ToolsPanel` montrait les vingt-cinq outils du registre, groupés par métier,
 * tous à la fois : cent quarante et un boutons dans une colonne, quelle que
 * soit l'activité. Celle-ci montre ce que l'étape propose — une dizaine
 * d'entrées — et rien de plus. Le reste n'est pas caché : il est ailleurs,
 * dans une autre étape, dans « Tous les outils », dans la recherche.
 *
 * Une entrée n'est pas un outil : c'est un outil plus ce qu'on aurait choisi
 * juste après. La choisir prend l'outil **et** remplit ses options — poser un
 * WC, c'est l'outil composant avec la fiche WC déjà désignée.
 */
import { useState } from 'react';
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';

import type { CreationStageId } from '../ux/creation-stages.js';

import type { EditorAction, EditorState, EditorTool } from './editor-state.js';
import { SHORTCUTS, shortcutLabel } from './shortcuts.js';
import { ToolIcon } from './tool-icons.js';
import { ToolOptions } from './ToolOptions.js';
import type { ToolDrafts } from './tool-options.js';
import {
  EDITOR_TOOLS,
  toolById,
  type EditorToolDefinition,
} from './tool-registry.js';
import {
  COMMON_SECTION,
  draftsForEntry,
  entryAvailable,
  missingFicheFamilies,
  toolboxFor,
  type ToolboxEntry,
  type ToolboxSection,
} from './toolbox.js';

export interface ToolboxProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  readonly domain?: DesignDomainId;
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly drafts: ToolDrafts;
  readonly onDraftChange: (key: string, value: string) => void;
  /** Poser plusieurs options d'un coup : une entrée en remplit souvent trois. */
  readonly onDraftsChange: (drafts: ToolDrafts) => void;
  /** Ouvrir la bibliothèque d'équipements, d'où viennent les fiches. */
  readonly onOpenLibrary: () => void;
}

function shortcut(commandId: string | undefined): string {
  if (commandId === undefined) return '';
  const binding = SHORTCUTS.find(({ id }) => id === commandId);
  return binding === undefined ? '' : ` (${shortcutLabel(binding)})`;
}

export function Toolbox({
  project,
  stage,
  domain,
  editor,
  dispatch,
  drafts,
  onDraftChange,
  onDraftsChange,
  onOpenLibrary,
}: ToolboxProps) {
  const sections = toolboxFor(project, stage, domain);
  const common: ToolboxSection = {
    ...COMMON_SECTION,
    entries: COMMON_SECTION.entries.filter((candidate) =>
      entryAvailable(project, candidate),
    ),
  };
  const offered = new Set(
    [...sections, common].flatMap((section) =>
      section.entries.map(({ toolId }) => toolId),
    ),
  );
  // Ce que l'étape ne propose pas reste à un dépliage, sur le même écran : une
  // étape filtre ce qui est proposé, elle ne restreint jamais ce qui est
  // possible.
  const others = EDITOR_TOOLS.filter((tool) => !offered.has(tool.id));
  const [othersOpen, setOthersOpen] = useState(false);
  const holdsActive = others.some(({ id }) => id === editor.activeTool);
  const active = toolById(editor.activeTool);

  const choose = (candidate: ToolboxEntry): void => {
    dispatch({ type: 'SET_TOOL', tool: candidate.toolId as EditorTool });
    const prefilled = draftsForEntry(project, candidate);
    if (Object.keys(prefilled).length > 0) onDraftsChange(prefilled);
  };

  // Une étape qui pose des fiches et n'en trouve aucune n'a rien à montrer :
  // dire d'où elles viennent vaut mieux qu'une colonne vide.
  const missing = missingFicheFamilies(project, stage);

  return (
    <div className="toolbox">
      {sections.length === 0 && missing.length > 0 && (
        <p className="hint">
          Cette étape pose des fiches du catalogue —{' '}
          {missing.slice(0, 3).join(', ')}
          {missing.length > 3 ? '…' : ''} — et ce projet n’en tient aucune.{' '}
          <button type="button" className="link" onClick={onOpenLibrary}>
            Ouvrir la bibliothèque d’équipements
          </button>
        </p>
      )}
      {sections.map((section) => (
        <section
          key={section.id}
          className="toolbox-section"
          aria-label={`Outils · ${section.label}`}
        >
          <p className="context-group-label">{section.label}</p>
          <div className="toolbox-grid">
            {section.entries.map((candidate) => (
              <EntryButton
                key={candidate.id}
                entry={candidate}
                active={candidate.toolId === editor.activeTool}
                onChoose={choose}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Les options de l'outil actif, sous les outils : choisir un assemblage
          fait partie du choix de l'outil mur, ce n'est pas une course
          séparée en haut de la fenêtre. */}
      {active !== undefined && (
        <ToolOptions
          project={project}
          tool={editor.activeTool}
          drafts={drafts}
          onChange={onDraftChange}
        />
      )}

      <section className="toolbox-section" aria-label="Outils · Communs">
        <p className="context-group-label">{common.label}</p>
        <div className="toolbox-grid">
          {common.entries.map((candidate) => (
            <EntryButton
              key={candidate.id}
              entry={candidate}
              active={candidate.toolId === editor.activeTool}
              onChoose={choose}
            />
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <details
          className="toolbox-others"
          open={othersOpen || holdsActive}
          onToggle={(event) => setOthersOpen(event.currentTarget.open)}
        >
          <summary>Tous les outils ({others.length})</summary>
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
        </details>
      )}
    </div>
  );
}

function EntryButton({
  entry,
  active,
  onChoose,
}: {
  readonly entry: ToolboxEntry;
  readonly active: boolean;
  readonly onChoose: (entry: ToolboxEntry) => void;
}) {
  const tool = toolById(entry.toolId);
  return (
    <button
      type="button"
      className={active ? 'toolbox-entry active' : 'toolbox-entry'}
      aria-pressed={active}
      title={`${entry.hint}${shortcut(tool?.shortcutId)}`}
      onClick={() => onChoose(entry)}
    >
      <ToolIcon icon={entry.icon} />
      <span>{entry.label}</span>
    </button>
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
      title={`${tool.hint} — raccourci${shortcut(tool.shortcutId)}`}
      onClick={() =>
        dispatch({ type: 'SET_TOOL', tool: tool.id as EditorTool })
      }
    >
      {tool.label}
    </button>
  );
}
