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
import { paperSizeFor } from '@house-technical-designer/drawing-engine';
import { announcedDotsPerInch } from './raster-plan.js';
import {
  defaultViewportFrame,
  relaidSheet,
  renderSheet,
  renderViewToSvg,
} from './documents-model.js';
import {
  FACADES,
  SECTION_AXES,
  VIEW_CAPTURE_KINDS,
  type Facade,
  type SectionAxis,
  type ViewCaptureKind,
} from './view-capture.js';

export interface DocumentsPanelProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  /** Saves the plan as it stands, which is what a view is made of. */
  readonly onCaptureView: (name: string, kind: ViewCaptureKind) => void;
  readonly onApplyView: (view: SavedDrawingView) => void;
  readonly onExport: (sheets: readonly ProjectSheet[]) => void;
  readonly newId: (prefix: string) => string;
}

const FORMATS = ['A4', 'A3', 'A2', 'A1', 'A0'] as const;

const ORIENTATIONS = [
  ['LANDSCAPE', 'Paysage'],
  ['PORTRAIT', 'Portrait'],
] as const;

/** The scales a drawing set is normally read at. */
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
  const sheets = useMemo(() => project.sheets ?? [], [project.sheets]);
  const [viewName, setViewName] = useState('Plan du niveau');
  const [viewKind, setViewKind] =
    useState<(typeof VIEW_CAPTURE_KINDS)[number]['id']>('PLAN');
  const [sectionAxis, setSectionAxis] = useState<SectionAxis>('EAST_WEST');
  const [facade, setFacade] = useState<Facade>('SOUTH');
  const [sheetTitle, setSheetTitle] = useState('Plan');
  const [format, setFormat] = useState<ProjectSheet['format']>('A3');
  const [orientation, setOrientation] =
    useState<ProjectSheet['orientation']>('LANDSCAPE');
  const [preview, setPreview] = useState<string>();

  /**
   * Saves a sheet after laying its viewports out again.
   *
   * Every frame follows from the paper, its orientation and how many views
   * there are; none of it is a decision to preserve. Saving without relaying
   * is how a sheet turned to portrait keeps frames that hang off the paper and
   * stops being drawable.
   */
  const saveSheet = (sheet: ProjectSheet): void => {
    onCommand(new SaveSheetCommand(relaidSheet(sheet)));
  };

  /** What the export will announce, said before the button is pressed. */
  const resolution = useMemo(
    () =>
      announcedDotsPerInch(
        sheets.map((sheet) => paperSizeFor(sheet.format, sheet.orientation)),
      ),
    [sheets],
  );

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
        Une vue ne contient aucun dessin : elle retient les décisions — le
        niveau, l’échelle, les calques, le profil graphique, et pour une coupe
        la ligne où elle coupe — et le dessin est refait à partir du modèle. Une
        vue rouverte après qu’un mur a bougé montre le mur où il est.
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
          <label>
            Type de vue
            <select
              value={viewKind}
              onChange={(event) => {
                setViewKind(
                  event.target
                    .value as (typeof VIEW_CAPTURE_KINDS)[number]['id'],
                );
              }}
            >
              {VIEW_CAPTURE_KINDS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {viewKind === 'SECTION' ? (
            <label>
              Sens de la coupe
              <select
                value={sectionAxis}
                onChange={(event) => {
                  setSectionAxis(event.target.value as SectionAxis);
                }}
              >
                {SECTION_AXES.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined}
          {viewKind === 'ELEVATION' ? (
            <label>
              Façade
              <select
                value={facade}
                onChange={(event) => {
                  setFacade(event.target.value as Facade);
                }}
              >
                {FACADES.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined}
          <button
            type="button"
            onClick={() => {
              onCaptureView(
                viewName,
                viewKind === 'SECTION'
                  ? { type: 'SECTION', axis: sectionAxis }
                  : viewKind === 'ELEVATION'
                    ? { type: 'ELEVATION', facade }
                    : { type: viewKind },
              );
            }}
            disabled={viewName.trim() === ''}
          >
            Enregistrer cette vue
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
                      onClick={() => {
                        // Only a plan is edited in the plan. A section opened
                        // « in the plan » would be a plan of a storey wearing
                        // the section's name, which is what this used to do.
                        if (view.type === 'PLAN') onApplyView(view);
                        else setPreview(renderViewToSvg(project, view));
                      }}
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
            {/* Nommé explicitement : le libellé enveloppe le menu, donc le nom
                accessible emporterait la valeur choisie avec lui, et « Format »
                se confondrait avec le format de chaque feuille du tableau. */}
            <select
              aria-label="Format de la nouvelle feuille"
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
          <label>
            Orientation
            <select
              aria-label="Orientation de la nouvelle feuille"
              value={orientation}
              onChange={(event) =>
                setOrientation(
                  event.target.value as ProjectSheet['orientation'],
                )
              }
            >
              {ORIENTATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
                orientation,
                viewports: [
                  {
                    id: newId('viewport'),
                    viewId: first.id,
                    scaleDenominator: first.scaleDenominator,
                    ...defaultViewportFrame({ format, orientation }),
                  },
                ],
              };
              saveSheet(sheet);
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
                <th scope="col">Indice</th>
                <th scope="col">Vues</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((sheet) => (
                <tr key={sheet.id}>
                  <td>{sheet.number}</td>
                  <td>{sheet.title}</td>
                  <td>
                    <select
                      aria-label={`Format de la feuille ${sheet.number}`}
                      value={sheet.format}
                      onChange={(event) =>
                        saveSheet({
                          ...sheet,
                          format: event.target.value as ProjectSheet['format'],
                        })
                      }
                    >
                      {FORMATS.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Orientation de la feuille ${sheet.number}`}
                      value={sheet.orientation}
                      onChange={(event) =>
                        saveSheet({
                          ...sheet,
                          orientation: event.target
                            .value as ProjectSheet['orientation'],
                        })
                      }
                    >
                      {ORIENTATIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {/* L'indice va au cartouche. Vide, la case est dessinée
                        comme inconnue plutôt que remplie d'un « A » que
                        personne n'a décidé. */}
                    <input
                      aria-label={`Indice de la feuille ${sheet.number}`}
                      value={sheet.revision ?? ''}
                      size={4}
                      onChange={(event) => {
                        const { revision: _previous, ...rest } = sheet;
                        const revision = event.target.value.trim();
                        saveSheet(
                          revision === '' ? rest : { ...rest, revision },
                        );
                      }}
                    />
                  </td>
                  <td>
                    <ul className="viewport-list">
                      {sheet.viewports.map((viewport, index) => (
                        <li key={viewport.id}>
                          <select
                            aria-label={`Vue ${index + 1} de la feuille ${sheet.number}`}
                            value={viewport.viewId}
                            onChange={(event) =>
                              saveSheet({
                                ...sheet,
                                viewports: sheet.viewports.map((entry) =>
                                  entry.id === viewport.id
                                    ? { ...entry, viewId: event.target.value }
                                    : entry,
                                ),
                              })
                            }
                          >
                            {views.map((view) => (
                              <option key={view.id} value={view.id}>
                                {view.name}
                              </option>
                            ))}
                          </select>
                          <label>
                            1:
                            <input
                              type="number"
                              min={1}
                              step={10}
                              size={5}
                              aria-label={`Échelle de la vue ${index + 1} de la feuille ${sheet.number}`}
                              value={viewport.scaleDenominator}
                              onChange={(event) => {
                                const scaleDenominator = Number(
                                  event.target.value,
                                );
                                // Une échelle nulle n'est pas une échelle :
                                // le champ vidé ne change rien plutôt que de
                                // faire tenir le bâtiment sur un point.
                                if (
                                  !Number.isFinite(scaleDenominator) ||
                                  scaleDenominator <= 0
                                )
                                  return;
                                saveSheet({
                                  ...sheet,
                                  viewports: sheet.viewports.map((entry) =>
                                    entry.id === viewport.id
                                      ? { ...entry, scaleDenominator }
                                      : entry,
                                  ),
                                });
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="secondary danger"
                            disabled={sheet.viewports.length < 2}
                            aria-label={`Retirer la vue ${index + 1} de la feuille ${sheet.number}`}
                            onClick={() =>
                              saveSheet({
                                ...sheet,
                                viewports: sheet.viewports.filter(
                                  ({ id }) => id !== viewport.id,
                                ),
                              })
                            }
                          >
                            Retirer
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="secondary"
                      disabled={views.length === 0}
                      onClick={() => {
                        const view = views[0];
                        if (view === undefined) return;
                        saveSheet({
                          ...sheet,
                          viewports: [
                            ...sheet.viewports,
                            {
                              id: newId('viewport'),
                              viewId: view.id,
                              scaleDenominator: view.scaleDenominator,
                              ...defaultViewportFrame(sheet),
                            },
                          ],
                        });
                      }}
                    >
                      Ajouter une vue
                    </button>
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
        {resolution !== undefined && (
          <p className="hint">
            {/* Ce que la trame vaut vraiment, dit avant l'export. Un grand
                format ne tient pas à la même densité qu'un A4 : la mémoire
                d'un onglet est ce qui décide, et c'est une décision, donc elle
                se dit. */}
            Ce dossier sera tramé à {resolution} ppp — la densité de la plus
            grande feuille, qui est celle qui borne la netteté de l’ensemble.
          </p>
        )}
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
