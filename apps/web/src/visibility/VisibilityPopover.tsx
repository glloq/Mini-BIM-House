/**
 * What is drawn, as a short list rather than as twenty checkboxes.
 *
 * Nine times out of ten the question is « montre-moi l'architecture » or
 * « montre-moi l'électricité », and a preset answers it in one click. The
 * twenty individual layers are still there, one disclosure down, for the tenth
 * time — they are the engine, and the engine does not have to be the interface.
 */
import { useEffect } from 'react';
import {
  LAYER_PRESETS,
  PLAN_LAYERS,
} from '@house-technical-designer/view-query';

import type { EditorAction, EditorState } from '../editor/editor-state.js';

export interface VisibilityPopoverProps {
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly onClose: () => void;
}

export function VisibilityPopover({
  editor,
  dispatch,
  onClose,
}: VisibilityPopoverProps) {
  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const hidden = PLAN_LAYERS.filter(
    ({ id }) => editor.layers[id] !== true,
  ).length;

  return (
    <div
      className="visibility-popover panel"
      role="dialog"
      aria-label="Visibilité"
    >
      <p className="panel-label">Ce qui est dessiné</p>
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
        <summary>Calque par calque</summary>
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
