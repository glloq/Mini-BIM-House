/**
 * The arrangement, and only the arrangement.
 *
 * `App()` was two and a half thousand lines that held the state of the
 * project, the state of the editor, the import and export of files, and the
 * exact pixel each panel starts at. Pulling the arrangement out means the
 * rest can move without the layout moving with it — and it means the nine
 * stages are a rearrangement of what already exists rather than a rewrite of
 * it.
 *
 * Everything here is a slot. The shell decides where things are; it decides
 * nothing about what they are.
 *
 * **Une seule colonne, et elle est à gauche.** Il y en avait deux, de part et
 * d'autre du dessin, et la seconde ne servait qu'à lire : ce que l'objet
 * désigné est. Elle prenait 280 px de large plus son bord plus sa gouttière,
 * du côté où l'on finit de lire, et elle les prenait dès qu'on cliquait un
 * objet — c'est-à-dire à chaque geste de la journée. Ce qu'elle montrait est
 * descendu dans la colonne de gauche, qui le montre à la place des outils.
 * La droite est au plan, entière, et sans condition.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface AppShellProps {
  readonly topBar: ReactNode;
  readonly contextPanel: ReactNode;
  readonly contextSeparator: ReactNode;
  readonly canvas: ReactNode;
  readonly statusBar: ReactNode;
  /** Modals, prompts and popovers, which belong to no column. */
  readonly overlays?: ReactNode;
  readonly columns: string;
  readonly contextPanelHidden: boolean;
  /** Whether the context panel is open over the canvas on a narrow screen. */
  readonly drawerOpen: boolean;
  readonly onCloseDrawer: () => void;
}

export function AppShell({
  topBar,
  contextPanel,
  contextSeparator,
  canvas,
  statusBar,
  overlays,
  columns,
  contextPanelHidden,
  drawerOpen,
  onCloseDrawer,
}: AppShellProps) {
  return (
    <main className="workspace">
      {topBar}
      {/* Les sous-parties étaient ici, sur une rangée : elles sont dans la
          colonne, en sommaire dépliable, avec ce qu'elles posent. */}
      {overlays}
      <div className="shell-body">
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
        </div>
      </div>
      {statusBar}
    </main>
  );
}
