export type EnvironmentalQuantityUnit = 'm' | 'm2' | 'm3' | 'kg' | 'each';
export type DeclarationType = 'FDES' | 'PEP' | 'DED' | 'CUSTOM';
export type LifeCycleStage =
  | 'PRODUCT'
  | 'CONSTRUCTION'
  | 'USE'
  | 'END_OF_LIFE'
  | 'BENEFITS_BEYOND_BOUNDARY';

export interface EnvironmentalQuantity {
  readonly itemId: string;
  readonly projectObjectId: string;
  readonly materialId?: string;
  readonly levelId?: string;
  readonly lot: string;
  readonly value: number;
  readonly unit: EnvironmentalQuantityUnit;
}

export interface EnvironmentalDataLink {
  readonly projectObjectId: string;
  readonly declarationId: string;
  readonly declarationType: DeclarationType;
  readonly projectQuantityUnit: EnvironmentalQuantityUnit;
  readonly functionalUnit: string;
  /** Functional units per one project quantity unit. */
  readonly conversionFactor: number;
}

export interface EnvironmentalDeclaration {
  readonly id: string;
  readonly type: DeclarationType;
  readonly version: string;
  readonly functionalUnit: string;
  readonly indicator: string;
  readonly indicatorUnit: string;
  readonly impactsByStage: Readonly<Partial<Record<LifeCycleStage, number>>>;
  readonly source: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
}

export type EnvironmentalDiagnosticCode =
  | 'ENV_MISSING_LINK'
  | 'ENV_MISSING_DECLARATION'
  | 'ENV_INCOMPATIBLE_UNIT'
  | 'ENV_INCOMPATIBLE_INDICATOR'
  | 'ENV_MISSING_IMPACT'
  | 'ENV_DECLARATION_NOT_YET_VALID'
  | 'ENV_EXPIRED_DECLARATION';

