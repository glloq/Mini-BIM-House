import type {
  JsonValue,
  NetworkDiscipline,
} from '@house-technical-designer/core-domain';

/**
 * One physical property a network object carries.
 *
 * The key is what the calculation reads; the label and the unit are what the
 * user reads. A descriptor never carries a default: a diameter nobody chose is
 * not a diameter, and the module has to report it as missing rather than size a
 * pipe on a value the application made up.
 */
export interface NetworkPropertyDescriptor {
  readonly key: string;
  readonly label: string;
  readonly kind: 'NUMBER' | 'TEXT' | 'CHOICE';
  readonly unit?: string;
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly hint?: string;
}

const MATERIALS = (
  entries: readonly (readonly [string, string])[],
): readonly { readonly value: string; readonly label: string }[] =>
  entries.map(([value, label]) => ({ value, label }));

const FLOW_LPS: NetworkPropertyDescriptor = {
  key: 'designFlowLps',
  label: 'Débit de dimensionnement',
  kind: 'NUMBER',
  unit: 'L/s',
  min: 0,
};
const FLOW_M3H: NetworkPropertyDescriptor = {
  key: 'targetFlowM3h',
  label: 'Débit visé',
  kind: 'NUMBER',
  unit: 'm³/h',
  min: 0,
};
const ROUGHNESS: NetworkPropertyDescriptor = {
  key: 'roughnessM',
  label: 'Rugosité absolue',
  kind: 'NUMBER',
  unit: 'm',
  min: 0,
  hint: 'Laissée vide, la constante de méthode du module est utilisée et signalée comme telle.',
};
const LOCAL_LOSS: NetworkPropertyDescriptor = {
  key: 'localLossCoefficient',
  label: 'Somme des pertes singulières',
  kind: 'NUMBER',
  unit: 'ζ',
  min: 0,
};
const INTERNAL_DIAMETER: NetworkPropertyDescriptor = {
  key: 'internalDiameterM',
  label: 'Diamètre intérieur',
  kind: 'NUMBER',
  unit: 'm',
  min: 0,
};
const DUCT_DIAMETER: NetworkPropertyDescriptor = {
  key: 'diameterM',
  label: 'Diamètre intérieur',
  kind: 'NUMBER',
  unit: 'm',
  min: 0,
};
const SLOPE: NetworkPropertyDescriptor = {
  key: 'slope',
  label: 'Pente',
  kind: 'NUMBER',
  unit: 'm/m',
  min: 0,
  max: 1,
};

const PIPE_MATERIAL: NetworkPropertyDescriptor = {
  key: 'materialId',
  label: 'Matériau',
  kind: 'CHOICE',
  options: MATERIALS([
    ['copper', 'Cuivre'],
    ['per', 'PER'],
    ['multilayer', 'Multicouche'],
    ['pvc', 'PVC'],
    ['pvc-pressure', 'PVC pression'],
    ['steel', 'Acier'],
    ['cast-iron', 'Fonte'],
  ]),
  hint: 'Nomme la nature du tuyau ; ce n’est pas une référence à la bibliothèque de matériaux.',
};

const CONDUCTOR_MATERIAL: NetworkPropertyDescriptor = {
  key: 'conductorMaterial',
  label: 'Âme',
  kind: 'CHOICE',
  options: MATERIALS([
    ['COPPER', 'Cuivre'],
    ['ALUMINIUM', 'Aluminium'],
  ]),
};

/** Properties every node of a discipline may carry, whatever its kind. */
const NODE_PROPERTIES: Readonly<
  Record<
    NetworkDiscipline,
    Readonly<Record<string, readonly NetworkPropertyDescriptor[]>>
  >
