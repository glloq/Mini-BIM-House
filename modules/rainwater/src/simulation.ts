import {
  validateClimateDataset,
  type ClimateDataset,
} from '@house-technical-designer/climate';

export interface RainCollectionSurface {
  readonly surfaceId: string;
  readonly projectedAreaM2: number;
  readonly runoffCoefficient: number;
  readonly preFilterEfficiency: number;
  readonly enabled: boolean;
}

export interface RainwaterDemand {
  readonly useType: string;
  readonly demandSeriesL: readonly number[];
  readonly regulatoryClass?: string;
}

export interface RainwaterTank {
  readonly nominalVolumeL: number;
  /** Optional operating reserve; omission explicitly means no reserve. */
  readonly minimumVolumeL?: number;
  readonly initialVolumeL?: number;
  readonly overflowDestination?: string;
}

export interface RainwaterSimulationInput {
  readonly climate: ClimateDataset;
  readonly surfaces: readonly RainCollectionSurface[];
  readonly demands: readonly RainwaterDemand[];
  /** Explicit series: pass zeroes when no mains top-up is configured. */
  readonly mainsTopUpSeriesL: readonly number[];
  readonly tank: RainwaterTank;
}

export interface RainwaterStep {
  readonly timestamp: string;
  readonly precipitationMm: number;
  readonly collectedL: number;
  readonly demandL: number;
  readonly mainsTopUpL: number;
  readonly servedL: number;
  readonly shortageL: number;
  readonly storageL: number;
  readonly overflowL: number;
}

export interface RainwaterIndicators {
  readonly collectedL: number;
  readonly demandL: number;
  readonly servedL: number;
  readonly mainsTopUpL: number;
  readonly shortageL: number;
  readonly overflowL: number;
  readonly coverageRatio?: number;
  readonly utilizationRatio?: number;
  readonly emptyStepCount: number;
  readonly overflowStepCount: number;
}

export interface RainwaterSimulationResult {
  readonly status: 'OK' | 'UNKNOWN' | 'INVALID';
  readonly steps: readonly RainwaterStep[];
  readonly indicators?: RainwaterIndicators;
  readonly diagnostics: readonly RainwaterDiagnostic[];
}

export interface RainwaterDiagnostic {
  readonly code:
    | 'RAIN_INVALID_INPUT'
    | 'RAIN_MISSING_INITIAL_VOLUME'
    | 'RAIN_MISSING_PRECIPITATION'
    | 'RAIN_UNSUPPORTED_CLIMATE';
  readonly path: string;
  readonly message: string;
}

/** Converts rainfall to collected volume using the identity 1 mm × 1 m² = 1 L. */
export function collectedVolumeL(
  precipitationMm: number,
  surfaces: readonly RainCollectionSurface[],
): number {
  assertFiniteNonNegative(precipitationMm, 'precipitationMm');
  return surfaces.reduce((total, surface, index) => {
    validateSurface(surface, index);
    return surface.enabled
      ? total +
          precipitationMm *
            surface.projectedAreaM2 *
            surface.runoffCoefficient *
            surface.preFilterEfficiency
      : total;
  }, 0);
}

export function simulateRainwater(
  input: RainwaterSimulationInput,
): RainwaterSimulationResult {
  const diagnostics = validateInput(input);
  if (diagnostics.some(({ code }) => code === 'RAIN_INVALID_INPUT'))
    return { status: 'INVALID', steps: [], diagnostics };
  if (diagnostics.length > 0)
    return { status: 'UNKNOWN', steps: [], diagnostics };

  let storageL = input.tank.initialVolumeL!;
  const minimumVolumeL = input.tank.minimumVolumeL ?? 0;
  const steps: RainwaterStep[] = input.climate.samples.map((sample, index) => {
    const collectedL = collectedVolumeL(
      sample.precipitationMm!,
      input.surfaces,
    );
    const demandL = input.demands.reduce(
      (total, demand) => total + demand.demandSeriesL[index]!,
      0,
    );
    const mainsTopUpL = input.mainsTopUpSeriesL[index]!;
    const availableL = storageL + collectedL + mainsTopUpL;
    const drawableL = Math.max(0, availableL - minimumVolumeL);
    const servedL = Math.min(demandL, drawableL);
    const shortageL = demandL - servedL;
    const afterDemandL = availableL - servedL;
    const overflowL = Math.max(0, afterDemandL - input.tank.nominalVolumeL);
    storageL = Math.min(afterDemandL, input.tank.nominalVolumeL);
    return {
      timestamp: sample.timestamp!,
      precipitationMm: sample.precipitationMm!,
      collectedL,
      demandL,
      mainsTopUpL,
      servedL,
      shortageL,
      storageL,
      overflowL,
    };
  });
  return {
    status: 'OK',
    steps,
    indicators: aggregateIndicators(steps, input.tank.initialVolumeL!),
    diagnostics: [],
  };
}

