import type { Project } from '@house-technical-designer/core-domain';
import type { EditorTool } from './editor-state.js';
import { optionsOf } from './tool-registry.js';
import {
  toolOptionContext,
  toolOptionLayout,
  type OfferedToolOption,
} from './option-visibility.js';
import {
  storageKeyOf,
  type ToolDrafts,
  type ToolOptionContext,
} from './tool-options.js';

export interface ToolOptionsProps {
  readonly project: Project;
  readonly tool: EditorTool;
  readonly drafts: ToolDrafts;
  /** Called with the key the value is stored under, scope included. */
  readonly onChange: (storageKey: string, value: string) => void;
}

/**
 * What the active tool asks before drawing.
 *
 * The toolbar held one hand-written panel per tool; a new tool meant another
 * panel, and an editor covering stairs, columns, furniture, ducts and
 * annotations would have ended as a wall of controls nobody arranged. This
 * renders whatever the tool declares, and knows nothing about walls or ducts.
 *
 * Elle ne rend plus tout ce qui est déclaré, cependant : elle rend ce que
 * `option-visibility` juge applicable maintenant, et replie le reste. Ce qui
 * est replié garde sa valeur — la barre décide de ce qui est montré, jamais de
 * ce qui est construit.
 */
export function ToolOptions({
  project,
  tool,
  drafts,
  onChange,
}: ToolOptionsProps) {
  const options = optionsOf(tool);
  if (options.length === 0) return null;
  const context = toolOptionContext(project, tool, options, drafts);
  const layout = toolOptionLayout(project, tool, options, drafts);
  if (layout.primary.length === 0 && layout.advanced.length === 0) return null;

  const field = (offered: OfferedToolOption) => (
    <ToolOptionField
      key={offered.option.key}
      tool={tool}
      offered={offered}
      context={context}
      onChange={onChange}
    />
  );

  return (
    <div className="tool-group" role="group" aria-label="Options de l’outil">
      {layout.primary.map(field)}
      {layout.advanced.length > 0 && (
        /*
         * `<details>` plutôt qu'un bouton et un état : le repli est un
         * comportement du navigateur, il fonctionne sans feuille de style et
         * sans rien à retenir entre deux rendus. L'ouverture appartient à
         * celui qui lit — rien ici ne la force, pas même un réglage modifié,
         * qui se contente de le dire.
         *
         * Sa classe n'est pas `tool-more`, qui est déjà celle du « + » de la
         * palette : deux dépliages voisins qui ne montrent pas la même chose
         * ne peuvent pas porter le même nom, sinon le premier style croisé
         * enferme ce texte dans le carré de deux rem de l'autre.
         */
        <details className="tool-option-more">
          <summary>
            Plus de réglages
            {layout.changedAdvanced > 0 && (
              <small>
                {' '}
                · {layout.changedAdvanced} modifié
                {layout.changedAdvanced > 1 ? 's' : ''}
              </small>
            )}
          </summary>
          <div className="tool-option-more-fields">
            {layout.advanced.map(field)}
          </div>
        </details>
      )}
    </div>
  );
}

/** Un champ, quel que soit le groupe où il a été rangé. */
function ToolOptionField({
  tool,
  offered,
  context,
  onChange,
}: {
  readonly tool: EditorTool;
  readonly offered: OfferedToolOption;
  readonly context: ToolOptionContext;
  readonly onChange: (storageKey: string, value: string) => void;
}) {
  const { option, value, enabled } = offered;
  const id = `tool-option-${tool}-${option.key}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {option.label}
        {option.unit !== undefined && <small> ({option.unit})</small>}
      </label>
      {option.kind === 'SELECT' ? (
        <select
          id={id}
          value={value}
          disabled={!enabled}
          onChange={(event) =>
            onChange(storageKeyOf(tool, option), event.target.value)
          }
        >
          {(option.choices?.(context) ?? []).map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={option.kind === 'NUMBER' ? 'number' : 'text'}
          value={value}
          disabled={!enabled}
          {...(option.min === undefined ? {} : { min: option.min })}
          {...(option.step === undefined ? {} : { step: option.step })}
          onChange={(event) =>
            onChange(storageKeyOf(tool, option), event.target.value)
          }
        />
      )}
      {option.hint !== undefined && (
        <small className="hint">{option.hint}</small>
      )}
    </div>
  );
}
