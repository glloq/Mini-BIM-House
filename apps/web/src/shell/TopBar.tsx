/**
 * The top edge: what this application is, and what applies to the whole file.
 *
 * Only what concerns the project as a whole belongs here — opening, saving,
 * undoing, exporting. Anything that concerns the thing being drawn belongs to
 * the context panel or to the tool bar; putting it here is how a header grows
 * until it is a second application.
 */
import type { ReactNode } from 'react';

export interface TopBarProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly actions: ReactNode;
}

export function TopBar({ eyebrow, title, actions }: TopBarProps) {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <div className="actions">{actions}</div>
    </header>
  );
}
