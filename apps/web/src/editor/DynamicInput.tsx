import { useEffect, useRef, useState } from 'react';
import type { DirectInputPatch } from './editor-state.js';
import { completionLabel, type CompletionMode } from './tool-registry.js';
import { parseOffsetMm } from './placement-values.js';
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

/**
 * Ce qu'un champ de valeur exacte mesure : une longueur ou un cap.
 *
 * Deux unités seulement, parce que le plan n'en connaît que deux, et le choix
 * décide de trois choses à la fois — comment on lit ce qui est tapé, comment
 * on écrit ce que la souris dit, et quel signe a un sens. Un écart peut être
 * négatif ou nul, un cap ne l'est jamais vraiment ; les deux se ramènent dans
 * la fonction qui les lit plutôt que dans chaque appelant.
 */
export type ExactValueUnit = 'MM' | 'DEG';

export interface ExactValueField<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
  readonly unit: ExactValueUnit;
  /**
   * Ce que la souris dit en ce moment.
   *
   * Il s'affiche en filigrane du champ, jamais comme sa valeur : un champ
   * pré-rempli par la souris se remettrait à jour sous les doigts de qui est
   * en train d'y taper, et l'on ne saurait plus lequel des deux gagne. Vide,
   * le champ suit la souris ; rempli, il l'emporte.
   */
  readonly measured: number;
}

export interface ExactValueInputProps<Id extends string = string> {
  /** Où les champs se posent sur la toile, en pixels. */
  readonly atPx: { readonly x: number; readonly y: number };
  /** Ce que ces champs règlent, dit pour qui ne voit pas le dessin. */
  readonly title: string;
  readonly fields: readonly ExactValueField<Id>[];
  /** Une valeur tapée, ou `undefined` quand le champ est rendu à la souris. */
  readonly onChange: (id: Id, value: number | undefined) => void;
  /** Fait le geste avec ce qui est tapé, exactement comme un clic le ferait. */
  readonly onCommit: () => void;
  readonly onCancel: () => void;
  readonly commitLabel: string;
  /** Ce qu'il reste à savoir pendant la saisie : la touche qui tourne, par exemple. */
  readonly hint?: string;
  /**
   * Si les champs prennent le clavier en paraissant.
   *
   * Ils le prennent quand ils naissent d'un geste déjà commencé — deux clics
   * posés, une sélection qu'on traîne : la frappe suivante est pour eux. Ils
   * ne le prennent pas quand ils accompagnent un outil qui attend encore, où
   * le clavier sert d'abord à faire tourner ce qu'on s'apprête à poser.
   */
  readonly takesFocus: boolean;
}

/** Ce que la souris dit, écrit comme le plan écrit déjà cette grandeur. */
function measuredLabel(field: ExactValueField): string {
  return field.unit === 'DEG'
    ? `${field.measured.toFixed(1)}°`
    : `${Math.round(field.measured)} mm`;
}

/**
 * La valeur exacte, tapée là où la souris ne sait qu'approcher.
 *
 * Les mêmes champs que ceux du tracé de mur, au même endroit — sous le
 * curseur, là où l'on regarde — et avec les mêmes touches : on tape, Tab passe
 * au champ suivant, Entrée fait le geste, Échap l'abandonne. C'est délibéré :
 * une deuxième façon de saisir un nombre pendant qu'on dessine serait une
 * deuxième chose à apprendre pour la même chose à faire.
 *
 * Ce qu'ils ajoutent n'est pas un mode. L'outil reste celui qu'il était, les
 * clics restent les mêmes, et personne n'a à choisir entre « à la souris » et
 * « au clavier » avant de commencer : on tire, on regarde le nombre, on le
 * corrige s'il faut. C'est ce qui permet aux trois façons de travailler —
 * l'approximative, la précise, l'experte — de tenir dans un seul outil.
 */
export function ExactValueInput<Id extends string>({
  atPx,
  title,
  fields,
  onChange,
  onCommit,
  onCancel,
  commitLabel,
  hint,
  takesFocus,
}: ExactValueInputProps<Id>) {
  const first = useRef<HTMLInputElement>(null);
  const [texts, setTexts] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    if (takesFocus) first.current?.focus();
  }, [takesFocus]);

  const commit = (field: ExactValueField<Id>, text: string): void => {
    setTexts((current) => ({ ...current, [field.id]: text }));
    if (text.trim() === '') {
      onChange(field.id, undefined);
      return;
    }
    const parsed =
      field.unit === 'DEG' ? parseAngleDeg(text) : parseOffsetMm(text);
    // Une saisie qu'on ne sait pas lire ne devient pas zéro : le champ reste
    // ce qu'on y a tapé, et la souris continue de décider tant qu'il n'a pas
    // de sens. Inventer une valeur ici est exactement ce qui ferait poser un
    // objet là où personne ne l'a demandé.
    onChange(field.id, parsed);
  };

  return (
    <div
      className="dynamic-input"
      style={{ left: `${atPx.x}px`, top: `${atPx.y}px` }}
      role="group"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit();
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      // Ces champs sont posés sur la surface de dessin, et la surface de
      // dessin prend tout ce qu'on presse : cliquer dans un champ y posait
      // aussi un point. Ce qu'on presse ici est pressé ici.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      // Et le curseur qui vient jusqu'ici a quitté le dessin : sans cela, il
      // continuerait d'y déplacer le point visé, et le bouton « poser »
      // poserait l'objet sous le bouton plutôt qu'à l'endroit qu'on regardait.
      // Un glissement en cours n'est pas concerné : le pointeur y est capturé
      // par la toile, et ces champs ne le voient pas passer.
      onPointerMove={(event) => event.stopPropagation()}
    >
      {fields.map((field, index) => (
        <label key={field.id}>
          <span>{field.label}</span>
          <input
            ref={index === 0 ? first : undefined}
            type="text"
            inputMode="decimal"
            aria-label={`${title} · ${field.label}`}
            placeholder={measuredLabel(field)}
            value={texts[field.id] ?? ''}
            onChange={(event) => commit(field, event.target.value)}
          />
        </label>
      ))}
      {hint !== undefined && <span className="lock">{hint}</span>}
      <button type="button" className="primary" onClick={onCommit}>
        {commitLabel}
      </button>
    </div>
  );
}
