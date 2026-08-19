import type {
  EquipmentDefinition,
  EquipmentInstance,
  EquipmentIssue,
  EquipmentPropertyValue,
  PerformanceCurve,
} from './types.js';

function issue(
  code: EquipmentIssue['code'],
  path: string,
  severity: EquipmentIssue['severity'],
  message: string,
): EquipmentIssue {
  return { code, path, severity, message };
}

function validateCurve(
  curve: PerformanceCurve,
  path: string,
  issues: EquipmentIssue[],
): void {
  if (curve.inputAxes.length === 0 || curve.points.length === 0) {
    issues.push(
      issue(
        'EQUIPMENT_INVALID_CURVE',
        path,
        'ERROR',
        `Curve ${curve.id} needs at least one axis and one point.`,
      ),
    );
    return;
  }
  for (const [index, point] of curve.points.entries()) {
    if (point.inputs.length !== curve.inputAxes.length)
      issues.push(
        issue(
          'EQUIPMENT_INVALID_CURVE',
          `${path}/points/${index}`,
          'ERROR',
          `Point ${index} of curve ${curve.id} does not provide one value per axis.`,
        ),
      );
    if (
      !Number.isFinite(point.output) ||
      point.inputs.some((value) => !Number.isFinite(value))
    )
      issues.push(
        issue(
          'EQUIPMENT_INVALID_CURVE',
          `${path}/points/${index}`,
          'ERROR',
          `Point ${index} of curve ${curve.id} holds a non-finite value.`,
        ),
      );
  }
}

/**
 * Validates one definition. A `PRODUCT` entry has to name its manufacturer and
 * source its properties, so a generic figure can never be presented as a
 * declared product performance.
 */
export function validateEquipmentDefinition(
  definition: EquipmentDefinition,
): readonly EquipmentIssue[] {
  const issues: EquipmentIssue[] = [];
  if (definition.id.trim() === '')
    issues.push(
      issue(
        'EQUIPMENT_EMPTY_ID',
        '/id',
        'ERROR',
        'Identifier must not be empty.',
      ),
    );
  if (definition.name.trim() === '')
    issues.push(
      issue(
        'EQUIPMENT_EMPTY_NAME',
        '/name',
        'ERROR',
        'Name must not be empty.',
      ),
    );
  if (definition.version.trim() === '')
    issues.push(
      issue(
        'EQUIPMENT_INVALID_VERSION',
        '/version',
        'ERROR',
        'A definition must carry a version so projects can pin it.',
      ),
    );
  const portIds = new Set<string>();
  for (const [index, port] of definition.ports.entries()) {
    if (portIds.has(port.id))
      issues.push(
        issue(
          'EQUIPMENT_DUPLICATE_PORT',
          `/ports/${index}`,
          'ERROR',
          `Duplicate port identifier ${port.id}.`,
        ),
      );
    portIds.add(port.id);
  }
  const dimensions = definition.dimensions;
  for (const key of ['widthMm', 'depthMm', 'heightMm'] as const) {
    const value = dimensions?.[key];
    if (value !== undefined && (!Number.isFinite(value) || value <= 0))
      issues.push(
        issue(
          'EQUIPMENT_INVALID_DIMENSION',
          `/dimensions/${key}`,
          'ERROR',
          `${key} must be finite and greater than zero.`,
        ),
      );
  }
  for (const [key, value] of Object.entries(definition.properties))
    if (typeof value === 'number' && !Number.isFinite(value))
      issues.push(
        issue(
          'EQUIPMENT_INVALID_PROPERTY',
          `/properties/${key}`,
          'ERROR',
          `${key} must be a finite number.`,
        ),
      );
  const sourced = new Set(definition.sources.map(({ property }) => property));
  for (const key of Object.keys(definition.properties))
    if (!sourced.has(key))
      issues.push(
        issue(
          'EQUIPMENT_UNSOURCED_PROPERTY',
          `/properties/${key}`,
          definition.catalogKind === 'PRODUCT' ? 'ERROR' : 'WARNING',
          `${key} does not declare where its value comes from.`,
        ),
      );
  if (
    definition.catalogKind === 'PRODUCT' &&
    (definition.manufacturer ?? '').trim() === ''
  )
    issues.push(
      issue(
        'EQUIPMENT_PRODUCT_WITHOUT_MANUFACTURER',
        '/manufacturer',
        'ERROR',
        'A product definition must name its manufacturer.',
      ),
    );
  for (const [index, curve] of (definition.performanceCurves ?? []).entries())
    validateCurve(curve, `/performanceCurves/${index}`, issues);
  return issues;
}

/** Validates a whole catalogue, including cross-entry identifier uniqueness. */
export function validateEquipmentCatalog(
  definitions: readonly EquipmentDefinition[],
): readonly EquipmentIssue[] {
  const issues: EquipmentIssue[] = [];
  const seen = new Set<string>();
  for (const [index, definition] of definitions.entries()) {
    if (seen.has(definition.id))
      issues.push(
        issue(
          'EQUIPMENT_DUPLICATE_ID',
          `/${index}/id`,
          'ERROR',
          `Duplicate equipment definition ${definition.id}.`,
        ),
      );
    seen.add(definition.id);
    issues.push(
      ...validateEquipmentDefinition(definition).map((entry) => ({
        ...entry,
        path: `/${index}${entry.path}`,
      })),
    );
  }
  return issues;
}

