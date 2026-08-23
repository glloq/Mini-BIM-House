/**
 * One place in the application, named once.
 *
 * Six features already had to say « va là-bas » — une vérification, un calcul,
 * une recherche, l'arbre du projet, une quantité, un scénario — and each said
 * it differently, so each of them could reach a slightly different depth. A
 * check could open a stage; it could not open the storey, select the object
 * and expand the property it was talking about, because nothing in the
 * application could express that.
 *
 * A target expresses all of it, and everything unstated stays unstated: a
 * target with only a stage asks for a stage, not for a stage plus a guessed
 * selection.
 */
import type { DesignDomainId } from '@house-technical-designer/core-domain';

import type { CreationStageId } from './creation-stages.js';

export interface UiTarget {
  /** L'étape de création à ouvrir : ce que la personne va être en train de faire. */
  readonly stage?: CreationStageId;
  /** The technical discipline to read the plan through, in Systèmes. */
  readonly domain?: DesignDomainId;
  readonly levelId?: string;
  /** The object to select, and to frame if it can be found. */
  readonly objectId?: string;
  /**
   * The field the person is being sent to, as a path in the inspector.
   *
   * `dimensions.heightMm` rather than « la hauteur » : a stage is not an
   * answer, a field is.
   */
  readonly propertyPath?: string;
  /** An overlay to switch on so that what is being pointed at is visible. */
  readonly overlayId?: string;
}

/**
 * What a navigation costs the person, from nothing to a full change of place.
 *
 * Used to decide whether to animate, to announce, or to leave the canvas
 * alone: re-selecting an object on the storey already open must not feel like
 * changing application.
 */
export type UiTargetReach = 'NONE' | 'SELECTION' | 'LEVEL' | 'STAGE';

export interface UiLocation {
  readonly stage: CreationStageId;
  readonly domain?: DesignDomainId;
  readonly levelId?: string;
  readonly objectId?: string;
}

export function targetReach(from: UiLocation, to: UiTarget): UiTargetReach {
  if (to.stage !== undefined && to.stage !== from.stage) return 'STAGE';
  if (to.domain !== undefined && to.domain !== from.domain) return 'STAGE';
  if (to.levelId !== undefined && to.levelId !== from.levelId) return 'LEVEL';
  if (to.objectId !== undefined && to.objectId !== from.objectId)
    return 'SELECTION';
  if (to.propertyPath !== undefined || to.overlayId !== undefined)
    return 'SELECTION';
  return 'NONE';
}

/** The location a target describes, read from where the person currently is. */
export function locationAfter(from: UiLocation, to: UiTarget): UiLocation {
  const domain = to.domain ?? from.domain;
  const levelId = to.levelId ?? from.levelId;
  const objectId = to.objectId ?? from.objectId;
  return {
    stage: to.stage ?? from.stage,
    ...(domain === undefined ? {} : { domain }),
    ...(levelId === undefined ? {} : { levelId }),
    ...(objectId === undefined ? {} : { objectId }),
  };
}

/**
 * Whether a target says anything at all.
 *
 * An empty target is a bug at the call site — a feature that meant to point
 * somewhere and pointed nowhere — and it is better refused than honoured as a
 * silent no-op.
 */
export function isEmptyTarget(target: UiTarget): boolean {
  return (
    target.stage === undefined &&
    target.domain === undefined &&
    target.levelId === undefined &&
    target.objectId === undefined &&
    target.propertyPath === undefined &&
    target.overlayId === undefined
  );
}

/** What a target is doing, in words, for a tooltip or a screen reader. */
export function describeTarget(target: UiTarget): string {
  const parts: string[] = [];
  if (target.stage !== undefined) parts.push(`étape ${target.stage}`);
  if (target.domain !== undefined) parts.push(`discipline ${target.domain}`);
  if (target.levelId !== undefined) parts.push(`niveau ${target.levelId}`);
  if (target.objectId !== undefined) parts.push(`objet ${target.objectId}`);
  if (target.propertyPath !== undefined)
    parts.push(`propriété ${target.propertyPath}`);
  if (target.overlayId !== undefined) parts.push(`calque ${target.overlayId}`);
  return parts.length === 0 ? 'nulle part' : parts.join(', ');
}

/**
 * The single cross-cutting navigation.
 *
 * Every feature that wants to send someone somewhere takes one of these and
 * calls it. A second way of navigating is a second depth of navigation, and
 * the shallow one always wins by accident.
 */
export type NavigateTo = (target: UiTarget) => void;
