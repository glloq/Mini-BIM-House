import { resolvedSpaces } from '@house-technical-designer/core-domain';
import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { climateFingerprint } from '@house-technical-designer/climate';
import type {
  CalculationJson,
  CalculationResult,
} from '@house-technical-designer/calculation-core';
import type {
  MissingCalculationInput,
  ProjectCalculationInputs,
} from '@house-technical-designer/calculation-adapters';

/** Human labels for the modules, in the order the dashboard shows them. */
// What each module is called used to be a second copy of the seventeen names,
// kept here. Two lists of the same seventeen things drift: a module runs with
// no name, or a name sits with nothing behind it. The one list lives in the
// registry the adapters keep, and it is read from there — after the adapters
// are loaded, so that seventeen calculation engines do not come with the
// application just to spell « Chauffage ».

export type ModuleRunStatus =
  'OK' | 'PARTIAL' | 'FAILED' | 'MISSING_INPUT' | 'ERROR';

export interface ModuleRun {
  readonly moduleId: string;
  readonly label: string;
  readonly status: ModuleRunStatus;
  readonly message?: string;
  readonly result?: CalculationResult;
  /** Inputs the project could not provide for this module. */
  readonly missing: readonly MissingCalculationInput[];
  readonly inputs: CalculationJson;
  /**
   * Whether the answer came from the cache rather than from a fresh run.
   *
   * Not a curiosity: it is the difference between « seventeen modules ran »
   * and « five did ». Carrying it here is what lets a test assert the second
   * rather than hope for it.
   */
  readonly reused: boolean;
}

export interface CalculationRun {
  readonly runs: readonly ModuleRun[];
  readonly missing: readonly MissingCalculationInput[];
  readonly provenance: ProjectCalculationInputs['provenance'];
  /** The project these results were computed from. */
  readonly projectId: string;
  /** The project revision these results were computed from. */
  readonly projectRevision: string;
  /** The climate datasets they were computed with. */
  readonly climateFingerprint: string;
  readonly startedAt: string;
  readonly completedAt: string;
  /** Modules that had to be computed again for this run. */
  readonly recomputed: readonly string[];
}

/**
 * What the climate contributes to a result, as one comparable value.
 *
 * Datasets are identified by content rather than by name: replacing a file with
 * another one carrying the same identifier changes the answers, and the run has
 * to be seen as out of date.
 */
export function climateSignature(climate: readonly ClimateDataset[]): string {
  return climate
    .map((dataset) => climateFingerprint(dataset))
    .sort()
    .join('|');
}

/**
 * Whether a run still describes the project in front of the user.
 *
 * Results computed on revision 20 must never be read as the state of revision
 * 35. The check is on the revision and the climate, because those are the two
 * inputs the run was built from.
 */
export function isCurrentRun(
  run: CalculationRun | undefined,
  project: Project,
  climate: readonly ClimateDataset[],
): run is CalculationRun {
  if (run === undefined) return false;
  return (
    // Two projects can sit at the same revision with the same climate; only
    // the identity tells their results apart.
    run.projectId === project.id &&
    run.projectRevision === (project.metadata.projectRevision ?? '') &&
    run.climateFingerprint === climateSignature(climate)
  );
}

/**
 * Whether the results have to be computed again.
 *
 * Seventeen modules run on every change of the project, and they used to run
 * again on every change of anything: opening the calculations tab with an
 * overlay already showing, switching to the checks and back, renaming a saved
 * view. None of that changes a number, and all of it paid for the whole set.
 *
 * A run already made for this project, this revision and this climate is the
 * answer; asking again would produce the same one. What forces a fresh run is
 * the user asking for one, which is what the generation counts.
 */
export function needsRecalculation(
  run: CalculationRun | undefined,
  project: Project,
  climate: readonly ClimateDataset[],
  generation: number,
  lastGeneration: number,
): boolean {
  if (generation !== lastGeneration) return true;
  return !isCurrentRun(run, project, climate);
}

/**
 * Runs every project-driven module against the current project.
 *
 * A module whose inputs the project cannot supply is reported as missing input
 * rather than run on a placeholder, and the missing entries name where the value
 * is expected to come from.
 *
 * The seventeen calculation modules and the orchestrator are loaded here rather
 * than with the application: they are a large part of the code and none of it
 * is needed to open a project and draw. The first run pays for the download,
 * the following ones do not.
 */
