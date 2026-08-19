import type { Assembly } from '@house-technical-designer/assemblies';
import type {
  Material,
  MaterialSource,
} from '@house-technical-designer/materials';

export interface ThermalMethod {
  readonly id: string;
  readonly version: string;
  readonly insideSurfaceResistanceM2KW: number;
  readonly outsideSurfaceResistanceM2KW: number;
}

export interface ThermalLayerInput {
  readonly layerId: string;
  readonly materialId: string;
  readonly thicknessM: number;
  readonly lambdaWmK?: number;
  readonly declaredResistanceM2KW?: number;
  readonly source?: MaterialSource;
}

export type ThermalDiagnosticCode =
  | 'THERMAL_MISSING_LAMBDA'
  | 'THERMAL_INVALID_THICKNESS'
  | 'THERMAL_INVALID_U_VALUE'
  | 'THERMAL_BRIDGE_NOT_INCLUDED';

export interface ThermalDiagnostic {
  readonly code: ThermalDiagnosticCode;
  readonly layerId?: string;
  readonly message: string;
}

export interface ThermalLayerResult {
  readonly layerId: string;
  readonly materialId: string;
  readonly thicknessM: number;
  readonly resistanceM2KW?: number;
  readonly resistanceSource?: 'DECLARED' | 'CALCULATED';
  readonly propertySource?: MaterialSource;
}

export interface ThermalResistanceResult {
  readonly status: 'OK' | 'PARTIAL';
  readonly methodId: string;
  readonly methodVersion: string;
  readonly insideSurfaceResistanceM2KW: number;
  readonly layers: readonly ThermalLayerResult[];
  readonly outsideSurfaceResistanceM2KW: number;
  readonly totalResistanceM2KW?: number;
  readonly uValueWm2K?: number;
  readonly diagnostics: readonly ThermalDiagnostic[];
}

export interface ThermalElementResult extends ThermalResistanceResult {
  readonly elementId: string;
  readonly netAreaM2: number;
  readonly heatTransferCoefficientWK?: number;
}

/** Calculates a homogeneous layer stack without inventing missing properties. */
export function calculateThermalResistance(
  layers: readonly ThermalLayerInput[],
  method: ThermalMethod,
): ThermalResistanceResult {
  assertNonNegativeFinite(
    method.insideSurfaceResistanceM2KW,
    'inside surface resistance',
  );
  assertNonNegativeFinite(
    method.outsideSurfaceResistanceM2KW,
    'outside surface resistance',
  );
  const diagnostics: ThermalDiagnostic[] = [];
  const results = layers.map((layer): ThermalLayerResult => {
    if (!Number.isFinite(layer.thicknessM) || layer.thicknessM <= 0) {
      diagnostics.push({
        code: 'THERMAL_INVALID_THICKNESS',
        layerId: layer.layerId,
        message: `Layer ${layer.layerId} thickness must be finite and greater than zero.`,
      });
      return layerResult(layer);
    }
    if (layer.declaredResistanceM2KW !== undefined) {
      if (
        !Number.isFinite(layer.declaredResistanceM2KW) ||
        layer.declaredResistanceM2KW <= 0
      ) {
        diagnostics.push({
          code: 'THERMAL_INVALID_U_VALUE',
          layerId: layer.layerId,
          message: `Layer ${layer.layerId} declared resistance must be finite and greater than zero.`,
        });
        return layerResult(layer);
      }
      return layerResult(layer, layer.declaredResistanceM2KW, 'DECLARED');
    }
    if (
      layer.lambdaWmK === undefined ||
      !Number.isFinite(layer.lambdaWmK) ||
      layer.lambdaWmK <= 0
    ) {
      diagnostics.push({
        code: 'THERMAL_MISSING_LAMBDA',
        layerId: layer.layerId,
        message: `Layer ${layer.layerId} requires a positive finite conductivity or a declared resistance.`,
      });
      return layerResult(layer);
    }
    return layerResult(layer, layer.thicknessM / layer.lambdaWmK, 'CALCULATED');
  });
  const base = {
    status: diagnostics.length === 0 ? ('OK' as const) : ('PARTIAL' as const),
    methodId: method.id,
    methodVersion: method.version,
    insideSurfaceResistanceM2KW: method.insideSurfaceResistanceM2KW,
    layers: results,
    outsideSurfaceResistanceM2KW: method.outsideSurfaceResistanceM2KW,
    diagnostics,
  };
  if (diagnostics.length > 0) return base;
  const totalResistanceM2KW =
    method.insideSurfaceResistanceM2KW +
    results.reduce((sum, layer) => sum + knownResistance(layer), 0) +
    method.outsideSurfaceResistanceM2KW;
  return {
    ...base,
    totalResistanceM2KW,
    uValueWm2K: 1 / totalResistanceM2KW,
  };
}

export function calculateElementTransmission(
  elementId: string,
  netAreaM2: number,
  layers: readonly ThermalLayerInput[],
  method: ThermalMethod,
): ThermalElementResult {
  assertNonNegativeFinite(netAreaM2, 'net area');
  const resistance = calculateThermalResistance(layers, method);
  return {
    ...resistance,
    elementId,
    netAreaM2,
    ...(resistance.uValueWm2K === undefined
      ? {}
      : { heatTransferCoefficientWK: resistance.uValueWm2K * netAreaM2 }),
  };
}

/** Resolves persisted assembly layers against the material catalog. */
export function assemblyThermalLayers(
  assembly: Assembly,
  materials: readonly Material[],
): readonly ThermalLayerInput[] {
  const byId = new Map(materials.map((material) => [material.id, material]));
  return assembly.layers.map((layer) => {
    const material = byId.get(layer.materialId);
    const source = material?.sources?.find(
      ({ property }) => property === 'lambdaWmK',
    );
    return {
      layerId: layer.id,
      materialId: layer.materialId,
      thicknessM: layer.thicknessM,
      ...(material?.properties.lambdaWmK === undefined
        ? {}
        : { lambdaWmK: material.properties.lambdaWmK }),
      ...(source === undefined ? {} : { source }),
    };
  });
}

function layerResult(
  layer: ThermalLayerInput,
  resistanceM2KW?: number,
  resistanceSource?: ThermalLayerResult['resistanceSource'],
): ThermalLayerResult {
  return {
    layerId: layer.layerId,
    materialId: layer.materialId,
    thicknessM: layer.thicknessM,
    ...(resistanceM2KW === undefined ? {} : { resistanceM2KW }),
    ...(resistanceSource === undefined ? {} : { resistanceSource }),
    ...(layer.source === undefined ? {} : { propertySource: layer.source }),
  };
}

function knownResistance(layer: ThermalLayerResult): number {
  if (layer.resistanceM2KW === undefined) {
    throw new Error('Complete thermal result contains an unknown resistance');
  }
  return layer.resistanceM2KW;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}
