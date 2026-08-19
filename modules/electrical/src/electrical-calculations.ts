import {
  DEFAULT_GEOMETRY_TOLERANCE,
  type Point3D,
} from '@house-technical-designer/geometry';
import {
  millimetres,
  millimetresToMetres,
  numericValue,
} from '@house-technical-designer/units';
import type {
  ElectricalCable,
  ElectricalCircuit,
  ElectricalLoad,
  VoltageReference,
} from './electrical-domain.js';

export const ELECTRICAL_POWER_METHOD_ID =
  'balanced-active-power-demand-v1' as const;
export const RESISTIVE_VOLTAGE_DROP_METHOD_ID =
  'resistive-path-voltage-drop-v1' as const;

export interface CableElectricalInput {
  readonly cable: ElectricalCable;
  /** Catalog/method value at the selected material and temperature. */
  readonly conductorResistanceOhmPerM?: number;
}

export interface ElectricalCircuitCalculationInput {
  readonly circuit: ElectricalCircuit;
  readonly loads: readonly ElectricalLoad[];
  /** Ordered cable segments forming one continuous series path. */
  readonly cables: readonly CableElectricalInput[];
}

export interface ElectricalCableResult {
  readonly cableId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly lengthM: number;
  readonly currentA?: number;
  readonly voltageDropV?: number;
  readonly warnings: readonly ElectricalCalculationWarning[];
}

export interface ElectricalCircuitResult {
  readonly circuitId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly powerMethodId: typeof ELECTRICAL_POWER_METHOD_ID;
  readonly voltageDropMethodId: typeof RESISTIVE_VOLTAGE_DROP_METHOD_ID;
  readonly installedPowerW?: number;
  readonly designPowerW?: number;
  readonly designApparentPowerVA?: number;
  readonly designCurrentA?: number;
  readonly voltageDropV?: number;
  readonly voltageDropPercent?: number;
  readonly cables: readonly ElectricalCableResult[];
  readonly warnings: readonly ElectricalCalculationWarning[];
}

export interface ElectricalCalculationWarning {
  readonly code:
    | 'ELEC_UNKNOWN_ACTIVE_POWER'
    | 'ELEC_UNKNOWN_DEMAND_FACTOR'
    | 'ELEC_UNKNOWN_POWER_FACTOR'
    | 'ELEC_UNKNOWN_RESISTANCE'
    | 'ELEC_UNSUPPORTED_CONFIGURATION';
  readonly objectId: string;
  readonly message: string;
}

export function calculateDesignCurrentA(
  activePowerW: number,
  voltageV: number,
  powerFactor: number,
  phases: 1 | 3,
  voltageReference: VoltageReference,
): number {
  nonNegative(activePowerW, 'active power');
  positive(voltageV, 'voltage');
  if (!Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1)
    throw new RangeError('power factor must be in (0, 1]');
  if (voltageReference === 'DC')
    throw new RangeError('AC design current does not accept a DC voltage');
  return (
    activePowerW /
    (currentVoltageFactor(phases, voltageReference) * voltageV * powerFactor)
  );
}

export function calculateElectricalCircuit(
  input: ElectricalCircuitCalculationInput,
): ElectricalCircuitResult {
  const { circuit } = input;
  validateCircuitConfiguration(circuit);
  const warnings: ElectricalCalculationWarning[] = [];
  validateCalculationReferences(input);
  const installedPowerW = sumWhenKnown(
    input.loads,
    ({ activePowerW }) => activePowerW,
    (load) =>
      warnings.push(
        warning(
          'ELEC_UNKNOWN_ACTIVE_POWER',
          load.loadId,
          'Active power is unknown.',
        ),
      ),
  );
  const designPowerW = sumWhenKnown(
    input.loads,
    (load) =>
      load.activePowerW === undefined || load.demandFactor === undefined
        ? undefined
        : load.activePowerW * load.demandFactor,
    (load) => {
      if (load.activePowerW === undefined) return;
      warnings.push(
        warning(
          'ELEC_UNKNOWN_DEMAND_FACTOR',
          load.loadId,
          'Demand factor is unknown.',
        ),
      );
    },
  );
  const designApparentPowerVA = sumWhenKnown(
    input.loads,
    (load) =>
      load.activePowerW === undefined ||
      load.demandFactor === undefined ||
      load.powerFactor === undefined
        ? undefined
        : (load.activePowerW * load.demandFactor) / load.powerFactor,
    (load) => {
      if (
        load.activePowerW !== undefined &&
        load.demandFactor !== undefined &&
        load.powerFactor === undefined
      )
        warnings.push(
          warning(
            'ELEC_UNKNOWN_POWER_FACTOR',
            load.loadId,
            'Power factor is unknown.',
          ),
        );
    },
  );
  const designCurrentA =
    designApparentPowerVA === undefined
      ? undefined
      : designApparentPowerVA /
        (currentVoltageFactor(circuit.phases, circuit.voltageReference) *
          circuit.voltageV);
  const cables = input.cables.map((cable) =>
    calculateCableVoltageDrop(cable, circuit, designCurrentA),
  );
  const isSeriesPath = hasContinuousSeriesPath(input.cables);
  const voltageDropV =
    cables.length === 0 ||
    !isSeriesPath ||
    cables.some(({ voltageDropV }) => voltageDropV === undefined)
      ? undefined
      : cables.reduce((total, cable) => total + cable.voltageDropV!, 0);
  if (cables.length === 0)
    warnings.push(
      warning(
        'ELEC_UNSUPPORTED_CONFIGURATION',
        circuit.id,
        'Circuit has no cable path to evaluate.',
      ),
    );
  else if (!isSeriesPath)
    warnings.push(
      warning(
        'ELEC_UNSUPPORTED_CONFIGURATION',
        circuit.id,
        'Cable inputs must form one ordered continuous series path; branched paths require a per-branch calculation.',
      ),
    );
  const cableWarnings = cables.flatMap(({ warnings: entries }) => entries);
  const allWarnings = [...warnings, ...cableWarnings];
  return {
    circuitId: circuit.id,
    status:
      installedPowerW === undefined ||
      designPowerW === undefined ||
      designCurrentA === undefined ||
      voltageDropV === undefined
        ? 'PARTIAL'
        : 'OK',
    powerMethodId: ELECTRICAL_POWER_METHOD_ID,
    voltageDropMethodId: RESISTIVE_VOLTAGE_DROP_METHOD_ID,
    ...(installedPowerW === undefined ? {} : { installedPowerW }),
    ...(designPowerW === undefined ? {} : { designPowerW }),
    ...(designApparentPowerVA === undefined ? {} : { designApparentPowerVA }),
    ...(designCurrentA === undefined ? {} : { designCurrentA }),
    ...(voltageDropV === undefined
      ? {}
      : {
          voltageDropV,
          voltageDropPercent: (voltageDropV / circuit.voltageV) * 100,
        }),
    cables,
    warnings: allWarnings,
  };
}

