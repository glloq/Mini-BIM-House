import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import type {
  CalculationJson,
  CalculationResult,
} from '@house-technical-designer/calculation-core';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import {
  PROJECT_CALCULATION_MODULES,
  PROJECT_CALCULATION_MODULE_IDS,
  buildProjectCalculationInputs,
  createProjectCalculationContext,
  type MissingCalculationInput,
  type ProjectCalculationInputs,
} from '@house-technical-designer/calculation-adapters';

/** Human labels for the modules, in the order the dashboard shows them. */
export const MODULE_LABELS: Readonly<Record<string, string>> = {
  thermal: 'Enveloppe thermique',
  heating: 'Chauffage',
  dhw: 'Eau chaude sanitaire',
  lighting: 'Éclairage',
  ventilation: 'Ventilation',
  iaq: 'Qualité de l’air',
  water: 'Eau froide',
  wastewater: 'Évacuations',
  rainwater: 'Eau de pluie',
  photovoltaic: 'Photovoltaïque',
  battery: 'Stockage',
  'energy-balance': 'Bilan énergétique',
  hygrothermal: 'Hygrothermie',
  acoustics: 'Acoustique',
  cost: 'Coût',
  environmental: 'Environnement',
};

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
}

export interface CalculationRun {
  readonly runs: readonly ModuleRun[];
  readonly missing: readonly MissingCalculationInput[];
  readonly provenance: ProjectCalculationInputs['provenance'];
}

function orchestrator(): CalculationOrchestrator {
  const engine = new CalculationOrchestrator();
  PROJECT_CALCULATION_MODULES.forEach((module) => engine.register(module));
  return engine;
}

/**
 * Runs every project-driven module against the current project.
 *
 * A module whose inputs the project cannot supply is reported as missing input
 * rather than run on a placeholder, and the missing entries name where the value
 * is expected to come from.
 */
export async function runProjectCalculations(
  project: Project,
  climate: readonly ClimateDataset[],
): Promise<CalculationRun> {
  const context = createProjectCalculationContext(project, { climate });
  const built = buildProjectCalculationInputs(context);
  const engine = orchestrator();
  const runs: ModuleRun[] = [];
  for (const moduleId of PROJECT_CALCULATION_MODULE_IDS) {
    const missing = built.missing.filter(
      (entry) => entry.moduleId === moduleId,
    );
    const label = MODULE_LABELS[moduleId] ?? moduleId;
    const inputs = built.inputs[moduleId] ?? null;
    const outcome = await engine.calculateModule(moduleId, built.inputs, {});
    if (outcome.status === 'ERROR') {
      runs.push({
        moduleId,
        label,
        status: missing.length > 0 ? 'MISSING_INPUT' : 'ERROR',
        message: outcome.message,
        missing,
        inputs,
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
    });
  }
  return { runs, missing: built.missing, provenance: built.provenance };
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
  const spaces = project.building.levels.flatMap(
    ({ spaces: entries }) => entries,
  );
  const floorAreaM2 = spaces.reduce((total, space) => {
    if (space.boundaryMode !== 'MANUAL') return total;
    const points = space.manualPolygon.outer;
    let twice = 0;
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index]!;
      const next = points[(index + 1) % points.length]!;
      twice += current.x * next.y - next.x * current.y;
    }
    return total + Math.abs(twice) / 2 / 1_000_000;
  }, 0);
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
      'Coût matériaux',
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
