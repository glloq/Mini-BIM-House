import {
  simulateRainwater,
  type RainwaterSimulationInput,
  type RainwaterSimulationResult,
} from './simulation.js';

export interface RainwaterTankSolverInput {
  readonly simulation: Omit<RainwaterSimulationInput, 'tank'>;
  readonly candidateVolumesL: readonly number[];
  /** Explicit initial fill ratio applied identically to every candidate. */
  readonly initialFillRatio: number;
  readonly minimumVolumeRatio?: number;
}

export interface RainwaterTankCandidateResult {
  readonly nominalVolumeL: number;
  readonly initialVolumeL: number;
  readonly status: RainwaterSimulationResult['status'];
  readonly coverageRatio?: number;
  readonly overflowL?: number;
  readonly shortageL?: number;
  readonly capacityDeltaL?: number;
  readonly marginalCoverageGain?: number;
  readonly simulation: RainwaterSimulationResult;
}

export interface RainwaterTankSolverResult {
  readonly status: RainwaterSimulationResult['status'];
  readonly candidates: readonly RainwaterTankCandidateResult[];
  readonly diagnostics: readonly RainwaterTankSolverDiagnostic[];
}

export interface RainwaterTankSolverDiagnostic {
  readonly code: 'RAIN_TANK_SOLVER_INVALID_INPUT';
  readonly path: string;
  readonly message: string;
}

export interface RainwaterTankChartPoint {
  readonly nominalVolumeL: number;
  readonly coverageRatio: number;
  readonly overflowL: number;
  readonly shortageL: number;
}

export interface RainwaterTankChartModel {
  readonly capacityUnit: 'L';
  readonly volumeUnit: 'L';
  readonly ratioUnit: 'RATIO';
  readonly points: readonly RainwaterTankChartPoint[];
}

/**
 * Compares capacities without choosing an economically or legally "optimal" tank.
 * Candidates are sorted to make marginal gains deterministic.
 */
export function solveRainwaterTankCapacities(
  input: RainwaterTankSolverInput,
): RainwaterTankSolverResult {
  const diagnostics = validateSolverInput(input);
  if (diagnostics.length > 0)
    return { status: 'INVALID', candidates: [], diagnostics };

  const volumes = [...input.candidateVolumesL].sort(
    (first, second) => first - second,
  );
  let previous: RainwaterTankCandidateResult | undefined;
  const candidates = volumes.map((nominalVolumeL) => {
    const simulation = simulateRainwater({
      ...input.simulation,
      tank: {
        nominalVolumeL,
        initialVolumeL: nominalVolumeL * input.initialFillRatio,
        ...(input.minimumVolumeRatio === undefined
          ? {}
          : { minimumVolumeL: nominalVolumeL * input.minimumVolumeRatio }),
      },
    });
    const capacityDeltaL =
      previous === undefined
        ? undefined
        : nominalVolumeL - previous.nominalVolumeL;
    const coverageRatio = simulation.indicators?.coverageRatio;
    const marginalCoverageGain =
      previous?.coverageRatio === undefined || coverageRatio === undefined
        ? undefined
        : coverageRatio - previous.coverageRatio;
    const candidate: RainwaterTankCandidateResult = {
      nominalVolumeL,
      initialVolumeL: nominalVolumeL * input.initialFillRatio,
      status: simulation.status,
      ...(coverageRatio === undefined ? {} : { coverageRatio }),
      ...(simulation.indicators === undefined
        ? {}
        : {
            overflowL: simulation.indicators.overflowL,
            shortageL: simulation.indicators.shortageL,
          }),
      ...(capacityDeltaL === undefined ? {} : { capacityDeltaL }),
      ...(marginalCoverageGain === undefined ? {} : { marginalCoverageGain }),
      simulation,
    };
    previous = candidate;
    return candidate;
  });
  return {
    status: mergeStatuses(candidates.map(({ status }) => status)),
    candidates,
    diagnostics: [],
  };
}

export function createRainwaterTankChartModel(
  result: RainwaterTankSolverResult,
): RainwaterTankChartModel | undefined {
  if (result.status !== 'OK') return undefined;
  const points = result.candidates.flatMap((candidate) =>
    candidate.coverageRatio === undefined ||
    candidate.overflowL === undefined ||
    candidate.shortageL === undefined
      ? []
      : [
          {
            nominalVolumeL: candidate.nominalVolumeL,
            coverageRatio: candidate.coverageRatio,
            overflowL: candidate.overflowL,
            shortageL: candidate.shortageL,
          },
        ],
  );
  return {
    capacityUnit: 'L',
    volumeUnit: 'L',
    ratioUnit: 'RATIO',
    points,
  };
}

function validateSolverInput(
  input: RainwaterTankSolverInput,
): RainwaterTankSolverDiagnostic[] {
  if (
    input.candidateVolumesL.length === 0 ||
    new Set(input.candidateVolumesL).size !== input.candidateVolumesL.length ||
    input.candidateVolumesL.some(
      (volume) => !Number.isFinite(volume) || volume <= 0,
    ) ||
    !validRatio(input.initialFillRatio) ||
    (input.minimumVolumeRatio !== undefined &&
      (!validRatio(input.minimumVolumeRatio) ||
        input.initialFillRatio < input.minimumVolumeRatio))
  )
    return [
      {
        code: 'RAIN_TANK_SOLVER_INVALID_INPUT',
        path: 'input',
        message:
          'Candidate capacities must be unique, finite, and positive; fill ratios must be in [0, 1], and the initial ratio cannot be below the minimum ratio.',
      },
    ];
  return [];
}

function validRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function mergeStatuses(
  statuses: readonly RainwaterSimulationResult['status'][],
): RainwaterSimulationResult['status'] {
  if (statuses.includes('INVALID')) return 'INVALID';
  if (statuses.includes('UNKNOWN')) return 'UNKNOWN';
  return 'OK';
}
