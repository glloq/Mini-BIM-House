export const BATTERY_DISPATCH_METHOD_ID =
  'pv-self-consumption-dispatch-v1' as const;

export interface BatteryDispatchConfig {
  readonly usableCapacityKWh: number;
  readonly minimumSoc: number;
  readonly maximumSoc: number;
  readonly initialSoc: number;
  readonly maxChargePowerKW: number;
  readonly maxDischargePowerKW: number;
  readonly chargeEfficiency: number;
  readonly dischargeEfficiency: number;
}

export interface BatteryDispatchInput {
  readonly timeStepHours: number;
  readonly periods: readonly string[];
  readonly loadKWh: readonly (number | undefined)[];
  readonly pvKWh: readonly (number | undefined)[];
  readonly battery?: BatteryDispatchConfig;
  readonly offGrid: boolean;
}

export interface BatteryDispatchStep {
  readonly index: number;
  readonly period: string;
  readonly loadKWh: number;
  readonly servedLoadKWh: number;
  readonly pvKWh: number;
  readonly pvDirectKWh: number;
  readonly batteryChargeInputKWh: number;
  readonly batteryEnergyStoredKWh: number;
  readonly batteryEnergyWithdrawnKWh: number;
  readonly batteryDischargeOutputKWh: number;
  readonly chargeLossKWh: number;
  readonly dischargeLossKWh: number;
  readonly gridImportKWh: number;
  readonly gridExportKWh: number;
  readonly unservedEnergyKWh: number;
  readonly storedEnergyKWh: number;
  readonly stateOfCharge: number;
}

export interface BatteryDispatchResult {
  readonly status: 'OK' | 'UNKNOWN' | 'INVALID';
  readonly methodId: typeof BATTERY_DISPATCH_METHOD_ID;
  readonly steps: readonly BatteryDispatchStep[];
  readonly initialStoredEnergyKWh?: number;
  readonly finalStoredEnergyKWh?: number;
  readonly gridImportKWh?: number;
  readonly gridExportKWh?: number;
  readonly unservedEnergyKWh?: number;
  readonly chargeLossKWh?: number;
  readonly dischargeLossKWh?: number;
  readonly batteryChargeInputKWh?: number;
  readonly batteryDischargeOutputKWh?: number;
  readonly selfConsumptionRatio?: number;
  readonly selfSufficiencyRatio?: number;
  readonly equivalentFullCycles?: number;
  readonly minimumObservedSoc?: number;
  readonly maximumObservedSoc?: number;
  readonly diagnostics: readonly BatteryDispatchDiagnostic[];
}

export interface BatteryDispatchDiagnostic {
  readonly code: 'BAT_INVALID_INPUT' | 'BAT_UNKNOWN_LOAD' | 'BAT_UNKNOWN_PV';
  readonly path: string;
  readonly message: string;
}

export function simulateBatteryDispatch(
  input: BatteryDispatchInput,
): BatteryDispatchResult {
  const diagnostics = validateInput(input);
  const base = {
    methodId: BATTERY_DISPATCH_METHOD_ID,
    steps: [] as readonly BatteryDispatchStep[],
    diagnostics,
  };
  if (diagnostics.some(({ code }) => code === 'BAT_INVALID_INPUT'))
    return { ...base, status: 'INVALID' };
  if (diagnostics.length > 0) return { ...base, status: 'UNKNOWN' };

  const battery = input.battery;
  const initialStoredEnergyKWh =
    battery === undefined ? 0 : battery.initialSoc * battery.usableCapacityKWh;
  let storedEnergyKWh = initialStoredEnergyKWh;
  const minimumEnergyKWh =
    battery === undefined ? 0 : battery.minimumSoc * battery.usableCapacityKWh;
  const maximumEnergyKWh =
    battery === undefined ? 0 : battery.maximumSoc * battery.usableCapacityKWh;
  const steps: BatteryDispatchStep[] = [];
  for (let index = 0; index < input.periods.length; index += 1) {
    const loadKWh = input.loadKWh[index]!;
    const pvKWh = input.pvKWh[index]!;
    const pvDirectKWh = Math.min(loadKWh, pvKWh);
    const surplusKWh = pvKWh - pvDirectKWh;
    const deficitKWh = loadKWh - pvDirectKWh;

    const maximumChargeInputKWh =
      battery === undefined
        ? 0
        : Math.min(
            battery.maxChargePowerKW * input.timeStepHours,
            (maximumEnergyKWh - storedEnergyKWh) / battery.chargeEfficiency,
          );
    const batteryChargeInputKWh = Math.min(
      surplusKWh,
      Math.max(0, maximumChargeInputKWh),
    );
    const batteryEnergyStoredKWh =
      battery === undefined
        ? 0
        : batteryChargeInputKWh * battery.chargeEfficiency;
    const chargeLossKWh = batteryChargeInputKWh - batteryEnergyStoredKWh;
    storedEnergyKWh += batteryEnergyStoredKWh;
    storedEnergyKWh = Math.min(storedEnergyKWh, maximumEnergyKWh);

    const maximumDischargeOutputKWh =
      battery === undefined
        ? 0
        : Math.min(
            battery.maxDischargePowerKW * input.timeStepHours,
            (storedEnergyKWh - minimumEnergyKWh) * battery.dischargeEfficiency,
          );
    const batteryDischargeOutputKWh = Math.min(
      deficitKWh,
      Math.max(0, maximumDischargeOutputKWh),
    );
    const batteryEnergyWithdrawnKWh =
      battery === undefined
        ? 0
        : batteryDischargeOutputKWh / battery.dischargeEfficiency;
    const dischargeLossKWh =
      batteryEnergyWithdrawnKWh - batteryDischargeOutputKWh;
    storedEnergyKWh -= batteryEnergyWithdrawnKWh;
    storedEnergyKWh = Math.max(storedEnergyKWh, minimumEnergyKWh);

    const remainingDeficitKWh = deficitKWh - batteryDischargeOutputKWh;
    const gridImportKWh = input.offGrid ? 0 : remainingDeficitKWh;
    const unservedEnergyKWh = input.offGrid ? remainingDeficitKWh : 0;
    const gridExportKWh = surplusKWh - batteryChargeInputKWh;
    steps.push({
      index,
      period: input.periods[index]!,
      loadKWh,
      servedLoadKWh: loadKWh - unservedEnergyKWh,
      pvKWh,
      pvDirectKWh,
      batteryChargeInputKWh,
      batteryEnergyStoredKWh,
      batteryEnergyWithdrawnKWh,
      batteryDischargeOutputKWh,
      chargeLossKWh,
      dischargeLossKWh,
      gridImportKWh,
      gridExportKWh,
      unservedEnergyKWh,
      storedEnergyKWh,
      stateOfCharge:
        battery === undefined ? 0 : storedEnergyKWh / battery.usableCapacityKWh,
    });
  }
  return {
    status: 'OK',
    methodId: BATTERY_DISPATCH_METHOD_ID,
    steps,
    initialStoredEnergyKWh,
    finalStoredEnergyKWh: storedEnergyKWh,
    gridImportKWh: sum(steps, 'gridImportKWh'),
    gridExportKWh: sum(steps, 'gridExportKWh'),
    unservedEnergyKWh: sum(steps, 'unservedEnergyKWh'),
    chargeLossKWh: sum(steps, 'chargeLossKWh'),
    dischargeLossKWh: sum(steps, 'dischargeLossKWh'),
    batteryChargeInputKWh: sum(steps, 'batteryChargeInputKWh'),
    batteryDischargeOutputKWh: sum(steps, 'batteryDischargeOutputKWh'),
    ...ratioIndicators(steps),
    ...(battery === undefined
      ? {}
      : {
          equivalentFullCycles:
            sum(steps, 'batteryEnergyWithdrawnKWh') / battery.usableCapacityKWh,
          minimumObservedSoc: Math.min(
            battery.initialSoc,
            ...steps.map(({ stateOfCharge }) => stateOfCharge),
          ),
          maximumObservedSoc: Math.max(
            battery.initialSoc,
            ...steps.map(({ stateOfCharge }) => stateOfCharge),
          ),
        }),
    diagnostics: [],
  };
}

