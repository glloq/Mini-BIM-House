import {
  calculatePipeHydraulics,
  type HydraulicContext,
  type PipeHydraulicResult,
} from './hydraulics.js';

export interface WaterPipeCatalogEntry {
  readonly id: string;
  readonly internalDiameterM: number;
  readonly materialId: string;
  readonly roughnessM?: number;
  readonly sourceReference?: string;
}

export interface WaterPipeSizingInput {
  readonly segmentId: string;
  readonly lengthM: number;
  readonly flowM3s?: number;
  readonly localLossCoefficient?: number;
}

export interface WaterPipeSizingCriteria {
  readonly methodId: string;
  readonly maximumVelocityMs?: number;
  readonly maximumPressureLossPa?: number;
}

export interface WaterPipeCandidateResult {
  readonly catalogEntryId: string;
  readonly internalDiameterM: number;
  readonly status: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
  readonly reasons: readonly string[];
  readonly hydraulics?: PipeHydraulicResult;
}

export interface WaterPipeSizingResult {
  readonly status: 'SIZED' | 'NO_MATCH' | 'UNKNOWN';
  readonly methodId: string;
  readonly suggestedCatalogEntryId?: string;
  readonly candidates: readonly WaterPipeCandidateResult[];
  readonly warnings: readonly string[];
}

/** Selects the smallest proven candidate; limits always come from the active method. */
export function sizeWaterPipe(
  input: WaterPipeSizingInput,
  catalog: readonly WaterPipeCatalogEntry[],
  criteria: WaterPipeSizingCriteria,
  context: HydraulicContext,
): WaterPipeSizingResult {
  validateCriteria(criteria);
  const ordered = [...catalog].sort(
    (first, second) =>
      first.internalDiameterM - second.internalDiameterM ||
      first.id.localeCompare(second.id),
  );
  validateCatalog(ordered);
  if (
    input.flowM3s === undefined ||
    (criteria.maximumPressureLossPa !== undefined &&
      input.localLossCoefficient === undefined) ||
    (criteria.maximumVelocityMs === undefined &&
      criteria.maximumPressureLossPa === undefined)
  )
    return {
      status: 'UNKNOWN',
      methodId: criteria.methodId,
      candidates: [],
      warnings: [
        'Sizing requires flow, any pressure-loss inputs used, and at least one explicit acceptance limit.',
      ],
    };
  const candidates = ordered.map((entry) =>
    evaluateCandidate(input, entry, criteria, context),
  );
  const firstAccepted = candidates.findIndex(
    ({ status }) => status === 'ACCEPTED',
  );
  if (firstAccepted < 0)
    return {
      status: candidates.some(({ status }) => status === 'UNKNOWN')
        ? 'UNKNOWN'
        : 'NO_MATCH',
      methodId: criteria.methodId,
      candidates,
      warnings: [
        candidates.some(({ status }) => status === 'UNKNOWN')
          ? 'At least one candidate could not be verified.'
          : 'No catalog diameter satisfies the active criteria.',
      ],
    };
  if (
    candidates
      .slice(0, firstAccepted)
      .some(({ status }) => status === 'UNKNOWN')
  )
    return {
      status: 'UNKNOWN',
      methodId: criteria.methodId,
      candidates,
      warnings: [
        'A smaller candidate is unknown, so the smallest valid diameter cannot be proven.',
      ],
    };
  return {
    status: 'SIZED',
    methodId: criteria.methodId,
    suggestedCatalogEntryId: candidates[firstAccepted]!.catalogEntryId,
    candidates,
    warnings: [],
  };
}

function evaluateCandidate(
  input: WaterPipeSizingInput,
  entry: WaterPipeCatalogEntry,
  criteria: WaterPipeSizingCriteria,
  context: HydraulicContext,
): WaterPipeCandidateResult {
  const hydraulics = calculatePipeHydraulics(
    {
      segmentId: input.segmentId,
      lengthM: input.lengthM,
      internalDiameterM: entry.internalDiameterM,
      ...(input.flowM3s === undefined ? {} : { flowM3s: input.flowM3s }),
      ...(entry.roughnessM === undefined
        ? {}
        : { roughnessM: entry.roughnessM }),
      ...(input.localLossCoefficient === undefined
        ? {}
        : { localLossCoefficient: input.localLossCoefficient }),
    },
    context,
  );
  if (
    hydraulics.velocityMs === undefined ||
    (criteria.maximumPressureLossPa !== undefined &&
      hydraulics.totalPressureLossPa === undefined)
  )
    return {
      catalogEntryId: entry.id,
      internalDiameterM: entry.internalDiameterM,
      status: 'UNKNOWN',
      reasons: hydraulics.warnings.map(({ message }) => message),
      hydraulics,
    };
  const reasons: string[] = [];
  if (
    criteria.maximumVelocityMs !== undefined &&
    hydraulics.velocityMs > criteria.maximumVelocityMs
  )
    reasons.push(
      `Velocity ${hydraulics.velocityMs} m/s exceeds ${criteria.maximumVelocityMs} m/s.`,
    );
  if (
    criteria.maximumPressureLossPa !== undefined &&
    hydraulics.totalPressureLossPa !== undefined &&
    hydraulics.totalPressureLossPa > criteria.maximumPressureLossPa
  )
    reasons.push(
      `Pressure loss ${hydraulics.totalPressureLossPa} Pa exceeds ${criteria.maximumPressureLossPa} Pa.`,
    );
  return {
    catalogEntryId: entry.id,
    internalDiameterM: entry.internalDiameterM,
    status: reasons.length === 0 ? 'ACCEPTED' : 'REJECTED',
    reasons,
    hydraulics,
  };
}

function validateCriteria(criteria: WaterPipeSizingCriteria): void {
  if (criteria.methodId.trim() === '')
    throw new TypeError('Sizing method ID must not be empty');
  for (const [name, value] of [
    ['maximum velocity', criteria.maximumVelocityMs],
    ['maximum pressure loss', criteria.maximumPressureLossPa],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0))
      throw new RangeError(`${name} must be finite and positive`);
  }
}

function validateCatalog(catalog: readonly WaterPipeCatalogEntry[]): void {
  const ids = new Set<string>();
  for (const entry of catalog) {
    if (entry.id.trim() === '' || entry.materialId.trim() === '')
      throw new TypeError('Catalog IDs and material IDs must not be empty');
    if (
      !Number.isFinite(entry.internalDiameterM) ||
      entry.internalDiameterM <= 0
    )
      throw new RangeError(
        'Catalog internal diameters must be finite and positive',
      );
    if (ids.has(entry.id))
      throw new RangeError(`Duplicate catalog entry ${entry.id}`);
    ids.add(entry.id);
  }
}
