import {
  millimetres,
  millimetresToMetres,
  numericValue,
} from '@house-technical-designer/units';
import type { Point3D } from '@house-technical-designer/geometry';
import type { DuctSegment } from './ventilation-domain.js';

export interface AirflowMethod {
  readonly methodId: string;
  readonly airDensityKgM3: number;
  readonly dynamicViscosityPaS: number;
}

export interface DuctAirflowInput {
  readonly duct: DuctSegment;
  readonly flowM3h?: number;
}

export interface DuctAirflowResult {
  readonly ductId: string;
  readonly methodId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly lengthM: number;
  readonly crossSectionAreaM2?: number;
  readonly hydraulicDiameterM?: number;
  readonly flowM3h?: number;
  readonly velocityMs?: number;
  readonly reynoldsNumber?: number;
  readonly frictionFactor?: number;
  readonly linearPressureLossPa?: number;
  readonly localPressureLossPa?: number;
  readonly totalPressureLossPa?: number;
  readonly warnings: readonly AirflowWarning[];
}

export interface AirflowWarning {
  readonly code:
    | 'VENT_UNKNOWN_FLOW'
    | 'VENT_UNKNOWN_SECTION'
    | 'VENT_UNKNOWN_ROUGHNESS'
    | 'VENT_UNKNOWN_LOCAL_LOSS';
  readonly ductId: string;
  readonly message: string;
}

export interface DirectedAirflow {
  readonly ductId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly flowM3h?: number;
}

export interface AirflowContinuityResult {
  readonly nodeId: string;
  readonly status: 'OK' | 'UNKNOWN';
  readonly inflowM3h?: number;
  readonly outflowM3h?: number;
  readonly residualM3h?: number;
}

export interface VentilationBranch {
  readonly branchId: string;
  readonly ductIds: readonly string[];
  /** Explicit terminal/filter/equipment losses; pass 0 only when confirmed absent. */
  readonly additionalPressureLossPa: number;
}

export interface VentilationBranchResult {
  readonly branchId: string;
  readonly status: 'OK' | 'UNKNOWN';
  readonly totalPressureLossPa?: number;
}

export interface CriticalBranchResult {
  readonly status: 'OK' | 'UNKNOWN';
  readonly branchId?: string;
  readonly totalPressureLossPa?: number;
  readonly branches: readonly VentilationBranchResult[];
}

export function ductPathLengthM(path: readonly Point3D[]): number {
  if (path.length < 2) throw new RangeError('Duct path requires two points');
  let lengthMm = 0;
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]!;
    const current = path[index]!;
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const dz = current.z - previous.z;
    if (![dx, dy, dz].every(Number.isFinite))
      throw new RangeError('Duct path coordinates must be finite');
    lengthMm += Math.hypot(dx, dy, dz);
  }
  if (lengthMm <= 0) throw new RangeError('Duct path length must be positive');
  return numericValue(millimetresToMetres(millimetres(lengthMm)));
}

export function ductSection(
  properties: DuctSegment['properties'],
):
  { readonly areaM2: number; readonly hydraulicDiameterM: number } | undefined {
  if (properties.shape === 'ROUND') {
    if (properties.diameterM === undefined) return undefined;
    positive(properties.diameterM, 'duct diameter');
    return {
      areaM2: (Math.PI * properties.diameterM ** 2) / 4,
      hydraulicDiameterM: properties.diameterM,
    };
  }
  if (properties.widthM === undefined || properties.heightM === undefined)
    return undefined;
  positive(properties.widthM, 'duct width');
  positive(properties.heightM, 'duct height');
  return {
    areaM2: properties.widthM * properties.heightM,
    hydraulicDiameterM:
      (2 * properties.widthM * properties.heightM) /
      (properties.widthM + properties.heightM),
  };
}

export function calculateDuctAirflow(
  input: DuctAirflowInput,
  method: AirflowMethod,
): DuctAirflowResult {
  validateMethod(method);
  const lengthM = ductPathLengthM(input.duct.path);
  const base = { ductId: input.duct.id, methodId: method.methodId, lengthM };
  const section = ductSection(input.duct.properties);
  if (section === undefined)
    return partial(base, 'VENT_UNKNOWN_SECTION', 'Duct section is unknown.');
  const withSection = {
    ...base,
    crossSectionAreaM2: section.areaM2,
    hydraulicDiameterM: section.hydraulicDiameterM,
  };
  if (input.flowM3h === undefined)
    return partial(withSection, 'VENT_UNKNOWN_FLOW', 'Airflow is unknown.');
  nonNegative(input.flowM3h, 'airflow');
  const flowM3s = input.flowM3h / 3_600;
  const velocityMs = flowM3s / section.areaM2;
  const withFlow = { ...withSection, flowM3h: input.flowM3h, velocityMs };
  if (flowM3s === 0)
    return {
      ...withFlow,
      status: 'OK',
      reynoldsNumber: 0,
      linearPressureLossPa: 0,
      localPressureLossPa: 0,
      totalPressureLossPa: 0,
      warnings: [],
    };
  const reynoldsNumber =
    (method.airDensityKgM3 * velocityMs * section.hydraulicDiameterM) /
    method.dynamicViscosityPaS;
  if (input.duct.properties.roughnessM === undefined)
    return {
      ...withFlow,
      status: 'PARTIAL',
      reynoldsNumber,
      warnings: [
        warning(
          input.duct.id,
          'VENT_UNKNOWN_ROUGHNESS',
          'Duct roughness is unknown.',
        ),
      ],
    };
  nonNegative(input.duct.properties.roughnessM, 'duct roughness');
  const frictionFactor = darcyFrictionFactor(
    reynoldsNumber,
    section.hydraulicDiameterM,
    input.duct.properties.roughnessM,
  );
  const dynamicPressurePa = (method.airDensityKgM3 * velocityMs ** 2) / 2;
  const linearPressureLossPa =
    frictionFactor * (lengthM / section.hydraulicDiameterM) * dynamicPressurePa;
  if (input.duct.properties.localLossCoefficient === undefined)
    return {
      ...withFlow,
      status: 'PARTIAL',
      reynoldsNumber,
      frictionFactor,
      linearPressureLossPa,
      warnings: [
        warning(
          input.duct.id,
          'VENT_UNKNOWN_LOCAL_LOSS',
          'Local loss coefficient is unknown.',
        ),
      ],
    };
  nonNegative(
    input.duct.properties.localLossCoefficient,
    'local loss coefficient',
  );
  const localPressureLossPa =
    input.duct.properties.localLossCoefficient * dynamicPressurePa;
  return {
    ...withFlow,
    status: 'OK',
    reynoldsNumber,
    frictionFactor,
    linearPressureLossPa,
    localPressureLossPa,
    totalPressureLossPa: linearPressureLossPa + localPressureLossPa,
    warnings: [],
  };
}

