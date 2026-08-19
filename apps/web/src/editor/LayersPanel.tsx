import {
  LAYER_PRESETS,
  PLAN_LAYERS,
} from '@house-technical-designer/view-query';
import type { EditorAction, EditorState } from './editor-state.js';

export interface LayersPanelProps {
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
}

export function LayersPanel({ editor, dispatch }: LayersPanelProps) {
  return (
    <section className="layers-panel" aria-labelledby="layers-heading">
      <h3 id="layers-heading">Vues et calques</h3>
      <label>
        Vue disciplinaire
        <select
          value={editor.presetId}
          onChange={(event) =>
            dispatch({ type: 'APPLY_PRESET', presetId: event.target.value })
          }
        >
          {LAYER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
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
    </section>
  );
}
