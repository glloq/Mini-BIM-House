/**
 * Ce que l'outil actif attend, en une phrase.
 *
 * L'outil disait son nom et rien d'autre. « Mur » ne dit pas s'il faut cliquer
 * une fois ou deux, ni ce qui arrive au deuxième clic, ni comment on arrête un
 * tracé qui ne s'arrête pas tout seul — et un outil qui n'annonce pas ce qu'il
 * attend se découvre en essayant, c'est-à-dire en se trompant.
 *
 * La phrase est **dérivée** du registre et de l'état : ce que l'outil déclare
 * attendre à ce clic-ci, combien de points sont déjà posés, s'il s'arrête de
 * lui-même. Aucun outil n'écrit sa propre instruction, donc aucun ne peut
 * oublier de la mettre à jour.
 *
 * Deux niveaux de description, et le second n'efface pas le premier. Un outil
 * qui déclare ses étapes (`interaction`) prête ses mots à l'écran : « Cliquez
 * le mur à décaler » vaut mieux que « Cliquez le premier point », qui est
 * exact et ne dit rien. Un outil qui n'en déclare pas est décrit comme il
 * l'était — par son nombre de points — parce qu'enrichir vingt-cinq outils se
 * fait un par un et qu'aucun ne doit régresser en attendant son tour.
 */
import { draftMeasureLabel, draftMeasures } from './draft-measures.js';
import type { EditorState } from './editor-state.js';
import {
  completionLabel,
  completionModeOf,
  interactionStepAt,
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
  // Ce que l'outil dit lui-même du clic à venir, quand il en dit quelque
  // chose. Rien ici ne connaît les murs ni les réseaux : la phrase vient de
  // l'outil, la composition reste ici.
  const step = interactionStepAt(tool, placed);

  if (isOpenEnded(tool)) {
    const mode = completionModeOf(tool)!;
    const closing = mode === 'CLOSE_POLYGON';
    if (placed === 0)
      return {
        next: `${step?.prompt ?? openingPrompt(closing)}.`,
      };
    const measured = draftMeasures(editor.pendingPoints, mode);
    // Le premier sommet est un bouton autant qu'un repère : le recliquer
    // referme, et c'est le geste qu'on essaie d'abord quand on ne sait pas.
    const back =
      closing && placed >= 3 ? ', ou recliquez le premier sommet' : '';
    return {
      next: `${step?.prompt ?? nextPrompt(closing)} — ${placed} posé(s)${back}.`,
      finish: `${completionLabel(mode)} : Entrée. Échap annule le tracé`,
      ...(measured === undefined
        ? {}
        : { measures: draftMeasureLabel(measured) }),
    };
  }

  // Un outil d'un seul clic n'a pas de rang à annoncer : il dit ce qu'il pose,
  // ou, mieux, ce qu'il faut viser pour le poser.
  if (wanted <= 1)
    return {
      next: `${step?.prompt ?? `Cliquez où poser ${toolDefinition(tool).label.toLowerCase()}`}.`,
      ...escape,
    };
  if (placed >= wanted) return { next: 'Le tracé se termine.', ...escape };

  // Ce qu'il reste à cliquer n'a d'intérêt qu'au-delà de deux points : « il en
  // reste un » après le premier clic d'un mur n'apprend rien à personne.
  const left =
    wanted >= 3 && placed >= 1 ? ` — ${wanted - placed} restant(s)` : '';
  return {
    next: `${step?.prompt ?? defaultPointPrompt(placed, wanted)}${left}.`,
    ...escape,
  };
}

/** Comment on nomme le tout premier clic d'un tracé sans fin déclarée. */
function openingPrompt(closing: boolean): string {
  return closing
    ? 'Cliquez le premier sommet de la surface'
    : 'Cliquez le premier point du tracé';
}

/** Comment on nomme les clics qui suivent, dans ce même tracé. */
function nextPrompt(closing: boolean): string {
  return closing ? 'Cliquez le sommet suivant' : 'Cliquez le point suivant';
}

/**
 * La description de repli : le rang du point, faute de mieux.
 *
 * Exportée non pas parce que quelqu'un d'autre s'en sert, mais parce que
 * c'est **le comportement promis** à tout outil qui ne déclare pas d'étapes,
 * y compris celui que quelqu'un ajoutera demain. Un test le vérifie ici
 * directement, sans dépendre de l'état d'avancement du registre — sans quoi
 * la promesse ne tiendrait que tant qu'un outil non déclaré subsiste.
 */
export function defaultPointPrompt(placed: number, wanted: number): string {
  if (placed === 0) return 'Cliquez le premier point';
  if (wanted === 2) return 'Cliquez le second point';
  const ordinal = ORDINALS[placed] ?? `${placed + 1}ᵉ`;
  return `Cliquez le ${ordinal} point`;
}
