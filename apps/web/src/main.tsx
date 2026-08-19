import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import './styles.css';
import {
  createBlankProject,
  exportProjectPlan,
  ProjectEditingSession,
  projectPlan,
  screenPointToModel,
  summarizeProject,
} from './project-workspace.js';

function download(content: string, fileName: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [file, setFile] = useState<ProjectFile>(() =>
    createBlankProject(new Date().toISOString()),
  );
  const [message, setMessage] = useState('Nouveau projet local prêt.');
  const input = useRef<HTMLInputElement>(null);
  const session = useRef(new ProjectEditingSession(file));
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<
    { readonly x: number; readonly y: number } | undefined
  >();
  const [wallDraft, setWallDraft] = useState({
    startXmm: 0,
    startYmm: 0,
    endXmm: 5000,
    endYmm: 0,
    assemblyId: '',
  });
  const summary = useMemo(() => summarizeProject(file), [file]);
  const plan = useMemo(() => projectPlan(file), [file]);
  const width = plan.view.viewport.max.x - plan.view.viewport.min.x;
  const height = plan.view.viewport.max.y - plan.view.viewport.min.y;

  async function importProject(selected: File | undefined): Promise<void> {
    if (selected === undefined) return;
    const result = loadProjectJson(await selected.text());
    if (result.status !== 'OK') {
      const detail =
        result.status === 'INVALID_PROJECT'
          ? `${result.issues[0]?.path ?? '/'} : ${result.issues[0]?.message ?? 'projet invalide'}`
          : result.status === 'INVALID_JSON'
            ? result.message
            : result.status === 'UNSUPPORTED_FUTURE_SCHEMA'
              ? `version future ${result.schemaVersion}`
              : 'migration impossible';
      setMessage(`Import refusé — ${detail}`);
      return;
    }
    setFile(result.file);
    session.current = new ProjectEditingSession(result.file);
    setWallDraft((draft) => ({
      ...draft,
      assemblyId: result.file.project.assemblies?.[0]?.id ?? '',
    }));
    setMessage(`${selected.name} chargé et validé.`);
  }

  return (
    <main className="workspace">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mini BIM local-first</p>
          <h1>House Technical Designer</h1>
        </div>
        <div className="actions">
          <button
            className="secondary"
            onClick={() => {
              const result = session.current.undo();
              if (result.status === 'OK') setFile(result.file);
              setMessage(
                result.status === 'OK'
                  ? 'Dernière commande annulée.'
                  : (result.messages[0] ?? 'Historique vide.'),
              );
            }}
          >
            Annuler
          </button>
          <button
            className="secondary"
            onClick={() => {
              const result = session.current.redo();
              if (result.status === 'OK') setFile(result.file);
              setMessage(
                result.status === 'OK'
                  ? 'Commande rétablie.'
                  : (result.messages[0] ?? 'Historique vide.'),
              );
            }}
          >
            Rétablir
          </button>
          <button className="secondary" onClick={() => input.current?.click()}>
            Ouvrir
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                serializeProjectFile(file),
                `${file.project.metadata.name}.houseproj.json`,
                'application/json',
              )
            }
          >
            Sauvegarder
          </button>
          <button
            onClick={() => {
              const artifact = exportProjectPlan(file);
              download(artifact.content, artifact.fileName, artifact.mediaType);
            }}
          >
            Exporter SVG
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".json,.houseproj"
            onChange={(event) => void importProject(event.target.files?.[0])}
          />
        </div>
      </header>

      <section className="project-bar">
        <div>
          <span>Projet actif</span>
          <strong>{file.project.metadata.name}</strong>
        </div>
        <p role="status">{message}</p>
      </section>

      <div className="workspace-grid">
        <aside className="sidebar panel">
          <p className="panel-label">Modèle</p>
          <nav aria-label="Sections du projet">
            <a className="active" href="#plan">
              Plan architectural
            </a>
            <a href="#inventory">Bibliothèques</a>
            <a href="#inventory">Réseaux techniques</a>
            <a href="#inventory">Calculs</a>
          </nav>
          <div className="model-tree">
            <span>Niveaux</span>
            {file.project.building.levels.map((level) => (
              <strong key={level.id}>⌑ {level.name}</strong>
            ))}
          </div>
        </aside>

        <section className="canvas-panel panel" id="plan">
          <header className="panel-heading">
            <div>
              <p className="panel-label">Vue active</p>
              <h2>Plan du rez-de-chaussée</h2>
            </div>
            <span className="scale-chip">1:50 · mm</span>
          </header>
          <div
            className={`drawing-canvas${drawing ? ' drawing-active' : ''}`}
            onClick={(event) => {
              if (!drawing) return;
              const point = screenPointToModel(
                { x: event.clientX, y: event.clientY },
                event.currentTarget.getBoundingClientRect(),
                plan.view.viewport,
              );
              if (drawStart === undefined) {
                setDrawStart(point);
                setMessage(`Départ du mur : ${point.x}, ${point.y} mm.`);
                return;
              }
              const nextDraft = {
                ...wallDraft,
                startXmm: drawStart.x,
                startYmm: drawStart.y,
                endXmm: point.x,
                endYmm: point.y,
              };
              const result = session.current.addWall(
                nextDraft,
                `wall-${crypto.randomUUID()}`,
              );
              setDrawStart(undefined);
              if (result.status === 'ERROR') {
                setMessage(`Mur refusé — ${result.messages.join(' ')}`);
                return;
              }
              setWallDraft(nextDraft);
              setFile(result.file);
              setMessage('Mur tracé sur le plan.');
            }}
          >
            {plan.scene.primitives.length === 0 ? (
              <div className="empty-state">
                <strong>Le plan est vide</strong>
                <span>
                  Ouvrez la maison de référence ou commencez un nouveau modèle.
                </span>
              </div>
            ) : (
              <svg
                aria-label="Plan architectural"
                viewBox={`${plan.view.viewport.min.x} ${plan.view.viewport.min.y} ${width} ${height}`}
              >
                <g className="plan-walls">
                  {plan.scene.primitives.map((primitive) =>
                    primitive.geometry.kind === 'POLYLINE' ? (
                      <polyline
                        key={primitive.id}
                        points={primitive.geometry.polyline.points
                          .map(({ x, y }) => `${x},${y}`)
                          .join(' ')}
                      />
                    ) : null,
                  )}
                </g>
              </svg>
            )}
          </div>
          <form
            className="wall-toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              const result = session.current.addWall(
                wallDraft,
                `wall-${crypto.randomUUID()}`,
              );
              if (result.status === 'ERROR') {
                setMessage(`Mur refusé — ${result.messages.join(' ')}`);
                return;
              }
              setFile(result.file);
              setMessage('Mur ajouté par une commande réversible du moteur.');
            }}
          >
            <strong>Ajouter un mur</strong>
            <button
              className={drawing ? 'tool-active' : 'secondary'}
              type="button"
              onClick={() => {
                setDrawing((active) => !active);
                setDrawStart(undefined);
              }}
            >
              {drawing ? 'Outil actif' : 'Tracer sur le plan'}
            </button>
            {(['startXmm', 'startYmm', 'endXmm', 'endYmm'] as const).map(
              (field) => (
                <label key={field}>
                  {field.replace('mm', '')}
                  <input
                    type="number"
                    step="1"
                    value={wallDraft[field]}
                    onChange={(event) =>
                      setWallDraft((draft) => ({
                        ...draft,
                        [field]: event.target.valueAsNumber,
                      }))
                    }
                  />
                </label>
              ),
            )}
            <label>
              Assemblage
              <select
                value={wallDraft.assemblyId}
                onChange={(event) =>
                  setWallDraft((draft) => ({
                    ...draft,
                    assemblyId: event.target.value,
                  }))
                }
              >
                <option value="">Sélectionner</option>
                {file.project.assemblies?.map((assembly) => (
                  <option key={assembly.id} value={assembly.id}>
                    {assembly.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Ajouter</button>
          </form>
        </section>

        <aside className="inspector panel" id="inventory">
          <p className="panel-label">Synthèse du modèle</p>
          <h2>{file.project.metadata.name}</h2>
          <dl className="metrics">
            {Object.entries(summary).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="integrity">
            <span>✓</span>
            <div>
              <strong>Contrat validé</strong>
              <p>Schéma projet {file.schemaVersion}</p>
            </div>
          </div>
          <p className="notice">
            Les résultats calculés restent dérivés et ne sont pas enregistrés
            comme source de vérité.
          </p>
        </aside>
      </div>
    </main>
  );
}

const root = document.querySelector<HTMLElement>('#root');
if (root === null) throw new Error('Unable to find the application root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
