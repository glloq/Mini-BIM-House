import { useEffect, useMemo, useRef, useState } from 'react';
import { filterEntries, type PaletteEntry } from './palette-model.js';

export interface CommandPaletteProps {
  readonly entries: readonly PaletteEntry[];
  readonly onClose: () => void;
  /**
   * Ce qu'on cherche déjà, quand on est arrivé ici en le sachant.
   *
   * L'arborescence s'arrête à quarante objets par famille et renvoie au reste
   * par un bouton : ce bouton sait de quelle famille il parle, et le champ
   * s'ouvre avec le mot déjà écrit plutôt que vide.
   */
  readonly initialQuery?: string;
}

/**
 * One field that reaches everything.
 *
 * An editor covering a house cannot put every command in front of the user at
 * once, and a command nobody can find is a command that does not exist. Typing
 * a few letters is the way out of that: tools, workspaces, levels, commands and
 * the objects of the storey being drawn all answer to the same field.
 */
export function CommandPalette({
  entries,
  onClose,
  initialQuery = '',
}: CommandPaletteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [highlighted, setHighlighted] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const found = useMemo(() => filterEntries(entries, query), [entries, query]);

  useEffect(() => {
    input.current?.focus();
    // Le mot est déjà là : on le sélectionne, pour que taper le remplace.
    input.current?.select();
  }, []);
  // A new search starts at the top; keeping the old position would run whatever
  // happens to sit under an index the user never looked at.
  useEffect(() => setHighlighted(0), [query]);

  function choose(entry: PaletteEntry | undefined): void {
    if (entry === undefined) return;
    onClose();
    entry.run();
  }

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
      >
        <input
          ref={input}
          type="text"
          className="palette-query"
          value={query}
          placeholder="Chercher un outil, un espace, un objet…"
          aria-label="Chercher une commande"
          aria-controls="palette-results"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlighted((index) =>
                found.length === 0 ? 0 : (index + 1) % found.length,
              );
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlighted((index) =>
                found.length === 0
                  ? 0
                  : (index - 1 + found.length) % found.length,
              );
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              choose(found[highlighted]);
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <ul className="palette-results" id="palette-results">
          {found.map((entry, index) => (
            <li key={`${entry.group}:${entry.id}`}>
              <button
                type="button"
                className={index === highlighted ? 'palette-active' : undefined}
                onClick={() => choose(entry)}
                onPointerEnter={() => setHighlighted(index)}
              >
                <span className="palette-label">{entry.label}</span>
                <span className="palette-group">{entry.group}</span>
                {entry.hint !== undefined && (
                  <span className="palette-hint">{entry.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {found.length === 0 && (
          <p className="empty-state">Rien ne répond à « {query} ».</p>
        )}
      </div>
    </div>
  );
}
