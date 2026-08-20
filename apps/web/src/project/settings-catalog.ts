import type { JsonValue, Project } from '@house-technical-designer/core-domain';
import { PROJECT_CALCULATION_MODULES } from '@house-technical-designer/calculation-adapters';

/**
 * One scalar a module reads from the project settings.
 *
 * The descriptor carries the label and the unit the user reads; the key is the
 * one the module reads. Neither is derived from the other, so a rename in the
 * interface never silently changes what a calculation consumes.
 */
export interface ModuleSettingField {
  readonly key: string;
  readonly label: string;
  /** How the value is stored, which decides how an emptied field is written. */
  readonly kind: 'NUMBER' | 'TEXT';
  readonly unit?: string;
  readonly hint?: string;
}

/** A setting the user fills in per material rather than once for the project. */
export interface ModuleSettingMaterialTable {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
}

/**
 * A setting held as a list chosen from a fixed set of numbers.
 *
 * The octave bands an acoustic study covers are a choice among known bands,
 * not a free number: a checklist states which are studied and stores them as
 * the array the module reads.
 */
export interface ModuleSettingNumberChoice {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly options: readonly number[];
  readonly hint?: string;
}

/**
 * A setting held as a map from a fixed set of keys to a number.
 *
 * Occupancy per room category and absorption per octave band are not scalars
 * and not per-material either: they are short tables the user fills row by row.
 */
export interface ModuleSettingKeyedTable {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  readonly rows: readonly { readonly key: string; readonly label: string }[];
}

export interface ModuleSettingsDescriptor {
  readonly moduleId: string;
  readonly label: string;
  readonly fields: readonly ModuleSettingField[];
  readonly materialTables?: readonly ModuleSettingMaterialTable[];
  readonly keyedTables?: readonly ModuleSettingKeyedTable[];
  readonly numberChoices?: readonly ModuleSettingNumberChoice[];
  /** Why this module has no editable field here, when it has none. */
  readonly note?: string;
}

const SPACE_CATEGORY_ROWS = [
  { key: 'LIVING', label: 'Séjour' },
  { key: 'KITCHEN', label: 'Cuisine' },
  { key: 'BEDROOM', label: 'Chambre' },
  { key: 'BATHROOM', label: 'Salle de bains' },
  { key: 'WC', label: 'WC' },
  { key: 'HALL', label: 'Entrée' },
  { key: 'CORRIDOR', label: 'Dégagement' },
  { key: 'OTHER', label: 'Autre' },
] as const;

const OCTAVE_BAND_ROWS = [
  { key: '125', label: '125 Hz' },
  { key: '250', label: '250 Hz' },
  { key: '500', label: '500 Hz' },
  { key: '1000', label: '1000 Hz' },
  { key: '2000', label: '2000 Hz' },
  { key: '4000', label: '4000 Hz' },
] as const;

