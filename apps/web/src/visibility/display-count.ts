/**
 * Combien de calques sont masqués, sur combien.
 *
 * Séparé du panneau parce que la barre de vue le dit aussi, et qu'elle est là
 * dès le premier écran quand le panneau, lui, se charge à la demande : un plan
 * amputé de la moitié de ses objets, sans rien à l'écran pour le dire, est un
 * plan que quelqu'un imprimera.
 */
import { PLAN_LAYERS } from '@house-technical-designer/view-query';

import type { EditorState } from '../editor/editor-state.js';

export function hiddenLayerCount(editor: EditorState): number {
  return PLAN_LAYERS.filter(({ id }) => editor.layers[id] !== true).length;
}
