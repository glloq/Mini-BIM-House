/**
 * What can be done in the space one is standing in, and nothing else.
 *
 * The old sidebar listed all eleven destinations at once, so it answered « où
 * puis-je aller » — a question nobody asks — instead of « que puis-je faire
 * ici ». This one shows the destinations of the current space, then whatever
 * that space wants underneath.
 */
import type { ReactNode } from 'react';

import {
  destinationsOf,
  type ShellNavigation,
} from '../ux/navigation-state.js';
import {
  CONTEXT_GROUP_LABELS,
  LEGACY_WORKSPACE_LABELS,
  primaryWorkspace,
  type LegacyWorkspaceTab,
} from '../ux/workspaces.js';

export interface ContextPanelProps {
  readonly navigation: ShellNavigation;
  readonly activeTab: LegacyWorkspaceTab;
  readonly onSelectTab: (tab: LegacyWorkspaceTab) => void;
  readonly children?: ReactNode;
}

export function ContextPanel({
  navigation,
  activeTab,
  onSelectTab,
  children,
}: ContextPanelProps) {
  const descriptor = primaryWorkspace(navigation.workspace);
  const destinations = destinationsOf(navigation.workspace);
  return (
    <>
      <p className="panel-label">{descriptor.label}</p>
      {destinations.length > 1 && (
        <nav
          className="context-group"
          aria-label={`Dans ${descriptor.label}`}
          role="group"
        >
          <p className="context-group-label">
            {CONTEXT_GROUP_LABELS[navigation.workspace]}
          </p>
          {destinations.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === activeTab ? 'active' : undefined}
              aria-current={tab === activeTab ? 'page' : undefined}
              onClick={() => onSelectTab(tab)}
            >
              {LEGACY_WORKSPACE_LABELS[tab]}
            </button>
          ))}
        </nav>
      )}
      {children}
    </>
  );
}
