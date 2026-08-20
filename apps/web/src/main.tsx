import {
  lazy,
  StrictMode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import type {
  DimensionType,
  ProjectFile,
  WallRole,
} from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { validateClimateDataset } from '@house-technical-designer/climate';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  networkNodeTemplates,
  ReplaceProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  applyProjectScenario,
  DEFAULT_ZIP_LIMITS,
  loadProjectJson,
  ProjectContainerError,
  ProjectSerializationError,
  readProjectContainer,
  serializeProjectFile,
  validateProjectFile,
  writeProjectContainer,
} from '@house-technical-designer/project-io';
import {
  boundsOfObjects,
  buildPlanView,
  networkLayerId,
} from '@house-technical-designer/view-query';
import './styles.css';
import {
  createBlankProject,
  projectFromDraft,
  exportProjectPlan,
  ProjectEditingSession,
  safeFileStem,
  summarizeProject,
} from './project-workspace.js';
import { demoClimateDatasets, loadDemoProject } from './demo-project.js';
import { PlanCanvas } from './editor/PlanCanvas.js';
import { InspectorPanel } from './editor/InspectorPanel.js';
import { LayersPanel } from './editor/LayersPanel.js';
import { ToolBar, type OpeningDraft } from './editor/ToolBar.js';
import { OverlayControl } from './calculations/OverlayControl.js';
import { APPLICATION_VERSION } from './version.js';
import type { CheckFix } from './checks/checks-model.js';
import { toolDefinition } from './editor/tool-registry.js';
import { nextLibraryId } from './library/library-model.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import {
  announcesSaved,
  AUTOSAVE_DELAY_MS,
  SAVE_STATE_LABELS,
  discardAutosave,
  snapshotIdentity,
  lastAutosaveTime,
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
  isCurrentRun,
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
  type ShortcutCommandId,
} from './editor/shortcuts.js';
import { CommandPalette } from './palette/CommandPalette.js';
import { PanelSeparator } from './shell/PanelSeparator.js';
import { StatusBar } from './shell/StatusBar.js';
import {
  boundedWidth,
  gridColumns,
  loadLayout,
  saveLayout,
  type WorkspaceLayout,
} from './shell/workspace-layout.js';
import { objectEntries, type PaletteEntry } from './palette/palette-model.js';
import { inspectObject } from './editor/object-editors.js';
import { EDITOR_TOOLS } from './editor/tool-registry.js';
import {
  deleteObjectsCommand,
  duplicateObjectsCommand,
  geometryEditCommand,
  moveObjectsCommand,
} from './editor/editing-commands.js';
import type { GeometryEdit } from './editor/grips.js';

/**
 * Workspaces loaded when they are opened.
 *
 * Opening a project and drawing does not need the calculation dashboard, the
 * libraries or the checks; downloading them before the first line is drawn
 * only delays the drawing. Each workspace arrives when it is asked for, and
 * stays for the rest of the session.
 */
const MaterialsPanel = lazy(async () => ({
  default: (await import('./library/MaterialsPanel.js')).MaterialsPanel,
}));
const AssembliesPanel = lazy(async () => ({
  default: (await import('./library/AssembliesPanel.js')).AssembliesPanel,
}));
const EquipmentPanel = lazy(async () => ({
  default: (await import('./library/EquipmentPanel.js')).EquipmentPanel,
}));
const BuildingPanel = lazy(async () => ({
  default: (await import('./editor/BuildingPanel.js')).BuildingPanel,
}));
const CalculationsPanel = lazy(async () => ({
  default: (await import('./calculations/CalculationsPanel.js'))
    .CalculationsPanel,
}));
const QuantitiesPanel = lazy(async () => ({
  default: (await import('./quantities/QuantitiesPanel.js')).QuantitiesPanel,
}));
const ScenariosPanel = lazy(async () => ({
  default: (await import('./scenarios/ScenariosPanel.js')).ScenariosPanel,
}));
const NetworksPanel = lazy(async () => ({
  default: (await import('./networks/NetworksPanel.js')).NetworksPanel,
}));
const ProjectPanel = lazy(async () => ({
  default: (await import('./project/ProjectPanel.js')).ProjectPanel,
}));
const ChecksPanel = lazy(async () => ({
  default: (await import('./checks/ChecksPanel.js')).ChecksPanel,
}));
const NewProjectWizard = lazy(async () => ({
  default: (await import('./project/NewProjectWizard.js')).NewProjectWizard,
}));