function validateInput(
  input: BatteryDispatchInput,
): BatteryDispatchDiagnostic[] {
  const diagnostics: BatteryDispatchDiagnostic[] = [];
  const count = input.periods.length;
  if (
    !finitePositive(input.timeStepHours) ||
    count === 0 ||
    input.loadKWh.length !== count ||
    input.pvKWh.length !== count ||
    new Set(input.periods).size !== count ||
    input.periods.some((period) => period.trim() === '') ||
    input.loadKWh.some(
      (value) => value !== undefined && !finiteNonNegative(value),
    ) ||
    input.pvKWh.some(
      (value) => value !== undefined && !finiteNonNegative(value),
    ) ||
    (input.battery !== undefined && !validBattery(input.battery))
  )
    diagnostics.push({
      code: 'BAT_INVALID_INPUT',
      path: 'input',
      message:
        'Time step, periods, energy series, and battery limits must be finite and physically valid.',
    });
  input.loadKWh.forEach((value, index) => {
    if (value === undefined)
      diagnostics.push({
        code: 'BAT_UNKNOWN_LOAD',
        path: `loadKWh[${index}]`,
        message: 'Electrical load is unknown.',
      });
  });
  input.pvKWh.forEach((value, index) => {
    if (value === undefined)
      diagnostics.push({
        code: 'BAT_UNKNOWN_PV',
        path: `pvKWh[${index}]`,
        message: 'PV generation is unknown.',
      });
  });
  return diagnostics;
}

function validBattery(battery: BatteryDispatchConfig): boolean {
  return (
    finitePositive(battery.usableCapacityKWh) &&
    finiteNonNegative(battery.maxChargePowerKW) &&
    finiteNonNegative(battery.maxDischargePowerKW) &&
    validEfficiency(battery.chargeEfficiency) &&
    validEfficiency(battery.dischargeEfficiency) &&
    validSoc(battery.minimumSoc) &&
    validSoc(battery.maximumSoc) &&
    validSoc(battery.initialSoc) &&
    battery.minimumSoc <= battery.initialSoc &&
    battery.initialSoc <= battery.maximumSoc &&
    battery.minimumSoc < battery.maximumSoc
  );
}

function validEfficiency(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1;
}

function validSoc(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function sum(
  steps: readonly BatteryDispatchStep[],
  property: keyof BatteryDispatchStep,
): number {
  return steps.reduce((total, step) => total + (step[property] as number), 0);
}

function ratioIndicators(
  steps: readonly BatteryDispatchStep[],
): Pick<
  BatteryDispatchResult,
  'selfConsumptionRatio' | 'selfSufficiencyRatio'
> {
  const pvKWh = sum(steps, 'pvKWh');
  const loadKWh = sum(steps, 'loadKWh');
  const pvUsedKWh =
    sum(steps, 'pvDirectKWh') + sum(steps, 'batteryChargeInputKWh');
  const locallyServedLoadKWh =
    sum(steps, 'pvDirectKWh') + sum(steps, 'batteryDischargeOutputKWh');
  return {
    ...(pvKWh === 0 ? {} : { selfConsumptionRatio: pvUsedKWh / pvKWh }),
    ...(loadKWh === 0
      ? {}
      : { selfSufficiencyRatio: locallyServedLoadKWh / loadKWh }),
  };
}