> = {
  WATER: {
    FIXTURE: [
      FLOW_LPS,
      {
        key: 'minimumPressurePa',
        label: 'Pression minimale requise',
        kind: 'NUMBER',
        unit: 'Pa',
        min: 0,
      },
    ],
    SOURCE: [
      {
        key: 'supplyPressurePa',
        label: 'Pression disponible',
        kind: 'NUMBER',
        unit: 'Pa',
        min: 0,
      },
    ],
  },
  HEATING: {
    EMITTER: [
      {
        key: 'designPowerW',
        label: 'Puissance à émettre',
        kind: 'NUMBER',
        unit: 'W',
        min: 0,
      },
      FLOW_LPS,
    ],
    SOURCE: [
      {
        key: 'designTemperatureDifferenceK',
        label: 'Écart de température de dimensionnement',
        kind: 'NUMBER',
        unit: 'K',
        min: 0,
      },
    ],
  },
  WASTEWATER: {
    FIXTURE: [
      {
        key: 'dischargeUnits',
        label: 'Unités de vidange',
        kind: 'NUMBER',
        unit: 'UV',
        min: 0,
      },
    ],
  },
  RAINWATER: {
    SOURCE: [
      {
        key: 'collectedAreaM2',
        label: 'Surface collectée',
        kind: 'NUMBER',
        unit: 'm²',
        min: 0,
      },
    ],
  },
  VENTILATION: {
    TERMINAL: [FLOW_M3H],
    INTAKE: [FLOW_M3H],
    FAN: [
      {
        key: 'availableStaticPressurePa',
        label: 'Pression statique disponible',
        kind: 'NUMBER',
        unit: 'Pa',
        min: 0,
      },
    ],
  },
  ELECTRICAL: {
    // The equipment a node stands for is chosen in the inspector and stored as
    // the node's own reference, not as a name typed into its properties.
    LUMINAIRE: [...electricalLoad()],
    OUTLET: [...electricalLoad()],
    FIXED_LOAD: [...electricalLoad()],
    EV: [...electricalLoad()],
    CIRCUIT: [
      {
        key: 'nominalVoltageV',
        label: 'Tension nominale',
        kind: 'NUMBER',
        unit: 'V',
        min: 0,
      },
      {
        key: 'protectionRatingA',
        label: 'Calibre de protection',
        kind: 'NUMBER',
        unit: 'A',
        min: 0,
      },
      {
        key: 'phases',
        label: 'Nombre de phases',
        kind: 'CHOICE',
        options: [
          { value: '1', label: 'Monophasé' },
          { value: '3', label: 'Triphasé' },
        ],
      },
      {
        key: 'conductorSectionMm2',
        label: 'Section des conducteurs',
        kind: 'NUMBER',
        unit: 'mm²',
        min: 0,
      },
    ],
    DISTRIBUTION_BOARD: [
      {
        key: 'nominalVoltageV',
        label: 'Tension nominale',
        kind: 'NUMBER',
        unit: 'V',
        min: 0,
      },
      {
        key: 'phases',
        label: 'Nombre de phases',
        kind: 'CHOICE',
        options: [
          { value: '1', label: 'Monophasé' },
          { value: '3', label: 'Triphasé' },
        ],
      },
    ],
  },
  OTHER: {},
};

function electricalLoad(): readonly NetworkPropertyDescriptor[] {
  return [
    {
      key: 'activePowerW',
      label: 'Puissance active',
      kind: 'NUMBER',
      unit: 'W',
      min: 0,
    },
    {
      key: 'powerFactor',
      label: 'Facteur de puissance',
      kind: 'NUMBER',
      unit: '0 à 1',
      min: 0,
      max: 1,
    },
    {
      key: 'demandFactor',
      label: 'Facteur de simultanéité',
      kind: 'NUMBER',
      unit: '0 à 1',
      min: 0,
      max: 1,
    },
  ];
}

const EDGE_PROPERTIES: Readonly<
  Record<NetworkDiscipline, readonly NetworkPropertyDescriptor[]>
