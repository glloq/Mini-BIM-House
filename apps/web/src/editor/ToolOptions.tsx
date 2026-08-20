import type { Project } from '@house-technical-designer/core-domain';
import type { EditorTool } from './editor-state.js';
import { optionsOf } from './tool-registry.js';
import {
  optionValue,
  type ToolDrafts,
  type ToolOptionContext,
} from './tool-options.js';

export interface ToolOptionsProps {
  readonly project: Project;
  readonly tool: EditorTool;
  readonly drafts: ToolDrafts;
  readonly onChange: (key: string, value: string) => void;
}

/**
 * What the active tool asks before drawing.
 *
 * The toolbar held one hand-written panel per tool; a new tool meant another
 * panel, and an editor covering stairs, columns, furniture, ducts and
 * annotations would have ended as a wall of controls nobody arranged. This
 * renders whatever the tool declares, and knows nothing about walls or ducts.
 */
export function ToolOptions({
  project,
  tool,
  drafts,
  onChange,
}: ToolOptionsProps) {
  const options = optionsOf(tool);
  if (options.length === 0) return null;
  const read = (key: string): string =>
    optionValue(project, tool, options, drafts, key);
  const context: ToolOptionContext = { project, value: read };

  return (
    <div className="tool-group" role="group" aria-label="Options de l’outil">
      {options.map((option) => {
        const id = `tool-option-${tool}-${option.key}`;
        const value = read(option.key);
        return (
          <div className="field" key={option.key}>
            <label htmlFor={id}>
              {option.label}
              {option.unit !== undefined && <small> ({option.unit})</small>}
            </label>
            {option.kind === 'SELECT' ? (
              <select
                id={id}
                value={value}
                onChange={(event) => onChange(option.key, event.target.value)}
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
                {...(option.min === undefined ? {} : { min: option.min })}
                {...(option.step === undefined ? {} : { step: option.step })}
                onChange={(event) => onChange(option.key, event.target.value)}
              />
            )}
            {option.hint !== undefined && (
              <small className="hint">{option.hint}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}
