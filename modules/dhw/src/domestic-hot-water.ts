import {
  litres,
  litresToCubicMetres,
  numericValue,
} from '@house-technical-designer/units';

const JOULES_PER_KILOWATT_HOUR = 3_600_000;
const SECONDS_PER_HOUR = 3_600;

export interface DwhMethod {
  readonly id: string;
  readonly version: string;
  readonly waterDensityKgM3: number;
  readonly waterSpecificHeatJKgK: number;
}

export interface DwhInput {
  readonly dailyUseVolumeL?: number;
  readonly coldWaterTemperatureC?: number;
  readonly useTemperatureC?: number;
  readonly storageTemperatureC?: number;
  readonly tankVolumeL?: number;
  readonly usefulHeatingPowerW?: number;
  /** Explicit modeled days; omitted annual results remain unknown. */
  readonly annualOperatingDays?: number;
}

export type DwhDiagnosticCode =
  | 'DHW_MISSING_DAILY_VOLUME'
  | 'DHW_MISSING_COLD_TEMPERATURE'
  | 'DHW_MISSING_USE_TEMPERATURE'
  | 'DHW_MISSING_STORAGE_TEMPERATURE'
  | 'DHW_MISSING_TANK_VOLUME'
  | 'DHW_MISSING_HEATING_POWER'
  | 'DHW_MISSING_ANNUAL_OPERATING_DAYS';

export interface DwhDiagnostic {
  readonly code: DwhDiagnosticCode;
  readonly message: string;
}

export interface DwhResult {
  readonly status: 'OK' | 'PARTIAL';
  readonly methodId: string;
  readonly methodVersion: string;
  readonly dailyUsefulEnergyKWh?: number;
  readonly annualUsefulEnergyKWh?: number;
  readonly requiredStorageL?: number;
  readonly tankReheatingEnergyKWh?: number;
  readonly reheatingTimeH?: number;
  readonly diagnostics: readonly DwhDiagnostic[];
}

/** Calculates useful DHW energy, ideal mixing, and ideal tank reheating in SI. */
export function calculateDwh(input: DwhInput, method: DwhMethod): DwhResult {
  validateMethod(method);
  validateInput(input);
  const diagnostics: DwhDiagnostic[] = [];
  reportMissing(
    input.dailyUseVolumeL,
    'DHW_MISSING_DAILY_VOLUME',
    'Daily use volume is unknown.',
    diagnostics,
  );
  reportMissing(
    input.coldWaterTemperatureC,
    'DHW_MISSING_COLD_TEMPERATURE',
    'Cold-water temperature is unknown.',
    diagnostics,
  );
  reportMissing(
    input.useTemperatureC,
    'DHW_MISSING_USE_TEMPERATURE',
    'Use temperature is unknown.',
    diagnostics,
  );
  reportMissing(
    input.storageTemperatureC,
    'DHW_MISSING_STORAGE_TEMPERATURE',
    'Storage temperature is unknown.',
    diagnostics,
  );
  reportMissing(
    input.tankVolumeL,
    'DHW_MISSING_TANK_VOLUME',
    'Tank volume is unknown.',
    diagnostics,
  );
  reportMissing(
    input.usefulHeatingPowerW,
    'DHW_MISSING_HEATING_POWER',
    'Useful heating power is unknown.',
    diagnostics,
  );
  reportMissing(
    input.annualOperatingDays,
    'DHW_MISSING_ANNUAL_OPERATING_DAYS',
    'Annual operating days are unknown.',
    diagnostics,
  );

  const dailyUsefulEnergyKWh =
    input.dailyUseVolumeL === undefined ||
    input.coldWaterTemperatureC === undefined ||
    input.useTemperatureC === undefined
      ? undefined
      : sensibleEnergyKWh(
          input.dailyUseVolumeL,
          input.useTemperatureC - input.coldWaterTemperatureC,
          method,
        );
  const requiredStorageL =
    input.dailyUseVolumeL === undefined ||
    input.coldWaterTemperatureC === undefined ||
    input.useTemperatureC === undefined ||
    input.storageTemperatureC === undefined
      ? undefined
      : equivalentStorageVolumeL(
          input.dailyUseVolumeL,
          input.coldWaterTemperatureC,
          input.useTemperatureC,
          input.storageTemperatureC,
        );
  const tankReheatingEnergyKWh =
    input.tankVolumeL === undefined ||
    input.coldWaterTemperatureC === undefined ||
    input.storageTemperatureC === undefined
      ? undefined
      : sensibleEnergyKWh(
          input.tankVolumeL,
          input.storageTemperatureC - input.coldWaterTemperatureC,
          method,
        );
  const reheatingTimeH =
    tankReheatingEnergyKWh === undefined ||
    input.usefulHeatingPowerW === undefined
      ? undefined
      : (tankReheatingEnergyKWh * JOULES_PER_KILOWATT_HOUR) /
        input.usefulHeatingPowerW /
        SECONDS_PER_HOUR;
  return {
    status: diagnostics.length === 0 ? 'OK' : 'PARTIAL',
    methodId: method.id,
    methodVersion: method.version,
    ...(dailyUsefulEnergyKWh === undefined ? {} : { dailyUsefulEnergyKWh }),
    ...(dailyUsefulEnergyKWh === undefined ||
    input.annualOperatingDays === undefined
      ? {}
      : {
          annualUsefulEnergyKWh:
            dailyUsefulEnergyKWh * input.annualOperatingDays,
        }),
    ...(requiredStorageL === undefined ? {} : { requiredStorageL }),
    ...(tankReheatingEnergyKWh === undefined ? {} : { tankReheatingEnergyKWh }),
    ...(reheatingTimeH === undefined ? {} : { reheatingTimeH }),
    diagnostics,
  };
}

