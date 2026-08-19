export const STEADY_STATE_HYGROTHERMAL_METHOD_ID =
  'steady-state-vapor-profile-v1' as const;

export type HygrothermalLimitation =
  | 'HYGROSCOPIC_MATERIAL'
  | 'LIQUID_TRANSFER'
  | 'BELOW_GRADE_ASSEMBLY'
  | 'WATER_INFILTRATION'
  | 'COMPLEX_ROOF'
  | 'VENTILATED_ASSEMBLY'
  | 'CONSTRUCTION_DRYING'
  | 'NEEDS_DYNAMIC_SIMULATION';

export interface HygrothermalLayer {
  readonly id: string;
  readonly thicknessM: number;
  readonly thermalResistanceM2KW?: number;
  /** Documented equivalent air-layer thickness, preferred when available. */
  readonly sdM?: number;
  /** Water-vapour resistance factor, used as Sd = mu * thickness. */
  readonly mu?: number;
  readonly limitations?: readonly HygrothermalLimitation[];
}

export interface SteadyStateHygrothermalInput {
  readonly assemblyId: string;
  readonly period: string;
  /** Layers ordered from interior to exterior. */
  readonly layers: readonly HygrothermalLayer[];
  readonly indoorTemperatureC: number;
  readonly indoorRelativeHumidity: number;
  readonly outdoorTemperatureC: number;
  readonly outdoorRelativeHumidity: number;
  readonly interiorSurfaceResistanceM2KW: number;
  readonly exteriorSurfaceResistanceM2KW: number;
}

export interface HygrothermalInterfaceState {
  readonly interfaceIndex: number;
  readonly afterLayerId?: string;
  readonly temperatureC: number;
  readonly vaporPressurePa: number;
  readonly saturationPressurePa: number;
  readonly relativeHumidity: number;
  readonly condensation: boolean;
}

export interface HygrothermalDiagnostic {
  readonly code:
    | 'HYG_INVALID_INPUT'
    | 'HYG_UNKNOWN_THERMAL_RESISTANCE'
    | 'HYG_UNKNOWN_VAPOR_RESISTANCE'
    | 'HYG_VAPOR_PROPERTY_MISMATCH'
    | 'HYG_METHOD_LIMITATION';
  readonly path: string;
  readonly message: string;
}

export interface SteadyStateHygrothermalResult {
  readonly status: 'OK' | 'UNKNOWN' | 'INVALID';
  readonly methodId: typeof STEADY_STATE_HYGROTHERMAL_METHOD_ID;
  readonly applicability: 'VALID' | 'LIMITED' | 'NOT_APPLICABLE';
  readonly assemblyId: string;
  readonly period: string;
  readonly totalThermalResistanceM2KW?: number;
  readonly totalSdM?: number;
  readonly interfaces: readonly HygrothermalInterfaceState[];
  readonly diagnostics: readonly HygrothermalDiagnostic[];
  readonly assumptions: readonly string[];
  readonly references: readonly string[];
}

export interface InteriorSurfaceRiskResult {
  readonly status: 'LOW_RISK' | 'HIGH_RISK' | 'UNKNOWN';
  readonly surfaceTemperatureC?: number;
  readonly surfaceRelativeHumidity?: number;
  readonly vaporPressurePa?: number;
  readonly saturationPressurePa?: number;
}

/** Saturation vapour pressure over water using a Magnus-type equation. */
export function saturationVaporPressurePa(temperatureC: number): number {
  if (!Number.isFinite(temperatureC))
    throw new RangeError('temperature must be finite');
  return 610.5 * Math.exp((17.2694 * temperatureC) / (237.29 + temperatureC));
}

export function vaporPressurePa(
  temperatureC: number,
  relativeHumidity: number,
): number {
  if (
    !Number.isFinite(relativeHumidity) ||
    relativeHumidity < 0 ||
    relativeHumidity > 1
  )
    throw new RangeError('relative humidity must be a fraction in [0, 1]');
  return relativeHumidity * saturationVaporPressurePa(temperatureC);
}

export function equivalentAirLayerThicknessM(
  mu: number,
  thicknessM: number,
): number {
  if (!finitePositive(mu) || !finitePositive(thicknessM))
    throw new RangeError('mu and thickness must be finite and positive');
  return mu * thicknessM;
}

