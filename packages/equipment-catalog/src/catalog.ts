import type {
  EquipmentDefinition,
  PlacedEquipment,
  EquipmentIssue,
  EquipmentPropertyValue,
  PerformanceCurve,
} from './types.js';
import {
  lookupPerformance,
  validatePerformanceMap,
  type PerformanceLookup,
} from './performance-map.js';

function issue(
  code: EquipmentIssue['code'],
  path: string,
  severity: EquipmentIssue['severity'],
  message: string,
): EquipmentIssue {
  return { code, path, severity, message };
}

/**
 * Le contrôle qui rend le repère d'un port opposable.
 *
 * Le repère est écrit sur `EquipmentPortDefinition.position` : le décalage part
 * de l'**origine de l'appareil**, celle que la pose situe — centre de l'emprise
 * en x et y, dessous en z. Une phrase de documentation n'a jamais empêché
 * personne d'écrire autre chose : ce que le repère permet, et qu'aucune autre
 * convention ne permettrait, c'est de le **vérifier**, parce qu'un raccordement
 * qui part de l'origine est forcément dans le volume que la fiche déclare.
 *
 * D'où les trois bornes, qui sont les trois dimensions de la fiche et rien
 * d'autre : aucun seuil n'est écrit ici. Une dimension que la fiche ne déclare
 * pas ne borne rien — on ne refuse pas ce qu'on n'a pas de quoi juger — sauf
 * en z, où le zéro tient tout seul : un raccordement sous l'origine est sous
 * l'appareil, qu'on connaisse sa hauteur ou non.
 *
 * C'est ce contrôle qui aurait dit tout de suite ce que la maison de référence
 * a mis un an à montrer : 288 raccordements de 175 fiches — dont la sortie du
 * WC, 350 mm sous sa propre cuvette — étaient écrits depuis le centre de la
 * boîte, un repère que rien n'avait jamais énoncé.
 */
function portWithinBody(
  definition: EquipmentDefinition,
  port: EquipmentDefinition['ports'][number],
  index: number,
): readonly EquipmentIssue[] {
  // Une fiche qui ne situe pas son raccordement n'est pas jugée ici : c'est le
  // schéma qui exige `position`, et redire son refus donnerait deux messages
  // pour un même manque.
  const position = port.position;
  if (position === undefined) return [];
  const outside = (
    axis: 'x' | 'y' | 'z',
    value: number,
    low: number,
    high: number | undefined,
    said: string,
  ): readonly EquipmentIssue[] =>
    Number.isFinite(value) &&
    (value < low || (high !== undefined && value > high))
      ? [
          issue(
            'EQUIPMENT_PORT_OUTSIDE_BODY',
            `/ports/${index}/position/${axis}`,
            'ERROR',
            `${port.id} sits at ${axis} = ${value} mm, outside the ${said} of ${definition.id}: a port position is measured from the equipment origin — centre of the footprint, underside in z.`,
          ),
        ]
      : [];
  const width = definition.dimensions?.widthMm;
  const depth = definition.dimensions?.depthMm;
  const height = definition.dimensions?.heightMm;
  return [
    ...(width === undefined
      ? []
      : outside('x', position.x, -width / 2, width / 2, 'width')),
    ...(depth === undefined
      ? []
      : outside('y', position.y, -depth / 2, depth / 2, 'depth')),
    ...outside('z', position.z, 0, height, 'height'),
  ];
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
    issues.push(...portWithinBody(definition, port, index));
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
    issues.push(
      ...validatePerformanceMap(curve, `/performanceCurves/${index}`),
    );
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
            definition.familyId,
            definition.manufacturer ?? '',
            definition.model ?? '',
          ].join(' '),
        ).includes(search),
    )
    .filter(
      (definition) =>
        query.categories === undefined ||
        (definition.category !== undefined &&
          query.categories.includes(definition.category)),
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
        (first.category ?? '').localeCompare(second.category ?? '') ||
        first.name.localeCompare(second.name, 'fr') ||
        first.id.localeCompare(second.id),
    );
}

/**
 * Reads a property of a placed thing, letting it override its model.
 *
 * Only a scalar overrides: a list or an object where a value is expected is
 * not a value of this equipment, and taking it would put something a
 * calculation cannot read where it expects a number.
 */
export function equipmentProperty(
  definition: EquipmentDefinition,
  placed: PlacedEquipment | undefined,
  property: string,
): EquipmentPropertyValue | undefined {
  const override = placed?.properties?.[property];
  if (
    typeof override === 'string' ||
    typeof override === 'number' ||
    typeof override === 'boolean'
  )
    return override;
  return definition.properties[property];
}

/**
 * Resolves a placed thing against a catalogue.
 *
 * A version mismatch is reported rather than silently accepted: the project
 * recorded which definition version it was designed with, and the interface
 * must be able to tell the user that the catalogue moved on. A placement that
 * pinned nothing is reported too — not as an error, since older files have
 * none, but so that « designed with which figures? » has an answer other than
 * « whichever ones are loaded today ».
 */
export function resolvePlacedEquipment(
  placed: PlacedEquipment,
  definitions: readonly EquipmentDefinition[],
):
  | {
      readonly status: 'OK';
      readonly definition: EquipmentDefinition;
      readonly issues: readonly EquipmentIssue[];
    }
  | { readonly status: 'UNKNOWN'; readonly issues: readonly EquipmentIssue[] } {
  const definition = definitions.find(({ id }) => id === placed.definitionId);
  if (definition === undefined)
    return {
      status: 'UNKNOWN',
      issues: [
        issue(
          'EQUIPMENT_UNKNOWN_DEFINITION',
          `/${placed.id}/definitionId`,
          'ERROR',
          placed.definitionId === undefined
            ? 'Placement names no catalogue entry.'
            : `No catalogue entry ${placed.definitionId}.`,
        ),
      ],
    };
  if (placed.definitionVersion === undefined)
    return {
      status: 'OK',
      definition,
      issues: [
        issue(
          'EQUIPMENT_UNPINNED_DEFINITION',
          `/${placed.id}/definitionVersion`,
          'WARNING',
          `Placement of ${definition.id} records no catalogue version; it will follow the catalogue wherever it goes.`,
        ),
      ],
    };
  const issues =
    definition.version === placed.definitionVersion
      ? []
      : [
          issue(
            'EQUIPMENT_DEFINITION_VERSION_MISMATCH',
            `/${placed.id}/definitionVersion`,
            'WARNING',
            `Placement pins ${placed.definitionId}@${placed.definitionVersion} while the catalogue offers ${definition.version}.`,
          ),
        ];
  return { status: 'OK', definition, issues };
}

/**
 * Interpolates a single-axis performance curve.
 *
 * Kept as the one-input spelling of `lookupPerformance`, which reads one and
 * two axes alike and extrapolates neither.
 */
export function interpolatePerformance(
  curve: PerformanceCurve,
  input: number,
): PerformanceLookup {
  return lookupPerformance(curve, [input]);
}
