import { useEffect, useState } from 'react';
import type { InspectorEdit } from './inspector-edits.js';

export interface InspectorFieldProps {
  readonly edit: InspectorEdit;
  readonly onApply: (edit: InspectorEdit, value: string) => void;
}

/**
 * One editable property.
 *
 * Typed values are committed on blur or on Enter, never on every keystroke:
 * one keystroke per command would fill the undo history with letters and
 * invalidate the calculations on each of them. A select commits immediately,
 * because choosing an option is already a decision.
 */
export function InspectorField({ edit, onApply }: InspectorFieldProps) {
  const initial =
    edit.control.kind === 'NUMBER'
      ? String(edit.control.value)
      : edit.control.value;
  const [draft, setDraft] = useState(initial);

  // A change coming from elsewhere — an undo, another panel — replaces what is
  // being typed only when the user is not the one who caused it.
  useEffect(() => setDraft(initial), [initial]);

  const commit = (): void => {
    if (draft !== initial) onApply(edit, draft);
  };

  return (
    <div className="field inspector-edit">
      <label htmlFor={`inspector-${edit.id}`}>
        {edit.label}
        {edit.control.kind === 'NUMBER' && edit.control.unit !== undefined && (
          <small> ({edit.control.unit})</small>
        )}
      </label>
      {edit.control.kind === 'SELECT' ? (
        <select
          id={`inspector-${edit.id}`}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onApply(edit, event.target.value);
          }}
        >
          {edit.control.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`inspector-${edit.id}`}
          type={edit.control.kind === 'NUMBER' ? 'number' : 'text'}
          value={draft}
          {...(edit.control.kind === 'NUMBER'
            ? {
                ...(edit.control.step === undefined
                  ? {}
                  : { step: edit.control.step }),
                ...(edit.control.min === undefined
                  ? {}
                  : { min: edit.control.min }),
              }
            : {
                ...(edit.control.placeholder === undefined
                  ? {}
                  : { placeholder: edit.control.placeholder }),
              })}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') setDraft(initial);
          }}
        />
      )}
      {edit.hint !== undefined && <small className="hint">{edit.hint}</small>}
    </div>
  );
}