> = {
  WATER: [INTERNAL_DIAMETER, PIPE_MATERIAL, ROUGHNESS, LOCAL_LOSS],
  HEATING: [INTERNAL_DIAMETER, PIPE_MATERIAL, ROUGHNESS, LOCAL_LOSS],
  WASTEWATER: [INTERNAL_DIAMETER, PIPE_MATERIAL, SLOPE],
  RAINWATER: [INTERNAL_DIAMETER, PIPE_MATERIAL, SLOPE],
  VENTILATION: [
    {
      key: 'shape',
      label: 'Section',
      kind: 'CHOICE',
      options: MATERIALS([
        ['ROUND', 'Circulaire'],
        ['RECTANGULAR', 'Rectangulaire'],
      ]),
      hint: 'Une gaine circulaire se décrit par son diamètre, une gaine rectangulaire par sa largeur et sa hauteur.',
    },
    { ...DUCT_DIAMETER, hint: 'Gaine circulaire.' },
    {
      key: 'widthM',
      label: 'Largeur',
      kind: 'NUMBER',
      unit: 'm',
      min: 0,
      hint: 'Gaine rectangulaire.',
    },
    {
      key: 'heightM',
      label: 'Hauteur',
      kind: 'NUMBER',
      unit: 'm',
      min: 0,
      hint: 'Gaine rectangulaire.',
    },
    {
      key: 'airRole',
      label: 'Rôle',
      kind: 'CHOICE',
      options: MATERIALS([
        ['EXTRACT', 'Extraction'],
        ['SUPPLY', 'Insufflation'],
        ['TRANSFER', 'Transfert'],
      ]),
    },
    ROUGHNESS,
    LOCAL_LOSS,
  ],
  ELECTRICAL: [
    {
      key: 'conductorSectionMm2',
      label: 'Section des conducteurs',
      kind: 'NUMBER',
      unit: 'mm²',
      min: 0,
    },
    CONDUCTOR_MATERIAL,
    {
      key: 'conductorCount',
      label: 'Nombre de conducteurs',
      kind: 'NUMBER',
      unit: 'conducteurs',
      min: 1,
    },
    {
      key: 'circuitId',
      label: 'Circuit',
      kind: 'TEXT',
      hint: 'Identifiant du nœud circuit que ce câble alimente.',
    },
  ],
  OTHER: [],
};

/** What a node of this kind may be given, in the order it is presented. */
export function nodePropertySchema(
  discipline: NetworkDiscipline,
  kind: string,
): readonly NetworkPropertyDescriptor[] {
  return NODE_PROPERTIES[discipline]?.[kind] ?? [];
}

/** What a routed segment of this discipline may be given. */
export function edgePropertySchema(
  discipline: NetworkDiscipline,
): readonly NetworkPropertyDescriptor[] {
  return EDGE_PROPERTIES[discipline] ?? [];
}

/**
 * A known kind of system, so the type is chosen rather than spelled.
 *
 * The system type reaches the calculations; typing it by hand made a mistyped
 * word indistinguishable from a deliberate one.
 */
export interface NetworkSystemTemplate {
  readonly systemType: string;
  readonly label: string;
}

const SYSTEM_TEMPLATES: Readonly<
  Record<NetworkDiscipline, readonly NetworkSystemTemplate[]>
> = {
  WATER: [
    { systemType: 'POTABLE_COLD', label: 'Eau froide sanitaire' },
    { systemType: 'POTABLE_HOT', label: 'Eau chaude sanitaire' },
    { systemType: 'HOT_WATER_LOOP', label: 'Boucle d’eau chaude' },
    { systemType: 'NON_POTABLE', label: 'Eau non potable' },
  ],
  HEATING: [
    { systemType: 'RADIATOR_LOOP', label: 'Boucle de radiateurs' },
    { systemType: 'UNDERFLOOR_LOOP', label: 'Plancher chauffant' },
    { systemType: 'PRIMARY_LOOP', label: 'Circuit primaire' },
  ],
  WASTEWATER: [
    { systemType: 'COMBINED_WASTEWATER', label: 'Eaux usées et vannes' },
    { systemType: 'GREY_WATER', label: 'Eaux grises seules' },
    { systemType: 'BLACK_WATER', label: 'Eaux vannes seules' },
  ],
  RAINWATER: [
    { systemType: 'ROOF_DRAINAGE', label: 'Descentes de toiture' },
    { systemType: 'HARVESTING', label: 'Récupération d’eau de pluie' },
  ],
  VENTILATION: [
    { systemType: 'EXTRACT', label: 'Extraction simple flux' },
    { systemType: 'SUPPLY', label: 'Insufflation' },
    { systemType: 'BALANCED', label: 'Double flux' },
    {
      systemType: 'BALANCED_HEAT_RECOVERY',
      label: 'Double flux avec échangeur',
    },
  ],
  ELECTRICAL: [
    { systemType: 'ELECTRICAL', label: 'Distribution générale' },
    { systemType: 'LIGHTING', label: 'Éclairage' },
    { systemType: 'POWER', label: 'Prises et usages' },
    { systemType: 'PV', label: 'Production photovoltaïque' },
  ],
  OTHER: [{ systemType: 'OTHER', label: 'Autre système' }],
};