export interface EnvironmentalDiagnostic {
  readonly code: EnvironmentalDiagnosticCode;
  readonly itemId?: string;
  readonly declarationId?: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export interface EnvironmentalItemResult {
  readonly itemId: string;
  readonly projectObjectId: string;
  readonly materialId?: string;
  readonly levelId?: string;
  readonly lot: string;
  readonly projectQuantity: number;
  readonly projectQuantityUnit: EnvironmentalQuantityUnit;
  readonly declarationId?: string;
  readonly declarationVersion?: string;
  readonly declarationType?: DeclarationType;
  readonly functionalUnit?: string;
  readonly conversionFactor?: number;
  readonly functionalUnitQuantity?: number;
  readonly impactsByStage?: Readonly<Partial<Record<LifeCycleStage, number>>>;
  readonly totalImpact?: number;
  readonly indicator?: string;
  readonly indicatorUnit?: string;
  readonly source?: string;
}

export interface EnvironmentalGroupResult {
  readonly id: string;
  readonly itemIds: readonly string[];
  readonly totalImpact?: number;
}

export interface EnvironmentalImpactResult {
  readonly status: 'OK' | 'PARTIAL' | 'FAILED';
  readonly evaluationDate: string;
  readonly indicator?: string;
  readonly indicatorUnit?: string;
  readonly items: readonly EnvironmentalItemResult[];
  readonly lots: readonly EnvironmentalGroupResult[];
  readonly levels: readonly EnvironmentalGroupResult[];
  readonly totalImpact?: number;
  readonly diagnostics: readonly EnvironmentalDiagnostic[];
}

/** Applies only explicit object-to-declaration links and conversion factors. */
export function calculateEnvironmentalImpacts(
  quantities: readonly EnvironmentalQuantity[],
  links: readonly EnvironmentalDataLink[],
  declarations: readonly EnvironmentalDeclaration[],
  evaluationDate: string,
): EnvironmentalImpactResult {
  const evaluation = parseDate(evaluationDate, 'evaluation date');
  validateUnique(quantities, ({ itemId }) => itemId, 'quantity item');
  validateUnique(
    links,
    ({ projectObjectId }) => projectObjectId,
    'environmental link',
  );
  validateUnique(declarations, ({ id }) => id, 'environmental declaration');
  const linkByObject = new Map(
    links.map((link) => [link.projectObjectId, link]),
  );
  const declarationById = new Map(
    declarations.map((declaration) => [declaration.id, declaration]),
  );
  const diagnostics: EnvironmentalDiagnostic[] = [];
  const items = [...quantities]
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((quantity): EnvironmentalItemResult => {
      validateQuantity(quantity);
      const base = {
        itemId: quantity.itemId,
        projectObjectId: quantity.projectObjectId,
        ...optional('materialId', quantity.materialId),
        ...optional('levelId', quantity.levelId),
        lot: quantity.lot,
        projectQuantity: quantity.value,
        projectQuantityUnit: quantity.unit,
      } as EnvironmentalItemResult;
      const link = linkByObject.get(quantity.projectObjectId);
      if (link === undefined) {
        diagnostics.push({
          code: 'ENV_MISSING_LINK',
          itemId: quantity.itemId,
          severity: 'ERROR',
          message: `Object ${quantity.projectObjectId} has no environmental data link.`,
        });
        return base;
      }
      validateLink(link);
      const declaration = declarationById.get(link.declarationId);
      if (declaration === undefined) {
        diagnostics.push({
          code: 'ENV_MISSING_DECLARATION',
          itemId: quantity.itemId,
          declarationId: link.declarationId,
          severity: 'ERROR',
          message: `Declaration ${link.declarationId} is missing.`,
        });
        return base;
      }
      validateDeclaration(declaration);
      if (
        quantity.unit !== link.projectQuantityUnit ||
        link.functionalUnit !== declaration.functionalUnit ||
        link.declarationType !== declaration.type
      ) {
        diagnostics.push({
          code: 'ENV_INCOMPATIBLE_UNIT',
          itemId: quantity.itemId,
          declarationId: declaration.id,
          severity: 'ERROR',
          message: `Quantity/link/declaration units or declaration types are incompatible for ${quantity.itemId}.`,
        });
        return base;
      }
      if (
        declaration.validUntil !== undefined &&
        evaluation >
          parseDate(
            declaration.validUntil,
            `declaration ${declaration.id} validity end`,
          )
      )
        diagnostics.push({
          code: 'ENV_EXPIRED_DECLARATION',
          itemId: quantity.itemId,
          declarationId: declaration.id,
          severity: 'WARNING',
          message: `Declaration ${declaration.id} is expired at ${evaluationDate}.`,
        });
      if (
        declaration.validFrom !== undefined &&
        evaluation <
          parseDate(
            declaration.validFrom,
            `declaration ${declaration.id} validity start`,
          )
      )
        diagnostics.push({
          code: 'ENV_DECLARATION_NOT_YET_VALID',
          itemId: quantity.itemId,
          declarationId: declaration.id,
          severity: 'WARNING',
          message: `Declaration ${declaration.id} is not yet valid at ${evaluationDate}.`,
        });
      if (Object.keys(declaration.impactsByStage).length === 0) {
        diagnostics.push({
          code: 'ENV_MISSING_IMPACT',
          itemId: quantity.itemId,
          declarationId: declaration.id,
          severity: 'ERROR',
          message: `Declaration ${declaration.id} has no impact values.`,
        });
        return base;
      }
      const functionalUnitQuantity = quantity.value * link.conversionFactor;
      const impactsByStage = Object.fromEntries(
        Object.entries(declaration.impactsByStage).map(([stage, impact]) => [
          stage,
          required(impact) * functionalUnitQuantity,
        ]),
      ) as Partial<Record<LifeCycleStage, number>>;
      const totalImpact = Object.values(impactsByStage).reduce<number>(
        (sum, impact) => sum + required(impact),
        0,
      );
      return {
        ...base,
        declarationId: declaration.id,
        declarationVersion: declaration.version,
        declarationType: declaration.type,
        functionalUnit: declaration.functionalUnit,
        conversionFactor: link.conversionFactor,
        functionalUnitQuantity,
        impactsByStage,
        totalImpact,
        indicator: declaration.indicator,
        indicatorUnit: declaration.indicatorUnit,
        source: declaration.source,
      };
    });
  const knownItems = items.filter(
    (
      item,
    ): item is EnvironmentalItemResult & {
      totalImpact: number;
      indicator: string;
      indicatorUnit: string;
    } =>
      item.totalImpact !== undefined &&
      item.indicator !== undefined &&
      item.indicatorUnit !== undefined,
  );
  const indicatorKeys = new Set(
    knownItems.map(
      ({ indicator, indicatorUnit }) => `${indicator}\0${indicatorUnit}`,
    ),
  );
  if (indicatorKeys.size > 1)
    diagnostics.push({
      code: 'ENV_INCOMPATIBLE_INDICATOR',
      severity: 'ERROR',
      message:
        'Environmental declarations use incompatible indicators or indicator units.',
    });
  const incomplete = items.some(({ totalImpact }) => totalImpact === undefined);
  const compatible = indicatorKeys.size <= 1;
  const canTotal =
    !incomplete &&
    compatible &&
    knownItems.length === items.length &&
    items.length > 0;
  const indicator = canTotal ? knownItems[0]?.indicator : undefined;
  const indicatorUnit = canTotal ? knownItems[0]?.indicatorUnit : undefined;
  const indicatorMetadata =
    indicator === undefined || indicatorUnit === undefined
      ? {}
      : { indicator, indicatorUnit };
  return {
    status: diagnostics.some(({ severity }) => severity === 'ERROR')
      ? 'FAILED'
      : diagnostics.length > 0
        ? 'PARTIAL'
        : 'OK',
    evaluationDate,
    ...indicatorMetadata,
    items,
    lots: aggregate(items, (item) => item.lot, compatible),
    levels: aggregate(items, (item) => item.levelId, compatible),
    ...(canTotal
      ? {
          totalImpact: knownItems.reduce(
            (sum, item) => sum + item.totalImpact,
            0,
          ),
        }
      : {}),
    diagnostics,
  };
}

function aggregate(
  items: readonly EnvironmentalItemResult[],
  select: (item: EnvironmentalItemResult) => string | undefined,
  compatible: boolean,
): readonly EnvironmentalGroupResult[] {
  const groups = new Map<string, EnvironmentalItemResult[]>();
  for (const item of items) {
    const id = select(item);
    if (id !== undefined) groups.set(id, [...(groups.get(id) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, members]) => ({
      id,
      itemIds: members.map(({ itemId }) => itemId),
      ...(compatible &&
      members.every(({ totalImpact }) => totalImpact !== undefined)
        ? {
            totalImpact: members.reduce(
              (sum, item) => sum + required(item.totalImpact),
              0,
            ),
          }
        : {}),
    }));
}
function validateQuantity(quantity: EnvironmentalQuantity): void {
  if (
    quantity.itemId.trim() === '' ||
    quantity.projectObjectId.trim() === '' ||
    quantity.lot.trim() === ''
  )
    throw new TypeError(
      'Environmental quantity identifiers must not be empty.',
    );
  assertNonNegativeFinite(quantity.value, `quantity ${quantity.itemId}`);
}
function validateLink(link: EnvironmentalDataLink): void {
  if (
    link.projectObjectId.trim() === '' ||
    link.declarationId.trim() === '' ||
    link.functionalUnit.trim() === ''
  )
    throw new TypeError(
      'Environmental link identifiers and functional unit must not be empty.',
    );
  assertNonNegativeFinite(
    link.conversionFactor,
    `conversion factor for ${link.projectObjectId}`,
  );
}
function validateDeclaration(declaration: EnvironmentalDeclaration): void {
  if (
    [
      declaration.id,
      declaration.version,
      declaration.functionalUnit,
      declaration.indicator,
      declaration.indicatorUnit,
      declaration.source,
    ].some((value) => value.trim() === '')
  )
    throw new TypeError(
      `Declaration ${declaration.id} metadata must not be empty.`,
    );
  for (const impact of Object.values(declaration.impactsByStage))
    if (impact !== undefined && !Number.isFinite(impact))
      throw new RangeError(
        `Declaration ${declaration.id} impacts must be finite.`,
      );
  if (declaration.validFrom !== undefined)
    parseDate(
      declaration.validFrom,
      `declaration ${declaration.id} validity start`,
    );
  if (declaration.validUntil !== undefined)
    parseDate(
      declaration.validUntil,
      `declaration ${declaration.id} validity end`,
    );
  if (
    declaration.validFrom !== undefined &&
    declaration.validUntil !== undefined &&
    parseDate(
      declaration.validFrom,
      `declaration ${declaration.id} validity start`,
    ) >
      parseDate(
        declaration.validUntil,
        `declaration ${declaration.id} validity end`,
      )
  )
    throw new RangeError(
      `Declaration ${declaration.id} validity start must not be after its validity end.`,
    );
}
function validateUnique<T>(
  values: readonly T[],
  select: (value: T) => string,
  name: string,
): void {
  const ids = new Set<string>();
  for (const value of values) {
    const id = select(value);
    if (ids.has(id)) throw new TypeError(`Duplicate ${name} ID ${id}.`);
    ids.add(id);
  }
}
function parseDate(value: string, name: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new TypeError(`${name} must use YYYY-MM-DD.`);
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${name} is invalid.`);
  if (new Date(timestamp).toISOString().slice(0, 10) !== value)
    throw new TypeError(`${name} is invalid.`);
  return timestamp;
}
function required(value: number | undefined): number {
  if (value === undefined)
    throw new Error('Known environmental value is absent.');
  return value;
}
function optional<Key extends 'materialId' | 'levelId'>(
  key: Key,
  value: string | undefined,
): Partial<Record<Key, string>> {
  return value === undefined
    ? {}
    : ({ [key]: value } as Partial<Record<Key, string>>);
}
function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative.`);
}
