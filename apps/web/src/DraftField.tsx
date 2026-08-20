import { useState, type ReactNode } from 'react';

export type DraftFieldKind = 'TEXT' | 'NUMBER' | 'BOOLEAN';

export interface DraftFieldProps {
  readonly id: string;
  readonly label: ReactNode;
  readonly kind: DraftFieldKind;
  /** Current value, as the model holds it. */
  readonly value: string | number | boolean | undefined;
  readonly unit?: string;
  readonly hint?: string;
  readonly placeholder?: string;
  readonly min?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  /**
   * Called once per decision, with the raw text. An empty string means the
   * user cleared the field, which callers read as "no value" rather than zero.
   */
  readonly onCommit: (value: string) => void;
}

function asText(value: string | number | boolean | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * A field that commits once, not once per keystroke.
 *
 * Typing into a field is not a series of decisions. Sending a command per
 * character fills the undo history with letters, invalidates the calculations
 * on each one and retriggers the autosave; the decision is made on blur or on
 * Enter, and Escape puts back what the model holds.
 *
 * A checkbox commits immediately, because ticking one is already the decision.
 */
export function DraftField({
  id,
  label,
  kind,
  value,
  unit,
  hint,
  placeholder,
  min,
  step,
  disabled,
  onCommit,
}: DraftFieldProps) {
  const stored = asText(value);
  const [draft, setDraft] = useState(stored);
  const [shown, setShown] = useState(stored);
  // A change coming from elsewhere — an undo, another panel, another project —
  // replaces the draft; what the user is typing is not overwritten by itself.
  if (shown !== stored) {
    setShown(stored);
    setDraft(stored);
  }

  if (kind === 'BOOLEAN')
    return (
      <label className="checkbox" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={disabled === true}
          onChange={(event) =>
            onCommit(event.target.checked ? 'true' : 'false')
          }
        />
        <span>{label}</span>
      </label>
    );

  const commit = (): void => {
    if (draft !== stored) onCommit(draft);
  };

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit !== undefined && <small> ({unit})</small>}
      </label>
      <input
        id={id}
        type={kind === 'NUMBER' ? 'number' : 'text'}
        value={draft}
        disabled={disabled === true}
        {...(kind === 'NUMBER' ? { step: step ?? 'any' } : {})}
        {...(min === undefined ? {} : { min })}
        {...(placeholder === undefined ? {} : { placeholder })}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') setDraft(stored);
        }}
      />
      {hint !== undefined && <small className="hint">{hint}</small>}
    </div>
  );
}
