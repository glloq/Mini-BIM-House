export const CO2_BALANCE_METHOD_ID = 'well-mixed-co2-analytical-v1' as const;

export interface Co2BalanceInput {
  readonly roomId: string;
  readonly roomVolumeM3: number;
  readonly timeStepSeconds: number;
  readonly initialConcentrationPpm?: number;
  readonly outdoorConcentrationPpm?: number;
  /** CO2 volume generation at each step, expressed in m3/s. */
  readonly generationM3s: readonly (number | undefined)[];
  readonly ventilationFlowM3h: readonly (number | undefined)[];
  readonly timestamps?: readonly string[];
}

export interface Co2BalanceStep {
  readonly index: number;
  readonly timestamp?: string;
  readonly generationM3s: number;
  readonly ventilationFlowM3h: number;
  readonly concentrationStartPpm: number;
  readonly concentrationEndPpm: number;
}

export interface Co2BalanceResult {
  readonly status: 'OK' | 'UNKNOWN' | 'INVALID';
  readonly roomId: string;
  readonly methodId: typeof CO2_BALANCE_METHOD_ID;
  readonly steps: readonly Co2BalanceStep[];
  readonly meanConcentrationPpm?: number;
  readonly maximumConcentrationPpm?: number;
  readonly finalConcentrationPpm?: number;
  readonly diagnostics: readonly Co2BalanceDiagnostic[];
}

export interface Co2BalanceDiagnostic {
  readonly code:
    | 'IAQ_INVALID_INPUT'
    | 'IAQ_UNKNOWN_INITIAL_CONCENTRATION'
    | 'IAQ_UNKNOWN_OUTDOOR_CONCENTRATION'
    | 'IAQ_UNKNOWN_GENERATION'
    | 'IAQ_UNKNOWN_VENTILATION_FLOW';
  readonly path: string;
  readonly message: string;
}

export function simulateCo2Balance(input: Co2BalanceInput): Co2BalanceResult {
  const diagnostics = validateInput(input);
  const base = {
    roomId: input.roomId,
    methodId: CO2_BALANCE_METHOD_ID,
    steps: [] as readonly Co2BalanceStep[],
    diagnostics,
  };
  if (diagnostics.some(({ code }) => code === 'IAQ_INVALID_INPUT'))
    return { ...base, status: 'INVALID' };
  if (diagnostics.length > 0) return { ...base, status: 'UNKNOWN' };

  const outdoorFraction = ppmToFraction(input.outdoorConcentrationPpm!);
  let concentrationFraction = ppmToFraction(input.initialConcentrationPpm!);
  const steps: Co2BalanceStep[] = [];
  for (let index = 0; index < input.generationM3s.length; index += 1) {
    const generationM3s = input.generationM3s[index]!;
    const ventilationFlowM3h = input.ventilationFlowM3h[index]!;
    const start = concentrationFraction;
    concentrationFraction = nextConcentrationFraction(
      start,
      outdoorFraction,
      generationM3s,
      ventilationFlowM3h / 3_600,
      input.roomVolumeM3,
      input.timeStepSeconds,
    );
    if (concentrationFraction > 1)
      return {
        roomId: input.roomId,
        methodId: CO2_BALANCE_METHOD_ID,
        status: 'INVALID',
        steps,
        diagnostics: [
          {
            code: 'IAQ_INVALID_INPUT',
            path: `steps[${index}]`,
            message:
              'The simplified balance produced a CO2 fraction above 1; inputs are outside the physical model domain.',
          },
        ],
      };
    steps.push({
      index,
      ...(input.timestamps === undefined
        ? {}
        : { timestamp: input.timestamps[index]! }),
      generationM3s,
      ventilationFlowM3h,
      concentrationStartPpm: fractionToPpm(start),
      concentrationEndPpm: fractionToPpm(concentrationFraction),
    });
  }
  const endValues = steps.map(({ concentrationEndPpm }) => concentrationEndPpm);
  return {
    roomId: input.roomId,
    methodId: CO2_BALANCE_METHOD_ID,
    status: 'OK',
    steps,
    meanConcentrationPpm:
      endValues.reduce((total, value) => total + value, 0) / endValues.length,
    maximumConcentrationPpm: Math.max(...endValues),
    finalConcentrationPpm: endValues.at(-1)!,
    diagnostics: [],
  };
}

