/**
 * Les rendus de plan que l’application propose.
 *
 * Une charte graphique répond à « comment dessiner ? », un preset de calques à
 * « quoi afficher ? ». Ce sont deux axes, et les mélanger reviendrait à
 * interdire un plan d’architecte des réseaux ou un plan technique des
 * matériaux. Cette liste ne parle donc que du premier ; la visibilité reste
 * celle des presets de calques.
 *
 * Le mot « charte graphique » ne sort pas d’ici : l’utilisateur choisit un
 * dessin, pas une structure de données.
 */
import {
  ARCHITECTURAL_CLEAN_SCREEN,
  FR_INITIAL_SCREEN,
  GENERIC_TECHNICAL_SCREEN,
} from '@house-technical-designer/drawing-engine';
import type { CreationStageId } from './creation-stages.js';

export interface PlanRenderingChoice {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly graphicProfileId: string;
}

export const PLAN_RENDERINGS: readonly PlanRenderingChoice[] = [
  {
    id: 'architectural',
    label: 'Plan architectural',
    hint: 'Lire la maison : murs, pièces, ouvertures',
    graphicProfileId: ARCHITECTURAL_CLEAN_SCREEN.profile.id,
  },
  {
    id: 'technical',
    label: 'Plan technique',
    hint: 'Lire un réseau, une coupe, un détail',
    graphicProfileId: GENERIC_TECHNICAL_SCREEN.profile.id,
  },
  {
    id: 'technical-fr',
    label: 'Plan technique — conventions FR',
    hint: 'Le plan technique, à la française',
    graphicProfileId: FR_INITIAL_SCREEN.profile.id,
  },
];

/**
 * Le rendu par défaut d’une étape de création.
 *
 * On construit une maison en la regardant comme une maison, et on pose une
 * gaine en regardant le dessin technique. « Documents » ne figure pas ici : une
 * vue enregistrée porte sa propre charte, et c’est elle qui décide.
 */
export function defaultPlanRendering(
  stage: CreationStageId,
): PlanRenderingChoice {
  const architectural = PLAN_RENDERINGS[0]!;
  return stage === 'SYSTEMS' ? PLAN_RENDERINGS[1]! : architectural;
}

/** Le rendu que désigne un identifiant, quand cette version le connaît. */
export function planRendering(id: string): PlanRenderingChoice | undefined {
  return PLAN_RENDERINGS.find((entry) => entry.id === id);
}
