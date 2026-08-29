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
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { validateClimateDataset } from '@house-technical-designer/climate';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  AddEquipmentCommand,
  ReplaceProjectCommand,
  SaveDrawingViewCommand,
  SetScenarioOverrideCommand,
} from '@house-technical-designer/editor-core';
import type {
  DesignDomainId,
  ProjectSheet,
  SavedDrawingView,
} from '@house-technical-designer/core-domain';
import {
  designDomainLabel,
  domainOfDiscipline,
  projectEntities,
} from '@house-technical-designer/core-domain';
import {
  applyProjectScenario,
  DEFAULT_ZIP_LIMITS,
} from '@house-technical-designer/project-io';
import {
  boundsOfObjects,
  buildPlanView,
  LAYER_PRESETS,
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
// The demonstration house and its two climate datasets are a hundred kilobytes
// of JSON behind one button. Loading them with the application would put a
// demonstration in the way of opening one's own project.
const demoProject = () => import('./demo-project.js');
/*
 * Ouvrir, enregistrer, exporter : chargés au moment où on clique.
 *
 * Lire ou écrire un fichier de projet passe par le schéma, et le validateur
 * qu'Ajv en compile pèse à lui seul plus que le reste de l'application. Il
 * arrivait pourtant au premier écran, parce qu'un `export *` du paquet le
 * portait jusqu'à `applyProjectScenario`. Quelqu'un qui ouvre l'application
 * pour dessiner ne valide aucun fichier ; celui qui en ouvre un attend déjà
 * son disque. Le chargement se fait donc ici, à l'endroit du geste, comme
 * pour la maison de démonstration.
 */
const projectFiles = () => import('@house-technical-designer/project-io/files');
import { PlanCanvas } from './editor/PlanCanvas.js';
import { ClearanceControl } from './editor/ClearanceControl.js';
import { clearanceReport } from '@house-technical-designer/core-domain';
import type { ClearanceGroupId } from './editor/clearance-overlay.js';
import { InspectorPanel } from './editor/InspectorPanel.js';
import { ViewProperties } from './editor/ViewProperties.js';
import { ContextToolBar } from './editor/ContextToolBar.js';
import type { ObjectActionHost } from './editor/object-actions.js';
import { ToolHeader } from './editor/ToolHeader.js';
import { toolboxFor } from './editor/toolbox.js';
import { OverlayControl } from './calculations/OverlayControl.js';
import { APPLICATION_VERSION } from './version.js';
import { scenarioOverride } from './scenarios/scenario-changes.js';
import {
  scenarioDiff,
  scenarioDiffOverlay,
  targetForEdit,
} from './scenarios/scenario-view.js';
import type { InspectorEdit } from './editor/inspector-edits.js';
import type { CheckFix } from './checks/checks-model.js';
import {
  completionModeOf,
  isOpenEnded,
  optionsOf,
  requiredPoints,
  toolDefinition,
} from './editor/tool-registry.js';
import { ObjectMenu, type ObjectMenuEntry } from './editor/ObjectMenu.js';
import {
  restoredView,
  scaleDenominatorForZoom,
} from './documents/saved-view.js';
import {
  capturedView,
  type ViewCaptureKind,
} from './documents/view-capture.js';
import {
  boundsOf,
  capabilitiesOf,
  inspectObject,
  relationshipsOf,
  similarTo,
} from './editor/object-editors.js';
import { contextActionsInStage } from './editor/stage-editing.js';
import { ownerStageOf } from './ux/ownership.js';
import type { Project } from '@house-technical-designer/core-domain';
import type { EditorTool } from './editor/editor-state.js';
import {
  draftKey,
  optionNumber as readOptionNumber,
  optionValue as readOptionValue,
  type ToolDrafts,
} from './editor/tool-options.js';
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
  overlayOption,
  designTemperatureDifferenceK,
  type OverlayId,
} from './calculations/overlay-source.js';
import {
  isCurrentRun,
  needsRecalculation,
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
import { SectionList } from './shell/SectionList.js';
import { LevelRow } from './shell/LevelRow.js';
import { StoreyCount } from './shell/StoreyCount.js';
import {
  boundedWidth,
  gridColumns,
  loadLayout,
  saveLayout,
  type WorkspaceLayout,
} from './shell/workspace-layout.js';
import { hiddenLayerCount } from './visibility/display-count.js';
import { technicalDomains } from './systems/discipline-scope.js';
import { WorkflowGuide } from './workflow/WorkflowGuide.js';
import { workflowEntries } from './workflow/workflow-registry.js';
import { AppShell } from './shell/AppShell.js';
import { TopBar } from './shell/TopBar.js';
import { StageBar } from './shell/StageBar.js';

import { ContextPanel } from './shell/ContextPanel.js';
import { ShellStatusBar } from './shell/ShellStatusBar.js';
import { ProjectMenu } from './shell/ProjectMenu.js';
import { ModelNavigator } from './shell/ModelNavigator.js';
/*
 * L'arborescence n'est plus dans le premier écran, ni dans ses octets.
 *
 * Elle est ouverte à la demande depuis la barre haute : la charger d'avance
 * ferait payer à chaque première ouverture de l'application un panneau que la
 * plupart des séances n'ouvrent jamais. C'est la même règle que pour la place
 * qu'elle prenait dans la colonne, appliquée au poids.
 */
const ProjectTree = lazy(async () => ({
  default: (await import('./shell/ProjectTree.js')).ProjectTree,
}));
import { isDrawerScreen } from './shell/narrow-screen.js';
import {
  columnMode,
  subjectKey,
  type ColumnChoice,
  type ColumnMode,
} from './shell/column-mode.js';

import {
  activeDomain as activeDomainOf,
  activeSectionId,
  activeTab as activeTabOf,
  DEFAULT_SHELL_NAVIGATION,
  goToSection,
  goToStage,
  goToTab,
  navigationFor,
  remainingByStage,
  type ShellNavigation,
} from './ux/stage-state.js';
import {
  creationStage,
  librariesOfStage,
  stageOfTab,
  type CreationStageId,
} from './ux/creation-stages.js';
import { designStateOf } from './ux/design-state.js';
import {
  PLAN_RENDERINGS,
  defaultPlanRendering,
  planRendering,
} from './ux/view-profiles.js';
import { isEmptyTarget, type UiTarget } from './ux/ui-target.js';
import {
  DESTINATION_LABELS,
  DESTINATIONS,
  type DestinationId,
} from './ux/destinations.js';
import { objectEntries, type PaletteEntry } from './palette/palette-model.js';
import { EDITOR_TOOLS } from './editor/tool-registry.js';
import { surfaceIds } from './editor/polygon-surface.js';
import {
  componentDrafts,
  draftsForEntry,
  ficheOfFamily,
  type ToolboxEntry,
} from './editor/toolbox.js';
import {
  EMPTY_CLIPBOARD,
  clipboardCount,
  copyObjects,
  addSpaceAtPointCommand,
  deleteObjectsCommand,
  duplicateObjectsCommand,
  pasteClipboardCommand,
  type PlanClipboard,
  geometryEditCommand,
  moveObjectsCommand,
  transformObjectsCommand,
} from './editor/editing-commands.js';
import type { GeometryEdit } from './editor/grips.js';

/**
 * Le fichier, replié.
 *
 * Six boutons permanents pour six gestes qu'on fait une fois par séance ;
 * l'ordre est celui d'une séance : on ouvre, on enregistre, on exporte.
 */
const PROJECT_MENU_ITEMS = [
  { id: 'NEW', label: 'Nouveau projet' },
  { id: 'OPEN', label: 'Ouvrir…' },
  { id: 'DEMO', label: 'Maison de démonstration' },
  {
    id: 'SAVE',
    label: 'Sauvegarder',
    hint: 'Projet et jeux climatiques dans un seul fichier',
  },
  {
    id: 'EXPORT_JSON',
    label: 'Exporter le JSON',
    hint: 'Le projet seul, en JSON lisible',
  },
  { id: 'EXPORT_SVG', label: 'Exporter le SVG' },
] as const;

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
const OpeningsPanel = lazy(async () => ({
  default: (await import('./library/OpeningsPanel.js')).OpeningsPanel,
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
const DocumentsPanel = lazy(async () => ({
  default: (await import('./documents/DocumentsPanel.js')).DocumentsPanel,
}));
const ChecksPanel = lazy(async () => ({
  default: (await import('./checks/ChecksPanel.js')).ChecksPanel,
}));
/*
 * The count of findings is not needed to draw the first frame, and asking for
 * it would bring the whole checking machinery — rule packs, clearances,
 * quantities — into what the application downloads before showing a plan. It
 * arrives a moment after the shell, which is when it starts being useful.
 */
const IssueCenter = lazy(async () => ({
  default: (await import('./checks/IssueCenter.js')).IssueCenter,
}));
const DisplayPanel = lazy(async () => ({
  default: (await import('./visibility/DisplayPanel.js')).DisplayPanel,
}));
const ProjectCreationPage = lazy(async () => ({
  default: (await import('./project-creation/ProjectCreationPage.js'))
    .ProjectCreationPage,
}));
/*
 * La nomenclature entière, chargée au moment où on la demande.
 *
 * Elle pèse soixante-treize kio et sert à qui veut poser autre chose que les
 * soixante-dix-neuf familles nommées : un plan qui s'ouvre n'a pas à la
 * porter.
 */
const FamilyPicker = lazy(async () => ({
  default: (await import('./library/FamilyPicker.js')).FamilyPicker,
}));

/**
 * One workspace panel, with what to show while its code is still arriving.
 *
 * `is-document` : un écran de document **défile**, le plan non.
 *
 * Les deux vivent dans la même case de la grille, et cette case rogne ce qui
 * en sort — c'est ce qui empêche le dessin d'allonger la page. Les tableaux et
 * les formulaires, eux, sont plus hauts qu'elle : les vérifications, la table
 * des feuilles, l'écran du projet perdaient tout ce qui passait la ligne de
 * flottaison, sans barre de défilement pour aller le chercher. Un audit de
 * mise en page en comptait deux cent trente.
 */
function LazyWorkspace({ children }: { readonly children: ReactNode }) {
  return (
    <section className="canvas-panel panel is-document">
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
/** The smallest window framing one object leaves around it. */
const FRAMING_MINIMUM_MM = 1000;

function App() {
  const [file, setFile] = useState<ProjectFile>(() =>
    createBlankProject(new Date().toISOString()),
  );
  const [message, setMessage] = useState('Nouveau projet local prêt.');
  /**
   * Which of the five spaces is open, and what was last read in each.
   *
   * The eleven destinations are still there; they are reached through the
   * space they belong to instead of through one column of eleven buttons.
   */
  const [navigation, setNavigation] = useState<ShellNavigation>(
    DEFAULT_SHELL_NAVIGATION,
  );
  const tab = activeTabOf(navigation);
  const setTab = useCallback(
    (next: DestinationId) => setNavigation((current) => goToTab(current, next)),
    [],
  );
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>();
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string>();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>();
  /**
   * What the user chose in the options of each tool.
   *
   * One record rather than one state per tool: a new tool declares its options
   * in the registry and needs nothing here.
   */
  const [toolDrafts, setToolDrafts] = useState<ToolDrafts>({});
  /** A network object another screen asked to open the properties of. */
  const [inspectNetworkObjectId, setInspectNetworkObjectId] =
    useState<string>();
  /** The property someone was sent to look at, when they were sent to one. */
  const [inspectedProperty, setInspectedProperty] = useState<string>();
  /** Whether what is drawn is being chosen right now. */
  /*
   * La sous-partie dont on est en train de lire la nomenclature.
   *
   * Une sous-partie nomme trois à huit familles ; le métier en tient quarante.
   * « Autre… » ouvre les autres, filtrées sur ce métier-là.
   */
  const [browsing, setBrowsing] = useState<
    { readonly label: string; readonly domain?: DesignDomainId } | undefined
  >(undefined);
  const [displayOpen, setDisplayOpen] = useState(false);
  /*
   * Où poser le panneau d'affichage : relu sur son bouton, jamais mémorisé.
   *
   * Il vivait `absolute` sous le bouton, donc dans la case du plan, et cette
   * case rogne ce qui en sort. Un écran de 768 px avec un objet désigné donne
   * 334 px au plan : les vingt calques du panneau tombaient dehors.
   */
  const [displayAt, setDisplayAt] = useState<
    { readonly top: number; readonly right: number } | undefined
  >(undefined);
  /** Whether the model tree is open; it is secondary, behind « ☰ Modèle ». */
  /** The trade the plan is being read through, in Systèmes. */
  /*
   * Le métier lu en ce moment vit dans la navigation, pas à côté.
   *
   * Il était un état séparé, et deux mémoires de la même chose finissent par
   * ne plus dire la même : l'étape se souvient du métier qu'on y lisait, et
   * c'est elle qu'on interroge.
   */
  const activeDomain = activeDomainOf(navigation);

  /**
   * Le rendu choisi pour le plan, quand quelqu’un en a choisi un.
   *
   * Sans choix, c’est l’espace de travail qui décide : on construit une maison
   * en la regardant comme une maison, on pose une gaine en regardant le dessin
   * technique. Le rendu dit comment dessiner ; ce qui est affiché reste
   * l’affaire des calques.
   */
  const [renderingId, setRenderingId] = useState<string>();
  const rendering =
    (renderingId === undefined ? undefined : planRendering(renderingId)) ??
    defaultPlanRendering(navigation.stage);

  const [climate, setClimate] = useState<readonly ClimateDataset[]>([]);
  const [overlayId, setOverlayId] = useState<OverlayId>('none');
  const [clearanceGroups, setClearanceGroups] = useState<
    readonly ClearanceGroupId[]
  >([]);
  /**
   * The variant being drawn, when the plan is showing one.
   *
   * Scenario mode does not change the project: it changes what the plan shows
   * and what an edit means. Nothing of the variant is ever written into the
   * building — a variant is a list of differences, and it stays one.
   */
  const [scenarioMode, setScenarioMode] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>('SAVED');
  /** Whether the workspace navigation is open as a drawer on a narrow screen. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Ce qu'on cherchait en ouvrant la palette, quand on le savait déjà. */
  const [paletteQuery, setPaletteQuery] = useState('');
  /**
   * Le navigateur du modèle, ouvert seulement quand on le demande.
   *
   * L'arborescence était un dépliage permanent de la colonne : replié il ne
   * montrait rien et prenait quand même sa place, dans la colonne qui porte
   * maintenant aussi les propriétés. Il n'est plus là qu'ouvert.
   */
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  /**
   * Le mode qu'on a réclamé à la main, et à propos de quelle sélection.
   *
   * Sans ça, cliquer « Outils » alors qu'un mur est désigné ne tiendrait pas
   * une seconde : la sélection redirait « propriétés » au rendu suivant. Avec,
   * le choix vaut pour ce mur-là et se périme dès qu'on en désigne un autre —
   * désigner un objet est une question, et elle mérite sa réponse.
   */
  const [columnChoice, setColumnChoice] = useState<ColumnChoice>();
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
  /** The last « recompute » the effect actually honoured. */
  const honouredGeneration = useRef(0);

  const importInput = useRef<HTMLInputElement>(null);
  const session = useRef(new ProjectEditingSession(file));
  const [editor, dispatchEditor] = useReducer(
    editorReducer,
    { widthPx: 900, heightPx: 600 },
    createEditorState,
  );

  /** Reads one option of a tool, as the toolbar and the tool itself read it. */
  const toolOption = useCallback(
    (project: Project, toolId: EditorTool, drafts: ToolDrafts, key: string) =>
      readOptionValue(project, toolId, optionsOf(toolId), drafts, key),
    [],
  );
  const toolOptionNumber = useCallback(
    (project: Project, toolId: EditorTool, drafts: ToolDrafts, key: string) =>
      readOptionNumber(project, toolId, optionsOf(toolId), drafts, key),
    [],
  );
  /** Chooses the network every screen works on. */
  const selectNetwork = useCallback((networkId: string) => {
    setToolDrafts((current) => ({
      ...current,
      [draftKey('NETWORK', 'networkId', true)]: networkId,
    }));
  }, []);

  const summary = useMemo(() => summarizeProject(file), [file]);
  const levels = file.project.building.levels;
  const activeLevelId = editor.levelId ?? levels[0]?.id;
  const networks = file.project.systems ?? [];
  /**
   * The network the tools work on.
   *
   * It is the option of the network tool rather than a state of its own: the
   * networks workspace and the plan then always speak of the same one, and a
   * network deleted elsewhere falls back to what the project still holds.
   */
  const activeNetworkId = toolOption(
    file.project,
    'NETWORK',
    toolDrafts,
    'networkId',
  );
  const activeNetwork = networks.find(({ id }) => id === activeNetworkId);
  /**
   * The family a click or a band is allowed to take.
   *
   * It is an option of the selection tool rather than a state of its own, for
   * the same reason as the network: the toolbar renders it because the tool
   * declares it, and nothing here knows that walls exist.
   */
  const selectableFamily = toolOption(
    file.project,
    'SELECT',
    toolDrafts,
    'family',
  );

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
      setSelectedMaterialId(undefined);
      setSelectedAssemblyId(undefined);
      setSelectedEquipmentId(undefined);
      setToolDrafts({});
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

  /**
   * Tout ce qui écrit dans le projet passe par là, l'espace actif compris.
   *
   * La frontière d'édition est tenue par la session, qui est le seul passage :
   * voir `ProjectEditingSession.dispatch`. Ici on ne fait que lui dire d'où le
   * geste vient.
   *
   * Annuler et refaire ne passent pas par cette fonction, et c'est voulu :
   * reprendre son propre geste n'est pas modifier l'objet de quelqu'un
   * d'autre, et bloquer `Ctrl+Z` parce qu'on a changé d'onglet entre-temps
   * serait un piège.
   */
  const runCommand = useCallback(
    (command: ProjectCommand): boolean => {
      const result = session.current.dispatch(command, navigation.stage);
      if (result.status === 'ERROR') {
        setMessage(`Refusé — ${result.messages.join(' ')}`);
        return false;
      }
      setFile(result.file);
      setSaveState('MODIFIED');
      setMessage(`${command.label} · appliqué.`);
      return true;
    },
    [navigation.stage],
  );

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
      const {
        ProjectContainerError,
        ProjectSerializationError,
        writeProjectContainer,
      } = await projectFiles();
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

  const saveProject = useCallback(async (): Promise<boolean> => {
    // The serialiser refuses to write a project the format would not accept.
    // A click handler is outside any error boundary, so the refusal is caught
    // here and said out loud rather than lost in the console with the save
    // state left claiming the project was written.
    const { ProjectSerializationError, serializeProjectFile } =
      await projectFiles();
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

  /**
   * Les propriétés paraissent quand on désigne quelque chose, et s'en vont
   * avec — mais dans la colonne de gauche, et non plus dans une seconde.
   *
   * L'inspecteur tenait 280 px à droite du dessin, plus son bord et sa
   * gouttière : 294 px de plan repris dès qu'on cliquait un objet, c'est-à-dire
   * à chaque geste. Le repli automatique n'y changeait rien — il ne rendait la
   * largeur qu'au repos, et le repos n'est pas là où l'on travaille. La droite
   * est désormais au plan sans condition, et la colonne de gauche montre les
   * propriétés **à la place** des outils.
   *
   * Ce qui suit reste la même règle qu'avant : paraître à la sélection,
   * disparaître au clic dans le vide. Hors du plan, l'espace ouvert est
   * lui-même le sujet — un tableau de quantités n'a pas d'outils à offrir.
   */
  const columnSubject = subjectKey(editor.selection, inspectedProperty);
  const propertiesAlways = tab !== 'plan';
  const mode = columnMode({
    subjectKey: columnSubject,
    alwaysProperties: propertiesAlways,
    ...(columnChoice === undefined ? {} : { choice: columnChoice }),
  });
  /*
   * La bascule n'existe que lorsqu'il y a deux choses à montrer.
   *
   * Au repos, rien n'est désigné : la colonne pose, et « Propriétés » n'aurait
   * que les faits de la vue à offrir — l'étage, l'échelle, le rendu. Ils se
   * demandent depuis la barre haute, où l'inspecteur avait déjà son bouton, et
   * ne coûtent donc rien dans une colonne dont le budget est de dix boutons
   * offerts d'un coup.
   */
  const modesOffered = mode === 'PROPERTIES' || columnSubject !== '';
  const columns = gridColumns(layout);

  /**
   * Sur un téléphone, la colonne est un tiroir : il monte quand on désigne.
   *
   * La feuille de style fait du panneau une feuille montante sous 600 px et un
   * tiroir latéral sous 900. Désigner un mur y répondrait donc dans un panneau
   * fermé — la réponse serait là, invisible, et il faudrait deux gestes de
   * plus pour la lire. Le tiroir s'ouvre de lui-même sur une nouvelle
   * sélection, exactement comme le panneau de droite paraissait sur un écran
   * large ; on le referme d'un geste vers le bas, du fond, ou avec Échap.
   */
  const shownSubject = useRef(columnSubject);
  useEffect(() => {
    if (columnSubject === shownSubject.current) return;
    shownSubject.current = columnSubject;
    /*
     * Ne plus rien désigner met fin à l'épisode, et au choix qui allait avec.
     *
     * « Montre-moi les outils » vaut pour l'objet qu'on avait sous les yeux en
     * le disant. Sans cet oubli, le choix survivait à la désélection : on
     * reprenait le même mur plus tard et la colonne restait sur les outils,
     * parce que le sujet était redevenu celui du choix. Ce qui n'est plus
     * désigné n'est plus sous les yeux.
     */
    if (columnSubject === '') setColumnChoice(undefined);
    /*
     * La question se pose à l'instant du geste, et non au rendu d'avant.
     *
     * `useDrawerScreen` répond par un état, et un état vient d'un rendu :
     * celui où la sélection change n'est pas forcément celui où la mesure de
     * la fenêtre est arrivée. La feuille restait donc fermée sur le premier
     * objet désigné après le chargement — le seul moment où quelqu'un
     * découvre qu'elle monte.
     */
    else if (isDrawerScreen()) setMenuOpen(true);
  }, [columnSubject]);

  /*
   * Ce qu'il reste à faire, par étape, dérivé du modèle.
   *
   * Un nombre à côté d'un libellé, jamais un barrage : rien n'empêche de
   * travailler dans une étape qui n'affiche rien, ni d'en quitter une qui
   * affiche cinq. Il disparaît quand il n'y a plus rien à dire.
   */
  const hiddenLayers = useMemo(() => hiddenLayerCount(editor), [editor]);

  const stageProgress = useMemo(
    () => remainingByStage(workflowEntries(file.project)),
    [file.project],
  );

  /**
   * Ce que la maison est, pas ce que l'on a cliqué : les prédicats de la
   * boîte à outils lisent cet état plutôt que des drapeaux d'étape.
   */
  const design = useMemo(
    () => designStateOf(file.project, activeLevelId),
    [activeLevelId, file.project],
  );

  /**
   * Les sous-parties de l'espace courant, telles que ce projet peut les servir.
   *
   * Lues dans la boîte à outils et non dans le registre des espaces : une
   * sous-partie dont aucun outil n'est posable sur ce projet n'est pas une
   * sous-partie, c'est une promesse.
   */
  const sectionChoices = useMemo(
    () => toolboxFor(file.project, navigation.stage, undefined, design),
    [design, file.project, navigation.stage],
  );
  const openSection = activeSectionId(navigation, sectionChoices);
  // Ce que le plan montre en plus du dessin, dans cet espace. Dérivé du
  // registre : aucune seconde liste ne dit où une aide s'affiche.
  const planAids = creationStage(navigation.stage).planAids ?? [];

  const changeLayout = useCallback((patch: Partial<WorkspaceLayout>): void => {
    setLayout((current) => {
      const next: WorkspaceLayout = {
        ...current,
        ...patch,
        ...(patch.sidebarPx === undefined
          ? {}
          : { sidebarPx: boundedWidth(patch.sidebarPx) }),
      };
      saveLayout(
        typeof localStorage === 'undefined' ? undefined : localStorage,
        next,
      );
      return next;
    });
  }, []);

  /**
   * Montrer les propriétés de ce qui est désigné, quoi qu'on regardait avant.
   *
   * Emmener quelqu'un sur un objet sans lui montrer ce que l'objet est, c'est
   * ne lui en montrer que la moitié : la palette de commandes, le menu d'un
   * objet et le passage dans l'espace propriétaire finissent tous ici.
   */
  const showProperties = useCallback((): void => {
    setColumnChoice(undefined);
    changeLayout({ sidebarShown: true });
  }, [changeLayout]);

  /** The object whose actions are open, and where the menu sits. */
  const [objectMenu, setObjectMenu] = useState<
    | {
        readonly objectId: string;
        readonly atPx: { readonly x: number; readonly y: number };
      }
    | undefined
  >(undefined);

  /** Frames one object without building a whole view to measure it. */
  const frameObject = useCallback(
    (objectId: string) => {
      if (activeLevelId === undefined) return;
      const bounds = boundsOf(
        session.current.file.project,
        activeLevelId,
        objectId,
      );
      if (bounds === undefined) {
        setMessage('Cet objet n’a pas d’étendue mesurable sur le plan.');
        return;
      }
      // A node has a position and no extent; framing it exactly would fill the
      // window with one millimetre. A metre around it shows where it stands.
      const half = FRAMING_MINIMUM_MM / 2;
      const centre = {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: (bounds.min.y + bounds.max.y) / 2,
      };
      dispatchEditor({
        type: 'ZOOM_SELECTION',
        bounds: {
          min: {
            x: Math.min(bounds.min.x, centre.x - half),
            y: Math.min(bounds.min.y, centre.y - half),
          },
          max: {
            x: Math.max(bounds.max.x, centre.x + half),
            y: Math.max(bounds.max.y, centre.y + half),
          },
        },
      });
    },
    [activeLevelId],
  );

  /** Selects everything of the same family that is built the same way. */
  const selectSimilar = useCallback(
    (objectId: string) => {
      if (activeLevelId === undefined) return;
      const similar = similarTo(
        session.current.file.project,
        activeLevelId,
        objectId,
      );
      if (similar.length === 0) {
        setMessage('Cette famille ne dit pas ce que « semblable » veut dire.');
        return;
      }
      dispatchEditor({ type: 'SELECT_MANY', objectIds: similar });
      setMessage(`${similar.length} objet(s) semblable(s) sélectionné(s).`);
    },
    [activeLevelId],
  );

  /**
   * Turns or reflects the selection about its own centre.
   *
   * The centre is the middle of what is selected rather than a point the user
   * has to place first: it is what a quarter turn or a flip means most of the
   * time, and the selection can be moved afterwards.
   */
  const transformSelection = useCallback(
    (kind: 'ROTATE' | 'MIRROR') => {
      const plan = buildPlanView(session.current.file.project, {
        ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
        layers: editor.layers,
      });
      const bounds = boundsOfObjects(plan.primitives, editor.selection);
      if (bounds === undefined) {
        setMessage('Sélectionnez d’abord ce qui doit être transformé.');
        return;
      }
      const centre = {
        x: (bounds.min.x + bounds.max.x) / 2,
        y: (bounds.min.y + bounds.max.y) / 2,
      };
      const result = transformObjectsCommand(
        session.current.file,
        activeLevelId,
        editor.selection,
        kind === 'ROTATE'
          ? { kind, centre, angleDeg: 90 }
          : {
              kind,
              from: centre,
              // A vertical axis through the centre: left becomes right.
              to: { x: centre.x, y: centre.y + 1000 },
            },
      );
      if (result.status === 'ERROR') {
        setMessage(result.message);
        return;
      }
      runCommand(result.command);
    },
    [activeLevelId, editor.layers, editor.selection, runCommand],
  );

  /**
   * What was copied, kept apart from the project it came from.
   *
   * The objects themselves are held rather than their identifiers: pasting
   * must not change because the originals were deleted or edited in between,
   * and a copy taken on one storey is meant to be put down on another.
   */
  const clipboard = useRef<PlanClipboard>(EMPTY_CLIPBOARD);

  /**
   * L'orientation que le fantôme de pose montre en ce moment.
   *
   * Elle vit sur le plan : `R` la fait tourner, et on la choisit en regardant
   * l'objet tourner sous le curseur plutôt qu'en tapant un nombre dans une
   * barre. Elle est gardée dans une référence parce qu'elle change à chaque
   * mouvement de souris tant qu'on la règle — la porter dans l'état
   * redessinerait toute la coque pendant un survol, pour un chiffre que seul
   * le prochain clic consommera.
   */
  const placementRotation = useRef<number | undefined>(undefined);

  const copySelection = useCallback(() => {
    const taken = copyObjects(
      session.current.file,
      activeLevelId,
      editor.selection,
    );
    clipboard.current = taken;
    const count = clipboardCount(taken);
    setMessage(
      count === 0
        ? 'Rien de sélectionné ne se copie depuis le plan.'
        : `${count} objet(s) copié(s) : collez-les sur ce niveau ou sur un autre.`,
    );
  }, [activeLevelId, editor.selection]);

  const pasteClipboard = useCallback(() => {
    const step =
      editor.snap.gridSpacingMm > 0 ? editor.snap.gridSpacingMm : 100;
    const result = pasteClipboardCommand(
      session.current.file,
      activeLevelId,
      clipboard.current,
      // Pasted onto the storey it was copied from, the copy would land exactly
      // on the original; onto another one, the offset costs nothing.
      { x: step * 2, y: step * 2 },
      (prefix) => `${prefix}-${crypto.randomUUID()}`,
    );
    if (result.status === 'ERROR') {
      setMessage(result.message);
      return;
    }
    if (!runCommand(result.command)) return;
    dispatchEditor({ type: 'SELECT_MANY', objectIds: result.createdIds });
  }, [activeLevelId, editor.snap.gridSpacingMm, runCommand]);

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

  /**
   * Ce que l'application sait faire de la sélection, offert au registre.
   *
   * Les gestes eux-mêmes ne bougent pas : dupliquer, supprimer, transformer,
   * aligner, cadrer et désigner les semblables restent écrits une fois ici,
   * avec leur historique, leurs messages et leur re-sélection. Ce qui change
   * est qui décide de les proposer — `object-actions.ts` le décide pour tous
   * les affichages, et `stage-editing.ts` retire ceux qui écrivent quand
   * l'espace actif ne possède pas ce qui est désigné.
   *
   * Certains gestes demandent un point : décaler un mur, le scinder, dériver
   * un tronçon. Ceux-là n'appellent pas une commande, ils prennent l'outil qui
   * la construira — et c'est déjà tout ce qui manquait, puisque ces outils
   * existaient et qu'on ne les trouvait qu'en fouillant la boîte à outils.
   */
  const selectionActions = useMemo<ObjectActionHost>(
    () => ({
      transform: transformSelection,
      duplicate: duplicateSelection,
      remove: deleteSelection,
      frame: frameObject,
      selectSimilar,
      startTool: (tool) => dispatchEditor({ type: 'SET_TOOL', tool }),
      runCommand: (command) => {
        runCommand(command);
      },
    }),
    [
      deleteSelection,
      duplicateSelection,
      frameObject,
      runCommand,
      selectSimilar,
      transformSelection,
    ],
  );

  /**
   * Aller modifier la sélection dans l'espace qui la possède.
   *
   * Un mur lu depuis Systèmes ne s'y modifie pas, et le dire sans y mener
   * laisse trois gestes à faire — retrouver l'onglet, y aller, re-désigner
   * l'objet — pour appliquer une règle que personne n'a demandée. On change
   * donc d'espace et rien d'autre : la sélection n'est pas retouchée, elle est
   * emmenée, et l'édition qu'on venait faire est là en arrivant.
   *
   * L'espace s'ouvre sur le plan et non sur ce qu'on y lisait la dernière
   * fois : on y va pour toucher un objet, et un objet se touche sur le dessin.
   */
  const editInOwnerStage = useCallback(
    (stage: CreationStageId): void => {
      setNavigation((current) =>
        navigationFor(current, { stage, destination: 'plan' }),
      );
      showProperties();
      setMenuOpen(false);
      setMessage(
        `${creationStage(stage).label} : la sélection y est modifiable.`,
      );
    },
    [showProperties],
  );

  /**
   * What can be done to one object, from the plan.
   *
   * The entries every object shares are the application's; the ones a wall
   * alone offers come from its own family, so a new family arrives with its
   * own actions rather than with a new branch here.
   */
  const objectMenuEntries = useCallback(
    (objectId: string): readonly ObjectMenuEntry[] => {
      const project = session.current.file.project;
      const levelId = activeLevelId ?? '';
      // What the family of this object says it allows. An action that is
      // offered and then refused reads as a defect; one that is visibly
      // unavailable reads as a property of the object, which is what it is.
      const can = capabilitiesOf(project, objectId);
      /*
       * L'espace qui possède cet objet, et si c'est celui d'où on le regarde.
       *
       * Le menu se construisait sans le savoir : il offrait « Dupliquer »,
       * « Pivoter », « Retourner », les gestes de la famille et « Supprimer »
       * sur une parcelle regardée depuis Bâtiment, où les cinq commandes
       * étaient refusées l'une après l'autre. Ce qui lit reste — cadrer,
       * désigner les semblables, suivre les liens, ouvrir les propriétés ;
       * ce qui écrit s'en va, et une ligne dit où le retrouver.
       */
      const owner = ownerStageOf(project, objectId);
      const stage = navigation.stage;
      const editable = owner === undefined || owner === stage;
      return [
        {
          id: 'frame',
          label: 'Cadrer sur cet objet',
          run: () => frameObject(objectId),
        },
        {
          id: 'similar',
          label: 'Sélectionner les objets semblables',
          disabled: similarTo(project, levelId, objectId).length === 0,
          run: () => selectSimilar(objectId),
        },
        /*
         * Voir les propriétés, quand c'est tout ce qui reste à faire ici.
         *
         * L'entrée n'apparaît pas dans l'espace propriétaire : le panneau y
         * est déjà ouvert par tout ce qu'on y fait, et une ligne de plus dans
         * un menu qui en compte huit se paie à chaque clic droit. Ailleurs,
         * lire **est** l'action offerte, et il faut pouvoir la demander.
         */
        ...(editable
          ? []
          : [
              {
                id: 'inspect',
                label: 'Voir les propriétés',
                run: () => showProperties(),
              },
            ]),
        ...(editable
          ? [
              {
                id: 'duplicate',
                label: 'Dupliquer',
                disabled: !can.duplicable,
                run: () => duplicateSelection(),
              },
              {
                id: 'rotate',
                label: 'Pivoter d’un quart de tour',
                disabled: !can.rotatable,
                run: () => transformSelection('ROTATE'),
              },
              {
                id: 'mirror',
                label: 'Retourner',
                disabled: !can.mirrorable,
                run: () => transformSelection('MIRROR'),
              },
            ]
          : []),
        ...relationshipsOf(project, levelId, objectId).map((tie) => ({
          id: `tie:${tie.role}`,
          label: `Sélectionner : ${tie.role.toLowerCase()} (${tie.objectIds.length})`,
          run: () => {
            dispatchEditor({ type: 'SELECT_MANY', objectIds: tie.objectIds });
            setMessage(
              `${tie.objectIds.length} objet(s) lié(s) sélectionné(s) : ${tie.role.toLowerCase()}.`,
            );
          },
        })),
        ...contextActionsInStage(stage, project, levelId, objectId).map(
          (action) => ({
            id: action.id,
            label: action.label,
            disabled: action.command() === undefined,
            run: () => {
              const command = action.command();
              if (command !== undefined) runCommand(command);
            },
          }),
        ),
        ...(editable
          ? [
              {
                id: 'delete',
                label: 'Supprimer',
                run: () => deleteSelection(),
              },
            ]
          : [
              {
                id: 'own',
                label: `Modifier dans ${creationStage(owner).label}`,
                run: () => editInOwnerStage(owner),
              },
            ]),
      ];
    },
    [
      activeLevelId,
      showProperties,
      deleteSelection,
      duplicateSelection,
      editInOwnerStage,
      frameObject,
      navigation.stage,
      runCommand,
      selectSimilar,
      transformSelection,
    ],
  );

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

  /**
   * Créer la pièce d'un contour fermé, depuis le contour lui-même.
   *
   * Le plan écrit la surface de ce que les murs enferment ; quand aucun espace
   * ne le couvre, il porte aussi le geste qui en fait un. Aller prendre
   * l'outil Pièce pour désigner ensuite un endroit qu'on est déjà en train de
   * regarder est un détour que rien ne justifie.
   */
  const createRoomAt = useCallback(
    (at: { x: number; y: number }) => {
      const result = addSpaceAtPointCommand(
        session.current.file,
        activeLevelId,
        at,
        // Le modèle refuse une pièce sans nom, et il a raison : une pièce
        // s'appelle quelque chose. « Pièce » est un nom de travail qu'on
        // change dans l'inspecteur, pas un vide qu'on laisse.
        { name: 'Pièce', category: 'OTHER' },
        `space-${crypto.randomUUID()}`,
      );
      if (result.status === 'ERROR') {
        setMessage(result.message);
        return;
      }
      runCommand(result.command);
    },
    [activeLevelId, runCommand],
  );

  const commitPoints = useCallback(
    (
      points: readonly { x: number; y: number }[],
      picks: readonly (string | undefined)[],
    ) => {
      // The tool says what its clicks mean. The application only carries them
      // to it: a new tool is a new entry in the registry, not another branch
      // here.
      const tool = toolDefinition(editor.activeTool);
      /*
       * Un outil qui lit rend son résultat et rend la main.
       *
       * Mesurer ne change pas la maison : il n'y a pas de commande à créer,
       * rien à empiler dans l'historique, et rien à annuler. Ce qu'il produit
       * est une phrase, et la phrase va là où vont les autres.
       */
      if (tool.reads === true) {
        const from = points[0];
        const to = points[points.length - 1];
        if (from !== undefined && to !== undefined) {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const lengthM = Math.hypot(dx, dy) / 1000;
          const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
          setMessage(
            `${tool.label} — ${lengthM.toFixed(2).replace('.', ',')} m à ${angleDeg.toFixed(0)}°`,
          );
        }
        dispatchEditor({ type: 'CANCEL' });
        return;
      }
      const result = tool.createCommand?.({
        file: session.current.file,
        ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
        points,
        picks,
        selection: editor.selection,
        option: (key) =>
          toolOption(
            session.current.file.project,
            editor.activeTool,
            toolDrafts,
            key,
          ),
        optionNumber: (key) =>
          toolOptionNumber(
            session.current.file.project,
            editor.activeTool,
            toolDrafts,
            key,
          ),
        newId: (prefix) =>
          prefix === ''
            ? crypto.randomUUID()
            : `${prefix}-${crypto.randomUUID()}`,
        /*
         * L'orientation vue sous le curseur, telle quelle.
         *
         * Une référence et non un état : elle change à chaque mouvement de la
         * souris quand on maintient `R`, et la faire passer par le rendu
         * redessinerait la coque entière pendant un survol.
         */
        ...(placementRotation.current === undefined
          ? {}
          : { placementRotationDeg: placementRotation.current }),
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
      editor.activeTool,
      editor.selection,
      runCommand,
      toolDrafts,
      toolOption,
      toolOptionNumber,
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
    async (scenarioId: string) => {
      // Le validateur que la commande porte doit être là quand elle s'exécute :
      // il est chargé avant qu'elle soit construite, et la fermeture le tient.
      const { validateProjectFile } = await projectFiles();
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
  // Colouring an object nobody is drawing colours nothing: an analysis of the
  // pipes reveals the layer the pipes are on, exactly as a network tool does.
  useEffect(() => {
    const discipline = overlayOption(overlayId)?.discipline;
    if (discipline === undefined) return;
    dispatchEditor({
      type: 'SHOW_LAYERS',
      layerIds: [networkLayerId(discipline)],
    });
  }, [overlayId]);

  useEffect(() => {
    if (activeNetwork === undefined) return;
    // Any tool that asks which network it works on draws on that discipline's
    // layer; naming the tools here would leave the next one drawing in the
    // dark.
    if (!optionsOf(editor.activeTool).some(({ key }) => key === 'networkId'))
      return;
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
    // The results already in hand answer for this project, this revision and
    // this climate: asking the seventeen modules again would produce the same
    // numbers. Switching tabs, turning an overlay on, renaming a view — none
    // of it changed anything a module reads.
    if (
      !needsRecalculation(
        calculationRun,
        file.project,
        climate,
        calculationGeneration,
        honouredGeneration.current,
      )
    )
      return;
    honouredGeneration.current = calculationGeneration;
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
    // `calculationRun` is read to decide whether it still answers, and set by
    // this effect: listing it would make the effect wake itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [climate, file.project, overlayId, tab, calculationGeneration]);

  /**
   * Runs a command by name, wherever it was asked for.
   *
   * The keyboard is one way of asking; the palette is another, and neither
   * should hold its own copy of what a command does.
   */
  /**
   * Prendre une entrée de la boîte à outils, où qu'on l'ait cliquée.
   *
   * La rangée d'outils et le panneau « Ajouter » montrent les mêmes entrées ;
   * chacun avait sa façon de les prendre, donc deux endroits à corriger. Il
   * n'y en a plus qu'un.
   *
   * Une entrée nomme une **famille** du catalogue, et elle installe la fiche
   * que cette famille désigne si le projet ne la tient pas encore. Avant, elle
   * disparaissait : `Aménagement` sur un projet neuf n'avait pas un bouton, et
   * la seule issue écrite était « ouvrez la bibliothèque ». Le catalogue
   * générique arrive à ce moment-là, et pas au démarrage — il pèse soixante-
   * treize kio, et un plan qui s'ouvre n'a pas à les porter.
   */
  const chooseEntry = useCallback(
    (candidate: ToolboxEntry) => {
      dispatchEditor({
        type: 'SET_TOOL',
        tool: candidate.toolId as EditorTool,
      });
      const prefill = (): void => {
        const drafts = draftsForEntry(session.current.file.project, candidate);
        if (Object.keys(drafts).length > 0)
          setToolDrafts((current) => ({ ...current, ...drafts }));
      };
      const family = candidate.family;
      if (
        family === undefined ||
        ficheOfFamily(session.current.file.project, family) !== undefined
      ) {
        prefill();
        return;
      }
      void (async () => {
        const { equipmentForFamily } =
          await import('./editor/starter-equipment.js');
        const fiche = equipmentForFamily(family);
        if (fiche === undefined) {
          setMessage(
            `${candidate.label} : le catalogue ne tient aucune fiche « ${family} ».`,
          );
          return;
        }
        if (!runCommand(new AddEquipmentCommand(fiche))) return;
        prefill();
      })();
    },
    [runCommand],
  );

  /**
   * Ends a run of points and lets the tool make what it can of them.
   *
   * A run of walls has no number of corners known in advance; the user says
   * when it is finished, and a run too short for the tool says so rather than
   * disappearing without a word.
   */
  const finishRun = useCallback(() => {
    if (editor.pendingPoints.length === 0) return;
    if (!isOpenEnded(editor.activeTool)) return;
    if (editor.pendingPoints.length < requiredPoints(editor.activeTool)) {
      setMessage(
        `${toolDefinition(editor.activeTool).label} : ${requiredPoints(editor.activeTool)} points au minimum.`,
      );
      return;
    }
    /*
     * Ce qu'on vient de fermer est ce qu'on veut regarder.
     *
     * Une parcelle fermée ne montrait rien : un trait pointillé pâle, aucune
     * surface écrite, aucune poignée — l'écran redevenait blanc au moment
     * même où l'objet venait d'exister. Le prendre répond aux deux questions
     * qui suivent : est-ce que c'est reconnu, et comment je le corrige.
     *
     * Une commande ne rend pas l'identifiant de ce qu'elle a fait ; le
     * comparer avant/après ne demande à aucune commande de s'en souvenir.
     */
    const before = new Set(
      surfaceIds(session.current.file.project, activeLevelId),
    );
    commitPoints(editor.pendingPoints, editor.pendingPicks);
    dispatchEditor({ type: 'FINISH_RUN' });
    if (completionModeOf(editor.activeTool) !== 'CLOSE_POLYGON') return;
    const made = surfaceIds(session.current.file.project, activeLevelId).find(
      (id) => !before.has(id),
    );
    if (made === undefined) return;
    // Et la sélection, pour que ses poignées soient là : elles ne se
    // dessinent que dans l'état de repos, qui est celui où l'on corrige.
    dispatchEditor({ type: 'SET_TOOL', tool: 'SELECT' });
    dispatchEditor({ type: 'SELECT', objectId: made });
  }, [
    activeLevelId,
    commitPoints,
    editor.activeTool,
    editor.pendingPicks,
    editor.pendingPoints,
  ]);

  /**
   * Keeps the plan as it stands as a view one can come back to.
   *
   * What is kept are the decisions — storey, scale, layers, profile — and not
   * a picture: the drawing is made again from the model each time, so a view
   * reopened after a wall moved shows the wall where it is now.
   */
  const captureView = useCallback(
    (name: string, kind: ViewCaptureKind) => {
      const levelId = activeLevelId as SavedDrawingView['levelId'] | undefined;
      const view = capturedView(session.current.file.project, {
        id: `view-${crypto.randomUUID()}`,
        name,
        kind,
        ...(levelId === undefined ? {} : { levelId }),
        // A drawing at 1:1 puts one model millimetre on one paper
        // millimetre, and a CSS pixel is 1/96 inch: the denominator is how
        // many model millimetres one paper millimetre carries at this zoom.
        scaleDenominator: scaleDenominatorForZoom(editor.camera.pixelsPerMm),
        layers: editor.layers,
        // La vue enregistrée garde le dessin sous lequel elle a été prise, et
        // non celui que cette version tient pour normal.
        graphicProfileId: rendering.graphicProfileId,
        centreMm: editor.camera.centerModelMm,
        ...(overlayId === 'none' ? {} : { analysisOverlayId: overlayId }),
      });
      if (runCommand(new SaveDrawingViewCommand(view)))
        setMessage(`Vue « ${name} » enregistrée.`);
    },
    [
      activeLevelId,
      editor.camera.centerModelMm,
      editor.camera.pixelsPerMm,
      editor.layers,
      overlayId,
      rendering,
      runCommand,
    ],
  );

  /**
   * Puts the plan back the way a saved view describes it.
   *
   * All of it: the storey, every layer as it was — hidden ones included — the
   * centre, the scale and the analysis that was showing. It used to restore
   * the storey and turn on the layers that were on, which left a view saved
   * without the networks reappearing with them, at whatever zoom the user
   * happened to be at. That was a different drawing wearing the same name.
   */
  const applyView = useCallback(
    (view: SavedDrawingView) => {
      const restored = restoredView(session.current.file.project, view);
      if (restored.levelId !== undefined)
        dispatchEditor({ type: 'SET_LEVEL', levelId: restored.levelId });
      dispatchEditor({ type: 'SET_LAYERS', layers: restored.layers });
      dispatchEditor({
        type: 'SET_CAMERA',
        centreModelMm: restored.centreMm,
        pixelsPerMm: restored.pixelsPerMm,
      });
      setOverlayId(restored.overlayId);
      setTab('plan');
      setMessage(
        restored.unresolved.length === 0
          ? `Vue « ${view.name} » rétablie : niveau, calques, cadrage et analyse.`
          : `Vue « ${view.name} » rétablie, sauf ${restored.unresolved.join(' ; ')}.`,
      );
    },
    [setTab],
  );

  /**
   * Writes the drawing set as one PDF.
   *
   * The drawing engine builds and validates the job; the browser backend turns
   * the sheets into pages. A sheet that cannot be laid out stops the export
   * and says which one, rather than producing a file missing a page nobody
   * would notice.
   */
  const exportSheets = useCallback((sheets: readonly ProjectSheet[]) => {
    void (async () => {
      try {
        // The PDF chain — the print job, the sheet renderer and the browser
        // backend — is only ever used from this button. Loading it with the
        // application would put a printer in the way of drawing a wall.
        const [
          { createPdfPrintPage, generatePdfArtifact },
          documents,
          pdf,
          { announcedDotsPerInch },
        ] = await Promise.all([
          import('@house-technical-designer/drawing-engine'),
          import('./documents/documents-model.js'),
          import('./documents/browser-pdf-backend.js'),
          import('./documents/raster-plan.js'),
        ]);
        const project = session.current.file.project;
        const pages = sheets.map((sheet) =>
          createPdfPrintPage(
            documents.sheetLayoutOf(project, sheet),
            documents.renderSheet(project, sheet),
          ),
        );
        const artifact = await generatePdfArtifact(
          {
            id: `sheets-${project.id}`,
            metadata: {
              title: project.metadata.name,
              ...(project.metadata.author === undefined
                ? {}
                : { author: project.metadata.author }),
              subject: 'Dossier de plans',
            },
            colorMode: 'COLOR',
            pages,
          },
          `${project.metadata.name || 'plans'}.pdf`,
          new pdf.BrowserPdfBackend(),
        );
        downloadBytes(artifact.bytes, artifact.fileName, artifact.mediaType);
        // The resolution is the one the largest sheet could be given, not a
        // number written once: a set holding an A0 is not tramé at 200 ppp,
        // and saying it was would be saying something false about the file
        // the user is about to send to a printer.
        const dpi = announcedDotsPerInch(
          pages.map(({ paperSizeMm }) => paperSizeMm),
        );
        setMessage(
          `${pages.length} feuille(s) exportée(s)${
            dpi === undefined ? '' : ` — pages tramées à ${dpi} ppp`
          }.`,
        );
      } catch (error: unknown) {
        setMessage(
          `Export PDF impossible : ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    })();
  }, []);

  /** The project as this variant describes it, when one is being drawn. */
  const scenarioProject = useMemo(() => {
    if (scenarioMode === undefined) return undefined;
    const applied = applyProjectScenario(file.project, scenarioMode);
    return applied.status === 'OK' ? applied.project : undefined;
  }, [file.project, scenarioMode]);

  /**
   * The room the machines need, and where two of them disagree.
   *
   * Counted here so the plan can say how many problems it is not showing:
   * a zone nobody has measured is not drawn, and a plan that silently drew
   * nothing would look like a plan with nothing to say.
   */
  const clearances = useMemo(
    () => clearanceReport(scenarioProject ?? file.project),
    [scenarioProject, file.project],
  );

  /** What this variant adds, removes and changes, drawn like an analysis. */
  const scenarioOverlay = useMemo(
    () =>
      scenarioProject === undefined
        ? undefined
        : scenarioDiffOverlay(scenarioDiff(file.project, scenarioProject)),
    [file.project, scenarioProject],
  );

  /**
   * Applies an edit made while a variant is being drawn.
   *
   * Changing a property does not change the project: it states what this
   * variant does differently. A property no scenario path names is refused out
   * loud rather than silently written into the building.
   */
  const editInScenario = useCallback(
    (objectId: string, edit: InspectorEdit, value: string): boolean => {
      if (scenarioMode === undefined) return false;
      const project = session.current.file.project;
      const target = targetForEdit(project, objectId, edit);
      if (target === undefined) {
        setMessage(
          `« ${edit.label} » ne peut pas encore varier dans un scénario.`,
        );
        return false;
      }
      const override = scenarioOverride(target, value);
      if (override === undefined) {
        setMessage(`${edit.label} : valeur non reconnue.`);
        return false;
      }
      const applied = runCommand(
        new SetScenarioOverrideCommand(scenarioMode, override),
      );
      if (applied)
        setMessage(
          `Scénario : ${target.label} passe à ${value}${
            target.unit === undefined ? '' : ` ${target.unit}`
          }.`,
        );
      return applied;
    },
    [runCommand, scenarioMode],
  );

  const runShortcut = useCallback(
    (command: ShortcutCommandId): void => {
      // A tool is chosen by the registry rather than by a branch per tool: a
      // new tool declares the shortcut it answers to and is reachable at once.
      const chosen = EDITOR_TOOLS.find(
        ({ shortcutId }) => shortcutId === command,
      );
      if (chosen !== undefined && command !== 'tool.select') {
        dispatchEditor({ type: 'SET_TOOL', tool: chosen.id });
        return;
      }
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
        case 'edit.finish':
          finishRun();
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
        case 'edit.copy':
          copySelection();
          return;
        case 'edit.paste':
          pasteClipboard();
          return;
        case 'edit.rotate':
          transformSelection('ROTATE');
          return;
        case 'edit.mirror':
          transformSelection('MIRROR');
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
          setPaletteQuery('');
          setPaletteOpen(true);
      }
    },
    [
      copySelection,
      deleteSelection,
      dispatchEditor,
      duplicateSelection,
      finishRun,
      pasteClipboard,
      redo,
      transformSelection,
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
  /**
   * The one way of sending someone somewhere.
   *
   * Six features had to say « va là-bas » and each said it differently, so
   * each reached a different depth: a check could open a workspace, but not
   * open the storey, reveal the discipline, select the object, frame it and
   * expand the property it was talking about. It does all of it here, once,
   * and everything the target leaves unstated is left alone.
   */
  const navigateTo = useCallback(
    (target: UiTarget): void => {
      if (isEmptyTarget(target)) return;
      setNavigation((current) => navigationFor(current, target));
      const project = session.current.file.project;
      const entity =
        target.objectId === undefined
          ? undefined
          : projectEntities(project).find(({ id }) => id === target.objectId);
      const levelId = target.levelId ?? entity?.levelId;
      if (levelId !== undefined) dispatchEditor({ type: 'SET_LEVEL', levelId });
      if (target.domain !== undefined) {
        // `navigationFor` a déjà retenu le métier dans son étape.
        // The discipline a target names is read on the plan by showing its
        // layer: a network the layers hide is a network nobody was taken to.
        const network = (project.systems ?? []).find(
          (candidate) =>
            domainOfDiscipline(candidate.discipline) === target.domain,
        );
        if (network !== undefined) {
          selectNetwork(network.id);
          dispatchEditor({
            type: 'SHOW_LAYERS',
            layerIds: [networkLayerId(network.discipline)],
          });
        }
      }
      if (target.overlayId !== undefined)
        setOverlayId(target.overlayId as OverlayId);
      if (target.objectId !== undefined) {
        // The layer the object is drawn on, read from a view where nothing is
        // hidden: restoring visibility is part of showing something.
        const complete = buildPlanView(project, {
          ...(levelId === undefined ? {} : { levelId }),
        });
        const drawn = complete.primitives.find(
          (primitive) => primitive.sourceObjectId === target.objectId,
        );
        if (drawn !== undefined)
          dispatchEditor({ type: 'SHOW_LAYERS', layerIds: [drawn.layer] });
        dispatchEditor({ type: 'CLEAR_SELECTION' });
        dispatchEditor({ type: 'SELECT', objectId: target.objectId });
        const bounds = boundsOfObjects(complete.primitives, [target.objectId]);
        if (bounds !== undefined)
          dispatchEditor({ type: 'ZOOM_SELECTION', bounds });
        // Showing an object without its properties is showing half of it.
        showProperties();
      }
      setInspectedProperty(target.propertyPath);
    },
    [showProperties, selectNetwork],
  );

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
      ...DESTINATIONS.map((entry) => ({
        id: `espace:${entry}`,
        label: DESTINATION_LABELS[entry],
        group: 'Espaces',
        hint: creationStage(stageOfTab(entry)).label,
        run: () => setTab(entry),
      })),
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
      // Everything the context panel offers is reachable from here too, so
      // that a keyboard reaches what a pointer reaches.
      ...technicalDomains(file.project).map((domain) => ({
        id: `discipline:${domain}`,
        label: designDomainLabel(domain),
        group: 'Disciplines',
        hint: 'Lire le plan par cette discipline',
        run: () => navigateTo({ domain }),
      })),
      ...LAYER_PRESETS.map((preset) => ({
        id: `visibilite:${preset.id}`,
        label: preset.label,
        group: 'Visibilité',
        hint: 'Ce qui est dessiné',
        run: () =>
          dispatchEditor({ type: 'APPLY_PRESET', presetId: preset.id }),
      })),
      // « Comment dessiner » et « quoi afficher » sont deux axes : un plan
      // d'architecte des réseaux et un plan technique des matériaux doivent
      // rester deux combinaisons possibles.
      ...PLAN_RENDERINGS.map((entry) => ({
        id: `rendu:${entry.id}`,
        label: entry.label,
        group: 'Rendu du plan',
        hint: entry.hint,
        run: () => {
          setTab('plan');
          setRenderingId(entry.id);
        },
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
    [activeLevelId, file.project, navigateTo, runShortcut, setTab],
  );

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (shouldIgnoreTarget(target?.tagName, event)) return;
      const command = resolveShortcut(event);
      if (command === undefined) return;
      event.preventDefault();
      // Escape closes the drawer before it touches the drawing: the panel over
      // the plan is what the user is looking at. Le navigateur du modèle
      // passe en premier : il est posé par dessus le tiroir comme par dessus
      // le dessin, et c'est donc lui qu'on ferme d'abord.
      if (command === 'tool.select' && navigatorOpen) {
        setNavigatorOpen(false);
        return;
      }
      if (command === 'tool.select' && menuOpen) {
        setMenuOpen(false);
        return;
      }
      runShortcut(command);
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [menuOpen, navigatorOpen, runShortcut]);

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
    const { loadProjectJson, readProjectContainer } = await projectFiles();
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

  const selectOnPlan = useCallback(
    (objectIds: readonly string[]): void => {
      dispatchEditor({ type: 'CLEAR_SELECTION' });
      for (const objectId of objectIds)
        dispatchEditor({ type: 'SELECT', objectId, additive: true });
      setTab('plan');
    },
    [setTab],
  );

  /** Takes the user where a finding can actually be dealt with. */
  const applyFix = useCallback(
    (fix: CheckFix) => {
      const objectId = fix.objectIds?.[0];
      if (fix.tab === 'networks' && objectId !== undefined) {
        // A network object is read in its own browser, which knows the run it
        // belongs to; the plan alone cannot show a circuit.
        const holder = (session.current.file.project.systems ?? []).find(
          (network) =>
            [...network.nodes, ...network.edges].some(
              ({ id }) => id === objectId,
            ),
        );
        if (holder !== undefined) selectNetwork(holder.id);
        setInspectNetworkObjectId(objectId);
        setTab('networks');
        setInspectedProperty(fix.propertyPath);
        return;
      }
      if (objectId !== undefined && fix.objectIds !== undefined) {
        /*
         * Un constat mène à l'espace qui possède son objet.
         *
         * `stageOfTab('plan')` rend **Terrain** : c'est le premier des sept
         * espaces dont le plan est une destination, et rien dans un nom
         * d'onglet ne dit de quel objet on parle. Un constat sur un escalier
         * envoyait donc au Terrain, où un escalier n'est pas modifiable — on
         * arrivait sur le bon objet, dans l'onglet où il ne se corrige pas.
         *
         * Le défaut est plus vieux que la règle des espaces ; il ne coûtait
         * rien tant que tout se modifiait partout. Le propriétaire de l'objet
         * est la réponse juste, et l'onglet ne sert que lorsqu'il n'y en a pas
         * — un matériau, un réglage, une entrée de bibliothèque.
         */
        navigateTo({
          stage:
            ownerStageOf(session.current.file.project, objectId) ??
            stageOfTab(fix.tab),
          objectId,
          ...(fix.propertyPath === undefined
            ? {}
            : { propertyPath: fix.propertyPath }),
        });
        if (fix.tab !== 'plan') setTab(fix.tab);
        if (fix.objectIds.length > 1) selectOnPlan(fix.objectIds);
        return;
      }
      setTab(fix.tab);
      setInspectedProperty(fix.propertyPath);
    },
    [navigateTo, selectNetwork, selectOnPlan, setTab],
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

  /**
   * The overlay the plan actually draws.
   *
   * While a variant is being drawn, what matters is what it changes; an
   * analysis of the base project underneath it would be an analysis of
   * something else.
   */
  const drawnOverlay = scenarioOverlay ?? overlay;

  /** What the module behind the chosen analysis could not do. */
  const overlayWarnings = useMemo(() => {
    const moduleId = overlayOption(overlayId)?.moduleId;
    if (moduleId === undefined || currentRun === undefined) return [];
    return (
      currentRun.runs.find((run) => run.moduleId === moduleId)?.result
        ?.warnings ?? []
    );
  }, [currentRun, overlayId]);

  /**
   * La fiche que l'outil composant tient, pour que le plan la dessine avant le
   * clic.
   *
   * Même trajet que l'épaisseur du mur juste en dessous : la coque résout
   * l'option, le plan reçoit la valeur. Sans elle le plan ne sait pas ce qu'on
   * s'apprête à poser, et l'aperçu n'a rien à montrer.
   */
  const componentDefinitionId = useMemo(
    () => toolOption(file.project, 'COMPONENT', toolDrafts, 'definitionId'),
    [file.project, toolDrafts, toolOption],
  );

  const wallThicknessMm = useMemo(() => {
    // The preview is drawn with the thickness of the assembly the tool is set
    // to, which is one of its own options.
    const assemblyId = toolOption(
      file.project,
      'WALL',
      toolDrafts,
      'assemblyId',
    );
    const assembly = file.project.assemblies?.find(
      ({ id }) => id === assemblyId,
    );
    return assembly === undefined
      ? 200
      : assembly.layers.reduce(
          (total, layer) => total + layer.thicknessM * 1000,
          0,
        );
  }, [file.project, toolDrafts, toolOption]);

  /**
   * Creating a project takes the whole window.
   *
   * A modal is for a decision that blocks; starting a project is the first
   * screen of the work. It replaces the shell rather than sitting on top of
   * it, so nothing behind it is half-usable and nothing has to be explained
   * about what is greyed out.
   */
  if (creating)
    return (
      <Suspense fallback={<p className="notice">Chargement…</p>}>
        <ProjectCreationPage
          onCancel={() => setCreating(false)}
          onCreate={(draft) => {
            setCreating(false);
            setClimate([]);
            // The creation page is already on screen, so its chunk is loaded:
            // asking for these two by name costs nothing here and keeps them
            // out of what the application downloads before showing a plan.
            void (async () => {
              const [{ projectFromNewDraft }, { initialShapeCommands }] =
                await Promise.all([
                  import('./project-creation/new-project.js'),
                  import('./project-creation/initial-shape.js'),
                ]);
              const created = projectFromNewDraft(
                draft,
                new Date().toISOString(),
              );
              const name = created.project.metadata.name;
              const levels = created.project.building.levels.length;
              adopt(
                created,
                `Nouveau projet « ${name} » prêt : ${levels} niveau(x), bibliothèque générique incluse.`,
              );
              /*
               * The start mode decides what happens next, not what the file
               * holds. « Être guidé » lands in Projet with the guide open and
               * the first step named; « page blanche » lands on the plan with
               * nothing in the way. The project is the same either way — a
               * mode that changed the BIM would be a second kind of project.
               */
              setNavigation((current) =>
                goToStage(
                  current,
                  draft.startMode === 'GUIDED' ? 'PROJECT' : 'BUILDING',
                ),
              );
              const shape = draft.initialShape;
              if (shape === undefined || shape.kind === 'NONE') return;
              const built = initialShapeCommands(
                created,
                shape,
                (prefix) => `${prefix}-${crypto.randomUUID()}`,
              );
              if (built.status === 'ERROR') {
                setMessage(built.message);
                return;
              }
              if (built.status === 'NONE') return;
              runCommand(built.command);
              setMessage(
                `Nouveau projet « ${name} » prêt : ${levels} niveau(x) et une emprise de départ.`,
              );
            })();
          }}
        />
      </Suspense>
    );

  /**
   * Ce que le menu Projet déclenche, par identifiant.
   *
   * Le menu ne connaît que des libellés ; ce qu'ils font reste ici, où vivent
   * déjà le fichier courant et l'historique.
   */
  const runProjectMenuAction = (id: string): void => {
    if (id === 'NEW') replaceProject('Nouveau projet', () => setCreating(true));
    else if (id === 'OPEN')
      replaceProject('Ouvrir un projet', () => importInput.current?.click());
    else if (id === 'DEMO')
      replaceProject('Maison de démonstration', () => {
        void (async () => {
          const { demoClimateDatasets, loadDemoProject } = await demoProject();
          const demo = loadDemoProject();
          if (demo.status === 'ERROR') {
            setMessage(demo.message);
            return;
          }
          setClimate(demoClimateDatasets());
          adopt(demo.file, 'Maison de démonstration chargée.');
        })();
      });
    else if (id === 'SAVE') void saveContainer();
    else if (id === 'EXPORT_JSON') void saveProject();
    else if (id === 'EXPORT_SVG') {
      const artifact = exportProjectPlan(file, {
        ...(activeLevelId === undefined ? {} : { levelId: activeLevelId }),
        layers: editor.layers,
      });
      download(artifact.content, artifact.fileName, artifact.mediaType);
    }
  };

  /**
   * Ce que la sélection est, montré là où étaient les outils.
   *
   * C'était la seconde colonne, à droite du dessin ; c'est le second mode de
   * la seule qui reste. Rien de son contenu n'a changé — un objet a des
   * propriétés, une vue aussi — seule sa place a changé, et avec elle les
   * 294 px que le plan lui payait dès qu'on cliquait quelque chose.
   */
  const properties = (
    <>
      {/*
       * La progression appartient aux propriétés de l'étape Projet.
       *
       * Elle était posée dans les enfants de la colonne, qui ne paraissent
       * qu'en mode « Outils ». Or hors du plan, l'espace ouvert **est** le
       * sujet — la colonne y montre donc les propriétés — et le guide
       * disparaissait précisément là où il est la seule chose à lire. Ce que
       * l'étape Projet a à dire de ce projet, c'est lui.
       */}
      {navigation.stage === 'PROJECT' && (
        <WorkflowGuide project={file.project} onNavigate={navigateTo} />
      )}
      {tab === 'plan' ? (
        <InspectorPanel
          project={scenarioProject ?? file.project}
          selection={editor.selection}
          stage={navigation.stage}
          atRest={
            <ViewProperties
              editor={editor}
              levelName={
                levels.find(({ id }) => id === activeLevelId)?.name ??
                'aucun niveau'
              }
              {...(activeDomain === undefined
                ? {}
                : { domainLabel: designDomainLabel(activeDomain) })}
              renderingId={rendering.id}
            />
          }
          {...(inspectedProperty === undefined
            ? {}
            : { expandProperty: inspectedProperty })}
          onOpenLibrary={(library) => {
            setTab(library as DestinationId);
            setMenuOpen(false);
          }}
          onEditInOwnerStage={editInOwnerStage}
          onClear={() => dispatchEditor({ type: 'CLEAR_SELECTION' })}
          onCommand={runCommand}
          onMessage={setMessage}
          onDelete={deleteSelection}
          {...(scenarioMode === undefined ? {} : { onEdit: editInScenario })}
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
        Les résultats calculés restent dérivés et ne sont pas enregistrés comme
        source de vérité.
      </p>
    </>
  );

  return (
    <AppShell
      columns={columns}
      contextPanelHidden={!layout.sidebarShown}
      drawerOpen={menuOpen}
      onCloseDrawer={() => setMenuOpen(false)}
      topBar={
        <TopBar
          eyebrow="Mini BIM local-first"
          title="House Technical Designer"
          tabs={
            <StageBar
              stage={navigation.stage}
              remaining={stageProgress}
              onSelect={(stage) => {
                setNavigation((current) => goToStage(current, stage));
                setMenuOpen(false);
              }}
            />
          }
          actions={
            <>
              <button
                type="button"
                className="secondary menu-toggle"
                aria-expanded={menuOpen}
                aria-controls="workspace-sidebar"
                onClick={() => setMenuOpen((open) => !open)}
              >
                Panneau
              </button>
              <button
                type="button"
                className="secondary panel-toggle"
                aria-pressed={layout.sidebarShown}
                title="Afficher ou masquer le panneau de navigation"
                onClick={() =>
                  changeLayout({ sidebarShown: !layout.sidebarShown })
                }
              >
                Navigation
              </button>
              {/*
               * L'épingle des propriétés, à la place du bouton « Inspecteur ».
               *
               * Il ouvrait une seconde colonne ; il choisit maintenant ce que
               * la seule montre. Sans rien de désigné, la colonne n'offre pas
               * la bascule — elle n'aurait qu'une position pleine — et c'est
               * donc d'ici qu'on demande à lire ce que le plan montre :
               * l'étage, l'échelle, le rendu, les calques masqués.
               */}
              <button
                type="button"
                className="secondary panel-toggle"
                aria-pressed={mode === 'PROPERTIES'}
                aria-controls="workspace-sidebar"
                title="Montrer les propriétés dans la colonne"
                onClick={() =>
                  setColumnChoice({
                    mode: mode === 'PROPERTIES' ? 'TOOLS' : 'PROPERTIES',
                    subjectKey: columnSubject,
                  })
                }
              >
                Propriétés
              </button>
              {/*
               * L'arborescence s'ouvre d'ici, et de nulle part en permanence.
               *
               * Le bouton est dans la barre haute et non dans la colonne : la
               * colonne a un budget de dix boutons offerts d'un coup, et
               * chercher un objet dans tout le projet n'est pas une chose
               * qu'on fait depuis l'étape où l'on est — c'est la question
               * « où est-ce », qui vaut partout, comme la recherche juste à
               * côté. L'une cherche par la place, l'autre par le nom.
               */}
              <button
                type="button"
                className="secondary"
                aria-pressed={navigatorOpen}
                /*
                 * `aria-controls` ne se pose que sur ce qui existe.
                 *
                 * L'arborescence n'est dans le document que lorsqu'elle est
                 * ouverte : annoncer en permanence qu'on la commande désigne
                 * un identifiant introuvable, et un lecteur d'écran qui suit
                 * ce lien n'arrive nulle part.
                 */
                {...(navigatorOpen
                  ? { 'aria-controls': 'project-navigator' }
                  : {})}
                title="Parcourir les éléments du projet"
                onClick={() => setNavigatorOpen((open) => !open)}
              >
                Éléments
              </button>
              <button className="secondary" onClick={undo}>
                Annuler
              </button>
              <button className="secondary" onClick={redo}>
                Rétablir
              </button>
              <button
                type="button"
                className="secondary"
                title="Chercher un outil, une pièce, une commande (Ctrl+K)"
                onClick={() => {
                  // Un champ qui garde ce qu'on cherchait la fois d'avant est
                  // un champ qu'il faut vider avant de s'en servir.
                  setPaletteQuery('');
                  setPaletteOpen(true);
                }}
              >
                Rechercher
              </button>
              <ProjectMenu
                items={PROJECT_MENU_ITEMS}
                onSelect={runProjectMenuAction}
              />
              <input
                ref={importInput}
                hidden
                type="file"
                accept=".json,.houseproj"
                onChange={(event) =>
                  void importProject(event.target.files?.[0])
                }
              />
            </>
          }
        />
      }
      contextPanel={
        <ContextPanel
          navigation={navigation}
          activeTab={tab}
          onSelectTab={(next) => {
            setTab(next);
            setMenuOpen(false);
          }}
          mode={mode}
          onSelectMode={(next: ColumnMode) =>
            setColumnChoice({ mode: next, subjectKey: columnSubject })
          }
          modesOffered={modesOffered}
          properties={properties}
          context={
            tab === 'plan' ? (
              <>
                <LevelRow
                  project={file.project}
                  {...(activeLevelId === undefined
                    ? {}
                    : { levelId: activeLevelId })}
                  onSelectLevel={(levelId) =>
                    dispatchEditor({ type: 'SET_LEVEL', levelId })
                  }
                />
                {(planAids.includes('ANALYSIS') ||
                  scenarioMode !== undefined ||
                  overlayId !== 'none') && (
                  <OverlayControl
                    overlayId={overlayId}
                    onChange={setOverlayId}
                    {...(drawnOverlay === undefined
                      ? {}
                      : { overlay: drawnOverlay })}
                    warnings={overlayWarnings}
                    onSelectObjects={(objectIds) => {
                      // A remark becomes a correction the moment the plan shows
                      // which objects it is about.
                      dispatchEditor({ type: 'SELECT_MANY', objectIds });
                      setTab('plan');
                      zoomSelection();
                    }}
                    {...(climate.length === 0
                      ? {
                          unavailableReason:
                            'Analyse indisponible : aucun résultat de module pour ce projet.',
                        }
                      : {})}
                  />
                )}
              </>
            ) : undefined
          }
        >
          {tab === 'plan' && (
            <>
              {/*
               * Ce qu'on peut ajouter ici, avant ce que le projet contient.
               *
               * La colonne racontait le passé — les niveaux, les murs déjà
               * tracés, les réseaux déjà posés — alors qu'on y vient pour
               * créer. Ce que la sous-partie sait poser passe donc devant, en
               * toutes lettres ; l'arborescence reste dessous, à un dépliage,
               * pour retrouver et pour corriger.
               */}
              {/*
                Combien d'étages, dans l'espace où l'on bâtit — et nulle part
                ailleurs : c'est là qu'on se pose la question.
              */}
              {navigation.stage === 'BUILDING' && (
                <StoreyCount
                  project={file.project}
                  onCommand={runCommand}
                  onMessage={setMessage}
                />
              )}
              {/*
               * Les sous-parties, et ce que l'ouverte sait poser.
               *
               * Elles étaient une rangée au-dessus du plan et un panneau ici :
               * deux endroits pour une idée, avec les mêmes boutons aux deux
               * places — l'un des deux étant toujours celui qu'on n'avait pas
               * visé. Une liste dépliable les réunit, et c'est la forme d'un
               * sommaire : on voit les parties, on ouvre celle qu'on travaille.
               */}
              <SectionList
                project={file.project}
                stage={navigation.stage}
                {...(openSection === undefined ? {} : { section: openSection })}
                design={design}
                editor={editor}
                drafts={toolDrafts}
                onChooseEntry={chooseEntry}
                onNavigate={navigateTo}
                onOpenSection={(section) =>
                  setNavigation((current) => goToSection(current, section))
                }
                onBrowseFamilies={setBrowsing}
              />
              {(file.project.scenarios ?? []).length > 0 && (
                <section
                  className="overlay-control"
                  aria-labelledby="scenario-mode-heading"
                >
                  <h3 id="scenario-mode-heading">Scénario</h3>
                  {/*
                    The variant is chosen on the drawing, in « Variante » above
                    the plan: it is a mode of the plan, not a destination. What
                    stays here is what the mode means.
                  */}
                  {scenarioMode !== undefined && (
                    <p className="hint">
                      Le plan montre cette variante. Modifier une propriété ne
                      change pas le projet : cela dit ce que la variante fait
                      autrement. Les objets ajoutés, retirés et modifiés sont
                      colorés.
                    </p>
                  )}
                  {scenarioMode !== undefined &&
                    scenarioProject === undefined && (
                      <p className="hint">
                        Cette variante ne s’applique pas au projet tel qu’il est
                        : ouvrez l’espace Scénarios pour voir pourquoi.
                      </p>
                    )}
                </section>
              )}
              {/*
                Chaque aide là où elle sert, et nulle part ailleurs.
                Cinq cases de dégagement et vingt analyses s'affichaient dans
                la colonne du terrain, dans celle des documents, dans celle du
                projet : un panneau qui répond à une question qu'on ne se pose
                pas ici repousse sous la ligne de flottaison ce qu'on cherche.
                C'est le registre des espaces qui dit lesquelles, comme il dit
                déjà ce que l'espace contient.
              */}
              {planAids.includes('CLEARANCES') && (
                <ClearanceControl
                  groups={clearanceGroups}
                  onChange={setClearanceGroups}
                  conflicts={clearances.conflicts.length}
                  unmeasured={clearances.unmeasured.length}
                />
              )}
              {/*
                L'analyse vit dans Études — et partout où elle a déjà quelque
                chose à dire : une variante colore le plan par le même chemin,
                et sa légende ne peut pas disparaître parce qu'on regarde
                l'espace du bâtiment.
              */}
            </>
          )}
        </ContextPanel>
      }
      contextSeparator={
        layout.sidebarShown ? (
          <PanelSeparator
            label="Redimensionner le panneau de navigation"
            widthPx={layout.sidebarPx}
            grows="RIGHT"
            onResize={(sidebarPx) => changeLayout({ sidebarPx })}
          />
        ) : (
          <div className="panel-edge-empty" />
        )
      }
      canvas={
        <>
          {tab === 'plan' && (
            <section className="canvas-panel panel" id="plan">
              <ToolHeader
                project={file.project}
                stage={navigation.stage}
                design={design}
                onChooseEntry={chooseEntry}
                onNavigate={navigateTo}
                editor={editor}
                dispatch={dispatchEditor}
                drafts={toolDrafts}
                onDraftChange={(key, value) =>
                  setToolDrafts((current) => ({ ...current, [key]: value }))
                }
                context={
                  <ContextToolBar
                    project={file.project}
                    editor={editor}
                    dispatch={dispatchEditor}
                    stage={navigation.stage}
                    levelId={activeLevelId}
                    actions={selectionActions}
                    onCancel={() => dispatchEditor({ type: 'CANCEL' })}
                    onFinish={finishRun}
                  />
                }
                view={
                  <>
                    {(file.project.scenarios ?? []).length > 0 && (
                      <label className="view-choice">
                        <span className="visually-hidden">Variante</span>
                        <select
                          value={scenarioMode ?? ''}
                          onChange={(event) =>
                            setScenarioMode(
                              event.target.value === ''
                                ? undefined
                                : event.target.value,
                            )
                          }
                        >
                          <option value="">Le projet lui-même</option>
                          {(file.project.scenarios ?? []).map((scenario) => (
                            <option key={scenario.id} value={scenario.id}>
                              {scenario.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="visibility-anchor">
                      <button
                        type="button"
                        className="secondary"
                        aria-expanded={displayOpen}
                        aria-haspopup="dialog"
                        onClick={(event) => {
                          // Relevé sur le bouton lui-même, à chaque ouverture :
                          // le panneau est posé en `fixed`, hors de la case du
                          // plan qui rognait ses derniers calques.
                          const at =
                            event.currentTarget.getBoundingClientRect();
                          setDisplayAt({
                            top: at.bottom + 6,
                            right: Math.max(6, window.innerWidth - at.right),
                          });
                          setDisplayOpen((open) => !open);
                        }}
                      >
                        Affichage
                        {hiddenLayers > 0 && (
                          <span className="view-badge" aria-hidden="true">
                            {hiddenLayers}
                          </span>
                        )}
                      </button>
                      {displayOpen && (
                        <Suspense fallback={null}>
                          <DisplayPanel
                            editor={editor}
                            dispatch={dispatchEditor}
                            renderingId={rendering.id}
                            onRendering={setRenderingId}
                            onClose={() => setDisplayOpen(false)}
                            {...(displayAt === undefined
                              ? {}
                              : { at: displayAt })}
                          />
                        </Suspense>
                      )}
                    </div>
                  </>
                }
              />
              <PlanCanvas
                graphicProfileId={rendering.graphicProfileId}
                project={scenarioProject ?? file.project}
                editor={{ ...editor, levelId: activeLevelId } as EditorState}
                dispatch={dispatchEditor}
                aids={planAids}
                stage={navigation.stage}
                onMessage={setMessage}
                onCommitPoints={commitPoints}
                onPlacementRotation={(rotationDeg) => {
                  placementRotation.current = rotationDeg;
                }}
                onFinishRun={finishRun}
                onMoveSelection={moveSelection}
                onCommand={runCommand}
                onObjectMenu={(objectId, atPx) =>
                  setObjectMenu({ objectId, atPx })
                }
                selectableFamily={selectableFamily}
                onEditGeometry={editGeometry}
                wallThicknessMm={wallThicknessMm}
                {...(componentDefinitionId === ''
                  ? {}
                  : { componentDefinitionId })}
                {...(drawnOverlay === undefined
                  ? {}
                  : { overlay: drawnOverlay })}
                clearanceGroups={clearanceGroups}
                onCreateRoom={createRoomAt}
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

          {tab === 'openings' && (
            <LazyWorkspace>
              <OpeningsPanel project={file.project} onCommand={runCommand} />
            </LazyWorkspace>
          )}

          {tab === 'networks' && (
            <LazyWorkspace>
              <NetworksPanel
                project={file.project}
                levelId={activeLevelId}
                selectedNetworkId={
                  activeNetworkId === '' ? undefined : activeNetworkId
                }
                onSelectNetwork={selectNetwork}
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

          {tab === 'documents' && (
            <LazyWorkspace>
              <DocumentsPanel
                project={file.project}
                onCommand={runCommand}
                onMessage={setMessage}
                onCaptureView={captureView}
                onApplyView={applyView}
                onExport={exportSheets}
                newId={(prefix) => `${prefix}-${crypto.randomUUID()}`}
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
                onPromote={(scenarioId) => {
                  void promoteScenario(scenarioId);
                }}
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
        </>
      }
      statusBar={
        <ShellStatusBar
          projectName={file.project.metadata.name}
          message={message}
          saveLabel={SAVE_STATE_LABELS[saveState]}
          saveState={saveState}
          issues={
            <Suspense fallback={null}>
              <IssueCenter
                project={file.project}
                {...(currentRun === undefined ? {} : { run: currentRun })}
                onNavigate={navigateTo}
              />
            </Suspense>
          }
        />
      }
      overlays={
        <>
          {/*
           * L'arborescence, ouverte à la demande et par dessus le dessin.
           *
           * Elle était un dépliage permanent au bas de la colonne : replié il
           * ne montrait rien et coûtait quand même sa rangée, son trait et sa
           * marge, dans la seule colonne qui reste. Elle se pose contre le
           * plan plutôt que sur la colonne, pour que désigner un mur dedans en
           * montre les propriétés **à côté** plutôt que dessous.
           */}
          {navigatorOpen && (
            <ModelNavigator
              leftPx={layout.sidebarShown ? layout.sidebarPx + 20 : 12}
              onClose={() => setNavigatorOpen(false)}
            >
              <Suspense fallback={<p className="hint">Chargement…</p>}>
                <ProjectTree
                  project={file.project}
                  {...(activeLevelId === undefined
                    ? {}
                    : { levelId: activeLevelId })}
                  selection={editor.selection}
                  onSelectObject={(objectId) =>
                    dispatchEditor({ type: 'SELECT', objectId })
                  }
                  onFrameObject={(objectId) => {
                    dispatchEditor({ type: 'SELECT', objectId });
                    zoomSelection();
                  }}
                  onOpenDocuments={() => {
                    setTab('documents');
                    setNavigatorOpen(false);
                  }}
                  libraries={librariesOfStage(navigation.stage).map((id) => ({
                    id,
                    label: DESTINATION_LABELS[id],
                  }))}
                  onOpenLibrary={(library) => {
                    // Ouvrir une destination referme ce qui la cachait : le
                    // navigateur est posé sur le plan, et sur un téléphone le
                    // panneau est un tiroir.
                    setTab(library as DestinationId);
                    setNavigatorOpen(false);
                    setMenuOpen(false);
                  }}
                  onSearch={(query) => {
                    setPaletteQuery(query);
                    setPaletteOpen(true);
                    setNavigatorOpen(false);
                  }}
                />
              </Suspense>
            </ModelNavigator>
          )}
          {/*
           * Le reste du métier, ouvert depuis la sous-partie qui le sert.
           *
           * Poser un mitigeur demandait six gestes : quitter le plan, ouvrir
           * « Équipements », chercher, ajouter au projet, revenir, reprendre
           * l'outil composant, retrouver la fiche dans une liste. Il en
           * demande deux.
           */}
          {browsing !== undefined && (
            <Suspense fallback={null}>
              <FamilyPicker
                project={file.project}
                title={browsing.label}
                {...(browsing.domain === undefined
                  ? {}
                  : { domain: browsing.domain })}
                onCommand={runCommand}
                onMessage={setMessage}
                onClose={() => setBrowsing(undefined)}
                onPlace={(equipmentId, category) => {
                  dispatchEditor({ type: 'SET_TOOL', tool: 'COMPONENT' });
                  setToolDrafts((current) => ({
                    ...current,
                    ...componentDrafts(equipmentId, category),
                  }));
                  setMessage(
                    'Fiche prête : cliquez sur le plan pour la poser.',
                  );
                }}
              />
            </Suspense>
          )}
          {exportFailure !== undefined && (
            <section className="panel recovery-prompt" role="alertdialog">
              <p>
                <strong>Export impossible.</strong> Le projet ouvert contient{' '}
                {exportFailure.length} incohérence(s) que le format refuse
                d’enregistrer. Corrigez-les, puis exportez à nouveau ; rien n’a
                été écrit.
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
                <button
                  type="button"
                  onClick={() => setExportFailure(undefined)}
                >
                  Fermer
                </button>
              </div>
            </section>
          )}

          {pendingReplacement !== undefined && (
            <section className="panel recovery-prompt" role="alertdialog">
              <p>
                Ce projet contient des modifications qui n’ont pas été
                exportées. « {pendingReplacement.label} » les remplacerait.
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

          {objectMenu !== undefined && activeLevelId !== undefined && (
            <ObjectMenu
              title={inspectObject(file.project, objectMenu.objectId).title}
              atPx={objectMenu.atPx}
              entries={objectMenuEntries(objectMenu.objectId)}
              onClose={() => setObjectMenu(undefined)}
            />
          )}

          {paletteOpen && (
            <CommandPalette
              initialQuery={paletteQuery}
              entries={paletteEntries}
              onClose={() => setPaletteOpen(false)}
            />
          )}

          {recovery !== undefined && (
            <section className="panel recovery-prompt" role="alertdialog">
              <p>
                Une sauvegarde locale plus récente a été trouvée (
                {new Date(recovery.savedAt).toLocaleString('fr-FR')}). Restaurer
                ?
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
        </>
      }
    />
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
