export interface HydraulicContext {
  readonly fluidDensityKgM3: number;
  readonly dynamicViscosityPaS: number;
  readonly gravityMs2: number;
  readonly methodId: string;
}

export interface PipeHydraulicInput {
  readonly segmentId: string;
  readonly lengthM: number;
  readonly internalDiameterM: number;
  readonly flowM3s?: number;
  readonly roughnessM?: number;
  readonly localLossCoefficient?: number;
}

export interface PipeHydraulicResult {
  readonly status: 'OK' | 'PARTIAL';
  readonly segmentId: string;
  readonly methodId: string;
  readonly crossSectionAreaM2: number;
  readonly flowM3s?: number;
  readonly velocityMs?: number;
  readonly reynoldsNumber?: number;
  readonly frictionFactor?: number;
  readonly linearPressureLossPa?: number;
  readonly localPressureLossPa?: number;
  readonly totalPressureLossPa?: number;
  readonly warnings: readonly HydraulicWarning[];
}

export interface HydraulicWarning {
  readonly code: 'WATER_METHOD_MISSING' | 'WATER_UNKNOWN_PIPE_PROPERTIES';
  readonly segmentId: string;
  readonly message: string;
}

export interface DirectedFlow {
  readonly segmentId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly flowM3s?: number;
}

export interface NodeContinuityResult {
  readonly nodeId: string;
  readonly status: 'OK' | 'UNKNOWN';
  readonly inflowM3s?: number;
  readonly outflowM3s?: number;
  readonly residualM3s?: number;
}

export interface TerminalPressureResult {
  readonly fixtureId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly totalPressureLossPa?: number;
  readonly elevationLossPa?: number;
  readonly availablePressurePa?: number;
  readonly warning?:
    'WATER_DISCONNECTED_FIXTURE' | 'WATER_UNKNOWN_PIPE_PROPERTIES';
}

/** WATER-001: circular cross-section in SI. */
export function circularAreaM2(internalDiameterM: number): number {
  positiveFinite(internalDiameterM, 'internal diameter');
  return (Math.PI * internalDiameterM * internalDiameterM) / 4;
}

export function calculatePipeHydraulics(
  input: PipeHydraulicInput,
  context: HydraulicContext,
): PipeHydraulicResult {
  validateContext(context);
  nonNegativeFinite(input.lengthM, 'pipe length');
  positiveFinite(input.internalDiameterM, 'internal diameter');
  if (input.localLossCoefficient !== undefined)
    nonNegativeFinite(input.localLossCoefficient, 'local loss coefficient');
  const crossSectionAreaM2 = circularAreaM2(input.internalDiameterM);
  const base = {
    segmentId: input.segmentId,
    methodId: context.methodId,
    crossSectionAreaM2,
  };
  if (input.flowM3s === undefined)
    return {
      ...base,
      status: 'PARTIAL',
      warnings: [warning(input.segmentId, 'Flow is unknown.')],
    };
  nonNegativeFinite(input.flowM3s, 'flow');
  const velocityMs = input.flowM3s / crossSectionAreaM2;
  if (input.flowM3s === 0)
    return {
      ...base,
      status: 'OK',
      velocityMs,
      flowM3s: input.flowM3s,
      reynoldsNumber: 0,
      linearPressureLossPa: 0,
      localPressureLossPa: 0,
      totalPressureLossPa: 0,
      warnings: [],
    };
  const reynoldsNumber =
    (context.fluidDensityKgM3 * velocityMs * input.internalDiameterM) /
    context.dynamicViscosityPaS;
  const frictionFactor = darcyFrictionFactor(
    reynoldsNumber,
    input.internalDiameterM,
    input.roughnessM,
  );
  if (frictionFactor === undefined)
    return {
      ...base,
      status: 'PARTIAL',
      velocityMs,
      flowM3s: input.flowM3s,
      reynoldsNumber,
      warnings: [
        warning(input.segmentId, 'Turbulent flow requires pipe roughness.'),
      ],
    };
  const dynamicPressurePa =
    (context.fluidDensityKgM3 * velocityMs * velocityMs) / 2;
  const linearPressureLossPa =
    frictionFactor *
    (input.lengthM / input.internalDiameterM) *
    dynamicPressurePa;
  if (input.localLossCoefficient === undefined)
    return {
      ...base,
      status: 'PARTIAL',
      velocityMs,
      flowM3s: input.flowM3s,
      reynoldsNumber,
      frictionFactor,
      linearPressureLossPa,
      warnings: [
        warning(input.segmentId, 'Local loss coefficient is unknown.'),
      ],
    };
  const localPressureLossPa = input.localLossCoefficient * dynamicPressurePa;
  return {
    ...base,
    status: 'OK',
    velocityMs,
    flowM3s: input.flowM3s,
    reynoldsNumber,
    frictionFactor,
    linearPressureLossPa,
    localPressureLossPa,
    totalPressureLossPa: linearPressureLossPa + localPressureLossPa,
    warnings: [],
  };
}

