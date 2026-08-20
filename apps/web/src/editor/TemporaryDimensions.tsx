import { useEffect, useState } from 'react';
import type { InspectorEdit } from './inspector-edits.js';

/**
 * The measurements shown on the drawing itself, and edited there.
 *
 * A window is placed by typing how far it sits from the corner, and that number
 * belonged to a field called `offsetAlongHostMm` in a panel on the right. Here
 * it is written where it is measured, on the plan, and typing over it moves the
 * window.
 *
 * These are the same edits the inspector offers, not a second way of writing
 * the same thing: the command, its validation and its place in the history are
 * unchanged.
 */
export interface TemporaryDimensionsProps {
  readonly edits: readonly InspectorEdit[];
  readonly atPx: { readonly x: number; readonly y: number };
  readonly onApply: (edit: InspectorEdit, value: string) => void;
}

function TemporaryField({
  edit,
  onApply,
}: {
  readonly edit: InspectorEdit;
  readonly onApply: (edit: InspectorEdit, value: string) => void;
}) {
  const initial =
    edit.control.kind === 'NUMBER'
      ? String(Math.round(edit.control.value))
      : String(edit.control.value);
  const [draft, setDraft] = useState(initial);
  // A change from elsewhere — a drag, an undo — replaces what is shown.
  useEffect(() => setDraft(initial), [initial]);

  return (
    <label className="temporary-dimension">
      <span>{edit.label}</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`${edit.label} sur le plan`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== initial) onApply(edit, draft);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (draft !== initial) onApply(edit, draft);
          }
          if (event.key === 'Escape') setDraft(initial);
        }}
      />
    </label>
  );
}

export function TemporaryDimensions({
  edits,
  atPx,
  onApply,
}: TemporaryDimensionsProps) {
  if (edits.length === 0) return null;
  return (
    <div
      className="temporary-dimensions"
      style={{ left: `${atPx.x}px`, top: `${atPx.y}px` }}
    >
      {edits.map((edit) => (
        <TemporaryField key={edit.id} edit={edit} onApply={onApply} />
      ))}
    </div>
  );
}
