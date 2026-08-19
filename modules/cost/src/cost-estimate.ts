export type CostUnit = 'm' | 'm2' | 'm3' | 'kg' | 'each';
export type CostLot =
  | 'STRUCTURE'
  | 'ENVELOPE'
  | 'INSULATION'
  | 'ROOF'
  | 'PLUMBING'
  | 'VENTILATION'
  | 'ELECTRICAL'
  | 'HEATING'
  | 'FINISHES'
  | 'OTHER';

export interface CostQuantity {
  readonly itemId: string;
  readonly sourceEntityId: string;
  readonly value: number;
  readonly unit: CostUnit;
  readonly lot: CostLot;
}

export interface CostSource {
  readonly sourceType: 'CATALOG' | 'SUPPLIER' | 'USER';
  readonly reference: string;
  readonly validAt?: string;
}

export interface CostEntry {
  readonly itemId: string;
  readonly materialPricePerUnit?: number;
  readonly laborPricePerUnit?: number;
  readonly currency?: string;
  readonly priceUnit: CostUnit;
  /** Ordered quantity increment, expressed in priceUnit. */
  readonly packageQuantity?: number;
  /** Explicit fractional allowance, for example 0.08. */
  readonly wasteFactor?: number;
  readonly source?: CostSource;
}

export type CostDiagnosticCode =
  | 'COST_MISSING_ENTRY'
  | 'COST_MISSING_PRICE'
  | 'COST_MISSING_CURRENCY'
  | 'COST_INCOMPATIBLE_UNIT'
  | 'COST_INCOMPATIBLE_CURRENCY';

export interface CostDiagnostic {
  readonly code: CostDiagnosticCode;
  readonly itemId?: string;
  readonly message: string;
}

export interface CostLineResult {
  readonly itemId: string;
  readonly sourceEntityId: string;
  readonly lot: CostLot;
  readonly physicalQuantity: number;
  readonly physicalUnit: CostUnit;
  readonly requiredQuantity?: number;
  readonly orderedQuantity?: number;
  readonly packageCount?: number;
  readonly materialCost?: number;
  readonly laborCost?: number;
  readonly totalCost?: number;
  readonly currency?: string;
  readonly source?: CostSource;
}

export interface CostLotResult {
  readonly lot: CostLot;
  readonly itemIds: readonly string[];
  readonly totalCost?: number;
  readonly currency?: string;
}

export interface CostEstimate {
  readonly status: 'OK' | 'PARTIAL';
  readonly lines: readonly CostLineResult[];
  readonly lots: readonly CostLotResult[];
  readonly totalCost?: number;
  readonly currency?: string;
  readonly diagnostics: readonly CostDiagnostic[];
}

/** Prices supplied physical quantities without mutating or replacing the takeoff. */
export function calculateCostEstimate(
  quantities: readonly CostQuantity[],
  entries: readonly CostEntry[],
): CostEstimate {
  validateUniqueIds(quantities, 'quantity');
  validateUniqueIds(entries, 'cost entry');
  const entriesById = new Map(entries.map((entry) => [entry.itemId, entry]));
  const diagnostics: CostDiagnostic[] = [];
  const lines = [...quantities]
    .sort((first, second) => first.itemId.localeCompare(second.itemId))
    .map((quantity): CostLineResult => {
      validateQuantity(quantity);
      const base = {
        itemId: quantity.itemId,
        sourceEntityId: quantity.sourceEntityId,
        lot: quantity.lot,
        physicalQuantity: quantity.value,
        physicalUnit: quantity.unit,
      } as const;
      const entry = entriesById.get(quantity.itemId);
      if (entry === undefined) {
        diagnostics.push({
          code: 'COST_MISSING_ENTRY',
          itemId: quantity.itemId,
          message: `No cost entry exists for ${quantity.itemId}.`,
        });
        return base;
      }
      validateEntry(entry);
      if (entry.priceUnit !== quantity.unit) {
        diagnostics.push({
          code: 'COST_INCOMPATIBLE_UNIT',
          itemId: quantity.itemId,
          message: `Quantity unit ${quantity.unit} is incompatible with price unit ${entry.priceUnit}.`,
        });
        return { ...base, ...optionalSource(entry.source) };
      }
      if (entry.currency === undefined || entry.currency.trim() === '') {
        diagnostics.push({
          code: 'COST_MISSING_CURRENCY',
          itemId: quantity.itemId,
          message: `Currency is unknown for ${quantity.itemId}.`,
        });
        return { ...base, ...optionalSource(entry.source) };
      }
      if (
        entry.materialPricePerUnit === undefined &&
        entry.laborPricePerUnit === undefined
      ) {
        diagnostics.push({
          code: 'COST_MISSING_PRICE',
          itemId: quantity.itemId,
          message: `Material and labor prices are unknown for ${quantity.itemId}.`,
        });
        return {
          ...base,
          currency: entry.currency,
          ...optionalSource(entry.source),
        };
      }
      if (
        entry.materialPricePerUnit === undefined ||
        entry.laborPricePerUnit === undefined
      ) {
        diagnostics.push({
          code: 'COST_MISSING_PRICE',
          itemId: quantity.itemId,
          message: `Material and labor prices must both be explicit for ${quantity.itemId}; use zero when a component does not apply.`,
        });
        return {
          ...base,
          currency: entry.currency,
          ...optionalSource(entry.source),
        };
      }
      const requiredQuantity = quantity.value * (1 + (entry.wasteFactor ?? 0));
      const packageCount =
        entry.packageQuantity === undefined
          ? undefined
          : Math.ceil(requiredQuantity / entry.packageQuantity);
      const orderedQuantity =
        packageCount === undefined
          ? requiredQuantity
          : packageCount * required(entry.packageQuantity);
      const materialCost = orderedQuantity * entry.materialPricePerUnit;
      const laborCost = quantity.value * entry.laborPricePerUnit;
      return {
        ...base,
        requiredQuantity,
        orderedQuantity,
        ...(packageCount === undefined ? {} : { packageCount }),
        materialCost,
        laborCost,
        totalCost: materialCost + laborCost,
        currency: entry.currency,
        ...optionalSource(entry.source),
      };
    });
  const currencies = new Set(
    lines.flatMap((line) =>
      line.totalCost === undefined || line.currency === undefined
        ? []
        : [line.currency],
    ),
  );
  if (currencies.size > 1)
    diagnostics.push({
      code: 'COST_INCOMPATIBLE_CURRENCY',
      message: `Cost estimate contains incompatible currencies: ${[...currencies].sort().join(', ')}.`,
    });
  const incompleteLines = lines.some(
    ({ totalCost }) => totalCost === undefined,
  );
  const commonCurrency = currencies.size === 1 ? [...currencies][0] : undefined;
  const lots = aggregateLots(lines, commonCurrency, currencies.size > 1);
  const canTotal = !incompleteLines && commonCurrency !== undefined;
  return {
    status: diagnostics.length === 0 ? 'OK' : 'PARTIAL',
    lines,
    lots,
    ...(canTotal
      ? {
          totalCost: lines.reduce(
            (sum, line) => sum + required(line.totalCost),
            0,
          ),
          currency: commonCurrency,
        }
      : {}),
    diagnostics,
  };
}