/** Exact solution over a step with constant generation and ventilation. */
export function nextConcentrationFraction(
  concentration: number,
  outdoorConcentration: number,
  generationM3s: number,
  ventilationFlowM3s: number,
  roomVolumeM3: number,
  timeStepSeconds: number,
): number {
  validateFraction(concentration, 'concentration');
  validateFraction(outdoorConcentration, 'outdoor concentration');
  nonNegative(generationM3s, 'generation');
  nonNegative(ventilationFlowM3s, 'ventilation flow');
  positive(roomVolumeM3, 'room volume');
  positive(timeStepSeconds, 'time step');
  if (ventilationFlowM3s === 0)
    return concentration + (generationM3s / roomVolumeM3) * timeStepSeconds;
  const equilibrium = outdoorConcentration + generationM3s / ventilationFlowM3s;
  return (
    equilibrium +
    (concentration - equilibrium) *
      Math.exp((-ventilationFlowM3s / roomVolumeM3) * timeStepSeconds)
  );
}

function validateInput(input: Co2BalanceInput): Co2BalanceDiagnostic[] {
  const diagnostics: Co2BalanceDiagnostic[] = [];
  const count = input.generationM3s.length;
  if (
    input.roomId.trim() === '' ||
    !finitePositive(input.roomVolumeM3) ||
    !finitePositive(input.timeStepSeconds) ||
    count === 0 ||
    input.ventilationFlowM3h.length !== count ||
    (input.timestamps !== undefined && input.timestamps.length !== count) ||
    input.generationM3s.some(
      (value) => value !== undefined && !finiteNonNegative(value),
    ) ||
    input.ventilationFlowM3h.some(
      (value) => value !== undefined && !finiteNonNegative(value),
    ) ||
    (input.initialConcentrationPpm !== undefined &&
      !validPpm(input.initialConcentrationPpm)) ||
    (input.outdoorConcentrationPpm !== undefined &&
      !validPpm(input.outdoorConcentrationPpm))
  )
    diagnostics.push({
      code: 'IAQ_INVALID_INPUT',
      path: 'input',
      message:
        'Room, time step, concentrations, series lengths, generation, and airflow must be finite and physically valid.',
    });
  if (input.initialConcentrationPpm === undefined)
    diagnostics.push({
      code: 'IAQ_UNKNOWN_INITIAL_CONCENTRATION',
      path: 'initialConcentrationPpm',
      message: 'Initial CO2 concentration is unknown.',
    });
  if (input.outdoorConcentrationPpm === undefined)
    diagnostics.push({
      code: 'IAQ_UNKNOWN_OUTDOOR_CONCENTRATION',
      path: 'outdoorConcentrationPpm',
      message: 'Outdoor CO2 concentration is unknown.',
    });
  input.generationM3s.forEach((value, index) => {
    if (value === undefined)
      diagnostics.push({
        code: 'IAQ_UNKNOWN_GENERATION',
        path: `generationM3s[${index}]`,
        message: 'CO2 generation is unknown.',
      });
  });
  input.ventilationFlowM3h.forEach((value, index) => {
    if (value === undefined)
      diagnostics.push({
        code: 'IAQ_UNKNOWN_VENTILATION_FLOW',
        path: `ventilationFlowM3h[${index}]`,
        message: 'Ventilation airflow is unknown.',
      });
  });
  return diagnostics;
}

function ppmToFraction(value: number): number {
  return value / 1_000_000;
}

function fractionToPpm(value: number): number {
  return value * 1_000_000;
}

function validPpm(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000;
}

function validateFraction(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new RangeError(`${name} must be a fraction in [0, 1]`);
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function positive(value: number, name: string): void {
  if (!finitePositive(value))
    throw new RangeError(`${name} must be finite and positive`);
}

function nonNegative(value: number, name: string): void {
  if (!finiteNonNegative(value))
    throw new RangeError(`${name} must be finite and non-negative`);
}
