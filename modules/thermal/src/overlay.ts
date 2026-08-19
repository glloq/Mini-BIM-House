import {
  continuousScale,
  type AnalysisOverlay,
} from '@house-technical-designer/calculation-core';
import type { ThermalElementResult } from './thermal.js';

export type ThermalOverlayMode = 'U_VALUE' | 'HEAT_LOSS';

export interface ThermalOverlayOptions {
  readonly id: string;
  readonly mode: ThermalOverlayMode;
  /** Required by HEAT_LOSS so that its output is power rather than H. */
  readonly temperatureDifferenceK?: number;
}

/** Produces semantic values only; graphic profiles remain responsible for color. */
export function createThermalOverlay(
  elements: readonly ThermalElementResult[],
  options: ThermalOverlayOptions,
): AnalysisOverlay {
  if (options.id.trim() === '')
    throw new TypeError('Thermal overlay ID must not be empty');
  if (options.mode === 'HEAT_LOSS') {
    if (options.temperatureDifferenceK === undefined)
      throw new TypeError('HEAT_LOSS requires a temperature difference');
    if (
      !Number.isFinite(options.temperatureDifferenceK) ||
      options.temperatureDifferenceK < 0
    )
      throw new RangeError(
        'Thermal overlay temperature difference must be finite and non-negative',
      );
  }
  const entries = [...elements]
    .sort((first, second) => first.elementId.localeCompare(second.elementId))
    .map((element): readonly [string, number | null] => [
      element.elementId,
      overlayValue(element, options),
    ]);
  const numericValues = entries.flatMap(([, value]) =>
    value === null ? [] : [value],
  );
  const scale = continuousScale(numericValues);
  return {
    id: options.id,
    metric: options.mode,
    unit: options.mode === 'U_VALUE' ? 'W/(m²·K)' : 'W',
    values: Object.fromEntries(entries),
    ...(scale === undefined ? {} : { scale }),
  };
}

function overlayValue(
  element: ThermalElementResult,
  options: ThermalOverlayOptions,
): number | null {
  if (options.mode === 'U_VALUE') return element.uValueWm2K ?? null;
  if (element.heatTransferCoefficientWK === undefined) return null;
  if (options.temperatureDifferenceK === undefined)
    throw new Error(
      'Validated HEAT_LOSS options lack a temperature difference',
    );
  return element.heatTransferCoefficientWK * options.temperatureDifferenceK;
}
