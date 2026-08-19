export interface HeatingLoadMethod {
  readonly id: string;
  readonly version: string;
  /** Method-specific air density; no physical constant is hidden in the calculator. */
  readonly airDensityKgM3: number;
  readonly airSpecificHeatJKgK: number;
}

export interface RoomHeatingLoadInput {
  readonly roomId: string;
  readonly floorAreaM2?: number;
  readonly transmissionHeatTransferCoefficientWK?: number;
  readonly designTemperatureDifferenceK?: number;
  readonly ventilationFlowM3s?: number;
  /** Set true when recovery equipment is present, even if its efficiency is unknown. */
  readonly heatRecoveryPresent?: boolean;
  /** Fraction from 0 to 1, applied only to ventilation heat loss. */
  readonly heatRecoveryEfficiency?: number;
  /** Explicit additional design load. Omit it when it is unknown. */
  readonly otherW?: number;
}

export type HeatingLoadDiagnosticCode =
  | 'HEATING_MISSING_TRANSMISSION'
  | 'HEATING_MISSING_TEMPERATURE_DIFFERENCE'
  | 'HEATING_MISSING_VENTILATION_FLOW'
  | 'HEATING_MISSING_HEAT_RECOVERY_EFFICIENCY'
  | 'HEATING_MISSING_OTHER_LOAD';

export interface HeatingLoadDiagnostic {
  readonly code: HeatingLoadDiagnosticCode;
  readonly roomId: string;
  readonly message: string;
}

export interface RoomHeatingLoad {
  readonly roomId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly transmissionW?: number;
  readonly ventilationW?: number;
  readonly otherW?: number;
  readonly totalW?: number;
  readonly wattsPerM2?: number;
  readonly diagnostics: readonly HeatingLoadDiagnostic[];
}

export interface BuildingHeatingLoad {
  readonly status: 'OK' | 'PARTIAL';
  readonly methodId: string;
  readonly methodVersion: string;
  readonly roomLoads: readonly RoomHeatingLoad[];
  readonly designLoadW?: number;
  readonly diagnostics: readonly HeatingLoadDiagnostic[];
}

/** Calculates steady-state room design loads from explicit, SI-valued inputs. */
export function calculateHeatingLoads(
  rooms: readonly RoomHeatingLoadInput[],
  method: HeatingLoadMethod,
): BuildingHeatingLoad {
  assertIdentifier(method.id, 'method ID');
  assertIdentifier(method.version, 'method version');
  assertPositiveFinite(method.airDensityKgM3, 'air density');
  assertPositiveFinite(method.airSpecificHeatJKgK, 'air specific heat');
  const seen = new Set<string>();
  const roomLoads = [...rooms]
    .map((room) => {
      assertIdentifier(room.roomId, 'room ID');
      if (seen.has(room.roomId))
        throw new TypeError(`Duplicate heating room ID ${room.roomId}.`);
      seen.add(room.roomId);
      return calculateRoomHeatingLoad(room, method);
    })
    .sort((first, second) => first.roomId.localeCompare(second.roomId));
  const diagnostics = roomLoads.flatMap((room) => room.diagnostics);
  const incomplete = roomLoads.some(({ totalW }) => totalW === undefined);
  return {
    status: incomplete ? 'PARTIAL' : 'OK',
    methodId: method.id,
    methodVersion: method.version,
    roomLoads,
    ...(incomplete
      ? {}
      : {
          designLoadW: roomLoads.reduce(
            (sum, room) => sum + required(room.totalW),
            0,
          ),
        }),
    diagnostics,
  };
}