export async function runProjectCalculations(
  project: Project,
  climate: readonly ClimateDataset[],
): Promise<CalculationRun> {
  const startedAt = new Date().toISOString();
  const engine = await sharedEngine();
  const { calculationModuleLabel, moduleIds } = engine;
  const built = engine.build(project, climate);
  const runs: ModuleRun[] = [];
  for (const moduleId of moduleIds) {
    const missing = built.missing.filter(
      (entry) => entry.moduleId === moduleId,
    );
    const label = calculationModuleLabel(moduleId);
    const inputs = built.inputs[moduleId] ?? null;
    const outcome = await engine.orchestrator.calculateModule(
      moduleId,
      built.inputs,
      {},
    );
    if (outcome.status === 'ERROR') {
      runs.push({
        moduleId,
        label,
        status: missing.length > 0 ? 'MISSING_INPUT' : 'ERROR',
        message: outcome.message,
        missing,
        inputs,
        // A refusal is not a result, so there is nothing to have reused.
        reused: false,
      });
      continue;
    }
    runs.push({
      moduleId,
      label,
      status: outcome.result.status,
      result: outcome.result,
      missing,
      inputs,
      reused: outcome.cacheHit,
    });
  }
  return {
    runs,
    missing: built.missing,
    provenance: built.provenance,
    projectId: project.id,
    projectRevision: project.metadata.projectRevision ?? '',
    climateFingerprint: climateSignature(climate),
    startedAt,
    completedAt: new Date().toISOString(),
    recomputed: runs
      .filter(({ reused }) => !reused)
      .map(({ moduleId }) => moduleId),
  };
}

/**
 * L'orchestrateur, et le fait qu'il n'y en ait qu'un.
 *
 * Il en était créé un neuf à chaque exécution, donc avec un cache vide, donc
 * les dix-sept modules recalculaient tout à chaque révision du projet. Le
 * cache existait pourtant, et il était déjà exact : les résultats sont
 * adressés par l'empreinte de ce qui les produit — version du module, entrées,
 * réglages, empreintes des dépendances. Déplacer un mur change les entrées de
 * `thermal`, donc son empreinte, donc celles des quatre modules qui en
 * dépendent ; les douze autres retrouvent la leur inchangée.
 *
 * C'est ce qui rend l'invalidation sélective **sans rien déclarer**. Une liste
 * de chemins écrite à la main — « ce module dépend de `building.levels.walls` »
 * — dérive dès qu'un module lit une valeur de plus, et rien ne le dit : les
 * résultats deviennent faux en silence, ce qui est pire que de tout
 * recalculer. L'empreinte, elle, est dérivée de ce qui est réellement passé au
 * module, donc elle ne peut pas mentir. `inputPaths` reste sur les modules
 * comme documentation ; ce n'est pas ce qui décide.
 *
 * Ce qui est gardé entre deux exécutions est donc le cache, et rien d'autre :
 * le projet et le climat sont relus à chaque appel, et un résultat n'est
 * réutilisé que si son empreinte est identique.
 */
interface SharedEngine {
  readonly orchestrator: import('@house-technical-designer/calculation-core').CalculationOrchestrator;
  readonly moduleIds: readonly string[];
  readonly calculationModuleLabel: (moduleId: string) => string;
  readonly build: (
    project: Project,
    climate: readonly ClimateDataset[],
  ) => ProjectCalculationInputs;
}

let engineOnce: Promise<SharedEngine> | undefined;

async function sharedEngine(): Promise<SharedEngine> {
  engineOnce ??= (async (): Promise<SharedEngine> => {
    const [{ CalculationOrchestrator }, adapters] = await Promise.all([
      import('@house-technical-designer/calculation-core'),
      import('@house-technical-designer/calculation-adapters'),
    ]);
    const {
      PROJECT_CALCULATION_MODULES,
      PROJECT_CALCULATION_MODULE_IDS,
      buildProjectCalculationInputs,
      calculationModuleLabel,
      createProjectCalculationContext,
    } = adapters;
    const orchestrator = new CalculationOrchestrator();
    for (const module of PROJECT_CALCULATION_MODULES)
      orchestrator.register(module);
    return {
      orchestrator,
      moduleIds: PROJECT_CALCULATION_MODULE_IDS,
      calculationModuleLabel,
      build: (project, climate) =>
        buildProjectCalculationInputs(
          createProjectCalculationContext(project, { climate }),
        ),
    };
  })();
  return engineOnce;
}

/**
 * Jette ce qui a été gardé.
 *
 * Le seul appelant légitime est un test : chacun doit partir d'un cache vide,
 * sans quoi l'ordre des tests décide de leurs résultats. L'application, elle,
 * n'a aucune raison de le faire — un cache adressé par le contenu ne devient
 * jamais faux.
 */
export async function resetCalculationEngine(): Promise<void> {
  if (engineOnce === undefined) return;
  (await engineOnce).orchestrator.clearCache();
}

/** Ce que le cache a évité depuis le début de la séance. */
export async function calculationCacheStatistics(): Promise<
  import('@house-technical-designer/calculation-core').CalculationCacheStatistics
> {
  return (await sharedEngine()).orchestrator.statistics();
}

