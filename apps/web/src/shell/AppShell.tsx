/**
 * The arrangement, and only the arrangement.
 *
 * `App()` was two and a half thousand lines that held the state of the
 * project, the state of the editor, the import and export of files, and the
 * exact pixel each panel starts at. Pulling the arrangement out means the
 * rest can move without the layout moving with it — and it means the five
 * spaces are a rearrangement of what already exists rather than a rewrite of
 * it.
 *
 * Everything here is a slot. The shell decides where things are; it decides
 * nothing about what they are.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface AppShellProps {
  readonly topBar: ReactNode;
  readonly rail: ReactNode;
  readonly contextPanel: ReactNode;
  readonly contextSeparator: ReactNode;
  readonly canvas: ReactNode;
  readonly inspectorSeparator: ReactNode;
  readonly inspector: ReactNode;
  readonly statusBar: ReactNode;
  /** Modals, prompts and popovers, which belong to no column. */
  readonly overlays?: ReactNode;
  readonly columns: string;
  readonly contextPanelHidden: boolean;
  /** Whether the context panel is open over the canvas on a narrow screen. */
  readonly drawerOpen: boolean;
  readonly onCloseDrawer: () => void;
  readonly inspectorHidden: boolean;
}

export function AppShell({
  topBar,
  rail,
  contextPanel,
  contextSeparator,
  canvas,
  inspectorSeparator,
  inspector,
  statusBar,
  overlays,
  columns,
  contextPanelHidden,
  drawerOpen,
  onCloseDrawer,
  inspectorHidden,
}: AppShellProps) {
  return (
    <main className="workspace">
      {topBar}
      {overlays}
      <div className="shell-body">
        {rail}
        <div
          className="workspace-grid"
          style={{ '--workspace-columns': columns } as CSSProperties}
        >
          {drawerOpen && (
            <button
              type="button"
              className="drawer-backdrop"
              aria-label="Fermer le panneau"
              onClick={onCloseDrawer}
            />
          )}
          <aside
            id="workspace-sidebar"
            hidden={contextPanelHidden && !drawerOpen}
            className={drawerOpen ? 'sidebar panel open' : 'sidebar panel'}
          >
            {contextPanel}
          </aside>
          {contextSeparator}
          {canvas}
          {inspectorSeparator}
          <aside
            className="inspector panel"
            id="inventory"
            hidden={inspectorHidden}
          >
            {inspector}
          </aside>
        </div>
      </div>
      {statusBar}
    </main>
  );
}
