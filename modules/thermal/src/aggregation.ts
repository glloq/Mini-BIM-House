import type { MaterialSource } from '@house-technical-designer/materials';
import type { ThermalDiagnostic, ThermalElementResult } from './thermal.js';

export interface ThermalElementAssignment {
  readonly result: ThermalElementResult;
  readonly roomId?: string;
  readonly zoneId?: string;
  readonly levelId?: string;
}

export interface LinearThermalBridge {
  readonly id: string;
  readonly junctionType: string;
  readonly lengthM: number;
  readonly psiWmK: number;
  readonly source: MaterialSource;
}

export interface PointThermalBridge {
  readonly id: string;
  readonly chiWK: number;
  readonly source: MaterialSource;
}

export interface ThermalBridgeResult {
  readonly id: string;
  readonly kind: 'LINEAR' | 'POINT';
  readonly heatTransferCoefficientWK: number;
}

export interface ThermalGroupResult {
  readonly id: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly elementIds: readonly string[];
  readonly heatTransferCoefficientWK?: number;
}

export interface ThermalEnvelopeAggregation {
  readonly status: 'OK' | 'PARTIAL';
  readonly totalHeatTransferCoefficientWK?: number;
  readonly designTransmissionLossW?: number;
  readonly elements: readonly ThermalElementResult[];
  readonly bridges: readonly ThermalBridgeResult[];
  readonly rooms: readonly ThermalGroupResult[];
  readonly zones: readonly ThermalGroupResult[];
  readonly levels: readonly ThermalGroupResult[];
  readonly diagnostics: readonly ThermalDiagnostic[];
}

export interface ThermalAggregationInput {
  readonly elements: readonly ThermalElementAssignment[];
  readonly linearBridges?: readonly LinearThermalBridge[];
  readonly pointBridges?: readonly PointThermalBridge[];
  /** Omit bridges explicitly when they have not been assessed. */
  readonly bridgeMode: 'NONE' | 'MANUAL' | 'CATALOG' | 'NUMERICAL';
  readonly designTemperatureDifferenceK?: number;
}

/** Aggregates already-derived element results; it never persists the totals. */
export function aggregateThermalEnvelope(
  input: ThermalAggregationInput,
): ThermalEnvelopeAggregation {
  const diagnostics = input.elements.flatMap(
    ({ result }) => result.diagnostics,
  );
  const bridgeResults: ThermalBridgeResult[] = [];
  if (input.bridgeMode === 'NONE') {
    diagnostics.push({
      code: 'THERMAL_BRIDGE_NOT_INCLUDED',
      message:
        'Les ponts thermiques ne sont pas évalués : ils sont exclus du résultat.',
    });
  } else {
    for (const bridge of input.linearBridges ?? []) {
      assertNonNegativeFinite(bridge.lengthM, `bridge ${bridge.id} length`);
      assertNonNegativeFinite(bridge.psiWmK, `bridge ${bridge.id} psi`);
      bridgeResults.push({
        id: bridge.id,
        kind: 'LINEAR',
        heatTransferCoefficientWK: bridge.lengthM * bridge.psiWmK,
      });
    }
    for (const bridge of input.pointBridges ?? []) {
      assertNonNegativeFinite(bridge.chiWK, `bridge ${bridge.id} chi`);
      bridgeResults.push({
        id: bridge.id,
        kind: 'POINT',
        heatTransferCoefficientWK: bridge.chiWK,
      });
    }
  }
  const rooms = aggregateGroups(input.elements, ({ roomId }) => roomId);
  const zones = aggregateGroups(input.elements, ({ zoneId }) => zoneId);
  const levels = aggregateGroups(input.elements, ({ levelId }) => levelId);
  const incompleteElement = input.elements.some(
    ({ result }) => result.heatTransferCoefficientWK === undefined,
  );
  const status = incompleteElement || diagnostics.length > 0 ? 'PARTIAL' : 'OK';
  const base = {
    status,
    elements: input.elements.map(({ result }) => result),
    bridges: bridgeResults,
    rooms,
    zones,
    levels,
    diagnostics,
  } as const;
  if (incompleteElement) return base;
  const totalHeatTransferCoefficientWK =
    input.elements.reduce(
      (sum, { result }) => sum + requiredElementCoefficient(result),
      0,
    ) +
    bridgeResults.reduce(
      (sum, bridge) => sum + bridge.heatTransferCoefficientWK,
      0,
    );
  if (input.designTemperatureDifferenceK === undefined) {
    return { ...base, totalHeatTransferCoefficientWK };
  }
  assertNonNegativeFinite(
    input.designTemperatureDifferenceK,
    'design temperature difference',
  );
  return {
    ...base,
    totalHeatTransferCoefficientWK,
    designTransmissionLossW:
      totalHeatTransferCoefficientWK * input.designTemperatureDifferenceK,
  };
}

function aggregateGroups(
  assignments: readonly ThermalElementAssignment[],
  selectId: (assignment: ThermalElementAssignment) => string | undefined,
): readonly ThermalGroupResult[] {
  const groups = new Map<string, ThermalElementResult[]>();
  for (const assignment of assignments) {
    const id = selectId(assignment);
    if (id === undefined) continue;
    const members = groups.get(id) ?? [];
    members.push(assignment.result);
    groups.set(id, members);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([id, members]) => {
      const incomplete = members.some(
        ({ heatTransferCoefficientWK }) =>
          heatTransferCoefficientWK === undefined,
      );
      return {
        id,
        status: incomplete ? ('PARTIAL' as const) : ('OK' as const),
        elementIds: members.map(({ elementId }) => elementId),
        ...(incomplete
          ? {}
          : {
              heatTransferCoefficientWK: members.reduce(
                (sum, member) => sum + requiredElementCoefficient(member),
                0,
              ),
            }),
      };
    });
}

function requiredElementCoefficient(result: ThermalElementResult): number {
  if (result.heatTransferCoefficientWK === undefined) {
    throw new Error('Complete thermal aggregate contains an unknown element');
  }
  return result.heatTransferCoefficientWK;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative`);
  }
}