export function networkSystemTemplates(
  discipline: NetworkDiscipline,
): readonly NetworkSystemTemplate[] {
  return SYSTEM_TEMPLATES[discipline] ?? SYSTEM_TEMPLATES.OTHER;
}

/**
 * The property record after one field is committed.
 *
 * An emptied field removes the property rather than storing a value nobody
 * chose. `undefined` means the text was not a number, so nothing is written.
 */
export function withNetworkProperty(
  properties: Readonly<Record<string, JsonValue>>,
  descriptor: NetworkPropertyDescriptor,
  raw: string,
): Readonly<Record<string, JsonValue>> | undefined {
  const next: Record<string, JsonValue> = { ...properties };
  if (raw.trim() === '') {
    delete next[descriptor.key];
    return next;
  }
  if (descriptor.kind === 'NUMBER') {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) return undefined;
    next[descriptor.key] = value;
    return next;
  }
  if (
    descriptor.kind === 'CHOICE' &&
    !(descriptor.options ?? []).some(({ value }) => value === raw)
  )
    return undefined;
  next[descriptor.key] = raw;
  return next;
}

/**
 * The record without the values the stated shape cannot carry.
 *
 * Changing a duct from round to rectangular makes its diameter meaningless.
 * Dropping it is not inventing anything: it is removing a number that no longer
 * describes the object the user just redefined. What is never dropped is a
 * value the new shape still uses.
 */
export function withoutIncompatibleProperties(
  discipline: NetworkDiscipline,
  properties: Readonly<Record<string, JsonValue>>,
): Readonly<Record<string, JsonValue>> {
  if (discipline !== 'VENTILATION') return properties;
  const next = { ...properties };
  if (next.shape === 'ROUND') {
    delete next.widthM;
    delete next.heightM;
  }
  if (next.shape === 'RECTANGULAR') delete next.diameterM;
  return next;
}

/**
 * Why a record would describe something the discipline cannot represent.
 *
 * A round duct has a diameter and a rectangular one has a width and a height;
 * offering the choice and then asking for the wrong number is how an interface
 * makes a value impossible to enter. The contradiction is refused where it is
 * made rather than reported later as a missing input.
 */
export function incoherentNetworkProperties(
  discipline: NetworkDiscipline,
  properties: Readonly<Record<string, JsonValue>>,
): readonly string[] {
  if (discipline !== 'VENTILATION') return [];
  const shape = properties.shape;
  const has = (key: string): boolean => typeof properties[key] === 'number';
  if (shape === 'ROUND' && (has('widthM') || has('heightM')))
    return [
      'Une gaine circulaire se décrit par son diamètre : retirez la largeur et la hauteur.',
    ];
  if (shape === 'RECTANGULAR') {
    if (has('diameterM'))
      return [
        'Une gaine rectangulaire se décrit par sa largeur et sa hauteur : retirez le diamètre.',
      ];
    if (has('widthM') !== has('heightM'))
      return [
        'Une gaine rectangulaire demande sa largeur et sa hauteur, pas l’une des deux.',
      ];
  }
  return [];
}

/** Why a property record would be refused, when it would. */
export function invalidNetworkProperties(
  descriptors: readonly NetworkPropertyDescriptor[],
  properties: Readonly<Record<string, JsonValue>>,
): readonly string[] {
  const errors: string[] = [];
  const known = new Map(
    descriptors.map((descriptor) => [descriptor.key, descriptor]),
  );
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      errors.push(
        `La propriété ${key} n'est pas un nombre : videz le champ pour la retirer.`,
      );
      continue;
    }
    const descriptor = known.get(key);
    if (descriptor === undefined || typeof value !== 'number') continue;
    const unit = descriptor.unit === undefined ? '' : ` ${descriptor.unit}`;
    if (descriptor.min !== undefined && value < descriptor.min)
      errors.push(
        `${descriptor.label} : la valeur doit être supérieure ou égale à ${descriptor.min}${unit}.`,
      );
    if (descriptor.max !== undefined && value > descriptor.max)
      errors.push(
        `${descriptor.label} : la valeur doit être inférieure ou égale à ${descriptor.max}${unit}.`,
      );
  }
  return errors;
}
