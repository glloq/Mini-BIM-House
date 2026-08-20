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
import type {
  DimensionType,
  ProjectFile,
  WallRole,
} from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  networkNodeTemplates,
  ReplaceProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  applyProjectScenario,
  loadProjectJson,
  serializeProjectFile,
} from '@house-technical-designer/project-io';
import {
  boundsOfObjects,
  buildPlanView,
  networkLayerId,
} from '@house-technical-designer/view-query';
import './styles.css';
import {
  createBlankProject,
  exportProjectPlan,
  ProjectEditingSession,
  safeFileStem,
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
import { NetworksPanel } from './networks/NetworksPanel.js';
import { ProjectPanel } from './project/ProjectPanel.js';
import { ChecksPanel } from './checks/ChecksPanel.js';
import type { CheckFix } from './checks/checks-model.js';
import { placeNodeCommand } from './networks/network-model.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import {
  AUTOSAVE_DELAY_MS,
  SAVE_STATE_LABELS,
  discardAutosave,
  readAutosave,
  writeAutosave,
  type SaveState,
} from './autosave.js';
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
  addDimensionCommand,
  addOpeningCommand,
  addWallCommand,
  deleteObjectsCommand,
} from './editor/editing-commands.js';

function download(content: string, fileName: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // The anchor has to be in the document for the browser to honour its
  // download name, and the blob URL has to outlive the click: revoking it in
  // the same tick loses the file name and saves the download unnamed.
  document.body.append(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

const WORKSPACE_TABS = [
  { id: 'project', label: 'Projet' },
  { id: 'plan', label: 'Plan architectural' },
  { id: 'building', label: 'Niveaux et pièces' },
  { id: 'materials', label: 'Matériaux' },
  { id: 'assemblies', label: 'Assemblages' },
  { id: 'equipment', label: 'Équipements' },
  { id: 'networks', label: 'Réseaux' },
  { id: 'calculations', label: 'Calculs' },
  { id: 'quantities', label: 'Quantités' },
  { id: 'scenarios', label: 'Scénarios' },
  { id: 'checks', label: 'Vérifications' },
] as const;

type WorkspaceTab = (typeof WORKSPACE_TABS)[number]['id'];

/** Version reported in diagnostics; it matches the project file it writes. */
const APPLICATION_VERSION = '0.1.0';

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
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>();
  const [nodeKind, setNodeKind] = useState('');
  const [openingDraft, setOpeningDraft] =
    useState<OpeningDraft>(DEFAULT_OPENING);
  const [dimensionType, setDimensionType] = useState<DimensionType>('ALIGNED');
  const [wallRole, setWallRole] = useState<WallRole>('EXTERIOR');
  const [climate, setClimate] = useState<readonly ClimateDataset[]>([]);
  const [overlayId, setOverlayId] = useState<OverlayId>('none');
  const [saveState, setSaveState] = useState<SaveState>('SAVED');
  /** Whether the workspace navigation is open as a drawer on a narrow screen. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [recovery, setRecovery] = useState<{
    readonly savedAt: string;
    readonly file: ProjectFile;
  }>();
  const [calculationRun, setCalculationRun] = useState<CalculationRun>();
  const [calculationBusy, setCalculationBusy] = useState(false);
  /** Bumped by an explicit recompute; the effect above watches it. */
  const [calculationGeneration, setCalculationGeneration] = useState(0);
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
  const networks = file.project.systems ?? [];
  const activeNetwork =
    networks.find(({ id }) => id === selectedNetworkId) ?? networks[0];
  const activeNetworkId = activeNetwork?.id;
  // The drafted node kind has to belong to the active network's discipline: a
  // luminaire is not a node an extract duct can carry.
  const nodeKinds =
    activeNetwork === undefined
      ? []
      : networkNodeTemplates(activeNetwork.discipline);
  const activeNodeKind =
    nodeKinds.find(({ kind }) => kind === nodeKind)?.kind ??
    nodeKinds[0]?.kind ??
    '';

  /**
   * A project replacement waiting for the user to say what to do with the work
   * already in the editor.
   */
  const [pendingReplacement, setPendingReplacement] = useState<{
    readonly label: string;
    readonly run: () => void;
  }>();

  /**
   * Replaces the open project.
   *
   * The resulting save state is stated by the caller rather than inherited:
   * a project restored from the local snapshot has never been exported, and
   * showing it as "Enregistré" would claim a durable copy that does not exist.
   */
  const adopt = useCallback(
    (
      next: ProjectFile,
      notice: string,
      nextSaveState: SaveState = 'SAVED',
    ): void => {
      setFile(next);
      session.current = new ProjectEditingSession(next);
      setWallAssemblyId(next.project.assemblies?.[0]?.id ?? '');
      setSelectedMaterialId(undefined);
      setSelectedAssemblyId(undefined);
      setSelectedEquipmentId(undefined);
      setSelectedNetworkId(next.project.systems?.[0]?.id);
      setNodeKind('');
      dispatchEditor({ type: 'CANCEL' });
      const firstLevel = next.project.building.levels[0];
      if (firstLevel !== undefined)
        dispatchEditor({ type: 'SET_LEVEL', levelId: firstLevel.id });
      setSaveState(nextSaveState);
      setMessage(notice);
    },
    [],
  );

  /**
   * Runs a project replacement, asking first when it would discard work.
   *
   * The local snapshot is not an export: replacing a modified project without
   * a word would lose whatever has not been written to a file.
   */
  const replaceProject = useCallback(
    (label: string, run: () => void): void => {
      if (saveState === 'SAVED') {
        run();
        return;
      }
      setPendingReplacement({ label, run });
    },
    [saveState],
  );

  const runCommand = useCallback((command: ProjectCommand): boolean => {
    const result = session.current.dispatch(command);
    if (result.status === 'ERROR') {
      setMessage(`Refusé — ${result.messages.join(' ')}`);
      return false;
    }
    setFile(result.file);
    setSaveState('MODIFIED');
    setMessage(`${command.label} · appliqué.`);
    return true;
  }, []);

  const saveProject = useCallback(() => {
    download(
      serializeProjectFile(file),
      `${safeFileStem(file.project.metadata.name)}.houseproj.json`,
      'application/json',
    );
    setSaveState('SAVED');
    setMessage('Projet exporté en JSON.');
  }, [file]);

  const undo = useCallback(() => {
    const result = session.current.undo();
    if (result.status === 'OK') {
      setFile(result.file);
      setSaveState('MODIFIED');
    }
    setMessage(
      result.status === 'OK'
        ? 'Dernière commande annulée.'
        : (result.messages[0] ?? 'Historique vide.'),
    );
  }, []);

  const redo = useCallback(() => {
    const result = session.current.redo();
    if (result.status === 'OK') {
      setFile(result.file);
      setSaveState('MODIFIED');
    }
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
    const command = deleteObjectsCommand(
      session.current.file,
      activeLevelId,
      editor.selection,
    );
    if (command.status === 'ERROR') {
      setMessage(command.message);
      return;
    }
    if (runCommand(command.command))
      dispatchEditor({ type: 'CLEAR_SELECTION' });
  }, [activeLevelId, editor.selection, runCommand]);

  const commitPoints = useCallback(
    (points: readonly { x: number; y: number }[]) => {
      if (editor.activeTool === 'WALL') {
        const command = addWallCommand(
          session.current.file,
          activeLevelId,
          points,
          { assemblyId: wallAssemblyId, role: wallRole },
          `wall-${crypto.randomUUID()}`,
        );
        if (command.status === 'ERROR') {
          setMessage(command.message);
          return;
        }
        runCommand(command.command);
        return;
      }
      if (editor.activeTool === 'NETWORK') {
        if (activeNetworkId === undefined) {
          setMessage(
            'Aucun réseau actif : créez un réseau dans l’onglet Réseaux.',
          );
          return;
        }
        const point = points[points.length - 1]!;
        const level = session.current.file.project.building.levels.find(
          ({ id }) => id === activeLevelId,
        );
        const command = placeNodeCommand(
          session.current.file.project,
          activeNetworkId,
          {
            nodeId: `${activeNetworkId}:node-${crypto.randomUUID().slice(0, 8)}`,
            kind: activeNodeKind,
            position: {
              x: point.x,
              y: point.y,
              z: level?.elevationMm ?? 0,
            },
          },
        );
        if (command.status === 'ERROR') {
          setMessage(command.message);
          return;
        }
        runCommand(command.command);
        return;
      }
      if (editor.activeTool === 'DIMENSION') {
        const command = addDimensionCommand(
          session.current.file,
          activeLevelId,
          points,
          { dimensionType },
          `dimension-${crypto.randomUUID()}`,
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
      activeNetworkId,
      activeNodeKind,
      dimensionType,
      editor.activeTool,
      openingDraft,
      runCommand,
      wallAssemblyId,
      wallRole,
    ],
  );

  /**
   * Turns a scenario into the project itself.
   *
   * The variant is derived on read, so promoting it means writing what it
   * describes into the project — as one command, undoable like any other. The
   * scenario is left in place: it is a record of what was compared.
   */
  const promoteScenario = useCallback(
    (scenarioId: string) => {
      const result = applyProjectScenario(
        session.current.file.project,
        scenarioId,
      );
      if (result.status !== 'OK') {
        setMessage(
          `Scénario non applicable — ${result.issues[0]?.message ?? 'raison inconnue'}`,
        );
        return;
      }
      const promoted = result.project;
      runCommand(
        new ReplaceProjectCommand(
          `scenario:promote:${scenarioId}`,
          'Promouvoir un scénario en projet',
          () => promoted,
          { objectIds: [scenarioId], domains: ['scenarios', 'calculations'] },
        ),
      );
    },
    [runCommand],
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

  // Drawing on a hidden layer would place a node the user cannot see, so the
  // discipline of the active network is revealed while its tool is in use.
  useEffect(() => {
    if (editor.activeTool !== 'NETWORK' || activeNetwork === undefined) return;
    dispatchEditor({
      type: 'SHOW_LAYERS',
      layerIds: [networkLayerId(activeNetwork.discipline)],
    });
  }, [activeNetwork, editor.activeTool]);

  useEffect(() => {
    if (saveState !== 'MODIFIED') return;
    const timer = setTimeout(() => {
      void writeAutosave(file)
        .then(() => setSaveState('AUTOSAVED'))
        .catch(() => setSaveState('FAILED'));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [file, saveState]);

  // Closing the tab with work that was never exported deserves the browser's
  // own warning. The local snapshot survives, but a file the user meant to keep
  // would not.
  useEffect(() => {
    if (saveState === 'SAVED') return;
    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  // A snapshot left by a previous session is offered, never applied silently.
  useEffect(() => {
    void readAutosave().then((result) => {
      if (result.status === 'RECOVERED')
        setRecovery({ savedAt: result.savedAt, file: result.file });
    });
  }, []);

  // One run feeds both the dashboard and the overlay. Two independent effects
  // used to compute the same thing twice whenever the calculation tab was
  // opened with an overlay already on.
  useEffect(() => {
    if (overlayId === 'none' && tab !== 'calculations') return;
    let current = true;
    setCalculationBusy(true);
    void runProjectCalculations(file.project, climate)
      .then((result) => {
        if (current) setCalculationRun(result);
      })
      .finally(() => {
        if (current) setCalculationBusy(false);
      });
    return () => {
      current = false;
    };
  }, [climate, file.project, overlayId, tab, calculationGeneration]);

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (shouldIgnoreTarget(target?.tagName, event)) return;
      const command = resolveShortcut(event);
      if (command === undefined) return;
      event.preventDefault();
      // Escape closes the drawer before it touches the drawing: the panel over
      // the plan is what the user is looking at.
      if (command === 'tool.select' && menuOpen) {
        setMenuOpen(false);
        return;
      }
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
        case 'tool.network':
          dispatchEditor({ type: 'SET_TOOL', tool: 'NETWORK' });
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
    menuOpen,
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
              : result.status === 'TOO_LARGE'
                ? `${result.breach.actual.toLocaleString('fr-FR')} ${result.breach.label} pour un maximum de ${result.breach.maximum.toLocaleString('fr-FR')}`
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

  /** Takes the user where a finding can actually be dealt with. */
  const applyFix = useCallback(
    (fix: CheckFix) => {
      if (fix.objectIds !== undefined && fix.objectIds.length > 0) {
        selectOnPlan(fix.objectIds);
        if (fix.tab !== 'plan') setTab(fix.tab);
        return;
      }
      setTab(fix.tab);
    },
    [selectOnPlan],
  );

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
          <button
            type="button"
            className="secondary menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="workspace-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Espaces de travail
          </button>
          <button className="secondary" onClick={undo}>
            Annuler
          </button>
          <button className="secondary" onClick={redo}>
            Rétablir
          </button>
          <button
            className="secondary"
            onClick={() =>
              replaceProject('Nouveau projet', () => {
                setClimate([]);
                adopt(
                  createBlankProject(new Date().toISOString()),
                  'Nouveau projet local prêt, bibliothèque générique incluse.',
                );
              })
            }
          >
            Nouveau projet
          </button>
          <button
            className="secondary"
            onClick={() =>
              replaceProject('Ouvrir un projet', () =>
                importInput.current?.click(),
              )
            }
          >
            Ouvrir
          </button>
          <button
            className="secondary"
            onClick={() =>
              replaceProject('Maison de démonstration', () => {
                const demo = loadDemoProject();
                if (demo.status === 'ERROR') {
                  setMessage(demo.message);
                  return;
                }
                setClimate(demoClimateDatasets());
                adopt(demo.file, 'Maison de démonstration chargée.');
              })
            }
          >
            Maison de démonstration
          </button>
          <button className="secondary" onClick={saveProject}>
            Sauvegarder
          </button>
          <button
            onClick={() => {
              const artifact = exportProjectPlan(file, {
                ...(activeLevelId === undefined
                  ? {}
                  : { levelId: activeLevelId }),
                layers: editor.layers,
              });
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
        <p role="status" aria-label="État de l’application">
          {message}
        </p>
        <span className={`save-state save-${saveState.toLowerCase()}`}>
          {SAVE_STATE_LABELS[saveState]}
        </span>
      </section>

      {pendingReplacement !== undefined && (
        <section className="panel recovery-prompt" role="alertdialog">
          <p>
            Ce projet contient des modifications qui n’ont pas été exportées. «{' '}
            {pendingReplacement.label} » les remplacerait.
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                saveProject();
                pendingReplacement.run();
                setPendingReplacement(undefined);
              }}
            >
              Exporter puis continuer
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                pendingReplacement.run();
                setPendingReplacement(undefined);
              }}
            >
              Continuer sans exporter
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setPendingReplacement(undefined)}
            >
              Annuler
            </button>
          </div>
        </section>
      )}

      {recovery !== undefined && (
        <section className="panel recovery-prompt" role="alertdialog">
          <p>
            Une sauvegarde locale plus récente a été trouvée (
            {new Date(recovery.savedAt).toLocaleString('fr-FR')}). Restaurer ?
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                adopt(
                  recovery.file,
                  'Sauvegarde locale restaurée : elle n’a pas encore été exportée.',
                  'AUTOSAVED',
                );
                setRecovery(undefined);
              }}
            >
              Restaurer
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                void discardAutosave();
                setRecovery(undefined);
              }}
            >
              Ignorer et supprimer
            </button>
          </div>
        </section>
      )}

      <div className="workspace-grid">
        {menuOpen && (
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Fermer les espaces de travail"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside
          id="workspace-sidebar"
          className={menuOpen ? 'sidebar panel open' : 'sidebar panel'}
        >
          <p className="panel-label">Modèle</p>
          <nav aria-label="Sections du projet" className="workspace-tabs">
            {WORKSPACE_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={entry.id === tab ? 'active' : undefined}
                aria-current={entry.id === tab ? 'page' : undefined}
                onClick={() => {
                  setTab(entry.id);
                  setMenuOpen(false);
                }}
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
              onAssemblyChange={(assemblyId) => {
                setWallAssemblyId(assemblyId);
                // Choosing a partition proposes the matching role; the user
                // stays free to override it, and nothing is inferred silently
                // at creation time.
                const category = file.project.assemblies?.find(
                  ({ id }) => id === assemblyId,
                )?.category;
                if (category === 'PARTITION') setWallRole('PARTITION');
                if (category === 'WALL') setWallRole('EXTERIOR');
              }}
              wallRole={wallRole}
              onWallRoleChange={setWallRole}
              openingDraft={openingDraft}
              onOpeningDraftChange={setOpeningDraft}
              dimensionType={dimensionType}
              onDimensionTypeChange={setDimensionType}
              networkId={activeNetworkId ?? ''}
              onNetworkChange={setSelectedNetworkId}
              nodeKind={activeNodeKind}
              onNodeKindChange={setNodeKind}
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

        {tab === 'project' && (
          <section className="canvas-panel panel">
            <ProjectPanel
              project={file.project}
              climate={climate}
              onCommand={runCommand}
              onClimateChange={setClimate}
              onMessage={setMessage}
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

        {tab === 'networks' && (
          <section className="canvas-panel panel">
            <NetworksPanel
              project={file.project}
              levelId={activeLevelId}
              selectedNetworkId={activeNetworkId}
              onSelectNetwork={setSelectedNetworkId}
              onCommand={runCommand}
              onSelectObjects={(objectIds) => {
                if (activeNetwork !== undefined)
                  dispatchEditor({
                    type: 'SHOW_LAYERS',
                    layerIds: [networkLayerId(activeNetwork.discipline)],
                  });
                selectOnPlan(objectIds);
              }}
              onMessage={setMessage}
            />
          </section>
        )}

        {tab === 'calculations' && (
          <section className="canvas-panel panel">
            <CalculationsPanel
              project={file.project}
              climate={climate}
              {...(calculationRun === undefined ? {} : { run: calculationRun })}
              running={calculationBusy}
              onRecompute={() =>
                setCalculationGeneration((generation) => generation + 1)
              }
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

        {tab === 'checks' && (
          <section className="canvas-panel panel">
            <ChecksPanel
              project={file.project}
              {...(calculationRun === undefined ? {} : { run: calculationRun })}
              running={calculationBusy}
              onFix={applyFix}
            />
          </section>
        )}

        {tab === 'scenarios' && (
          <section className="canvas-panel panel">
            <ScenariosPanel
              project={file.project}
              climate={climate}
              onCommand={runCommand}
              onMessage={setMessage}
              onPromote={promoteScenario}
            />
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
              onCommand={runCommand}
              onMessage={setMessage}
              onDelete={deleteSelection}
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
function downloadDiagnostic(report: unknown): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'diagnostic.json';
  document.body.append(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary
      applicationVersion={APPLICATION_VERSION}
      onDownloadDiagnostic={downloadDiagnostic}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
