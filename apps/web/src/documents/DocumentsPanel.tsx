import { useMemo, useState } from 'react';
import type {
  Project,
  ProjectSheet,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import {
  RemoveDrawingViewCommand,
  RemoveSheetCommand,
  SaveSheetCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  defaultViewportFrame,
  renderSheet,
  renderViewToSvg,
} from './documents-model.js';

export interface DocumentsPanelProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  /** Saves the plan as it stands, which is what a view is made of. */
  readonly onCaptureView: (name: string) => void;
  readonly onApplyView: (view: SavedDrawingView) => void;
  readonly onExport: (sheets: readonly ProjectSheet[]) => void;
  readonly newId: (prefix: string) => string;
}

const FORMATS = ['A4', 'A3', 'A2', 'A1', 'A0'] as const;

/**
 * The drawing set: the views the project keeps, and the sheets they sit on.
 *
 * A view holds no geometry — the drawing is derived from the model each time —
 * so a view opened after a wall moved shows the wall where it is now. That is
 * the whole point of keeping views rather than pictures.
 */
export function DocumentsPanel({
  project,
  onCommand,
  onMessage,
  onCaptureView,
  onApplyView,
  onExport,
  newId,
}: DocumentsPanelProps) {
  const views = project.drawingViews ?? [];
  const sheets = project.sheets ?? [];
  const [viewName, setViewName] = useState('Plan du niveau');
  const [sheetTitle, setSheetTitle] = useState('Plan');
  const [format, setFormat] = useState<ProjectSheet['format']>('A3');
  const [preview, setPreview] = useState<string>();

  const previewFor = useMemo(
    () => (sheet: ProjectSheet) => {
      try {
        return renderSheet(project, sheet);
      } catch (error: unknown) {
        onMessage(
          `Cette feuille ne peut pas être dessinée : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return undefined;
      }
    },
    [onMessage, project],
  );

  return (
    <section
      className="panel documents-panel"
      aria-labelledby="documents-heading"
    >
      <h2 id="documents-heading">Vues et feuilles</h2>
      <p className="hint">
        Une vue ne contient aucun dessin : elle retient le niveau, l’échelle,
        les calques et le profil graphique, et le dessin est refait à partir du
        modèle. Une vue rouverte après qu’un mur a bougé montre le mur où il
        est.
      </p>

      <section aria-labelledby="views-heading">
        <h3 id="views-heading">Vues enregistrées</h3>
        <div className="tool-group">
          <label>
            Nom de la vue
            <input
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => onCaptureView(viewName)}
            disabled={viewName.trim() === ''}
          >
            Enregistrer le plan tel qu’il est
          </button>
        </div>
        {views.length === 0 ? (
          <p className="empty-state">Aucune vue enregistrée.</p>
        ) : (
          <table className="library-table">
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Type</th>
                <th scope="col">Niveau</th>
                <th scope="col">Échelle</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {views.map((view) => (
                <tr key={view.id}>
                  <td>{view.name}</td>
                  <td>{view.type}</td>
                  <td>
                    {project.building.levels.find(
                      ({ id }) => id === view.levelId,
                    )?.name ?? '—'}
                  </td>
                  <td>1:{view.scaleDenominator}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onApplyView(view)}
                    >
                      Ouvrir
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setPreview(renderViewToSvg(project, view));
                      }}
                    >
                      Aperçu
                    </button>
                    <button
                      type="button"
                      className="secondary danger"
                      onClick={() => {
                        onCommand(new RemoveDrawingViewCommand(view.id));
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="sheets-heading">
        <h3 id="sheets-heading">Feuilles</h3>
        <div className="tool-group">
          <label>
            Titre de la feuille
            <input
              value={sheetTitle}
              onChange={(event) => setSheetTitle(event.target.value)}
            />
          </label>
          <label>
            Format
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ProjectSheet['format'])
              }
            >
              {FORMATS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={views.length === 0 || sheetTitle.trim() === ''}
            onClick={() => {
              const first = views[0];
              if (first === undefined) return;
              const sheet: ProjectSheet = {
                id: newId('sheet'),
                number: `A-${(sheets.length + 1).toString().padStart(3, '0')}`,
                title: sheetTitle,
                format,
                orientation: 'LANDSCAPE',
                viewports: [
                  {
                    id: newId('viewport'),
                    viewId: first.id,
                    scaleDenominator: first.scaleDenominator,
                    ...defaultViewportFrame({
                      format,
                      orientation: 'LANDSCAPE',
                    }),
                  },
                ],
              };
              onCommand(new SaveSheetCommand(sheet));
            }}
          >
            Ajouter une feuille
          </button>
        </div>
        {views.length === 0 && (
          <p className="hint">
            Une feuille porte des vues : enregistrez-en une d’abord.
          </p>
        )}
        {sheets.length === 0 ? (
          <p className="empty-state">Aucune feuille.</p>
        ) : (
          <table className="library-table">
            <thead>
              <tr>
                <th scope="col">N°</th>
                <th scope="col">Titre</th>
                <th scope="col">Format</th>
                <th scope="col">Vue</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => (
                <tr key={sheet.id}>
                  <td>{sheet.number}</td>
                  <td>{sheet.title}</td>
                  <td>
                    {sheet.format}{' '}
                    {sheet.orientation === 'PORTRAIT' ? '↕' : '↔'}
                  </td>
                  <td>
                    <select
                      aria-label={`Vue de la feuille ${sheet.number}`}
                      value={sheet.viewports[0]?.viewId ?? ''}
                      onChange={(event) => {
                        const viewport = sheet.viewports[0];
                        if (viewport === undefined) return;
                        onCommand(
                          new SaveSheetCommand({
                            ...sheet,
                            viewports: [
                              { ...viewport, viewId: event.target.value },
                            ],
                          }),
                        );
                      }}
                    >
                      {views.map((view) => (
                        <option key={view.id} value={view.id}>
                          {view.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setPreview(previewFor(sheet));
                      }}
                    >
                      Aperçu
                    </button>
                    <button
                      type="button"
                      className="secondary danger"
                      onClick={() => {
                        onCommand(new RemoveSheetCommand(sheet.id));
                      }}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="actions">
          <button
            type="button"
            disabled={sheets.length === 0}
            onClick={() => onExport(sheets)}
          >
            Exporter le dossier en PDF
          </button>
        </div>
        <p className="hint">
          Les pages du PDF sont des images de chaque feuille : le format PDF ne
          connaît pas le SVG, et le convertir en tracés PDF reviendrait à écrire
          un second moteur de dessin qui finirait par ne plus dire la même
          chose. Le tirage est à l’échelle ; le texte n’y est ni sélectionnable
          ni recherchable.
        </p>
      </section>

      {preview !== undefined && (
        <section aria-labelledby="preview-heading">
          <h3 id="preview-heading">Aperçu</h3>
          <div
            className="sheet-preview"
            // The preview is the drawing engine's own output, rendered from
            // the project by this application: nothing here comes from a file
            // or a network.
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </section>
      )}
    </section>
  );
}