function validateInput(input: RainwaterSimulationInput): RainwaterDiagnostic[] {
  const diagnostics: RainwaterDiagnostic[] = [];
  const climateIssues = validateClimateDataset(input.climate);
  if (climateIssues.length > 0)
    diagnostics.push(
      invalidDiagnostic(
        `Climate dataset is invalid: ${climateIssues
          .map(({ path, message }) => `${path}: ${message}`)
          .join('; ')}`,
      ),
    );
  if (!['HOURLY', 'DAILY', 'MONTHLY'].includes(input.climate.resolution))
    diagnostics.push({
      code: 'RAIN_UNSUPPORTED_CLIMATE',
      path: 'climate.resolution',
      message:
        'Rainwater simulation requires an hourly, daily, or monthly series.',
    });
  if (input.tank.initialVolumeL === undefined)
    diagnostics.push({
      code: 'RAIN_MISSING_INITIAL_VOLUME',
      path: 'tank.initialVolumeL',
      message: 'Initial tank volume must be stated explicitly.',
    });
  input.climate.samples.forEach((sample, index) => {
    if (sample.precipitationMm === undefined)
      diagnostics.push({
        code: 'RAIN_MISSING_PRECIPITATION',
        path: `climate.samples[${index}].precipitationMm`,
        message: 'Missing precipitation is unknown, not zero.',
      });
  });
  const count = input.climate.samples.length;
  const invalid =
    count === 0 ||
    input.mainsTopUpSeriesL.length !== count ||
    input.demands.some(({ demandSeriesL }) => demandSeriesL.length !== count) ||
    !validNonNegative(input.tank.nominalVolumeL) ||
    (input.tank.initialVolumeL !== undefined &&
      (!validNonNegative(input.tank.initialVolumeL) ||
        input.tank.initialVolumeL > input.tank.nominalVolumeL)) ||
    (input.tank.minimumVolumeL !== undefined &&
      (!validNonNegative(input.tank.minimumVolumeL) ||
        input.tank.minimumVolumeL > input.tank.nominalVolumeL)) ||
    input.mainsTopUpSeriesL.some((value) => !validNonNegative(value)) ||
    input.demands.some(
      ({ useType, demandSeriesL }) =>
        useType.trim() === '' ||
        demandSeriesL.some((value) => !validNonNegative(value)),
    );
  try {
    input.surfaces.forEach(validateSurface);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    diagnostics.push(invalidDiagnostic(error.message));
  }
  if (invalid)
    diagnostics.push(
      invalidDiagnostic(
        'Series lengths must match climate samples and volumes must be finite, non-negative, and within tank capacity.',
      ),
    );
  return diagnostics;
}

function aggregateIndicators(
  steps: readonly RainwaterStep[],
  initialVolumeL: number,
): RainwaterIndicators {
  const sum = (property: keyof RainwaterStep): number =>
    steps.reduce((total, step) => total + (step[property] as number), 0);
  const demandL = sum('demandL');
  const servedL = sum('servedL');
  const collectedL = sum('collectedL');
  return {
    collectedL,
    demandL,
    servedL,
    mainsTopUpL: sum('mainsTopUpL'),
    shortageL: sum('shortageL'),
    overflowL: sum('overflowL'),
    ...(demandL > 0 ? { coverageRatio: servedL / demandL } : {}),
    ...(collectedL > 0 &&
    initialVolumeL === 0 &&
    steps.every(({ mainsTopUpL }) => mainsTopUpL === 0)
      ? { utilizationRatio: servedL / collectedL }
      : {}),
    emptyStepCount: steps.filter(({ storageL }) => storageL === 0).length,
    overflowStepCount: steps.filter(({ overflowL }) => overflowL > 0).length,
  };
}

function validateSurface(surface: RainCollectionSurface, index: number): void {
  if (
    surface.surfaceId.trim() === '' ||
    !validNonNegative(surface.projectedAreaM2) ||
    !validRatio(surface.runoffCoefficient) ||
    !validRatio(surface.preFilterEfficiency)
  )
    throw new RangeError(
      `surfaces[${index}] has invalid geometry or efficiency`,
    );
}

function validRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!validNonNegative(value))
    throw new RangeError(`${name} must be finite and non-negative`);
}

function invalidDiagnostic(message: string): RainwaterDiagnostic {
  return { code: 'RAIN_INVALID_INPUT', path: 'input', message };
}
