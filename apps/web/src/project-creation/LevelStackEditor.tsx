/**
 * The stack of storeys, drawn as a stack.
 *
 * Three fields — a count, one height, a checkbox — could describe a house with
 * identical floors and nothing else. This one shows the storeys in the order
 * they are built, each with its own height, and says where each one sits.
 */
import {
  LEVEL_DRAFT_KINDS,
  LEVEL_DRAFT_KIND_LABELS,
  type LevelDraftKind,
  type NewProjectLevelDraft,
} from '../ux/new-project-draft.js';
import {
  MAX_LEVELS,
  addLevel,
  moveLevel,
  removeLevel,
  stackedLevels,
  updateLevel,
} from './level-stack.js';

export interface LevelStackEditorProps {
  readonly stack: readonly NewProjectLevelDraft[];
  readonly onChange: (stack: readonly NewProjectLevelDraft[]) => void;
}

function metres(millimetres: number): string {
  return `${(millimetres / 1000).toFixed(2).replace('.', ',')} m`;
}

export function LevelStackEditor({ stack, onChange }: LevelStackEditorProps) {
  // Top of the building at the top of the list: a stack read on a screen is
  // read the way it is built, and a roof at the bottom of a list is a puzzle.
  const rows = [...stackedLevels(stack)].reverse();
  return (
    <div className="level-stack">
      <table className="level-stack-table">
        <caption className="sr-only">Niveaux du bâtiment</caption>
        <thead>
          <tr>
            <th scope="col">Niveau</th>
            <th scope="col">Nature</th>
            <th scope="col">Hauteur</th>
            <th scope="col">Altitude</th>
            <th scope="col">
              <span className="sr-only">Ordre</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ level, elevationMm }) => (
            <tr key={level.id}>
              <td>
                <input
                  type="text"
                  aria-label={`Nom du niveau ${level.name}`}
                  value={level.name}
                  onChange={(event) =>
                    onChange(
                      updateLevel(stack, level.id, {
                        name: event.target.value,
                      }),
                    )
                  }
                />
              </td>
              <td>
                <select
                  aria-label={`Nature du niveau ${level.name}`}
                  value={level.kind}
                  onChange={(event) =>
                    onChange(
                      updateLevel(stack, level.id, {
                        kind: event.target.value as LevelDraftKind,
                      }),
                    )
                  }
                >
                  {LEVEL_DRAFT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {LEVEL_DRAFT_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  step={10}
                  aria-label={`Hauteur du niveau ${level.name} en millimètres`}
                  value={level.heightMm}
                  onChange={(event) => {
                    const heightMm = Number(event.target.value);
                    // A storey of zero is not a storey; the field keeps what it
                    // had rather than writing a height nothing can be built at.
                    if (Number.isFinite(heightMm) && heightMm > 0)
                      onChange(updateLevel(stack, level.id, { heightMm }));
                  }}
                />
              </td>
              <td className="numeric">{metres(elevationMm)}</td>
              <td className="level-stack-actions">
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Monter ${level.name}`}
                  onClick={() => onChange(moveLevel(stack, level.id, 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Descendre ${level.name}`}
                  onClick={() => onChange(moveLevel(stack, level.id, -1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Retirer ${level.name}`}
                  disabled={stack.length <= 1}
                  onClick={() => onChange(removeLevel(stack, level.id))}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions">
        {LEVEL_DRAFT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="secondary"
            disabled={stack.length >= MAX_LEVELS}
            onClick={() => onChange(addLevel(stack, kind))}
          >
            + {LEVEL_DRAFT_KIND_LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
