import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  /**
   * Ce que le dessin mesure, pour que la cote reste dessus.
   *
   * Elle se posait à l'aplomb de l'objet, soixante pixels plus haut. Sur un
   * mur près du bord supérieur, ces soixante pixels tombaient **hors** du
   * dessin — la case du plan rogne ce qui en sort — et le champ où l'on tape
   * la longueur n'existait plus. Un objet qu'on désigne au bord n'est pas un
   * cas rare : c'est là qu'on dessine en premier.
   */
  readonly framePx: { readonly width: number; readonly height: number };
  readonly onApply: (edit: InspectorEdit, value: string) => void;
}

/** Entre deux bornes, et jamais en dessous de la première. */
function within(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, Math.max(low, high)));
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
  framePx,
  onApply,
}: TemporaryDimensionsProps) {
  const box = useRef<HTMLDivElement>(null);
  /*
   * Sa taille, relevée une fois posée.
   *
   * Elle dépend de ce qu'on cote — « Longueur » et « Épaisseur » ne font pas
   * la même largeur que « Distance au coin » — donc on la mesure plutôt que de
   * la deviner. Le premier rendu la place comme avant, à la transformation
   * CSS ; le suivant la borne au dessin.
   */
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = box.current;
    if (node === null) return;
    const { width, height } = node.getBoundingClientRect();
    setSize((held) =>
      Math.abs(held.width - width) < 1 && Math.abs(held.height - height) < 1
        ? held
        : { width, height },
    );
  }, [edits, atPx.x, atPx.y]);

  if (edits.length === 0) return null;
  const placed = size.width > 0 && size.height > 0;
  const above = atPx.y - size.height - 12;
  const left = placed
    ? within(atPx.x - size.width / 2, 4, framePx.width - size.width - 4)
    : atPx.x;
  // Au-dessus de l'objet quand il y a la place, en dessous sinon : c'est ce
  // qu'on fait à la main quand une cote ne tient pas.
  const top = placed
    ? within(
        above < 4 ? atPx.y + 14 : above,
        4,
        framePx.height - size.height - 4,
      )
    : atPx.y;
  return (
    <div
      ref={box}
      className={
        placed ? 'temporary-dimensions is-placed' : 'temporary-dimensions'
      }
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {edits.map((edit) => (
        <TemporaryField key={edit.id} edit={edit} onApply={onApply} />
      ))}
    </div>
  );
}
