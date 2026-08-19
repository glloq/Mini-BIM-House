import {
  simulateBatteryDispatch,
  type BatteryDispatchConfig,
  type BatteryDispatchResult,
} from '@house-technical-designer/battery';

export type EnergyVector =
  'ELECTRICITY' | 'GAS' | 'WOOD' | 'DISTRICT_HEAT' | 'SOLAR' | 'OTHER';

export interface EnergySeries {
  readonly timestepSeconds: number;
  readonly start: string;
  readonly unit: 'Wh';
  readonly values: readonly (number | undefined)[];
}

export interface EnergyUse {
  readonly id: string;
  readonly usage: string;
  readonly vector: EnergyVector;
  readonly series: EnergySeries;
}

export interface EnergyBalanceInput {
  readonly scenarioId: string;
  readonly uses: readonly EnergyUse[];
  readonly pvElectricity?: EnergySeries;
  readonly battery?: BatteryDispatchConfig;
  readonly offGrid: boolean;
}

export interface EnergyBalanceResult {
  readonly status: 'OK' | 'UNKNOWN' | 'INVALID';
  readonly methodId: 'physical-energy-balance-v1';
  readonly scenarioId: string;
  readonly totalByUsageWh?: Readonly<Record<string, number>>;
  readonly totalByVectorWh?: Readonly<Record<EnergyVector, number>>;
  readonly totalElectricLoadWh?: number;
  readonly totalPvWh?: number;
  readonly peakElectricPowerW?: number;
  readonly batteryDispatch?: BatteryDispatchResult;
  readonly gridImportWh?: number;
  readonly gridExportWh?: number;
  readonly unservedEnergyWh?: number;
  readonly selfConsumptionRatio?: number;
  readonly selfSufficiencyRatio?: number;
  readonly conservationResidualWh?: number;
  readonly diagnostics: readonly EnergyBalanceDiagnostic[];
}

export interface EnergyBalanceDiagnostic {
  readonly code:
    | 'ENERGY_INVALID_INPUT'
    | 'ENERGY_MISALIGNED_SERIES'
    | 'ENERGY_UNKNOWN_VALUE'
    | 'ENERGY_DUPLICATE_USE';
  readonly path: string;
  readonly message: string;
}

export interface PrimaryEnergyResult {
  readonly methodId: string;
  readonly totalPrimaryEnergyWh: number;
  readonly byVectorWh: Readonly<Record<string, number>>;
}

export function calculateEnergyBalance(
  input: EnergyBalanceInput,
): EnergyBalanceResult {
  const diagnostics = validateInput(input);
  const base = {
    methodId: 'physical-energy-balance-v1' as const,
    scenarioId: input.scenarioId,
    diagnostics,
  };
  if (
    diagnostics.some(({ code }) =>
      [
        'ENERGY_INVALID_INPUT',
        'ENERGY_MISALIGNED_SERIES',
        'ENERGY_DUPLICATE_USE',
      ].includes(code),
    )
  )
    return { ...base, status: 'INVALID' };
  if (diagnostics.length > 0) return { ...base, status: 'UNKNOWN' };

  const reference = input.uses[0]!.series;
  const totalByUsageWh = input.uses.reduce<Record<string, number>>(
    (totals, use) => ({
      ...totals,
      [use.usage]: (totals[use.usage] ?? 0) + sumKnown(use.series.values),
    }),
    {},
  );
  const vectorEntries = allVectors().map(
    (vector) =>
      [
        vector,
        input.uses
          .filter((use) => use.vector === vector)
          .reduce((total, use) => total + sumKnown(use.series.values), 0),
      ] as const,
  );
  const totalByVectorWh = Object.fromEntries(vectorEntries) as Record<
    EnergyVector,
    number
  >;
  const electricUses = input.uses.filter(
    ({ vector }) => vector === 'ELECTRICITY',
  );
  const electricLoadWh = reference.values.map((_, index) =>
    electricUses.reduce(
      (total, use) => total + requiredValue(use.series.values[index]),
      0,
    ),
  );
  const pvWh =
    input.pvElectricity?.values.map(requiredValue) ??
    reference.values.map(() => 0);
  const batteryDispatch = simulateBatteryDispatch({
    timeStepHours: reference.timestepSeconds / 3_600,
    periods: reference.values.map((_, index) => `${reference.start}#${index}`),
    loadKWh: electricLoadWh.map((value) => value / 1_000),
    pvKWh: pvWh.map((value) => value / 1_000),
    ...(input.battery === undefined ? {} : { battery: input.battery }),
    offGrid: input.offGrid,
  });
  if (batteryDispatch.status !== 'OK')
    return {
      ...base,
      status: batteryDispatch.status === 'UNKNOWN' ? 'UNKNOWN' : 'INVALID',
      diagnostics: [
        {
          code: 'ENERGY_INVALID_INPUT',
          path: 'battery',
          message: 'Battery dispatch configuration is invalid or incomplete.',
        },
      ],
    };
  const conservationResidualWh = conservationResidual(batteryDispatch, pvWh);
  return {
    ...base,
    status: 'OK',
    totalByUsageWh,
    totalByVectorWh,
    totalElectricLoadWh: sumKnown(electricLoadWh),
    totalPvWh: sumKnown(pvWh),
    peakElectricPowerW:
      Math.max(...electricLoadWh) / (reference.timestepSeconds / 3_600),
    batteryDispatch,
    gridImportWh: batteryDispatch.gridImportKWh! * 1_000,
    gridExportWh: batteryDispatch.gridExportKWh! * 1_000,
    unservedEnergyWh: batteryDispatch.unservedEnergyKWh! * 1_000,
    ...(batteryDispatch.selfConsumptionRatio === undefined
      ? {}
      : { selfConsumptionRatio: batteryDispatch.selfConsumptionRatio }),
    ...(batteryDispatch.selfSufficiencyRatio === undefined
      ? {}
      : { selfSufficiencyRatio: batteryDispatch.selfSufficiencyRatio }),
    conservationResidualWh,
    diagnostics: [],
  };
}

