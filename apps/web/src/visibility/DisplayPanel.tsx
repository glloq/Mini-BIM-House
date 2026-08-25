/**
 * Ce que le plan montre, et comment il le dessine — au même endroit.
 *
 * Deux écrans répondaient à cette question : `LayersPanel`, vingt-huit cases à
 * cocher dans la colonne de gauche, et `VisibilityPopover`, des préréglages
 * au-dessus du plan. Deux interfaces pour une question, ce sont deux réponses
 * qui finissent par diverger — et celle qu'on trouve d'abord est rarement la
 * bonne. `LayersPanel` est supprimé, pas déplacé.
 *
 * Trois degrés, du plus courant au plus fin : **le rendu** (comment c'est
 * dessiné), **le préréglage** (quoi afficher), puis les vingt-huit calques un
 * par un. Le rendu et les calques sont deux axes indépendants : un plan
 * d'architecte des réseaux et un plan technique des matériaux doivent rester
 * deux combinaisons possibles, et les mélanger reviendrait à interdire l'une
 * des deux.
 *
 * Neuf fois sur dix la question est « montre-moi l'électricité », et un
 * préréglage y répond en un clic. Les calques restent le moteur ; le moteur
 * n'a pas à être l'interface.
 */
import { useEffect } from 'react';
import {
  LAYER_PRESETS,
  PLAN_LAYERS,
} from '@house-technical-designer/view-query';

import type { EditorAction, EditorState } from '../editor/editor-state.js';
import { PLAN_RENDERINGS } from '../ux/view-profiles.js';

import { hiddenLayerCount } from './display-count.js';

export interface DisplayPanelProps {
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  /** Le rendu choisi, quand quelqu'un en a choisi un. */
  readonly renderingId: string;
  readonly onRendering: (renderingId: string) => void;
  readonly onClose: () => void;
  /**
   * Où le poser, relevé sur son propre bouton.
   *
   * Il était posé en `absolute` sous le bouton, donc **dans** la case du plan
   * — et cette case rogne ce qui en sort. Sur un écran de 768 px avec un objet
   * désigné, l'inspecteur prend une rangée entière, le plan tombe à 334 px, et
   * les cent derniers pixels du panneau — les vingt calques — étaient perdus.
   *
   * Posé en `fixed`, il n'appartient plus à cette case : il est borné par la
   * fenêtre, et défile chez lui si la fenêtre est courte.
   */
  readonly at?: { readonly top: number; readonly right: number };
}

export function DisplayPanel({
  editor,
  dispatch,
  renderingId,
  onRendering,
  onClose,
  at,
}: DisplayPanelProps) {
  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const hidden = hiddenLayerCount(editor);

  return (
    <div
      className="display-panel panel"
      role="dialog"
      aria-label="Affichage"
      style={
        at === undefined
          ? undefined
          : { top: `${at.top}px`, right: `${at.right}px` }
      }
    >
      <p className="context-group-label">Rendu</p>
      <div className="visibility-presets">
        {PLAN_RENDERINGS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === renderingId ? 'active' : undefined}
            aria-pressed={entry.id === renderingId}
            title={entry.hint}
            onClick={() => onRendering(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="context-group-label">Afficher</p>
      <div className="visibility-presets">
        {LAYER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={preset.id === editor.presetId ? 'active' : undefined}
            aria-pressed={preset.id === editor.presetId}
            onClick={() =>
              dispatch({ type: 'APPLY_PRESET', presetId: preset.id })
            }
          >
            {preset.label}
          </button>
        ))}
      </div>
      {/*
        The count is the point of saying anything here: a plan missing half its
        objects because a layer was left off, with nothing on screen to say so,
        is a plan somebody will print.
      */}
      <p className="hint">
        {hidden === 0
          ? 'Tout est visible.'
          : `${hidden} calque(s) masqué(s) sur ${PLAN_LAYERS.length}.`}
      </p>
      <details className="visibility-layers">
        <summary>Calque par calque ({PLAN_LAYERS.length})</summary>
        <ul className="layer-list">
          {PLAN_LAYERS.map((layer) => (
            <li key={layer.id}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editor.layers[layer.id] === true}
                  onChange={() =>
                    dispatch({ type: 'TOGGLE_LAYER', layerId: layer.id })
                  }
                />
                {layer.label}
              </label>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