export function calculateAirflowContinuity(
  nodeIds: readonly string[],
  flows: readonly DirectedAirflow[],
): readonly AirflowContinuityResult[] {
  return [...nodeIds].sort().map((nodeId) => {
    const incoming = flows.filter(({ toNodeId }) => toNodeId === nodeId);
    const outgoing = flows.filter(({ fromNodeId }) => fromNodeId === nodeId);
    if ([...incoming, ...outgoing].some(({ flowM3h }) => flowM3h === undefined))
      return { nodeId, status: 'UNKNOWN' as const };
    const inflowM3h = sumKnownFlows(incoming);
    const outflowM3h = sumKnownFlows(outgoing);
    return {
      nodeId,
      status: 'OK' as const,
      inflowM3h,
      outflowM3h,
      residualM3h: inflowM3h - outflowM3h,
    };
  });
}

export function findCriticalVentilationBranch(
  branches: readonly VentilationBranch[],
  ducts: readonly DuctAirflowResult[],
): CriticalBranchResult {
  const byId = new Map(ducts.map((duct) => [duct.ductId, duct]));
  const results = [...branches]
    .sort((first, second) => first.branchId.localeCompare(second.branchId))
    .map((branch): VentilationBranchResult => {
      const members = branch.ductIds.map((id) => byId.get(id));
      if (
        branch.ductIds.length === 0 ||
        !Number.isFinite(branch.additionalPressureLossPa) ||
        branch.additionalPressureLossPa < 0 ||
        members.some((member) => member?.totalPressureLossPa === undefined)
      )
        return { branchId: branch.branchId, status: 'UNKNOWN' };
      return {
        branchId: branch.branchId,
        status: 'OK',
        totalPressureLossPa: members.reduce(
          (total, member) => total + member!.totalPressureLossPa!,
          branch.additionalPressureLossPa,
        ),
      };
    });
  if (results.some(({ status }) => status === 'UNKNOWN'))
    return { status: 'UNKNOWN', branches: results };
  const critical = results.reduce<VentilationBranchResult | undefined>(
    (selected, candidate) =>
      selected === undefined ||
      candidate.totalPressureLossPa! > selected.totalPressureLossPa!
        ? candidate
        : selected,
    undefined,
  );
  return critical === undefined
    ? { status: 'UNKNOWN', branches: results }
    : {
        status: 'OK',
        branchId: critical.branchId,
        totalPressureLossPa: critical.totalPressureLossPa!,
        branches: results,
      };
}

function darcyFrictionFactor(
  reynoldsNumber: number,
  hydraulicDiameterM: number,
  roughnessM: number,
): number {
  return reynoldsNumber < 2_300
    ? 64 / reynoldsNumber
    : 1 /
        (-1.8 *
          Math.log10(
            (roughnessM / (3.7 * hydraulicDiameterM)) ** 1.11 +
              6.9 / reynoldsNumber,
          )) **
          2;
}

function partial(
  base: Omit<DuctAirflowResult, 'status' | 'warnings'>,
  code: AirflowWarning['code'],
  message: string,
): DuctAirflowResult {
  return {
    ...base,
    status: 'PARTIAL',
    warnings: [warning(base.ductId, code, message)],
  };
}

function warning(
  ductId: string,
  code: AirflowWarning['code'],
  message: string,
): AirflowWarning {
  return { ductId, code, message };
}

function sumKnownFlows(flows: readonly DirectedAirflow[]): number {
  return flows.reduce((total, { flowM3h }) => {
    if (flowM3h === undefined) throw new Error('Expected a known airflow');
    nonNegative(flowM3h, 'airflow');
    return total + flowM3h;
  }, 0);
}

function validateMethod(method: AirflowMethod): void {
  if (method.methodId.trim() === '')
    throw new TypeError('Airflow method ID must not be empty');
  positive(method.airDensityKgM3, 'air density');
  positive(method.dynamicViscosityPaS, 'dynamic viscosity');
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}