/** Condensation-only surface screening; no arbitrary WATCH threshold is assumed. */
export function assessInteriorSurfaceRisk(
  surfaceTemperatureC: number | undefined,
  indoorTemperatureC: number,
  indoorRelativeHumidity: number,
): InteriorSurfaceRiskResult {
  if (surfaceTemperatureC === undefined) return { status: 'UNKNOWN' };
  if (
    !validTemperature(surfaceTemperatureC) ||
    !validTemperature(indoorTemperatureC)
  )
    throw new RangeError(
      'temperatures must be finite and inside the formula domain',
    );
  const interiorVaporPressurePa = vaporPressurePa(
    indoorTemperatureC,
    indoorRelativeHumidity,
  );
  const surfaceSaturationPressurePa =
    saturationVaporPressurePa(surfaceTemperatureC);
  return {
    status:
      interiorVaporPressurePa > surfaceSaturationPressurePa
        ? 'HIGH_RISK'
        : 'LOW_RISK',
    surfaceTemperatureC,
    surfaceRelativeHumidity:
      interiorVaporPressurePa / surfaceSaturationPressurePa,
    vaporPressurePa: interiorVaporPressurePa,
    saturationPressurePa: surfaceSaturationPressurePa,
  };
}

export function assessSteadyStateHygrothermal(
  input: SteadyStateHygrothermalInput,
): SteadyStateHygrothermalResult {
  const diagnostics = validateInput(input);
  const base = {
    assemblyId: input.assemblyId,
    period: input.period,
    methodId: STEADY_STATE_HYGROTHERMAL_METHOD_ID,
    interfaces: [] as readonly HygrothermalInterfaceState[],
    diagnostics,
    assumptions: [
      'One-dimensional steady-state heat and vapour diffusion.',
      'Material properties and boundary conditions remain constant for the period.',
      'No moisture storage, liquid transport, air leakage, or transient drying is modelled.',
    ],
    references: [
      'Method scope informed by ISO 13788:2012; this implementation does not claim conformity.',
    ],
  };
  if (diagnostics.some(({ code }) => code === 'HYG_INVALID_INPUT'))
    return { ...base, status: 'INVALID', applicability: 'NOT_APPLICABLE' };

  const hasUnknown = diagnostics.some(
    ({ code }) =>
      code === 'HYG_UNKNOWN_THERMAL_RESISTANCE' ||
      code === 'HYG_UNKNOWN_VAPOR_RESISTANCE',
  );
  if (hasUnknown)
    return { ...base, status: 'UNKNOWN', applicability: 'NOT_APPLICABLE' };

  const thermalResistances = input.layers.map(
    ({ thermalResistanceM2KW }) => thermalResistanceM2KW!,
  );
  const sdValues = input.layers.map(resolveSdM);
  const totalThermalResistanceM2KW =
    input.interiorSurfaceResistanceM2KW +
    sum(thermalResistances) +
    input.exteriorSurfaceResistanceM2KW;
  const totalSdM = sum(sdValues);
  const indoorVaporPressurePa = vaporPressurePa(
    input.indoorTemperatureC,
    input.indoorRelativeHumidity,
  );
  const outdoorVaporPressurePa = vaporPressurePa(
    input.outdoorTemperatureC,
    input.outdoorRelativeHumidity,
  );

  let cumulativeThermalResistance = input.interiorSurfaceResistanceM2KW;
  let cumulativeSdM = 0;
  const interfaces: HygrothermalInterfaceState[] = [];
  for (let index = 0; index <= input.layers.length; index += 1) {
    if (index > 0) {
      cumulativeThermalResistance += thermalResistances[index - 1]!;
      cumulativeSdM += sdValues[index - 1]!;
    }
    const temperatureC =
      input.indoorTemperatureC +
      (input.outdoorTemperatureC - input.indoorTemperatureC) *
        (cumulativeThermalResistance / totalThermalResistanceM2KW);
    const interfaceVaporPressurePa =
      indoorVaporPressurePa +
      (outdoorVaporPressurePa - indoorVaporPressurePa) *
        (cumulativeSdM / totalSdM);
    const saturationPressurePa = saturationVaporPressurePa(temperatureC);
    interfaces.push({
      interfaceIndex: index,
      ...(index === 0 ? {} : { afterLayerId: input.layers[index - 1]!.id }),
      temperatureC,
      vaporPressurePa: interfaceVaporPressurePa,
      saturationPressurePa,
      relativeHumidity: interfaceVaporPressurePa / saturationPressurePa,
      condensation: interfaceVaporPressurePa > saturationPressurePa,
    });
  }

  const limited = diagnostics.some(
    ({ code }) =>
      code === 'HYG_METHOD_LIMITATION' ||
      code === 'HYG_VAPOR_PROPERTY_MISMATCH',
  );
  return {
    ...base,
    status: 'OK',
    applicability: limited ? 'LIMITED' : 'VALID',
    totalThermalResistanceM2KW,
    totalSdM,
    interfaces,
  };
}