function hasContinuousSeriesPath(
  cables: readonly CableElectricalInput[],
): boolean {
  return cables.every(({ cable }, index) => {
    if (index === 0) return true;
    const previous = cables[index - 1]!.cable.path.at(-1)!;
    const current = cable.path[0]!;
    return (
      Math.hypot(
        previous.x - current.x,
        previous.y - current.y,
        previous.z - current.z,
      ) <= DEFAULT_GEOMETRY_TOLERANCE.pointMergeMm
    );
  });
}

export function electricalPathLengthM(path: readonly Point3D[]): number {
  if (path.length < 2) throw new RangeError('Cable path requires two points');
  let totalMm = 0;
  for (let index = 1; index < path.length; index += 1) {
    const first = path[index - 1]!;
    const second = path[index]!;
    const delta = [second.x - first.x, second.y - first.y, second.z - first.z];
    if (delta.some((value) => !Number.isFinite(value)))
      throw new RangeError('Cable path coordinates must be finite');
    totalMm += Math.hypot(...delta);
  }
  if (totalMm <= 0) throw new RangeError('Cable path length must be positive');
  return numericValue(millimetresToMetres(millimetres(totalMm)));
}

function calculateCableVoltageDrop(
  input: CableElectricalInput,
  circuit: ElectricalCircuit,
  currentA: number | undefined,
): ElectricalCableResult {
  const lengthM = electricalPathLengthM(input.cable.path);
  if (currentA === undefined)
    return {
      cableId: input.cable.id,
      status: 'PARTIAL',
      lengthM,
      warnings: [],
    };
  if (input.conductorResistanceOhmPerM === undefined)
    return {
      cableId: input.cable.id,
      status: 'PARTIAL',
      lengthM,
      currentA,
      warnings: [
        warning(
          'ELEC_UNKNOWN_RESISTANCE',
          input.cable.id,
          'Conductor resistance is unknown.',
        ),
      ],
    };
  nonNegative(input.conductorResistanceOhmPerM, 'conductor resistance');
  const pathFactor =
    circuit.phases === 3
      ? circuit.voltageReference === 'PHASE_PHASE'
        ? Math.sqrt(3)
        : 1
      : 2;
  return {
    cableId: input.cable.id,
    status: 'OK',
    lengthM,
    currentA,
    voltageDropV:
      pathFactor * currentA * input.conductorResistanceOhmPerM * lengthM,
    warnings: [],
  };
}

function sumWhenKnown<T>(
  values: readonly T[],
  select: (value: T) => number | undefined,
  onUnknown: (value: T) => void,
): number | undefined {
  let total = 0;
  let known = true;
  for (const value of values) {
    const selected = select(value);
    if (selected === undefined) {
      known = false;
      onUnknown(value);
    } else {
      nonNegative(selected, 'load contribution');
      total += selected;
    }
  }
  return known ? total : undefined;
}

function validateCircuitConfiguration(circuit: ElectricalCircuit): void {
  positive(circuit.voltageV, 'voltage');
  if (circuit.voltageReference === 'DC' && circuit.phases !== 1)
    throw new RangeError('DC circuits must use one phase/conductor system');
  if (circuit.voltageReference === 'DC')
    throw new RangeError(
      'DC voltage-drop calculation requires a dedicated method and is not supported by this version',
    );
}

function validateCalculationReferences(
  input: ElectricalCircuitCalculationInput,
): void {
  const expectedLoads = [...input.circuit.loadIds].sort();
  const suppliedLoads = input.loads.map(({ loadId }) => loadId).sort();
  if (
    new Set(suppliedLoads).size !== suppliedLoads.length ||
    expectedLoads.length !== suppliedLoads.length ||
    expectedLoads.some((id, index) => id !== suppliedLoads[index])
  )
    throw new RangeError(
      `Loads supplied for circuit ${input.circuit.id} must exactly match its loadIds.`,
    );
  if (
    input.cables.some(
      ({ cable }) => cable.properties.circuitId !== input.circuit.id,
    )
  )
    throw new RangeError(
      `Every cable supplied for circuit ${input.circuit.id} must reference that circuit.`,
    );
}

function currentVoltageFactor(
  phases: 1 | 3,
  voltageReference: VoltageReference,
): number {
  if (phases === 1) return 1;
  return voltageReference === 'PHASE_PHASE' ? Math.sqrt(3) : 3;
}

function warning(
  code: ElectricalCalculationWarning['code'],
  objectId: string,
  message: string,
): ElectricalCalculationWarning {
  return { code, objectId, message };
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}