/** One workspace panel, with what to show while its code is still arriving. */
function LazyWorkspace({ children }: { readonly children: ReactNode }) {
  return (
    <section className="canvas-panel panel">
      <Suspense
        fallback={<p className="notice">Chargement de l’espace de travail…</p>}
      >
        {children}
      </Suspense>
    </section>
  );
}

function download(content: string, fileName: string, mediaType: string): void {
  downloadBlob(new Blob([content], { type: mediaType }), fileName);
}

/**
 * A dataset carried by a container, once it has been checked.
 *
 * A file may hold anything; what is adopted has to satisfy the climate
 * contract, or the project would recalculate on something that is not weather.
 */
/**
 * What to add to an import notice when the file came from an older schema.
 *
 * A project written by an earlier version is brought up to date on the way in.
 * Saying nothing would give back a file that is no longer the one that was
 * saved, without the user ever having been told.
 */
function migrationNotice(
  journal: readonly { readonly from: string; readonly to: string }[],
): string {
  if (journal.length === 0) return '';
  const from = journal[0]!.from;
  const to = journal[journal.length - 1]!.to;
  return ` Le fichier était au format ${from} : il a été mis à jour en ${to}, et c'est cette version qui sera enregistrée.`;
}

function readClimateDataset(json: string): ClimateDataset | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  const dataset = parsed as ClimateDataset;
  return validateClimateDataset(dataset).length === 0 ? dataset : undefined;
}

