import type { EditorAction, EditorState } from '../editor/editor-state.js';

export interface StatusBarProps {
  readonly editor: EditorState;
  readonly dispatch: (action: EditorAction) => void;
  readonly levelName: string;
}

/** The snaps, in the order a drawing hand looks for them. */
const SNAPS = [
  ['grid', 'Grille'],
  ['endpoint', 'Extrémités'],
  ['midpoint', 'Milieux'],
  ['intersection', 'Intersections'],
  ['orthogonal', 'Angles'],
] as const;

/**
 * What the drawing is doing, along its bottom edge.
 *
 * These are not tools and they were sitting among them: the grid step, the
 * angle step, the snaps in use, the scale and the size of the selection are the
 * state of the view, read constantly and changed rarely. Kept in the toolbar
 * they took the room that the tools of a whole house will need.
 */
export function StatusBar({ editor, dispatch, levelName }: StatusBarProps) {
  const snap = editor.snap;
  return (
    <div className="status-bar" role="group" aria-label="État du dessin">
      <span className="status-cell">{levelName}</span>
      <span className="status-cell">
        {editor.cursorModel === undefined
          ? '— ; — mm'
          : `${Math.round(editor.cursorModel.x)} ; ${Math.round(
              editor.cursorModel.y,
            )} mm`}
      </span>
      <label className="checkbox status-cell">
        <input
          type="checkbox"
          checked={snap.enabled}
          onChange={(event) =>
            dispatch({
              type: 'SET_SNAP',
              snap: { enabled: event.target.checked },
            })
          }
        />
        Accrochage
      </label>
      {SNAPS.map(([key, label]) => (
        <label key={key} className="checkbox status-cell">
          <input
            type="checkbox"
            disabled={!snap.enabled}
            checked={snap[key]}
            onChange={(event) =>
              dispatch({
                type: 'SET_SNAP',
                snap: { [key]: event.target.checked },
              })
            }
          />
          {label}
        </label>
      ))}
      <label className="status-cell status-number">
        Pas
        <input
          type="number"
          min={1}
          step={10}
          value={snap.gridSpacingMm}
          aria-label="Pas de grille en millimètres"
          onChange={(event) => {
            const gridSpacingMm = Number(event.target.value);
            // A grid of zero is not a grid; the field keeps what it had.
            if (Number.isFinite(gridSpacingMm) && gridSpacingMm > 0)
              dispatch({ type: 'SET_SNAP', snap: { gridSpacingMm } });
          }}
        />
        mm
      </label>
      <label className="status-cell status-number">
        Angle
        <input
          type="number"
          min={1}
          max={90}
          step={5}
          value={snap.angleStepDeg}
          aria-label="Pas angulaire en degrés"
          onChange={(event) => {
            const angleStepDeg = Number(event.target.value);
            if (Number.isFinite(angleStepDeg) && angleStepDeg > 0)
              dispatch({ type: 'SET_SNAP', snap: { angleStepDeg } });
          }}
        />
        °
      </label>
      <span className="status-cell">
        {(editor.camera.pixelsPerMm * 1000).toFixed(0)} px/m
      </span>
      <span className="status-cell">
        {editor.selection.length === 0
          ? 'aucune sélection'
          : `${editor.selection.length} sélectionné(s)`}
      </span>
    </div>
  );
}
