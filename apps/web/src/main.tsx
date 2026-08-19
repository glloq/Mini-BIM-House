import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import {
  boundsOfObjects,
  buildPlanView,
} from '@house-technical-designer/view-query';
import './styles.css';
import {
  createBlankProject,
  exportProjectPlan,
  ProjectEditingSession,
  summarizeProject,
} from './project-workspace.js';
import { demoClimateDatasets, loadDemoProject } from './demo-project.js';
import { MaterialsPanel } from './library/MaterialsPanel.js';
import { AssembliesPanel } from './library/AssembliesPanel.js';
import { EquipmentPanel } from './library/EquipmentPanel.js';
import { PlanCanvas } from './editor/PlanCanvas.js';
import { InspectorPanel } from './editor/InspectorPanel.js';
import { LayersPanel } from './editor/LayersPanel.js';
import { ToolBar, type OpeningDraft } from './editor/ToolBar.js';
import { BuildingPanel } from './editor/BuildingPanel.js';
import { CalculationsPanel } from './calculations/CalculationsPanel.js';
import { OverlayControl } from './calculations/OverlayControl.js';
import { QuantitiesPanel } from './quantities/QuantitiesPanel.js';
import { ScenariosPanel } from './scenarios/ScenariosPanel.js';
import {
  buildOverlay,
  designTemperatureDifferenceK,
  type OverlayId,
} from './calculations/overlay-source.js';
import {
  runProjectCalculations,
  type CalculationRun,
} from './calculations/calculation-runner.js';
import {
  createEditorState,
  editorReducer,
  type EditorState,
} from './editor/editor-state.js';
import {
  resolveShortcut,
  shouldIgnoreTarget,
  SHORTCUTS,
  shortcutLabel,
} from './editor/shortcuts.js';
import {
  addOpeningCommand,
  addWallCommand,
  deleteObjectCommand,
} from './editor/editing-commands.js';

function download(content: string, fileName: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const WORKSPACE_TABS = [
  { id: 'plan', label: 'Plan architectural' },
  { id: 'building', label: 'Niveaux et pièces' },
  { id: 'materials', label: 'Matériaux' },
  { id: 'assemblies', label: 'Assemblages' },
  { id: 'equipment', label: 'Équipements' },
  { id: 'calculations', label: 'Calculs' },
  { id: 'quantities', label: 'Quantités' },
  { id: 'scenarios', label: 'Scénarios' },
] as const;

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]['id'];

const DEFAULT_OPENING: OpeningDraft = {
  openingType: 'WINDOW',
  widthMm: 1200,
  heightMm: 1200,
  sillHeightMm: 900,
};