export function sensibleEnergyKWh(
  volumeL: number,
  temperatureDifferenceK: number,
  method: DwhMethod,
): number {
  assertNonNegativeFinite(volumeL, 'water volume');
  assertNonNegativeFinite(temperatureDifferenceK, 'temperature difference');
  validateMethod(method);
  const volumeM3 = numericValue(litresToCubicMetres(litres(volumeL)));
  const massKg = volumeM3 * method.waterDensityKgM3;
  return (
    (massKg * method.waterSpecificHeatJKgK * temperatureDifferenceK) /
    JOULES_PER_KILOWATT_HOUR
  );
}

export function equivalentStorageVolumeL(
  useVolumeL: number,
  coldC: number,
  useC: number,
  storageC: number,
): number {
  assertNonNegativeFinite(useVolumeL, 'use volume');
  assertFinite(coldC, 'cold-water temperature');
  assertFinite(useC, 'use temperature');
  assertFinite(storageC, 'storage temperature');
  if (useC < coldC)
    throw new RangeError(
      'use temperature must not be below cold-water temperature',
    );
  if (storageC <= coldC)
    throw new RangeError(
      'storage temperature must be above cold-water temperature',
    );
  if (storageC < useC)
    throw new RangeError(
      'storage temperature must not be below use temperature',
    );
  return useVolumeL * ((useC - coldC) / (storageC - coldC));
}

function validateInput(input: DwhInput): void {
  for (const [name, value] of [
    ['daily use volume', input.dailyUseVolumeL],
    ['tank volume', input.tankVolumeL],
    ['annual operating days', input.annualOperatingDays],
  ] as const)
    if (value !== undefined) assertNonNegativeFinite(value, name);
  if (input.usefulHeatingPowerW !== undefined)
    assertPositiveFinite(input.usefulHeatingPowerW, 'useful heating power');
  for (const [name, value] of [
    ['cold-water temperature', input.coldWaterTemperatureC],
    ['use temperature', input.useTemperatureC],
    ['storage temperature', input.storageTemperatureC],
  ] as const)
    if (value !== undefined) assertFinite(value, name);
  if (
    input.coldWaterTemperatureC !== undefined &&
    input.useTemperatureC !== undefined &&
    input.useTemperatureC < input.coldWaterTemperatureC
  )
    throw new RangeError(
      'use temperature must not be below cold-water temperature',
    );
  if (
    input.coldWaterTemperatureC !== undefined &&
    input.storageTemperatureC !== undefined &&
    input.storageTemperatureC <= input.coldWaterTemperatureC
  )
    throw new RangeError(
      'storage temperature must be above cold-water temperature',
    );
  if (
    input.useTemperatureC !== undefined &&
    input.storageTemperatureC !== undefined &&
    input.storageTemperatureC < input.useTemperatureC
  )
    throw new RangeError(
      'storage temperature must not be below use temperature',
    );
}

function validateMethod(method: DwhMethod): void {
  if (method.id.trim() === '' || method.version.trim() === '')
    throw new TypeError('DHW method ID and version must not be empty');
  assertPositiveFinite(method.waterDensityKgM3, 'water density');
  assertPositiveFinite(method.waterSpecificHeatJKgK, 'water specific heat');
}
function reportMissing(
  value: number | undefined,
  code: DwhDiagnosticCode,
  message: string,
  diagnostics: DwhDiagnostic[],
): void {
  if (value === undefined) diagnostics.push({ code, message });
}
function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}
function assertNonNegativeFinite(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
}
function assertPositiveFinite(value: number, name: string): void {
  assertFinite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
}
