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
import type { EditorState } from './editor-state.js';
import {
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

  if (isOpenEnded(tool))
    return placed === 0
      ? { next: 'Cliquez le premier point du tracé.' }
      : {
          next: `Cliquez le point suivant — ${placed} posé(s).`,
          finish: 'Entrée termine, Échap annule',
        };

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