export interface EquipmentQuery {
  readonly search?: string;
  readonly categories?: readonly EquipmentCategory[];
  readonly catalogKinds?: readonly EquipmentDefinition['catalogKind'][];
  readonly manufacturer?: string;
}

type EquipmentCategory = EquipmentDefinition['category'];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Filters and orders a catalogue for a picker, without mutating it. */
export function queryEquipment(
  definitions: readonly EquipmentDefinition[],
  query: EquipmentQuery = {},
): readonly EquipmentDefinition[] {
  const search = normalize(query.search ?? '');
  return definitions
    .filter(
      (definition) =>
        search === '' ||
        normalize(
          [
            definition.name,
            definition.id,
            definition.kind,
            definition.manufacturer ?? '',
            definition.model ?? '',
          ].join(' '),
        ).includes(search),
    )
    .filter(
      (definition) =>
        query.categories === undefined ||
        query.categories.includes(definition.category),
    )
    .filter(
      (definition) =>
        query.catalogKinds === undefined ||
        query.catalogKinds.includes(definition.catalogKind),
    )
    .filter(
      (definition) =>
        query.manufacturer === undefined ||
        normalize(definition.manufacturer ?? '') ===
          normalize(query.manufacturer),
    )
    .slice()
    .sort(
      (first, second) =>
        first.category.localeCompare(second.category) ||
        first.name.localeCompare(second.name, 'fr') ||
        first.id.localeCompare(second.id),
    );
}

/** Reads an instance property, letting an instance override the definition. */
export function equipmentProperty(
  definition: EquipmentDefinition,
  instance: EquipmentInstance | undefined,
  property: string,
): EquipmentPropertyValue | undefined {
  return instance?.overrides?.[property] ?? definition.properties[property];
}

/**
 * Resolves an instance against a catalogue.
 *
 * A version mismatch is reported rather than silently accepted: the project
 * recorded which definition version it was designed with, and the interface must
 * be able to tell the user that the catalogue moved on.
 */
export function resolveEquipmentInstance(
  instance: EquipmentInstance,
  definitions: readonly EquipmentDefinition[],
):
  | {
      readonly status: 'OK';
      readonly definition: EquipmentDefinition;
      readonly issues: readonly EquipmentIssue[];
    }
  | { readonly status: 'UNKNOWN'; readonly issues: readonly EquipmentIssue[] } {
  const definition = definitions.find(({ id }) => id === instance.definitionId);
  if (definition === undefined)
    return {
      status: 'UNKNOWN',
      issues: [
        issue(
          'EQUIPMENT_UNKNOWN_DEFINITION',
          `/${instance.id}/definitionId`,
          'ERROR',
          `No catalogue entry ${instance.definitionId}.`,
        ),
      ],
    };
  const issues =
    definition.version === instance.definitionVersion
      ? []
      : [
          issue(
            'EQUIPMENT_DEFINITION_VERSION_MISMATCH',
            `/${instance.id}/definitionVersion`,
            'WARNING',
            `Instance pins ${instance.definitionId}@${instance.definitionVersion} while the catalogue offers ${definition.version}.`,
          ),
        ];
  return { status: 'OK', definition, issues };
}

export type PerformanceLookup =
  | { readonly status: 'OK'; readonly value: number }
  | {
      readonly status: 'OUT_OF_RANGE';
      readonly issue: EquipmentIssue;
    };

/**
 * Interpolates a single-axis performance curve.
 *
 * Nothing is extrapolated: a request outside the tabulated domain is reported so
 * the caller can show the limit rather than a confidently wrong number.
 */
export function interpolatePerformance(
  curve: PerformanceCurve,
  input: number,
): PerformanceLookup {
  if (curve.inputAxes.length !== 1)
    return {
      status: 'OUT_OF_RANGE',
      issue: issue(
        'EQUIPMENT_INVALID_CURVE',
        `/${curve.id}`,
        'ERROR',
        `Curve ${curve.id} is not a single-axis curve.`,
      ),
    };
  const points = [...curve.points].sort(
    (first, second) => first.inputs[0]! - second.inputs[0]!,
  );
  const first = points[0]!;
  const last = points.at(-1)!;
  if (input < first.inputs[0]! || input > last.inputs[0]!)
    return {
      status: 'OUT_OF_RANGE',
      issue: issue(
        'EQUIPMENT_PERFORMANCE_OUT_OF_RANGE',
        `/${curve.id}`,
        'WARNING',
        `${input} ${curve.inputAxes[0]!.unit} lies outside the tabulated range ${first.inputs[0]!}–${last.inputs[0]!}.`,
      ),
    };
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (input > current.inputs[0]!) continue;
    const span = current.inputs[0]! - previous.inputs[0]!;
    if (span === 0) return { status: 'OK', value: current.output };
    const ratio = (input - previous.inputs[0]!) / span;
    return {
      status: 'OK',
      value: previous.output + ratio * (current.output - previous.output),
    };
  }
  return { status: 'OK', value: last.output };
}