function number(value: CalculationJson | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export interface DashboardCard {
  readonly id: string;
  readonly label: string;
  readonly value?: string;
  readonly unit?: string;
  readonly moduleId: string;
  readonly hint?: string;
}

function output(
  runs: readonly ModuleRun[],
  moduleId: string,
  key: string,
): CalculationJson | undefined {
  return runs.find((run) => run.moduleId === moduleId)?.result?.outputs[key];
}

function card(
  runs: readonly ModuleRun[],
  id: string,
  label: string,
  moduleId: string,
  key: string,
  unit: string,
  transform: (value: number) => number = (value) => value,
  digits = 1,
): DashboardCard {
  const run = runs.find((entry) => entry.moduleId === moduleId);
  const raw = number(output(runs, moduleId, key));
  return {
    id,
    label,
    moduleId,
    unit,
    ...(raw === undefined
      ? {
          hint:
            run === undefined
              ? 'Module non exécuté'
              : run.missing.length > 0
                ? `${run.missing.length} donnée(s) manquante(s)`
                : 'Valeur non résolue',
        }
      : { value: transform(raw).toFixed(digits) }),
  };
}

/** Headline figures for the project dashboard, each opening its module. */
export function dashboardCards(
  project: Project,
  runs: readonly ModuleRun[],
): readonly DashboardCard[] {
  // The project's one answer about a room's surface. The dashboard used to
  // carry a shoelace formula of its own, over the rooms drawn by hand only, so
  // a house could show one floor area here and another in the takeoff.
  const floorAreaM2 = resolvedSpaces(project).reduce(
    (total, { floorAreaM2: area }) => total + (area ?? 0),
    0,
  );
  return [
    {
      id: 'floor-area',
      label: 'Surface de plancher',
      moduleId: 'thermal',
      unit: 'm²',
      value: floorAreaM2.toFixed(1),
    },
    card(
      runs,
      'envelope-h',
      'Déperditions d’enveloppe',
      'thermal',
      'heatTransferCoefficientWK',
      'W/K',
    ),
    card(
      runs,
      'u-value',
      'U moyen',
      'thermal',
      'uValueWm2K',
      'W/(m²·K)',
      (value) => value,
      3,
    ),
    card(
      runs,
      'heating-load',
      'Puissance de chauffage',
      'heating',
      'designLoadW',
      'kW',
      (value) => value / 1000,
      2,
    ),
    card(
      runs,
      'dhw-energy',
      'Énergie ECS annuelle',
      'dhw',
      'annualUsefulEnergyKWh',
      'kWh',
      (value) => value,
      0,
    ),
    card(
      runs,
      'lighting-power',
      'Puissance d’éclairage',
      'lighting',
      'installedPowerW',
      'W',
      (value) => value,
      0,
    ),
    card(
      runs,
      'electrical-demand',
      'Puissance électrique appelée',
      'electrical',
      'designPowerW',
      'W',
      (value) => value,
      0,
    ),
    card(
      runs,
      'ventilation-flow',
      'Débit de ventilation',
      'ventilation',
      'designFlowM3h',
      'm³/h',
      (value) => value,
      0,
    ),
    card(
      runs,
      'pv-yield',
      'Production photovoltaïque',
      'photovoltaic',
      'annualGenerationKWh',
      'kWh/an',
      (value) => value,
      0,
    ),
    card(
      runs,
      'self-sufficiency',
      'Autosuffisance',
      'energy-balance',
      'selfSufficiencyRatio',
      '%',
      (value) => value * 100,
      1,
    ),
    card(
      runs,
      'grid-import',
      'Import réseau',
      'energy-balance',
      'gridImportWh',
      'kWh',
      (value) => value / 1000,
      1,
    ),
    card(
      runs,
      'rainwater-coverage',
      'Couverture eau de pluie',
      'rainwater',
      'coverageRatio',
      '%',
      (value) => value * 100,
      1,
    ),
    card(
      runs,
      'cost',
      'Coût matériaux et pose',
      'cost',
      'totalCost',
      '€',
      (value) => value,
      0,
    ),
    card(
      runs,
      'carbon',
      'Impact carbone',
      'environmental',
      'totalImpact',
      'kgCO2e',
      (value) => value,
      0,
    ),
  ];
}

/** Every warning raised by a run, flattened for the alert list. */
export interface RunAlert {
  readonly moduleId: string;
  readonly moduleLabel: string;
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly message: string;
  readonly objectIds: readonly string[];
}

export function runAlerts(runs: readonly ModuleRun[]): readonly RunAlert[] {
  return runs.flatMap((run) =>
    (run.result?.warnings ?? []).map((warning) => ({
      moduleId: run.moduleId,
      moduleLabel: run.label,
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      objectIds: warning.objectIds ?? [],
    })),
  );
}