/** Regulatory/primary-energy factors are supplied externally and never alter physical kWh. */
export function calculatePrimaryEnergy(
  balance: EnergyBalanceResult,
  methodId: string,
  factors: Readonly<Partial<Record<EnergyVector, number>>>,
): PrimaryEnergyResult {
  if (balance.status !== 'OK' || balance.totalByVectorWh === undefined)
    throw new RangeError('Primary energy requires a complete physical balance');
  if (methodId.trim() === '')
    throw new TypeError('Primary-energy method ID must not be empty');
  const byVectorWh: Record<string, number> = {};
  for (const vector of allVectors()) {
    const finalEnergy = balance.totalByVectorWh[vector];
    if (finalEnergy === 0) continue;
    const factor = factors[vector];
    if (factor === undefined || !Number.isFinite(factor) || factor < 0)
      throw new RangeError(
        `Primary-energy factor for ${vector} is missing or invalid`,
      );
    byVectorWh[vector] = finalEnergy * factor;
  }
  return {
    methodId,
    totalPrimaryEnergyWh: Object.values(byVectorWh).reduce(
      (total, value) => total + value,
      0,
    ),
    byVectorWh,
  };
}

function validateInput(input: EnergyBalanceInput): EnergyBalanceDiagnostic[] {
  const diagnostics: EnergyBalanceDiagnostic[] = [];
  if (input.scenarioId.trim() === '' || input.uses.length === 0)
    diagnostics.push({
      code: 'ENERGY_INVALID_INPUT',
      path: 'input',
      message: 'Scenario ID and at least one energy use are required.',
    });
  const ids = new Set<string>();
  input.uses.forEach((use, index) => {
    if (ids.has(use.id))
      diagnostics.push({
        code: 'ENERGY_DUPLICATE_USE',
        path: `uses[${index}].id`,
        message: `Duplicate energy use ${use.id} would double-count energy.`,
      });
    ids.add(use.id);
    if (use.id.trim() === '' || use.usage.trim() === '')
      diagnostics.push({
        code: 'ENERGY_INVALID_INPUT',
        path: `uses[${index}]`,
        message: 'Energy use ID and usage must not be empty.',
      });
  });
  const series = [
    ...input.uses.map(({ series: value }) => value),
    ...(input.pvElectricity === undefined ? [] : [input.pvElectricity]),
  ];
  const reference = series[0];
  if (reference !== undefined) {
    series.forEach((value, index) => {
      if (
        !Number.isFinite(value.timestepSeconds) ||
        value.timestepSeconds <= 0 ||
        value.start.trim() === '' ||
        value.values.length === 0
      )
        diagnostics.push({
          code: 'ENERGY_INVALID_INPUT',
          path: `series[${index}]`,
          message: 'Energy series metadata and values must be valid.',
        });
      if (
        value.timestepSeconds !== reference.timestepSeconds ||
        value.start !== reference.start ||
        value.values.length !== reference.values.length
      )
        diagnostics.push({
          code: 'ENERGY_MISALIGNED_SERIES',
          path: `series[${index}]`,
          message:
            'Energy series must have identical start, time step, and length.',
        });
      value.values.forEach((entry, valueIndex) => {
        if (entry === undefined)
          diagnostics.push({
            code: 'ENERGY_UNKNOWN_VALUE',
            path: `series[${index}].values[${valueIndex}]`,
            message: 'Energy value is unknown.',
          });
        else if (!Number.isFinite(entry) || entry < 0)
          diagnostics.push({
            code: 'ENERGY_INVALID_INPUT',
            path: `series[${index}].values[${valueIndex}]`,
            message: 'Energy values must be finite and non-negative.',
          });
      });
    });
  }
  return diagnostics;
}

function conservationResidual(
  dispatch: BatteryDispatchResult,
  pvWh: readonly number[],
): number {
  const inputKWh =
    dispatch.initialStoredEnergyKWh! +
    sumKnown(pvWh) / 1_000 +
    dispatch.gridImportKWh!;
  const servedLoadKWh = dispatch.steps.reduce(
    (total, step) => total + step.servedLoadKWh,
    0,
  );
  const outputKWh =
    dispatch.finalStoredEnergyKWh! +
    servedLoadKWh +
    dispatch.gridExportKWh! +
    dispatch.chargeLossKWh! +
    dispatch.dischargeLossKWh!;
  return (inputKWh - outputKWh) * 1_000;
}

function requiredValue(value: number | undefined): number {
  if (value === undefined) throw new Error('Expected validated energy value');
  return value;
}

function sumKnown(values: readonly (number | undefined)[]): number {
  return values.reduce<number>(
    (total, value) => total + requiredValue(value),
    0,
  );
}

function allVectors(): readonly EnergyVector[] {
  return ['ELECTRICITY', 'GAS', 'WOOD', 'DISTRICT_HEAT', 'SOLAR', 'OTHER'];
}