function validateInput(
  input: SteadyStateHygrothermalInput,
): HygrothermalDiagnostic[] {
  const diagnostics: HygrothermalDiagnostic[] = [];
  if (
    input.assemblyId.trim() === '' ||
    input.period.trim() === '' ||
    input.layers.length === 0 ||
    !validTemperature(input.indoorTemperatureC) ||
    !validTemperature(input.outdoorTemperatureC) ||
    !validRelativeHumidity(input.indoorRelativeHumidity) ||
    !validRelativeHumidity(input.outdoorRelativeHumidity) ||
    !finiteNonNegative(input.interiorSurfaceResistanceM2KW) ||
    !finiteNonNegative(input.exteriorSurfaceResistanceM2KW)
  )
    diagnostics.push({
      code: 'HYG_INVALID_INPUT',
      path: 'input',
      message:
        'Identifiers, conditions, layers, and surface resistances must be finite and physically valid.',
    });
  input.layers.forEach((layer, index) => {
    const path = `layers[${index}]`;
    if (
      layer.id.trim() === '' ||
      !finitePositive(layer.thicknessM) ||
      (layer.thermalResistanceM2KW !== undefined &&
        !finitePositive(layer.thermalResistanceM2KW)) ||
      (layer.sdM !== undefined && !finitePositive(layer.sdM)) ||
      (layer.mu !== undefined && !finitePositive(layer.mu))
    )
      diagnostics.push({
        code: 'HYG_INVALID_INPUT',
        path,
        message:
          'Layer identifiers, thicknesses, and supplied properties must be finite and positive.',
      });
    if (layer.thermalResistanceM2KW === undefined)
      diagnostics.push({
        code: 'HYG_UNKNOWN_THERMAL_RESISTANCE',
        path: `${path}.thermalResistanceM2KW`,
        message: 'The layer thermal resistance is unknown.',
      });
    if (layer.sdM === undefined && layer.mu === undefined)
      diagnostics.push({
        code: 'HYG_UNKNOWN_VAPOR_RESISTANCE',
        path,
        message: 'Neither documented Sd nor mu is available for the layer.',
      });
    if (
      layer.sdM !== undefined &&
      layer.mu !== undefined &&
      Math.abs(layer.sdM - layer.mu * layer.thicknessM) >
        Math.max(layer.sdM, layer.mu * layer.thicknessM) * 1e-9
    )
      diagnostics.push({
        code: 'HYG_VAPOR_PROPERTY_MISMATCH',
        path,
        message:
          'Documented Sd differs from mu × thickness; documented Sd is used and applicability is limited.',
      });
    layer.limitations?.forEach((limitation) =>
      diagnostics.push({
        code: 'HYG_METHOD_LIMITATION',
        path: `${path}.limitations`,
        message: `${limitation} is outside the complete scope of the simplified steady-state method.`,
      }),
    );
  });
  const layerIds = input.layers.map(({ id }) => id);
  if (new Set(layerIds).size !== layerIds.length)
    diagnostics.push({
      code: 'HYG_INVALID_INPUT',
      path: 'layers',
      message: 'Layer identifiers must be unique.',
    });
  return diagnostics;
}

function resolveSdM(layer: HygrothermalLayer): number {
  return layer.sdM ?? equivalentAirLayerThicknessM(layer.mu!, layer.thicknessM);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function validTemperature(value: number): boolean {
  return Number.isFinite(value) && value > -237.29;
}

function validRelativeHumidity(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