export const MODULE_SETTINGS: readonly ModuleSettingsDescriptor[] = [
  { moduleId: 'thermal', label: 'Thermique', fields: [] },
  {
    moduleId: 'heating',
    label: 'Chauffage',
    fields: [
      {
        key: 'designIndoorTemperatureC',
        kind: 'NUMBER',
        label: 'Température intérieure de dimensionnement',
        unit: '°C',
      },
      {
        key: 'designOutdoorTemperatureC',
        kind: 'NUMBER',
        label: 'Température extérieure de base',
        unit: '°C',
        hint: 'Température de base du lieu, généralement fournie par la réglementation locale.',
      },
    ],
  },
  {
    moduleId: 'dhw',
    label: 'Eau chaude sanitaire',
    fields: [
      {
        key: 'householdOccupants',
        kind: 'NUMBER',
        label: 'Occupants',
        unit: 'personnes',
      },
      {
        key: 'dailyUseVolumeLPerOccupant',
        kind: 'NUMBER',
        label: 'Puisage journalier par occupant',
        unit: 'L',
      },
      {
        key: 'coldWaterTemperatureC',
        kind: 'NUMBER',
        label: 'Eau froide',
        unit: '°C',
      },
      {
        key: 'useTemperatureC',
        kind: 'NUMBER',
        label: 'Température d’usage',
        unit: '°C',
      },
      {
        key: 'storageTemperatureC',
        kind: 'NUMBER',
        label: 'Température de stockage',
        unit: '°C',
      },
      {
        key: 'annualOperatingDays',
        kind: 'NUMBER',
        label: 'Jours d’usage par an',
        unit: 'j',
      },
    ],
  },
  {
    moduleId: 'lighting',
    label: 'Éclairage',
    fields: [
      {
        key: 'utilizationFactor',
        kind: 'NUMBER',
        label: 'Facteur d’utilance',
        unit: '—',
      },
      {
        key: 'maintenanceFactor',
        kind: 'NUMBER',
        label: 'Facteur de maintenance',
        unit: '—',
      },
      {
        key: 'operatingHoursPerDay',
        kind: 'NUMBER',
        label: 'Heures d’usage par jour',
        unit: 'h',
      },
    ],
  },
  { moduleId: 'ventilation', label: 'Ventilation', fields: [] },
  {
    moduleId: 'iaq',
    label: 'Qualité de l’air',
    fields: [
      {
        key: 'co2GenerationM3sPerOccupant',
        kind: 'NUMBER',
        label: 'Production de CO₂ par occupant',
        unit: 'm³/s',
      },
      {
        key: 'initialConcentrationPpm',
        kind: 'NUMBER',
        label: 'Concentration initiale',
        unit: 'ppm',
      },
      {
        key: 'durationHours',
        kind: 'NUMBER',
        label: 'Durée simulée',
        unit: 'h',
      },
    ],
    keyedTables: [
      {
        key: 'occupantsByCategory',
        label: 'Occupants',
        unit: 'personnes',
        rows: [...SPACE_CATEGORY_ROWS],
      },
    ],
  },
  {
    moduleId: 'water',
    label: 'Eau froide',
    fields: [
      {
        key: 'simultaneityFactor',
        kind: 'NUMBER',
        label: 'Coefficient de simultanéité',
        unit: '—',
      },
    ],
  },
  {
    moduleId: 'wastewater',
    label: 'Évacuations',
    fields: [
      {
        key: 'designFlowM3sPerDischargeUnit',
        kind: 'NUMBER',
        label: 'Débit par unité de vidange',
        unit: 'm³/s',
      },
      {
        key: 'minimumSlope',
        kind: 'NUMBER',
        label: 'Pente minimale',
        unit: 'm/m',
      },
    ],
  },
  {
    moduleId: 'rainwater',
    label: 'Eaux pluviales',
    fields: [
      {
        key: 'runoffCoefficient',
        kind: 'NUMBER',
        label: 'Coefficient de ruissellement',
        unit: '—',
      },
      {
        key: 'preFilterEfficiency',
        kind: 'NUMBER',
        label: 'Rendement du préfiltre',
        unit: '—',
      },
      {
        key: 'dailyDemandL',
        kind: 'NUMBER',
        label: 'Besoin journalier',
        unit: 'L',
      },
    ],
  },
  {
    moduleId: 'photovoltaic',
    label: 'Photovoltaïque',
    fields: [
      {
        key: 'performanceRatio',
        kind: 'NUMBER',
        label: 'Ratio de performance',
        unit: '—',
      },
    ],
  },
  {
    moduleId: 'battery',
    label: 'Batterie',
    fields: [
      {
        key: 'offGrid',
        kind: 'NUMBER',
        label: 'Site isolé',
        unit: '0 ou 1',
        hint: '1 pour un site sans raccordement au réseau.',
      },
    ],
  },
  {
    moduleId: 'energy-balance',
    label: 'Bilan énergétique',
    fields: [
      {
        key: 'heatingSetpointTemperatureC',
        kind: 'NUMBER',
        label: 'Consigne de chauffage',
        unit: '°C',
      },
    ],
  },
  {
    moduleId: 'hygrothermal',
    label: 'Hygrothermie',
    fields: [
      {
        key: 'indoorTemperatureC',
        kind: 'NUMBER',
        label: 'Température intérieure',
        unit: '°C',
      },
      {
        key: 'indoorRelativeHumidity',
        kind: 'NUMBER',
        label: 'Humidité relative intérieure',
        unit: '0 à 1',
      },
    ],
  },
  {
    moduleId: 'acoustics',
    label: 'Acoustique',
    fields: [],
    numberChoices: [
      {
        key: 'bandsHz',
        label: 'Bandes étudiées',
        unit: 'Hz',
        options: [125, 250, 500, 1000, 2000, 4000],
        hint: 'Le calcul ne porte que sur les bandes cochées.',
      },
    ],
    keyedTables: [
      {
        key: 'defaultSurfaceAbsorption',
        label: 'Absorption par défaut',
        unit: '0 à 1',
        rows: [...OCTAVE_BAND_ROWS],
      },
    ],
    note: 'Les bandes calculées et leurs absorptions par défaut se règlent ci-dessous.',
  },
  {
    moduleId: 'cost',
    label: 'Coût',
    fields: [
      { key: 'currency', kind: 'TEXT', label: 'Devise', unit: 'code ISO' },
    ],
    materialTables: [
      { key: 'unitPriceByMaterial', label: 'Prix matériau', unit: '/m³' },
      { key: 'labourPriceByMaterial', label: 'Main-d’œuvre', unit: '/m³' },
      { key: 'wasteFactorByMaterial', label: 'Déchets', unit: '0 à 1' },
    ],
  },
  {
    moduleId: 'environmental',
    label: 'Environnement',
    fields: [
      { key: 'indicator', kind: 'TEXT', label: 'Indicateur', unit: 'GWP…' },
      {
        key: 'validAt',
        kind: 'TEXT',
        label: 'Date de validité',
        unit: 'AAAA-MM-JJ',
      },
      {
        key: 'declarationSource',
        kind: 'TEXT',
        label: 'Source de la déclaration',
        hint: 'Une donnée générique doit le dire : elle ne devient jamais une donnée fabricant.',
      },
    ],
    materialTables: [
      { key: 'gwpPerUnitByMaterial', label: 'Facteur GWP', unit: 'kgCO₂e/m³' },
    ],
  },
];

