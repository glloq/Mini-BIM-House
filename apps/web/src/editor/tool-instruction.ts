/**
 * Ce que l'outil actif attend, en une phrase.
 *
 * L'outil disait son nom et rien d'autre. « Mur » ne dit pas s'il faut cliquer
 * une fois ou deux, ni ce qui arrive au deuxième clic, ni comment on arrête un
 * tracé qui ne s'arrête pas tout seul — et un outil qui n'annonce pas ce qu'il
 * attend se découvre en essayant, c'est-à-dire en se trompant.
 *
 * La phrase est **dérivée** du registre et de l'état : combien de points
 * l'outil demande, combien sont déjà posés, s'il s'arrête de lui-même. Aucun
 * outil n'écrit sa propre instruction, donc aucun ne peut oublier de la mettre
 * à jour.
 */
import { draftMeasureLabel, draftMeasures } from './draft-measures.js';
import type { EditorState } from './editor-state.js';
import {
  completionLabel,
  completionModeOf,
  isOpenEnded,
  requiredPoints,
  toolDefinition,
} from './tool-registry.js';

/** Comment on nomme le prochain point, quand il en reste plusieurs à poser. */
const ORDINALS = [
  'premier',
  'deuxième',
  'troisième',
  'quatrième',
  'cinquième',
] as const;

export interface ToolInstruction {
  /** Ce qu'il faut faire maintenant. */
  readonly next: string;
  /** Comment on termine, pour un tracé qui ne s'arrête pas tout seul. */
  readonly finish?: string;
  /**
   * Ce que le tracé mesure déjà : une aire pour une surface, une longueur
   * pour un chemin. On dessine une parcelle pour ses mètres carrés ; les lire
   * après l'avoir créée, c'est créer pour lire, annuler, recommencer.
   */
  readonly measures?: string;
}

export function toolInstruction(editor: EditorState): ToolInstruction {
  const tool = editor.activeTool;
  if (tool === 'SELECT')
    return {
      next:
        editor.selection.length === 0
          ? 'Cliquez un objet, ou tracez une bande pour en prendre plusieurs.'
          : 'Glissez pour déplacer, ou cliquez ailleurs pour désélectionner.',
    };

  const wanted = requiredPoints(tool);
  const placed = editor.pendingPoints.length;
  // Rien de posé, rien à abandonner : proposer d'annuler un tracé qui n'a pas
  // commencé est un bouton qui ne fait rien.
  const escape = placed > 0 ? { finish: 'Échap annule' } : {};

  if (isOpenEnded(tool)) {
    const mode = completionModeOf(tool)!;
    const closing = mode === 'CLOSE_POLYGON';
    if (placed === 0)
      return {
        next: closing
          ? 'Cliquez le premier sommet de la surface.'
          : 'Cliquez le premier point du tracé.',
      };
    const measured = draftMeasures(editor.pendingPoints, mode);
    // Le premier sommet est un bouton autant qu'un repère : le recliquer
    // referme, et c'est le geste qu'on essaie d'abord quand on ne sait pas.
    const back =
      closing && placed >= 3 ? ', ou recliquez le premier sommet' : '';
    return {
      next: closing
        ? `Cliquez le sommet suivant — ${placed} posé(s)${back}.`
        : `Cliquez le point suivant — ${placed} posé(s).`,
      finish: `${completionLabel(mode)} : Entrée. Échap annule le tracé`,
      ...(measured === undefined
        ? {}
        : { measures: draftMeasureLabel(measured) }),
    };
  }

  if (wanted <= 1)
    return {
      next: `Cliquez où poser ${toolDefinition(tool).label.toLowerCase()}.`,
      ...escape,
    };

  if (placed === 0) return { next: 'Cliquez le premier point.' };
  if (placed >= wanted) return { next: 'Le tracé se termine.', ...escape };
  if (wanted === 2) return { next: 'Cliquez le second point.', ...escape };
  const ordinal = ORDINALS[placed] ?? `${placed + 1}ᵉ`;
  return {
    next: `Cliquez le ${ordinal} point — ${wanted - placed} restant(s).`,
    ...escape,
  };
}