/** Laminar 64/Re; turbulent Haaland approximation when roughness is known. */
export function darcyFrictionFactor(
  reynoldsNumber: number,
  internalDiameterM: number,
  roughnessM?: number,
): number | undefined {
  positiveFinite(reynoldsNumber, 'Reynolds number');
  positiveFinite(internalDiameterM, 'internal diameter');
  if (reynoldsNumber < 2_300) return 64 / reynoldsNumber;
  if (roughnessM === undefined) return undefined;
  nonNegativeFinite(roughnessM, 'roughness');
  const inverseSquareRoot =
    -1.8 *
    Math.log10(
      Math.pow(roughnessM / (3.7 * internalDiameterM), 1.11) +
        6.9 / reynoldsNumber,
    );
  return 1 / (inverseSquareRoot * inverseSquareRoot);
}

/** WATER-004: hydrostatic pressure difference rho*g*dz. */
export function elevationPressureLossPa(
  elevationDifferenceM: number,
  context: Pick<HydraulicContext, 'fluidDensityKgM3' | 'gravityMs2'>,
): number {
  finite(elevationDifferenceM, 'elevation difference');
  positiveFinite(context.fluidDensityKgM3, 'fluid density');
  positiveFinite(context.gravityMs2, 'gravity');
  return context.fluidDensityKgM3 * context.gravityMs2 * elevationDifferenceM;
}

/** Produces no pressure result for a disconnected or incomplete terminal path. */
export function calculateTerminalPressure(
  fixtureId: string,
  connected: boolean,
  sourcePressurePa: number | undefined,
  segments: readonly PipeHydraulicResult[],
  elevationDifferenceM: number,
  context: Pick<HydraulicContext, 'fluidDensityKgM3' | 'gravityMs2'>,
): TerminalPressureResult {
  if (!connected)
    return {
      fixtureId,
      status: 'PARTIAL',
      warning: 'WATER_DISCONNECTED_FIXTURE',
    };
  if (
    sourcePressurePa === undefined ||
    segments.some(
      ({ totalPressureLossPa }) => totalPressureLossPa === undefined,
    )
  )
    return {
      fixtureId,
      status: 'PARTIAL',
      warning: 'WATER_UNKNOWN_PIPE_PROPERTIES',
    };
  nonNegativeFinite(sourcePressurePa, 'source pressure');
  const totalPressureLossPa = segments.reduce(
    (sum, segment) => sum + requiredPressureLoss(segment),
    0,
  );
  const elevationLossPa = elevationPressureLossPa(
    elevationDifferenceM,
    context,
  );
  return {
    fixtureId,
    status: 'OK',
    totalPressureLossPa,
    elevationLossPa,
    availablePressurePa:
      sourcePressurePa - totalPressureLossPa - elevationLossPa,
  };
}

/** WATER-006: reports conservation residuals without assuming missing flows are zero. */
export function calculateNodeContinuity(
  nodeIds: readonly string[],
  flows: readonly DirectedFlow[],
): readonly NodeContinuityResult[] {
  return [...nodeIds].sort().map((nodeId) => {
    const incoming = flows.filter(({ toNodeId }) => toNodeId === nodeId);
    const outgoing = flows.filter(({ fromNodeId }) => fromNodeId === nodeId);
    const connected = [...incoming, ...outgoing];
    if (connected.some(({ flowM3s }) => flowM3s === undefined))
      return { nodeId, status: 'UNKNOWN' as const };
    const inflowM3s = incoming.reduce(
      (sum, flow) => sum + requiredFlow(flow),
      0,
    );
    const outflowM3s = outgoing.reduce(
      (sum, flow) => sum + requiredFlow(flow),
      0,
    );
    return {
      nodeId,
      status: 'OK' as const,
      inflowM3s,
      outflowM3s,
      residualM3s: inflowM3s - outflowM3s,
    };
  });
}

function requiredFlow(flow: DirectedFlow): number {
  if (flow.flowM3s === undefined)
    throw new Error('Known continuity result contains an unknown flow');
  nonNegativeFinite(flow.flowM3s, 'flow');
  return flow.flowM3s;
}

function requiredPressureLoss(segment: PipeHydraulicResult): number {
  if (segment.totalPressureLossPa === undefined)
    throw new Error('Complete terminal path contains an unknown pressure loss');
  return segment.totalPressureLossPa;
}

function warning(segmentId: string, message: string): HydraulicWarning {
  return { code: 'WATER_UNKNOWN_PIPE_PROPERTIES', segmentId, message };
}

function validateContext(context: HydraulicContext): void {
  positiveFinite(context.fluidDensityKgM3, 'fluid density');
  positiveFinite(context.dynamicViscosityPaS, 'dynamic viscosity');
  positiveFinite(context.gravityMs2, 'gravity');
  if (context.methodId.trim() === '')
    throw new TypeError('Hydraulic method ID must not be empty');
}

function positiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}

function nonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}
