import { useEffect, useRef, type CSSProperties } from 'react';

/** One line of the menu the plan opens on an object. */
export interface ObjectMenuEntry {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly run: () => void;
}

export interface ObjectMenuProps {
  readonly title: string;
  readonly entries: readonly ObjectMenuEntry[];
  readonly atPx: { readonly x: number; readonly y: number };
  readonly onClose: () => void;
}

/**
 * What can be done to the object under the pointer, where the pointer is.
 *
 * Reaching a toolbar at the top of the window to delete the wall being looked
 * at is a journey the drawing does not need. The entries every object shares
 * come from the application; the ones a wall alone offers come from its own
 * family, so a new family arrives with its own actions.
 */
export function ObjectMenu({ title, entries, atPx, onClose }: ObjectMenuProps) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div
      className="object-menu-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="object-menu"
        role="menu"
        aria-label={`Actions sur ${title}`}
        style={
          {
            '--menu-x': `${atPx.x}px`,
            '--menu-y': `${atPx.y}px`,
          } as CSSProperties
        }
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <p className="object-menu-title">{title}</p>
        {entries.map((entry, index) => (
          <button
            key={entry.id}
            ref={index === 0 ? first : undefined}
            type="button"
            role="menuitem"
            disabled={entry.disabled === true}
            onClick={() => {
              onClose();
              entry.run();
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
