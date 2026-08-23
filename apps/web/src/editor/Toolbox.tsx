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
import type { DesignState } from '../ux/design-state.js';

import {
  COMMON_SECTION,
  availabilityOf,
  draftsForEntry,
  entryAvailable,
  missingFicheFamilies,
  toolboxFor,
  unblockingEntry,
  type ToolboxAvailability,
  type ToolboxEntry,
  type ToolboxSection,
} from './toolbox.js';

export interface ToolboxProps {
  readonly project: Project;
  readonly stage: CreationStageId;
  readonly domain?: DesignDomainId;
  /**
   * La sous-partie ouverte, quand la rangée en a désigné une.
   *
   * Une seule est montrée : l'espace dit de quelle partie de la maison on
   * s'occupe, la rangée dit laquelle de ses parties, et la colonne montre ce
   * qu'il faut pour celle-là. Absente, on retombe sur tout ce que l'espace
   * propose — c'est ce que faisaient les neuf étapes.
   */
  readonly section?: string;
  /** Ce que la maison est, pour savoir quels outils servent vraiment. */
  readonly design: DesignState;
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
  section,
  design,
  editor,
  dispatch,
  drafts,
  onDraftChange,
  onDraftsChange,
  onOpenLibrary,
}: ToolboxProps) {
  // La sous-partie est cherchée parmi toutes celles de l'espace, et non parmi
  // celles que le métier laisse passer : « Ossature » nomme la structure, et
  // la chercher à travers le filtre d'architecture reviendrait à la perdre au
  // moment même où on la désigne.
  const chosen = toolboxFor(project, stage, undefined, design).find(
    ({ id }) => id === section,
  );
  const sections =
    chosen === undefined
      ? toolboxFor(project, stage, domain, design)
      : [chosen];
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

  /*
   * Les recommandées d'abord.
   *
   * L'ordre du registre est celui d'un chantier ; celui de l'écran est celui
   * de ce qui reste à faire. Trier plutôt que masquer : la personne retrouve
   * ses outils au même endroit, avec le plus utile en tête.
   */
  const ordered = (entries: readonly ToolboxEntry[]): ToolboxAvailability[] => {
    const graded = entries.map((candidate) =>
      availabilityOf(candidate, design),
    );
    return [
      ...graded.filter(({ recommended }) => recommended),
      ...graded.filter(({ recommended, enabled }) => !recommended && enabled),
      ...graded.filter(({ enabled }) => !enabled),
    ];
  };

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
            {ordered(section.entries).map((available) => (
              <EntryButton
                key={available.entry.id}
                available={available}
                active={available.entry.toolId === editor.activeTool}
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
          {ordered(common.entries).map((available) => (
            <EntryButton
              key={available.entry.id}
              available={available}
              active={available.entry.toolId === editor.activeTool}
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

/**
 * Une entrée, et ce qu'elle vaut devant cette maison-là.
 *
 * Une entrée qui ne sert pas encore dit **pourquoi**, écrit sous son nom : un
 * bouton grisé en silence est une panne, et la personne le prend pour un
 * défaut du programme plutôt que pour une étape qui lui manque.
 *
 * Quand la condition se règle avec un outil, la tuile *est* le geste qui
 * débloque : cliquer « Porte » sans mur tracé prend l'outil Mur. Elle n'est
 * donc pas désactivée — un bouton qu'on annonce inerte et qui agit ment à qui
 * l'écoute — seulement marquée et expliquée. C'est là où rien ne débloque
 * — un étage se pose dans le menu du projet — que le bouton est vraiment
 * `disabled`, et il garde sa raison.
 */
function EntryButton({
  available,
  active,
  onChoose,
}: {
  readonly available: ToolboxAvailability;
  readonly active: boolean;
  readonly onChoose: (entry: ToolboxEntry) => void;
}) {
  const { entry, enabled, recommended, requirement } = available;
  const tool = toolById(entry.toolId);
  const unblock = enabled ? undefined : unblockingEntry(requirement);
  const classes = ['toolbox-entry'];
  if (active) classes.push('active');
  if (recommended) classes.push('recommended');
  if (!enabled) classes.push('blocked');
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={active}
      {...(requirement === undefined
        ? {}
        : { 'aria-description': requirement.reason })}
      {...(unblock === undefined ? { disabled: !enabled } : {})}
      title={
        requirement === undefined
          ? `${entry.hint}${shortcut(tool?.shortcutId)}`
          : unblock === undefined
            ? `${entry.label} — ${requirement.reason}`
            : `${entry.label} — ${requirement.reason} Cliquez pour prendre « ${unblock.label} ».`
      }
      onClick={() => onChoose(unblock ?? entry)}
    >
      <ToolIcon icon={entry.icon} />
      <span>{entry.label}</span>
      {recommended && (
        <span className="entry-flag" aria-hidden="true">
          ●
        </span>
      )}
      {requirement !== undefined && (
        // Hors du nom accessible : « Porte » doit rester « Porte » pour qui
        // la cherche. La raison passe par `aria-description`, juste au-dessus.
        <span className="entry-reason" aria-hidden="true">
          {requirement.reason}
        </span>
      )}
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
