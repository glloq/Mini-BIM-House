/**
 * The five spaces, always in the same place.
 *
 * A narrow column rather than a row of tabs: the rail is the one part of the
 * application that never changes, and a person who has learnt that Systèmes is
 * the third icon down has learnt it for good.
 */
import {
  PRIMARY_WORKSPACES,
  primaryWorkspace,
  type PrimaryWorkspace,
} from '../ux/workspaces.js';

export interface PrimaryRailProps {
  readonly workspace: PrimaryWorkspace;
  readonly onSelect: (workspace: PrimaryWorkspace) => void;
}

export function PrimaryRail({ workspace, onSelect }: PrimaryRailProps) {
  return (
    <nav className="primary-rail" aria-label="Espaces de travail">
      {PRIMARY_WORKSPACES.map((id) => {
        const descriptor = primaryWorkspace(id);
        const current = id === workspace;
        return (
          <button
            key={id}
            type="button"
            className={current ? 'rail-entry active' : 'rail-entry'}
            aria-current={current ? 'page' : undefined}
            title={`${descriptor.label} — ${descriptor.description}`}
            onClick={() => onSelect(id)}
          >
            <span className="rail-letter" aria-hidden="true">
              {descriptor.shortcut}
            </span>
            <span className="rail-label">{descriptor.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