function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  mediaType: string,
): void {
  downloadBlob(
    new Blob([bytes as unknown as BlobPart], { type: mediaType }),
    fileName,
  );
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
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

/**
 * The workspaces, gathered by what the user is doing rather than listed flat.
 *
 * Eleven entries in one column read as eleven unrelated places; grouped, they
 * say that a project is described, then drawn, then furnished from libraries,
 * then serviced, and only then calculated.
 */
const WORKSPACE_GROUPS = [
  { label: 'Projet', tabs: [{ id: 'project', label: 'Projet' }] },
  {
    label: 'Conception',
    tabs: [
      { id: 'plan', label: 'Plan architectural' },
      { id: 'building', label: 'Niveaux et pièces' },
    ],
  },
  {
    label: 'Bibliothèques',
    tabs: [
      { id: 'materials', label: 'Matériaux' },
      { id: 'assemblies', label: 'Assemblages' },
    ],
  },
  {
    label: 'Technique',
    tabs: [
      { id: 'equipment', label: 'Équipements' },
      { id: 'networks', label: 'Réseaux' },
    ],
  },
  {
    label: 'Résultats',
    tabs: [
      { id: 'calculations', label: 'Calculs' },
      { id: 'quantities', label: 'Quantités' },
      { id: 'scenarios', label: 'Scénarios' },
      { id: 'checks', label: 'Vérifications' },
    ],
  },
] as const;

type WorkspaceTab = (typeof WORKSPACE_GROUPS)[number]['tabs'][number]['id'];

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
  /** A network object another screen asked to open the properties of. */
  const [inspectNetworkObjectId, setInspectNetworkObjectId] =
    useState<string>();
  const [openingDraft, setOpeningDraft] =
    useState<OpeningDraft>(DEFAULT_OPENING);
  const [dimensionType, setDimensionType] = useState<DimensionType>('ALIGNED');
  const [wallRole, setWallRole] = useState<WallRole>('EXTERIOR');
  const [climate, setClimate] = useState<readonly ClimateDataset[]>([]);
  const [overlayId, setOverlayId] = useState<OverlayId>('none');
  const [saveState, setSaveState] = useState<SaveState>('SAVED');
  /** Whether the workspace navigation is open as a drawer on a narrow screen. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // How wide the panels are is a preference of the person, kept in the browser
  // and never in the project.
  const [layout, setLayout] = useState<WorkspaceLayout>(() =>
    loadLayout(typeof localStorage === 'undefined' ? undefined : localStorage),
  );
  const [recovery, setRecovery] = useState<{
    readonly savedAt: string;
    readonly file: ProjectFile;
    /** The datasets the snapshot carried, restored with it. */
    readonly climate: readonly ClimateDataset[];
  }>();
  /** Why the last export was refused, when it was. */
  const [exportFailure, setExportFailure] = useState<readonly string[]>();
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

  /** Whether the creation assistant is open, waiting for its answers. */
  const [creating, setCreating] = useState(false);

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
      // Results belong to the project they were computed from; opening another
      // one leaves nothing to show until it has been calculated.
      setCalculationRun(undefined);
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

  /**
   * Writes the project and the climate it uses as one file.
   *
   * A project naming a climate profile it does not carry recalculates nothing
   * on another machine. The plain JSON stays available beside it, for reading
   * and for tooling.
   */
  const saveContainer = useCallback(async (): Promise<boolean> => {
    {
      // Compressing takes time, and the project may be edited while it runs.
      // What the file holds is the revision captured here, and the state bar
      // says so rather than claiming the current one was written.
      const exported = file.project.metadata.projectRevision ?? '';
      try {
        const bytes = await writeProjectContainer(
          file,
          climate.map((dataset) => ({
            id: dataset.id,
            json: JSON.stringify(dataset, null, 2),
          })),
        );
        setExportFailure(undefined);
        downloadBytes(
          bytes,
          `${safeFileStem(file.project.metadata.name)}.houseproj`,
          'application/zip',
        );
        const current =
          session.current.file.project.metadata.projectRevision ?? '';
        const moved = current !== exported;
        setSaveState(moved ? 'MODIFIED' : 'SAVED');
        setMessage(
          moved
            ? `Révision ${exported} exportée (.houseproj) ; le projet a été modifié depuis.`
            : climate.length === 0
              ? 'Projet exporté (.houseproj).'
              : `Projet exporté (.houseproj) avec ${climate.length} jeu(x) climatiques.`,
        );
        return true;
      } catch (error) {
        // A project naming a climate the session does not hold cannot be
        // written as a container: it would open elsewhere calculating nothing.
        // The refusal says which dataset is missing and what to do about it.
        if (error instanceof ProjectContainerError) {
          const profile = file.project.site.climateProfileId ?? '';
          setExportFailure([
            `Le projet désigne le profil climatique « ${profile} », qui n'est pas chargé dans cette session.`,
            'Importez ce jeu de données depuis l’espace Projet, ou retirez la référence, puis exportez à nouveau.',
          ]);
          setMessage(
            'Export impossible : le climat que le projet désigne ne voyagerait pas avec lui.',
          );
          return false;
        }
        const issues =
          error instanceof ProjectSerializationError ? error.issues : [];
        setExportFailure(
          issues.length > 0
            ? issues.map(({ path, message }) => `${path} ${message}`)
            : [error instanceof Error ? error.message : String(error)],
        );
        setMessage("Export impossible : le projet n'est pas enregistrable.");
        return false;
      }
    }
  }, [climate, file]);

  const saveProject = useCallback((): boolean => {
    // The serialiser refuses to write a project the format would not accept.
    // A click handler is outside any error boundary, so the refusal is caught
    // here and said out loud rather than lost in the console with the save
    // state left claiming the project was written.
    let json: string;
    try {
      json = serializeProjectFile(file);
    } catch (error) {
      const issues =
        error instanceof ProjectSerializationError ? error.issues : [];
      setExportFailure(
        issues.length > 0
          ? issues.map(({ path, message }) => `${path} ${message}`)
          : [error instanceof Error ? error.message : String(error)],
      );
      setMessage("Export impossible : le projet n'est pas enregistrable.");
      return false;
    }
    setExportFailure(undefined);
    download(
      json,
      `${safeFileStem(file.project.metadata.name)}.houseproj.json`,
      'application/json',
    );
    setSaveState('SAVED');
    setMessage('Projet exporté en JSON.');
    return true;
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

  /**
   * Applies what a dragged handle asked for.
   *
   * A refusal is said out loud: dragging a wall end past its own window is a
   * reasonable thing to try, and the reason it cannot be done belongs on
   * screen rather than in a silently ignored gesture.
   */
  const editGeometry = useCallback(
    (edit: GeometryEdit) => {
      const command = geometryEditCommand(
        session.current.file,
        activeLevelId,
        edit,
        edit.kind === 'WALL_SPLIT'
          ? nextLibraryId(
              'wall',
              'segment',
              (
                session.current.file.project.building.levels.find(
                  ({ id }) => id === activeLevelId,
                )?.walls ?? []
              ).map(({ id }) => id),
            )
          : undefined,
      );
      if (command.status === 'ERROR') {
        setMessage(command.message);
        return;
      }
      runCommand(command.command);
    },
    [activeLevelId, runCommand],
  );

  const columns = gridColumns(layout);

  const changeLayout = useCallback((patch: Partial<WorkspaceLayout>): void => {
    setLayout((current) => {
      const next: WorkspaceLayout = {
        ...current,
        ...patch,
        ...(patch.sidebarPx === undefined
          ? {}
          : { sidebarPx: boundedWidth(patch.sidebarPx) }),
        ...(patch.inspectorPx === undefined
          ? {}
          : { inspectorPx: boundedWidth(patch.inspectorPx) }),
      };
      saveLayout(
        typeof localStorage === 'undefined' ? undefined : localStorage,
        next,
      );
      return next;
    });
  }, []);

  /**
   * Copies the selection a little to the side, and selects the copies.
   *
   * Leaving the originals selected would look like nothing happened, and the
   * next edit would land on the wrong objects.
   */
  const duplicateSelection = useCallback(() => {
    const step =
      editor.snap.gridSpacingMm > 0 ? editor.snap.gridSpacingMm : 100;
    const result = duplicateObjectsCommand(
      session.current.file,
      activeLevelId,
      editor.selection,
      { x: step * 2, y: step * 2 },
      (prefix) => `${prefix}-${crypto.randomUUID()}`,
    );
    if (result.status === 'ERROR') {
      setMessage(result.message);
      return;
    }
    if (!runCommand(result.command)) return;
    dispatchEditor({ type: 'SELECT_MANY', objectIds: result.createdIds });
  }, [activeLevelId, editor.selection, editor.snap.gridSpacingMm, runCommand]);

  /** Carries the whole selection, as one entry in the history. */
  const moveSelection = useCallback(
    (delta: { x: number; y: number }) => {
      const result = moveObjectsCommand(
        session.current.file,
        activeLevelId,
        editor.selection,
        delta,
      );
      if (result.status === 'ERROR') {
        setMessage(result.message);
        return;
      }
      runCommand(result.command);
    },
    [activeLevelId, editor.selection, runCommand],
  );

  const commitPoints = useCallback(
    (points: readonly { x: number; y: number }[], pickedObjectId?: string) => {
      // The tool says what its clicks mean. The application only carries them
      // to it: a new tool is a new entry in the registry, not another branch
      // here.
      const tool = toolDefinition(editor.activeTool);
      const result = tool.createCommand?.({
        file: session.current.file,
        ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
        points,
        ...(pickedObjectId === undefined ? {} : { pickedObjectId }),
        drafts: {
          wallAssemblyId,
          wallRole,
          opening: openingDraft,
          dimensionType,
          ...(activeNetworkId === undefined
            ? {}
            : { networkId: activeNetworkId }),
          nodeKind: activeNodeKind,
        },
        newId: (prefix) =>
          prefix === ''
            ? crypto.randomUUID()
            : `${prefix}-${crypto.randomUUID()}`,
      });
      if (result === undefined) return;
      if (result.status === 'ERROR') {
        setMessage(result.message);
        return;
      }
      runCommand(result.command);
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
          // Promotion writes a whole project into the editor; what it writes has
          // to be a project the format would accept, or the file could no longer
          // be saved at all.
          (candidate) =>
            validateProjectFile({
              ...session.current.file,
              project: candidate,
            }).map(({ path, message }) => `${path} ${message}`),
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
    const snapshot = snapshotIdentity(file);
    const timer = setTimeout(() => {
      void writeAutosave({ file, climate })
        .then((written) => {
          // Announcing "saved" for a state that is no longer on screen would
          // also cancel the newer snapshot's own timer, leaving the edit
          // unwritten behind a reassuring label.
          if (
            announcesSaved(
              written,
              snapshot,
              snapshotIdentity(session.current.file),
            )
          )
            setSaveState('AUTOSAVED');
        })
        .catch(() => setSaveState('FAILED'));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [climate, file, saveState]);

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
        setRecovery({
          savedAt: result.savedAt,
          file: result.file,
          // A project restored without the weather it was calculated on is not
          // the session that was interrupted.
          climate: result.climateJson
            .map((json) => readClimateDataset(json))
            .filter(
              (dataset): dataset is ClimateDataset => dataset !== undefined,
            ),
        });
    });
  }, []);

  // One run feeds both the dashboard and the overlay. Two independent effects
  // used to compute the same thing twice whenever the calculation tab was
  // opened with an overlay already on.
  useEffect(() => {
    // Checks read the calculation results, so opening them has to produce a
    // run for the current revision rather than reuse whatever was last left.
    if (overlayId === 'none' && tab !== 'calculations' && tab !== 'checks')
      return;
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

  /**
   * Runs a command by name, wherever it was asked for.
   *
   * The keyboard is one way of asking; the palette is another, and neither
   * should hold its own copy of what a command does.
   */
  const runShortcut = useCallback(
    (command: ShortcutCommandId): void => {
      switch (command) {
        case 'tool.select':
          // Échap défait une chose à la fois, la plus récente d'abord :
          // l'action en cours, puis l'outil, puis la sélection. Le réducteur
          // sait où l'on en est ; la touche ne fait que le lui dire.
          dispatchEditor({ type: 'CANCEL' });
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
        case 'tool.split':
          dispatchEditor({ type: 'SET_TOOL', tool: 'SPLIT' });
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
        case 'edit.duplicate':
          duplicateSelection();
          return;
        case 'file.save':
          void saveContainer();
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
          setPaletteOpen(true);
      }
    },
    [
      deleteSelection,
      dispatchEditor,
      duplicateSelection,
      redo,
      saveContainer,
      undo,
      zoomFit,
      zoomSelection,
    ],
  );

  /**
   * Everything the palette can reach.
   *
   * Tools, workspaces, levels, keyboard commands and the objects of the storey
   * being drawn are unrelated everywhere else in the application and the same
   * thing here: a line to read and something that happens when it is chosen.
   */
  const paletteEntries = useMemo<readonly PaletteEntry[]>(
    () => [
      ...EDITOR_TOOLS.map((tool) => ({
        id: `outil:${tool.id}`,
        label: tool.label,
        group: 'Outils',
        hint: tool.hint,
        run: () => {
          setTab('plan');
          dispatchEditor({ type: 'SET_TOOL', tool: tool.id });
        },
      })),
      ...WORKSPACE_GROUPS.flatMap((group) =>
        group.tabs.map((entry) => ({
          id: `espace:${entry.id}`,
          label: entry.label,
          group: 'Espaces',
          hint: group.label,
          run: () => setTab(entry.id),
        })),
      ),
      ...SHORTCUTS.filter(
        (binding) =>
          binding.id !== 'palette.open' && !binding.id.startsWith('tool.'),
      ).map((binding) => ({
        id: binding.id,
        label: binding.label,
        group: 'Commandes',
        hint: shortcutLabel(binding),
        run: () => runShortcut(binding.id),
      })),
      ...file.project.building.levels.map((level) => ({
        id: `niveau:${level.id}`,
        label: level.name,
        group: 'Niveaux',
        hint: `${(level.elevationMm / 1000).toFixed(2)} m`,
        run: () => {
          setTab('plan');
          dispatchEditor({ type: 'SET_LEVEL', levelId: level.id });
        },
      })),
      ...objectEntries({
        project: file.project,
        ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
        describe: (objectId) => inspectObject(file.project, objectId).title,
        select: (objectId) => {
          setTab('plan');
          dispatchEditor({ type: 'SET_TOOL', tool: 'SELECT' });
          dispatchEditor({ type: 'SELECT', objectId });
        },
      }),
    ],
    [activeLevelId, file.project, runShortcut],
  );

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
      runShortcut(command);
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [menuOpen, runShortcut]);

  async function importProject(selected: File | undefined): Promise<void> {
    if (selected === undefined) return;
    // The size is read before the bytes are: a file far past what the reader
    // accepts should not be pulled into memory to be refused afterwards.
    if (selected.size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) {
      setMessage(
        `Import refusé — ce fichier fait ${Math.round(selected.size / 1024 / 1024)} Mo ; la limite est de ${Math.round(DEFAULT_ZIP_LIMITS.maxArchiveBytes / 1024 / 1024)} Mo.`,
      );
      return;
    }
    const bytes = new Uint8Array(await selected.arrayBuffer());
    const container = await readProjectContainer(bytes, {
      // A dataset that does not satisfy the contract makes the container
      // invalid; dropping it silently would open a project whose weather
      // quietly went missing.
      validateClimate: (json) => readClimateDataset(json) !== undefined,
    });
    if (container.status === 'INVALID_CONTAINER') {
      setMessage(`Import refusé — ${container.message}`);
      return;
    }
    if (container.status === 'OK') {
      // A container carries its climate: the project reopens with the data it
      // was calculated on, on this machine or another. Every entry has already
      // been checked, so nothing is dropped here.
      const datasets = container.container.climate
        .map(({ json }) => readClimateDataset(json))
        .filter((dataset): dataset is ClimateDataset => dataset !== undefined);
      setClimate(datasets);
      adopt(
        container.container.file,
        (datasets.length === 0
          ? `${selected.name} chargé et validé.`
          : `${selected.name} chargé et validé, avec ${datasets.length} jeu(x) de données climatiques.`) +
          migrationNotice(container.migrationJournal),
      );
      return;
    }
    const result =
      container.status === 'INVALID_PROJECT'
        ? container.result
        : loadProjectJson(new TextDecoder().decode(bytes));
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
    adopt(
      result.file,
      `${selected.name} chargé et validé.` +
        migrationNotice(result.migrationJournal),
    );
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
      const objectId = fix.objectIds?.[0];
      if (fix.tab === 'networks' && objectId !== undefined) {
        // Take the user to the very segment or node the finding is about, with
        // its properties open: a workspace is not an answer, a field is.
        const holder = (session.current.file.project.systems ?? []).find(
          (network) =>
            [...network.nodes, ...network.edges].some(
              ({ id }) => id === objectId,
            ),
        );
        if (holder !== undefined) setSelectedNetworkId(holder.id);
        setInspectNetworkObjectId(objectId);
        setTab('networks');
        return;
      }
      if (fix.objectIds !== undefined && fix.objectIds.length > 0) {
        selectOnPlan(fix.objectIds);
        if (fix.tab !== 'plan') setTab(fix.tab);
        return;
      }
      setTab(fix.tab);
    },
    [selectOnPlan],
  );

  // A run computed on an earlier revision — or with another climate file — is
  // not the state of this project. It is withheld rather than shown as current;
  // the effect above is already recomputing.
  const currentRun = isCurrentRun(calculationRun, file.project, climate)
    ? calculationRun
    : undefined;

  const overlay = useMemo(
    () =>
      currentRun === undefined
        ? undefined
        : buildOverlay(
            overlayId,
            currentRun.runs,
            designTemperatureDifferenceK(currentRun.runs),
          ),
    [currentRun, overlayId],
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
          <button
            type="button"
            className="secondary panel-toggle"
            aria-pressed={layout.sidebarShown}
            title="Afficher ou masquer le panneau de navigation"
            onClick={() => changeLayout({ sidebarShown: !layout.sidebarShown })}
          >
            Navigation
          </button>
          <button
            type="button"
            className="secondary panel-toggle"
            aria-pressed={layout.inspectorShown}
            title="Afficher ou masquer l’inspecteur"
            onClick={() =>
              changeLayout({ inspectorShown: !layout.inspectorShown })
            }
          >
            Inspecteur
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
              replaceProject('Nouveau projet', () => setCreating(true))
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
          <button
            className="secondary"
            title="Projet et jeux climatiques dans un seul fichier"
            onClick={() => void saveContainer()}
          >
            Sauvegarder
          </button>
          <button
            className="secondary"
            title="Le projet seul, en JSON lisible"
            onClick={saveProject}
          >
            Exporter le JSON
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

      {exportFailure !== undefined && (
        <section className="panel recovery-prompt" role="alertdialog">
          <p>
            <strong>Export impossible.</strong> Le projet ouvert contient{' '}
            {exportFailure.length} incohérence(s) que le format refuse
            d’enregistrer. Corrigez-les, puis exportez à nouveau ; rien n’a été
            écrit.
          </p>
          <ul className="alert-list">
            {exportFailure.slice(0, 8).map((issue) => (
              <li key={issue}>
                <span className="badge missing">à corriger</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
          {exportFailure.length > 8 && (
            <p className="hint">
              et {exportFailure.length - 8} autre(s) non affichée(s).
            </p>
          )}
          <div className="actions">
            <button type="button" onClick={() => setExportFailure(undefined)}>
              Fermer
            </button>
          </div>
        </section>
      )}

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
                // Only an export that actually happened may authorise
                // replacing the project it was meant to protect.
                void saveContainer().then((written) => {
                  if (!written) return;
                  pendingReplacement.run();
                  setPendingReplacement(undefined);
                });
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

      {creating && (
        <Suspense
          fallback={<p className="notice">Chargement de l’assistant…</p>}
        >
          <NewProjectWizard
            onCancel={() => setCreating(false)}
            onCreate={(draft) => {
              setCreating(false);
              setClimate([]);
              const created = projectFromDraft(draft, new Date().toISOString());
              adopt(
                created,
                `Nouveau projet « ${created.project.metadata.name} » prêt : ${created.project.building.levels.length} niveau(x), bibliothèque générique incluse.`,
              );
            }}
          />
        </Suspense>
      )}

      {paletteOpen && (
        <CommandPalette
          entries={paletteEntries}
          onClose={() => setPaletteOpen(false)}
        />
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
                setClimate(recovery.climate);
                adopt(
                  recovery.file,
                  recovery.climate.length === 0
                    ? 'Sauvegarde locale restaurée : elle n’a pas encore été exportée.'
                    : `Sauvegarde locale restaurée avec ${recovery.climate.length} jeu(x) climatiques : elle n’a pas encore été exportée.`,
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

      <div
        className="workspace-grid"
        style={{ '--workspace-columns': columns } as CSSProperties}
      >
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
          hidden={!layout.sidebarShown && !menuOpen}
          className={menuOpen ? 'sidebar panel open' : 'sidebar panel'}
        >
          <p className="panel-label">Modèle</p>
          <nav aria-label="Sections du projet" className="workspace-tabs">
            {WORKSPACE_GROUPS.map((group) => (
              <div
                key={group.label}
                className="workspace-group"
                role="group"
                aria-label={group.label}
              >
                <p className="workspace-group-label">{group.label}</p>
                {group.tabs.map((entry) => (
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
              </div>
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

        {layout.sidebarShown ? (
          <PanelSeparator
            label="Redimensionner le panneau de navigation"
            widthPx={layout.sidebarPx}
            grows="RIGHT"
            onResize={(sidebarPx) => changeLayout({ sidebarPx })}
          />
        ) : (
          <div className="panel-edge-empty" />
        )}

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
              onMoveSelection={moveSelection}
              onEditGeometry={editGeometry}
              wallThicknessMm={wallThicknessMm}
              {...(overlay === undefined ? {} : { overlay })}
            />
            <StatusBar
              editor={editor}
              dispatch={dispatchEditor}
              levelName={
                levels.find(({ id }) => id === activeLevelId)?.name ??
                'aucun niveau'
              }
            />
          </section>
        )}

        {tab === 'project' && (
          <LazyWorkspace>
            <ProjectPanel
              project={file.project}
              climate={climate}
              onCommand={runCommand}
              onClimateChange={setClimate}
              onMessage={setMessage}
            />
          </LazyWorkspace>
        )}

        {tab === 'building' && (
          <LazyWorkspace>
            <BuildingPanel
              project={file.project}
              levelId={activeLevelId}
              onCommand={runCommand}
              onSelectLevel={(levelId) =>
                dispatchEditor({ type: 'SET_LEVEL', levelId })
              }
              onSelectObjects={selectOnPlan}
            />
          </LazyWorkspace>
        )}

        {tab === 'materials' && (
          <LazyWorkspace>
            <MaterialsPanel
              project={file.project}
              onCommand={runCommand}
              {...(selectedMaterialId === undefined
                ? {}
                : { selectedId: selectedMaterialId })}
              onSelect={setSelectedMaterialId}
            />
          </LazyWorkspace>
        )}

        {tab === 'assemblies' && (
          <LazyWorkspace>
            <AssembliesPanel
              project={file.project}
              onCommand={runCommand}
              {...(selectedAssemblyId === undefined
                ? {}
                : { selectedId: selectedAssemblyId })}
              onSelect={setSelectedAssemblyId}
            />
          </LazyWorkspace>
        )}

        {tab === 'networks' && (
          <LazyWorkspace>
            <NetworksPanel
              project={file.project}
              levelId={activeLevelId}
              selectedNetworkId={activeNetworkId}
              onSelectNetwork={setSelectedNetworkId}
              onCommand={runCommand}
              {...(inspectNetworkObjectId === undefined
                ? {}
                : { inspectObjectId: inspectNetworkObjectId })}
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
          </LazyWorkspace>
        )}

        {tab === 'calculations' && (
          <LazyWorkspace>
            <CalculationsPanel
              project={file.project}
              climate={climate}
              {...(currentRun === undefined ? {} : { run: currentRun })}
              running={calculationBusy}
              onRecompute={() =>
                setCalculationGeneration((generation) => generation + 1)
              }
              onSelectObjects={selectOnPlan}
            />
          </LazyWorkspace>
        )}

        {tab === 'quantities' && (
          <LazyWorkspace>
            <QuantitiesPanel
              project={file.project}
              onSelectObjects={selectOnPlan}
              onExportCsv={(content, fileName) =>
                download(content, fileName, 'text/csv;charset=utf-8')
              }
            />
          </LazyWorkspace>
        )}

        {tab === 'checks' && (
          <LazyWorkspace>
            <ChecksPanel
              project={file.project}
              {...(currentRun === undefined ? {} : { run: currentRun })}
              running={calculationBusy}
              onFix={applyFix}
            />
          </LazyWorkspace>
        )}

        {tab === 'scenarios' && (
          <LazyWorkspace>
            <ScenariosPanel
              project={file.project}
              climate={climate}
              onCommand={runCommand}
              onMessage={setMessage}
              onPromote={promoteScenario}
            />
          </LazyWorkspace>
        )}

        {tab === 'equipment' && (
          <LazyWorkspace>
            <EquipmentPanel
              project={file.project}
              onCommand={runCommand}
              onMessage={setMessage}
              {...(selectedEquipmentId === undefined
                ? {}
                : { selectedId: selectedEquipmentId })}
              onSelect={setSelectedEquipmentId}
            />
          </LazyWorkspace>
        )}

        {layout.inspectorShown ? (
          <PanelSeparator
            label="Redimensionner l’inspecteur"
            widthPx={layout.inspectorPx}
            grows="LEFT"
            onResize={(inspectorPx) => changeLayout({ inspectorPx })}
          />
        ) : (
          <div className="panel-edge-empty" />
        )}

        <aside
          className="inspector panel"
          id="inventory"
          hidden={!layout.inspectorShown}
        >
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
      lastAutosaveAt={lastAutosaveTime}
      onDownloadDiagnostic={downloadDiagnostic}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