function calculateRoomHeatingLoad(
  input: RoomHeatingLoadInput,
  method: HeatingLoadMethod,
): RoomHeatingLoad {
  validateOptionalNonNegative(input.floorAreaM2, 'floor area');
  validateOptionalNonNegative(
    input.transmissionHeatTransferCoefficientWK,
    'transmission heat transfer coefficient',
  );
  validateOptionalNonNegative(
    input.designTemperatureDifferenceK,
    'design temperature difference',
  );
  validateOptionalNonNegative(input.ventilationFlowM3s, 'ventilation flow');
  validateOptionalNonNegative(input.otherW, 'other load');
  if (
    input.heatRecoveryEfficiency !== undefined &&
    (!Number.isFinite(input.heatRecoveryEfficiency) ||
      input.heatRecoveryEfficiency < 0 ||
      input.heatRecoveryEfficiency > 1)
  )
    throw new RangeError('heat recovery efficiency must be between 0 and 1');
  if (
    input.heatRecoveryPresent === false &&
    input.heatRecoveryEfficiency !== undefined
  )
    throw new TypeError(
      'heat recovery efficiency cannot be supplied when recovery is absent',
    );

  const diagnostics: HeatingLoadDiagnostic[] = [];
  missing(
    input.transmissionHeatTransferCoefficientWK,
    diagnostics,
    input.roomId,
    'HEATING_MISSING_TRANSMISSION',
    'Transmission heat transfer coefficient is unknown.',
  );
  if (
    input.heatRecoveryPresent === true &&
    input.heatRecoveryEfficiency === undefined
  )
    diagnostics.push({
      code: 'HEATING_MISSING_HEAT_RECOVERY_EFFICIENCY',
      roomId: input.roomId,
      message: 'Heat-recovery efficiency is unknown.',
    });
  missing(
    input.designTemperatureDifferenceK,
    diagnostics,
    input.roomId,
    'HEATING_MISSING_TEMPERATURE_DIFFERENCE',
    'Design temperature difference is unknown.',
  );
  missing(
    input.ventilationFlowM3s,
    diagnostics,
    input.roomId,
    'HEATING_MISSING_VENTILATION_FLOW',
    'Ventilation flow is unknown.',
  );
  missing(
    input.otherW,
    diagnostics,
    input.roomId,
    'HEATING_MISSING_OTHER_LOAD',
    'Additional design load is unknown.',
  );
  const transmissionW =
    input.transmissionHeatTransferCoefficientWK === undefined ||
    input.designTemperatureDifferenceK === undefined
      ? undefined
      : input.transmissionHeatTransferCoefficientWK *
        input.designTemperatureDifferenceK;
  const ventilationW =
    input.ventilationFlowM3s === undefined ||
    input.designTemperatureDifferenceK === undefined ||
    (input.heatRecoveryPresent === true &&
      input.heatRecoveryEfficiency === undefined)
      ? undefined
      : method.airDensityKgM3 *
        method.airSpecificHeatJKgK *
        input.ventilationFlowM3s *
        input.designTemperatureDifferenceK *
        (1 - (input.heatRecoveryEfficiency ?? 0));
  const complete =
    transmissionW !== undefined &&
    ventilationW !== undefined &&
    input.otherW !== undefined;
  const totalW = complete
    ? transmissionW + ventilationW + input.otherW
    : undefined;
  return {
    roomId: input.roomId,
    status: complete ? 'OK' : 'PARTIAL',
    ...(transmissionW === undefined ? {} : { transmissionW }),
    ...(ventilationW === undefined ? {} : { ventilationW }),
    ...(input.otherW === undefined ? {} : { otherW: input.otherW }),
    ...(totalW === undefined ? {} : { totalW }),
    ...(totalW === undefined ||
    input.floorAreaM2 === undefined ||
    input.floorAreaM2 === 0
      ? {}
      : { wattsPerM2: totalW / input.floorAreaM2 }),
    diagnostics,
  };
}

function missing(
  value: number | undefined,
  diagnostics: HeatingLoadDiagnostic[],
  roomId: string,
  code: HeatingLoadDiagnosticCode,
  message: string,
): void {
  if (value === undefined) diagnostics.push({ code, roomId, message });
}
function required(value: number | undefined): number {
  if (value === undefined) throw new Error('Complete heating load is unknown');
  return value;
}
function assertIdentifier(value: string, name: string): void {
  if (value.trim() === '') throw new TypeError(`${name} must not be empty`);
}
function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}
function validateOptionalNonNegative(
  value: number | undefined,
  name: string,
): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0))
    throw new RangeError(`${name} must be finite and non-negative`);
}