function App() {
  const [file, setFile] = useState<ProjectFile>(() =>
    createBlankProject(new Date().toISOString()),
  );
  const [message, setMessage] = useState('Nouveau projet local prêt.');
  const [tab, setTab] = useState<WorkspaceTab>('plan');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>();
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>();
  const [openingDraft, setOpeningDraft] =
    useState<OpeningDraft>(DEFAULT_OPENING);
  const [climate, setClimate] = useState<readonly ClimateDataset[]>([]);
  const [overlayId, setOverlayId] = useState<OverlayId>('none');
  const [calculationRun, setCalculationRun] = useState<CalculationRun>();
  const [wallAssemblyId, setWallAssemblyId] = useState(
    () => file.project.assemblies?.[0]?.id ?? '',
  );
  const importInput = useRef<HTMLInputElement>(null);
  const session = useRef(new ProjectEditingSession(file));
  const [editor, dispatchEditor] = useReducer(
    editorReducer,
    { widthPx: 900, heightPx: 600 },
    createEditorState,
  );

  const summary = useMemo(() => summarizeProject(file), [file]);
  const levels = file.project.building.levels;
  const activeLevelId = editor.levelId ?? levels[0]?.id;

  const adopt = useCallback((next: ProjectFile, notice: string): void => {
    setFile(next);
    session.current = new ProjectEditingSession(next);
    setWallAssemblyId(next.project.assemblies?.[0]?.id ?? '');
    setSelectedMaterialId(undefined);
    setSelectedAssemblyId(undefined);
    setSelectedEquipmentId(undefined);
    dispatchEditor({ type: 'CANCEL' });
    const firstLevel = next.project.building.levels[0];
    if (firstLevel !== undefined)
      dispatchEditor({ type: 'SET_LEVEL', levelId: firstLevel.id });
    setMessage(notice);
  }, []);

  const runCommand = useCallback((command: ProjectCommand): boolean => {
    const result = session.current.dispatch(command);
    if (result.status === 'ERROR') {
      setMessage(`Refusé — ${result.messages.join(' ')}`);
      return false;
    }
    setFile(result.file);
    setMessage(`${command.label} · appliqué.`);
    return true;
  }, []);

  const saveProject = useCallback(() => {
    download(
      serializeProjectFile(file),
      `${file.project.metadata.name}.houseproj.json`,
      'application/json',
    );
    setMessage('Projet exporté en JSON.');
  }, [file]);

  const undo = useCallback(() => {
    const result = session.current.undo();
    if (result.status === 'OK') setFile(result.file);
    setMessage(
      result.status === 'OK'
        ? 'Dernière commande annulée.'
        : (result.messages[0] ?? 'Historique vide.'),
    );
  }, []);

  const redo = useCallback(() => {
    const result = session.current.redo();
    if (result.status === 'OK') setFile(result.file);
    setMessage(
      result.status === 'OK'
        ? 'Commande rétablie.'
        : (result.messages[0] ?? 'Historique vide.'),
    );
  }, []);

  const deleteSelection = useCallback(() => {
    if (editor.selection.length === 0) {
      setMessage('Rien à supprimer : la sélection est vide.');
      return;
    }
    for (const objectId of editor.selection) {
      const command = deleteObjectCommand(
        session.current.file,
        activeLevelId,
        objectId,
      );
      if (command.status === 'ERROR') {
        setMessage(command.message);
        return;
      }
      if (!runCommand(command.command)) return;
    }
    dispatchEditor({ type: 'CLEAR_SELECTION' });
  }, [activeLevelId, editor.selection, runCommand]);

  const commitPoints = useCallback(
    (points: readonly { x: number; y: number }[]) => {
      if (editor.activeTool === 'WALL') {
        const command = addWallCommand(
          session.current.file,
          activeLevelId,
          points,
          { assemblyId: wallAssemblyId, role: 'EXTERIOR' },
          `wall-${crypto.randomUUID()}`,
        );
        if (command.status === 'ERROR') {
          setMessage(command.message);
          return;
        }
        runCommand(command.command);
        return;
      }
      if (editor.activeTool === 'OPENING') {
        const command = addOpeningCommand(
          session.current.file,
          activeLevelId,
          points[points.length - 1]!,
          openingDraft,
          `opening-${crypto.randomUUID()}`,
        );
        if (command.status === 'ERROR') {
          setMessage(command.message);
          return;
        }
        runCommand(command.command);
      }
    },
    [
      activeLevelId,
      editor.activeTool,
      openingDraft,
      runCommand,
      wallAssemblyId,
    ],
  );

  const zoomFit = useCallback(() => {
    const plan = buildPlanView(file.project, {
      ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
      layers: editor.layers,
    });
    dispatchEditor({ type: 'ZOOM_FIT', bounds: plan.view.viewport });
  }, [activeLevelId, editor.layers, file.project]);

  const zoomSelection = useCallback(() => {
    const plan = buildPlanView(file.project, {
      ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
      layers: editor.layers,
    });
    const bounds = boundsOfObjects(plan.primitives, editor.selection);
    if (bounds === undefined) {
      setMessage('Aucun objet sélectionné à cadrer.');
      return;
    }
    dispatchEditor({ type: 'ZOOM_SELECTION', bounds });
  }, [activeLevelId, editor.layers, editor.selection, file.project]);

  useEffect(() => {
    if (overlayId === 'none' && tab !== 'calculations') return;
    let current = true;
    void runProjectCalculations(file.project, climate).then((result) => {
      if (current) setCalculationRun(result);
    });
    return () => {
      current = false;
    };
  }, [climate, file.project, overlayId, tab]);

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (shouldIgnoreTarget(target?.tagName, event)) return;
      const command = resolveShortcut(event);
      if (command === undefined) return;
      event.preventDefault();
      switch (command) {
        case 'tool.select':
          dispatchEditor(
            editor.pendingPoints.length > 0
              ? { type: 'CANCEL' }
              : { type: 'SET_TOOL', tool: 'SELECT' },
          );
          return;
        case 'edit.cancel':
          dispatchEditor({ type: 'CANCEL' });
          return;
        case 'tool.wall':
          dispatchEditor({ type: 'SET_TOOL', tool: 'WALL' });
          return;
        case 'tool.opening':
          dispatchEditor({ type: 'SET_TOOL', tool: 'OPENING' });
          return;
        case 'tool.dimension':
          dispatchEditor({ type: 'SET_TOOL', tool: 'DIMENSION' });
          return;
        case 'edit.undo':
          undo();
          return;
        case 'edit.redo':
          redo();
          return;
        case 'edit.delete':
          deleteSelection();
          return;
        case 'file.save':
          saveProject();
          return;
        case 'view.zoomFit':
          zoomFit();
          return;
        case 'view.zoomSelection':
          zoomSelection();
          return;
        case 'view.reset':
          dispatchEditor({ type: 'RESET_VIEW' });
          return;
        case 'palette.open':
          setMessage(
            `Raccourcis : ${SHORTCUTS.map((binding) => `${binding.label} ${shortcutLabel(binding)}`).join(' · ')}`,
          );
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [
    deleteSelection,
    editor.pendingPoints.length,
    redo,
    saveProject,
    undo,
    zoomFit,
    zoomSelection,
  ]);

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
    setClimate([]);
    adopt(result.file, `${selected.name} chargé et validé.`);
  }

  const selectOnPlan = useCallback((objectIds: readonly string[]): void => {
    dispatchEditor({ type: 'CLEAR_SELECTION' });
    for (const objectId of objectIds)
      dispatchEditor({ type: 'SELECT', objectId, additive: true });
    setTab('plan');
  }, []);

  const overlay = useMemo(
    () =>
      calculationRun === undefined
        ? undefined
        : buildOverlay(
            overlayId,
            calculationRun.runs,
            designTemperatureDifferenceK(calculationRun.runs),
          ),
    [calculationRun, overlayId],
  );

  const wallThicknessMm = useMemo(() => {
    const assembly = file.project.assemblies?.find(
      ({ id }) => id === wallAssemblyId,
    );
    return assembly === undefined
      ? 200
      : assembly.layers.reduce(
          (total, layer) => total + layer.thicknessM * 1000,
          0,
        );
  }, [file.project.assemblies, wallAssemblyId]);

  return (
    <main className="workspace">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mini BIM local-first</p>
          <h1>House Technical Designer</h1>
        </div>
        <div className="actions">
          <button className="secondary" onClick={undo}>
            Annuler
          </button>
          <button className="secondary" onClick={redo}>
            Rétablir
          </button>
          <button
            className="secondary"
            onClick={() => {
              setClimate([]);
              adopt(
                createBlankProject(new Date().toISOString()),
                'Nouveau projet local prêt, bibliothèque générique incluse.',
              );
            }}
          >
            Nouveau projet
          </button>
          <button
            className="secondary"
            onClick={() => importInput.current?.click()}
          >
            Ouvrir
          </button>
          <button
            className="secondary"
            onClick={() => {
              const demo = loadDemoProject();
              if (demo.status === 'ERROR') {
                setMessage(demo.message);
                return;
              }
              setClimate(demoClimateDatasets());
              adopt(demo.file, 'Maison de démonstration chargée.');
            }}
          >
            Maison de démonstration
          </button>
          <button className="secondary" onClick={saveProject}>
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
            ref={importInput}
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
          <nav aria-label="Sections du projet" className="workspace-tabs">
            {WORKSPACE_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === tab ? 'active' : undefined}
                aria-current={entry.id === tab ? 'page' : undefined}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <label className="level-selector">
            Niveau
            <select
              value={activeLevelId ?? ''}
              onChange={(event) =>
                dispatchEditor({
                  type: 'SET_LEVEL',
                  levelId: event.target.value,
                })
              }
            >
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>
          {tab === 'plan' && (
            <>
              <LayersPanel editor={editor} dispatch={dispatchEditor} />
              <OverlayControl
                overlayId={overlayId}
                onChange={setOverlayId}
                {...(overlay === undefined ? {} : { overlay })}
                {...(climate.length === 0
                  ? {
                      unavailableReason:
                        'Analyse indisponible : aucun résultat de module pour ce projet.',
                    }
                  : {})}
              />
            </>
          )}
        </aside>

        {tab === 'plan' && (
          <section className="canvas-panel panel" id="plan">
            <header className="panel-heading">
              <div>
                <p className="panel-label">Vue active</p>
                <h2>
                  Plan ·{' '}
                  {levels.find(({ id }) => id === activeLevelId)?.name ??
                    'aucun niveau'}
                </h2>
              </div>
              <span className="scale-chip">
                {(editor.camera.pixelsPerMm * 1000).toFixed(0)} px/m · mm
              </span>
            </header>
            <ToolBar
              project={file.project}
              editor={editor}
              dispatch={dispatchEditor}
              assemblyId={wallAssemblyId}
              onAssemblyChange={setWallAssemblyId}
              openingDraft={openingDraft}
              onOpeningDraftChange={setOpeningDraft}
            />
            <PlanCanvas
              project={file.project}
              editor={{ ...editor, levelId: activeLevelId } as EditorState}
              dispatch={dispatchEditor}
              onCommitPoints={commitPoints}
              wallThicknessMm={wallThicknessMm}
              {...(overlay === undefined ? {} : { overlay })}
            />
          </section>
        )}

        {tab === 'building' && (
          <section className="canvas-panel panel">
            <BuildingPanel
              project={file.project}
              levelId={activeLevelId}
              onCommand={runCommand}
              onSelectLevel={(levelId) =>
                dispatchEditor({ type: 'SET_LEVEL', levelId })
              }
            />
          </section>
        )}

        {tab === 'materials' && (
          <section className="canvas-panel panel">
            <MaterialsPanel
              project={file.project}
              onCommand={runCommand}
              {...(selectedMaterialId === undefined
                ? {}
                : { selectedId: selectedMaterialId })}
              onSelect={setSelectedMaterialId}
            />
          </section>
        )}

        {tab === 'assemblies' && (
          <section className="canvas-panel panel">
            <AssembliesPanel
              project={file.project}
              onCommand={runCommand}
              {...(selectedAssemblyId === undefined
                ? {}
                : { selectedId: selectedAssemblyId })}
              onSelect={setSelectedAssemblyId}
            />
          </section>
        )}

        {tab === 'calculations' && (
          <section className="canvas-panel panel">
            <CalculationsPanel
              project={file.project}
              climate={climate}
              onSelectObjects={selectOnPlan}
            />
          </section>
        )}

        {tab === 'quantities' && (
          <section className="canvas-panel panel">
            <QuantitiesPanel
              project={file.project}
              onSelectObjects={selectOnPlan}
              onExportCsv={(content, fileName) =>
                download(content, fileName, 'text/csv;charset=utf-8')
              }
            />
          </section>
        )}

        {tab === 'scenarios' && (
          <section className="canvas-panel panel">
            <ScenariosPanel project={file.project} climate={climate} />
          </section>
        )}

        {tab === 'equipment' && (
          <section className="canvas-panel panel">
            <EquipmentPanel
              project={file.project}
              onCommand={runCommand}
              {...(selectedEquipmentId === undefined
                ? {}
                : { selectedId: selectedEquipmentId })}
              onSelect={setSelectedEquipmentId}
            />
          </section>
        )}

        <aside className="inspector panel" id="inventory">
          <p className="panel-label">Inspecteur</p>
          {tab === 'plan' ? (
            <InspectorPanel
              project={file.project}
              selection={editor.selection}
              onClear={() => dispatchEditor({ type: 'CLEAR_SELECTION' })}
            />
          ) : (
            <>
              <h2>{file.project.metadata.name}</h2>
              <dl className="metrics">
                {Object.entries(summary).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
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
