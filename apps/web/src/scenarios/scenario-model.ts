import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  applyProjectScenario,
  listScenarios,
} from '@house-technical-designer/project-io';
import {
  dashboardCards,
  runProjectCalculations,
  type DashboardCard,
} from '../calculations/calculation-runner.js';

export interface ScenarioComparisonRow {
  readonly id: string;
  readonly label: string;
  readonly unit?: string;
  readonly baseValue?: number;
  readonly variantValue?: number;
  /** Difference variant − base, when both sides resolved a value. */
  readonly delta?: number;
  readonly deltaRatio?: number;
}

export interface ScenarioComparison {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly rows: readonly ScenarioComparisonRow[];
  readonly issues: readonly string[];
}

function numeric(card: DashboardCard | undefined): number | undefined {
  if (card?.value === undefined) return undefined;
  const parsed = Number(card.value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Compares a scenario against the project it varies.
 *
 * The variant is derived from the same project rather than duplicated, and a
 * figure only produces a delta when both sides actually resolved it.
 */
export async function compareScenario(
  project: Project,
  scenarioId: string,
  climate: readonly ClimateDataset[],
): Promise<ScenarioComparison> {
  const scenario = listScenarios(project).find(({ id }) => id === scenarioId);
  const applied = applyProjectScenario(project, scenarioId);
  if (applied.status !== 'OK')
    return {
      scenarioId,
      scenarioName: scenario?.name ?? scenarioId,
      rows: [],
      issues: applied.issues.map(({ message }) => message),
    };
  const [base, variant] = await Promise.all([
    runProjectCalculations(project, climate),
    runProjectCalculations(applied.project, climate),
  ]);
  const baseCards = dashboardCards(project, base.runs);
  const variantCards = dashboardCards(applied.project, variant.runs);
  const rows = baseCards.map((card): ScenarioComparisonRow => {
    const baseValue = numeric(card);
    const variantValue = numeric(
      variantCards.find((entry) => entry.id === card.id),
    );
    const delta =
      baseValue === undefined || variantValue === undefined
        ? undefined
        : variantValue - baseValue;
    return {
      id: card.id,
      label: card.label,
      ...(card.unit === undefined ? {} : { unit: card.unit }),
      ...(baseValue === undefined ? {} : { baseValue }),
      ...(variantValue === undefined ? {} : { variantValue }),
      ...(delta === undefined ? {} : { delta }),
      ...(delta === undefined || baseValue === undefined || baseValue === 0
        ? {}
        : { deltaRatio: delta / baseValue }),
    };
  });
  return {
    scenarioId,
    scenarioName: scenario?.name ?? scenarioId,
    rows,
    issues: applied.issues.map(({ message }) => message),
  };
}

/** Scenarios the project declares, for the comparison picker. */
export function projectScenarios(
  project: Project,
): readonly { readonly id: string; readonly name: string }[] {
  return listScenarios(project).map(({ id, name }) => ({ id, name }));
}
