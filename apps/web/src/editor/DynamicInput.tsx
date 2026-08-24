import { useEffect, useRef, useState } from 'react';
import type { DirectInputPatch } from './editor-state.js';
import { completionLabel, type CompletionMode } from './tool-registry.js';
import { parseAngleDeg, parseLengthMm } from './typed-values.js';

export interface DynamicInputProps {
  /** Where on the canvas the fields sit, in pixels. */
  readonly atPx: { readonly x: number; readonly y: number };
  /** What the segment being drafted measures right now. */
  readonly lengthMm: number;
  readonly angleDeg: number;
  /** What the user has locked, if anything. */
  readonly lockedLengthMm?: number;
  readonly lockedAngleDeg?: number;
  /**
   * Which of the two the tool actually takes.
   *
   * The mirror tool takes an angle and no length — an axis has a direction and
   * no end — and the fields were shown all the same: typing a length into a
   * tool that ignores it is watching a value do nothing.
   */
  readonly accepts: { readonly length: boolean; readonly angle: boolean };
  readonly onChange: (patch: DirectInputPatch) => void;
  /** Asks the tool to place its point with what is locked. */
  readonly onCommit: () => void;
  /**
   * Ends a run, which is not the same as placing a point.
   *
   * A run of walls has no number of corners known in advance: Enter placed the
   * point and, on the second one, also ended the run, so a chain drawn from the
   * fields could never have three corners. Placing and finishing are two
   * gestures because they are two decisions.
   */
  readonly onFinish?: () => void;
  /** Ce que « terminer » veut dire ici : fermer une surface, ou finir un chemin. */
  readonly completion?: CompletionMode;
  /** Retirer le dernier sommet posé, quand il y en a un. */
  readonly onUndoPoint?: () => void;
  readonly onCancel: () => void;
}

/**
 * The length and the angle, where the user is looking.
 *
 * Drawing a wall means watching the end of it, and the fields that say how long
 * it is were at the top of the window. Here they follow the cursor: type a
 * length, Tab for the angle, Enter to place the point. A field left alone
 * measures what is being drawn; a field typed into locks it, and the drawing
 * follows what was typed rather than the pointer.
 */
export function DynamicInput({
  atPx,
  lengthMm,
  angleDeg,
  lockedLengthMm,
  lockedAngleDeg,
  accepts,
  onChange,
  onCommit,
  onFinish,
  completion,
  onUndoPoint,
  onCancel,
}: DynamicInputProps) {
  const length = useRef<HTMLInputElement>(null);
  const [lengthText, setLengthText] = useState('');
  const [angleText, setAngleText] = useState('');

  // The length is where typing goes first, because it is what is typed first.
  useEffect(() => length.current?.focus(), []);

  const commitLength = (text: string): void => {
    setLengthText(text);
    const parsed = parseLengthMm(text);
    onChange({ lengthMm: text.trim() === '' ? null : (parsed ?? null) });
  };
  const commitAngle = (text: string): void => {
    setAngleText(text);
    const parsed = parseAngleDeg(text);
    onChange({ angleDeg: text.trim() === '' ? null : (parsed ?? null) });
  };

  /*
   * Entrée valide ce qu'on a tapé, et termine quand on n'a rien tapé.
   *
   * L'aide générale annonce « Entrée : terminer le tracé » ; ces champs
   * faisaient l'inverse — Entrée posait un point, et il fallait Ctrl+Entrée
   * pour finir. Deux réponses à la même touche selon l'endroit du curseur,
   * c'est une interface qui se contredit.
   *
   * Un champ vide ne demande rien : Entrée y veut dire ce qu'elle veut dire
   * partout ailleurs. Un champ où l'on vient de taper une longueur demande
   * qu'on la pose, et c'est le geste qu'on est en train de faire.
   * Ctrl+Entrée reste l'alias de l'expert : il termine dans les deux cas, et
   * il n'est jamais nécessaire — les boutons sont là pour cela.
   */
  const typing = lengthText.trim() !== '' || angleText.trim() !== '';

  function handleKey(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const finishing = event.ctrlKey || event.metaKey || !typing;
      if (finishing && onFinish !== undefined) onFinish();
      else onCommit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="dynamic-input"
      style={{ left: `${atPx.x}px`, top: `${atPx.y}px` }}
      onKeyDown={handleKey}
      // These fields sit over the drawing surface, and the drawing surface
      // places a point wherever it is pressed: clicking into the length field
      // was also clicking on the plan. What is pressed here is pressed here.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {accepts.length && (
        <label>
          <span>Longueur</span>
          <input
            ref={length}
            type="text"
            inputMode="decimal"
            aria-label="Longueur du tracé"
            placeholder={`${Math.round(lengthMm)} mm`}
            value={lengthText}
            onChange={(event) => commitLength(event.target.value)}
          />
          {lockedLengthMm !== undefined && (
            <span className="lock">verrouillé</span>
          )}
        </label>
      )}
      {accepts.angle && (
        <label>
          <span>Angle</span>
          <input
            ref={accepts.length ? undefined : length}
            type="text"
            inputMode="decimal"
            aria-label="Angle du tracé"
            placeholder={`${angleDeg.toFixed(1)}°`}
            value={angleText}
            onChange={(event) => commitAngle(event.target.value)}
          />
          {lockedAngleDeg !== undefined && (
            <span className="lock">verrouillé</span>
          )}
        </label>
      )}
      {onFinish !== undefined && (
        <button
          type="button"
          className="primary"
          title={
            typing
              ? 'Entrée pose le point tapé ; Ctrl+Entrée achève le tracé'
              : 'Entrée achève le tracé'
          }
          onClick={onFinish}
        >
          {completionLabel(completion ?? 'FINISH_PATH')}
        </button>
      )}
      {onUndoPoint !== undefined && (
        <button
          type="button"
          className="secondary"
          title="Retirer le dernier sommet posé, et lui seul"
          onClick={onUndoPoint}
        >
          Annuler dernier sommet
        </button>
      )}
    </div>
  );
}