export interface CostScenario {
  readonly scenarioId: string;
  readonly estimate: CostEstimate;
}
export interface CostScenarioComparison {
  readonly scenarioId: string;
  readonly totalCost?: number;
  readonly currency?: string;
}

/** Provides transparent totals only; it deliberately creates no opaque score. */
export function compareCostScenarios(
  scenarios: readonly CostScenario[],
): readonly CostScenarioComparison[] {
  const ids = new Set<string>();
  return [...scenarios]
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))
    .map(({ scenarioId, estimate }) => {
      if (scenarioId.trim() === '' || ids.has(scenarioId))
        throw new TypeError(
          `Scenario IDs must be non-empty and unique: ${scenarioId}.`,
        );
      ids.add(scenarioId);
      return {
        scenarioId,
        ...(estimate.totalCost === undefined
          ? {}
          : { totalCost: estimate.totalCost, currency: estimate.currency }),
      };
    });
}

function aggregateLots(
  lines: readonly CostLineResult[],
  currency: string | undefined,
  mixedCurrencies: boolean,
): readonly CostLotResult[] {
  const groups = new Map<CostLot, CostLineResult[]>();
  for (const line of lines)
    groups.set(line.lot, [...(groups.get(line.lot) ?? []), line]);
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([lot, members]) => {
      const complete =
        !mixedCurrencies &&
        currency !== undefined &&
        members.every(
          ({ totalCost, currency: lineCurrency }) =>
            totalCost !== undefined && lineCurrency === currency,
        );
      return {
        lot,
        itemIds: members.map(({ itemId }) => itemId),
        ...(complete
          ? {
              totalCost: members.reduce(
                (sum, line) => sum + required(line.totalCost),
                0,
              ),
              currency,
            }
          : {}),
      };
    });
}
function validateQuantity(quantity: CostQuantity): void {
  if (quantity.itemId.trim() === '' || quantity.sourceEntityId.trim() === '')
    throw new TypeError('Cost quantity IDs must not be empty.');
  assertNonNegativeFinite(quantity.value, `quantity ${quantity.itemId}`);
}
function validateEntry(entry: CostEntry): void {
  if (entry.itemId.trim() === '')
    throw new TypeError('Cost entry ID must not be empty.');
  for (const [name, value] of [
    ['material price', entry.materialPricePerUnit],
    ['labor price', entry.laborPricePerUnit],
    ['waste factor', entry.wasteFactor],
  ] as const)
    if (value !== undefined)
      assertNonNegativeFinite(value, `${name} for ${entry.itemId}`);
  if (
    entry.packageQuantity !== undefined &&
    (!Number.isFinite(entry.packageQuantity) || entry.packageQuantity <= 0)
  )
    throw new RangeError(
      `package quantity for ${entry.itemId} must be finite and positive.`,
    );
}
function validateUniqueIds(
  values: readonly { readonly itemId: string }[],
  kind: string,
): void {
  const ids = new Set<string>();
  for (const { itemId } of values) {
    if (ids.has(itemId)) throw new TypeError(`Duplicate ${kind} ID ${itemId}.`);
    ids.add(itemId);
  }
}
function required(value: number | undefined): number {
  if (value === undefined) throw new Error('Complete cost value is unknown.');
  return value;
}
function optionalSource(source: CostSource | undefined): {
  readonly source?: CostSource;
} {
  return source === undefined ? {} : { source };
}
function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative.`);
}
