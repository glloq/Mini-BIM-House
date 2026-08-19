import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import type { CalculationJson } from '@house-technical-designer/calculation-core';
import type { ModuleRun } from './calculation-runner.js';

export type OverlayId =
  'none' | 'thermal-u' | 'thermal-heat-loss' | 'thermal-missing';

export interface OverlayOption {
  readonly id: OverlayId;
  readonly label: string;
  readonly moduleId?: string;
}

export const OVERLAY_OPTIONS: readonly OverlayOption[] = [
  { id: 'none', label: 'Aucune analyse' },
  { id: 'thermal-u', label: 'Transmission U', moduleId: 'thermal' },
  {
    id: 'thermal-heat-loss',
    label: 'Déperditions',
    moduleId: 'thermal',
  },
  {
    id: 'thermal-missing',
    label: 'Données manquantes',
    moduleId: 'thermal',
  },
];

function rows(
  value: CalculationJson | undefined,
): readonly Readonly<Record<string, CalculationJson>>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Readonly<Record<string, CalculationJson>> =>
          typeof entry === 'object' && entry !== null && !Array.isArray(entry),
      )
    : [];
}

function number(value: CalculationJson | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function text(value: CalculationJson | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function scaleOf(values: readonly number[]): AnalysisOverlay['scale'] {
  if (values.length === 0) return undefined;
  return {
    kind: 'CONTINUOUS',
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    clamp: true,
  };
}

/**
 * Builds an analysis overlay from a module run.
 *
 * The values come straight from the module's own outputs, so what the plan
 * colours is the same figure the module panel reports.
 */
export function buildOverlay(
  overlayId: OverlayId,
  runs: readonly ModuleRun[],
  designTemperatureDifferenceK: number | undefined,
): AnalysisOverlay | undefined {
  if (overlayId === 'none') return undefined;
  const thermal = runs.find((run) => run.moduleId === 'thermal')?.result;
  if (thermal === undefined) return undefined;
  const elements = rows(thermal.outputs.elements);
  if (elements.length === 0) return undefined;

  if (overlayId === 'thermal-missing') {
    const values = Object.fromEntries(
      elements.flatMap((element) => {
        const id = text(element.id);
        return id === undefined
          ? []
          : [[id, number(element.uValueWm2K) === undefined ? 1 : 0] as const];
      }),
    );
    return {
      id: 'thermal-missing',
      metric: 'MISSING_DATA',
      unit: '—',
      values,
      scale: { kind: 'CONTINUOUS', minimum: 0, maximum: 1, clamp: true },
      states: Object.fromEntries(
        Object.entries(values).map(([id, value]) => [
          id,
          value === 1 ? ('UNKNOWN' as const) : ('NORMAL' as const),
        ]),
      ),
    };
  }

  const heatLoss = overlayId === 'thermal-heat-loss';
  if (heatLoss && designTemperatureDifferenceK === undefined) return undefined;
  const deltaK = designTemperatureDifferenceK ?? 0;
  const entries = elements.flatMap((element) => {
    const id = text(element.id);
    if (id === undefined) return [];
    const uValue = number(element.uValueWm2K);
    const coefficient = number(element.heatTransferCoefficientWK);
    const value = heatLoss
      ? coefficient === undefined
        ? null
        : coefficient * deltaK
      : (uValue ?? null);
    return [[id, value] as const];
  });
  const numeric = entries
    .map(([, value]) => value)
    .filter((value): value is number => value !== null);
  const scale = scaleOf(numeric);
  return {
    id: heatLoss ? 'thermal-heat-loss' : 'thermal-u',
    metric: heatLoss ? 'HEAT_LOSS' : 'U_VALUE',
    unit: heatLoss ? 'W' : 'W/(m²·K)',
    values: Object.fromEntries(entries),
    ...(scale === undefined ? {} : { scale }),
  };
}

/** Design temperature difference the heating module resolved, when it ran. */
export function designTemperatureDifferenceK(
  runs: readonly ModuleRun[],
): number | undefined {
  return number(
    runs.find((run) => run.moduleId === 'heating')?.result?.outputs
      .designTemperatureDifferenceK,
  );
}