/** The method and version a module declares, so a settings entry can name them. */
export function moduleContract(
  moduleId: string,
): { readonly methodId: string; readonly version: string } | undefined {
  const module = PROJECT_CALCULATION_MODULES.find(({ id }) => id === moduleId);
  return module === undefined
    ? undefined
    : { methodId: module.methodId, version: module.version };
}

/** Current settings of a module, or an empty record when it has none yet. */
export function moduleSettings(
  project: Project,
  moduleId: string,
): Readonly<Record<string, JsonValue>> {
  return project.calculationSettings?.[moduleId]?.settings ?? {};
}

/** The value stored for a field, formatted for an input. */
export function fieldValue(
  settings: Readonly<Record<string, JsonValue>>,
  key: string,
): string {
  const value = settings[key];
  if (value === undefined || value === null) return '';
  if (typeof value === 'number' || typeof value === 'string')
    return String(value);
  return '';
}

/** The per-material value stored under a table key. */
export function materialValue(
  settings: Readonly<Record<string, JsonValue>>,
  tableKey: string,
  materialId: string,
): string {
  const table = settings[tableKey];
  if (typeof table !== 'object' || table === null || Array.isArray(table))
    return '';
  const value = (table as Record<string, JsonValue>)[materialId];
  return typeof value === 'number' ? String(value) : '';
}

/**
 * The settings a module would carry once a field is set to a typed value.
 *
 * An emptied field is removed rather than stored as zero: the module then
 * reports it as a missing input, which is the truth, instead of calculating
 * with a number nobody chose.
 */
export function withField(
  settings: Readonly<Record<string, JsonValue>>,
  key: string,
  raw: string,
  numeric: boolean,
): Readonly<Record<string, JsonValue>> | undefined {
  const next: Record<string, JsonValue> = { ...settings };
  if (raw.trim() === '') {
    delete next[key];
    return next;
  }
  if (!numeric) {
    next[key] = raw;
    return next;
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value)) return undefined;
  next[key] = value;
  return next;
}

/** The numbers currently chosen for a list-valued setting. */
export function chosenNumbers(
  settings: Readonly<Record<string, JsonValue>>,
  key: string,
): readonly number[] {
  const value = settings[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === 'number')
    : [];
}

/**
 * The settings with one number added to or removed from a list.
 *
 * An emptied list is removed rather than stored as `[]`: a study covering no
 * band is not a study, and the module has to report the input as missing.
 */
export function withNumberChoice(
  settings: Readonly<Record<string, JsonValue>>,
  key: string,
  value: number,
  chosen: boolean,
): Readonly<Record<string, JsonValue>> {
  const current = chosenNumbers(settings, key);
  const next = chosen
    ? [...new Set([...current, value])].sort((first, second) => first - second)
    : current.filter((entry) => entry !== value);
  const settingsNext: Record<string, JsonValue> = { ...settings };
  if (next.length === 0) delete settingsNext[key];
  else settingsNext[key] = next;
  return settingsNext;
}

/** Whether this catalogue can actually edit a module's setting key. */
export function canEditSetting(moduleId: string, key: string): boolean {
  const descriptor = MODULE_SETTINGS.find(
    (entry) => entry.moduleId === moduleId,
  );
  if (descriptor === undefined) return false;
  return (
    descriptor.fields.some((field) => field.key === key) ||
    (descriptor.materialTables ?? []).some((table) => table.key === key) ||
    (descriptor.keyedTables ?? []).some((table) => table.key === key) ||
    (descriptor.numberChoices ?? []).some((choice) => choice.key === key)
  );
}

export function withMaterialValue(
  settings: Readonly<Record<string, JsonValue>>,
  tableKey: string,
  materialId: string,
  raw: string,
): Readonly<Record<string, JsonValue>> | undefined {
  const current = settings[tableKey];
  const table: Record<string, JsonValue> =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? { ...(current as Record<string, JsonValue>) }
      : {};
  if (raw.trim() === '') delete table[materialId];
  else {
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value)) return undefined;
    table[materialId] = value;
  }
  const next: Record<string, JsonValue> = { ...settings };
  if (Object.keys(table).length === 0) delete next[tableKey];
  else next[tableKey] = table;
  return next;
}
