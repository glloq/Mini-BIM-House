/**
 * The bottom edge of the application: what project, what happened, what state.
 *
 * It used to be a band under the header, which is where the eye is not. A
 * status line belongs at the bottom, where it can be read without being looked
 * at, and where the count of checks will be able to sit beside it without
 * pushing the drawing down.
 */
import type { ReactNode } from 'react';

export interface ShellStatusBarProps {
  readonly projectName: string;
  readonly message: string;
  readonly saveLabel: string;
  readonly saveState: string;
  /** The permanent count of findings, which lives here and nowhere else. */
  readonly issues?: ReactNode;
}

export function ShellStatusBar({
  projectName,
  message,
  saveLabel,
  saveState,
  issues,
}: ShellStatusBarProps) {
  return (
    <footer className="shell-status" aria-label="État de l’application">
      <span className="shell-status-project">
        <span className="shell-status-key">Projet</span>
        <strong>{projectName}</strong>
      </span>
      <p role="status" className="shell-status-message">
        {message}
      </p>
      {issues}
      <span className={`save-state save-${saveState.toLowerCase()}`}>
        {saveLabel}
      </span>
    </footer>
  );
}
