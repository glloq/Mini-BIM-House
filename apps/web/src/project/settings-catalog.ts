import type { JsonValue, Project } from '@house-technical-designer/core-domain';
/*
 * Le registre seul, et non le barillet.
 *
 * Lire un libellé et une méthode par le barillet emportait les dix-sept
 * moteurs de calcul — thermique, hydraulique, électrique, acoustique — au
 * premier écran, parce que cet écran-ci est atteint depuis les vérifications,
 * qui sont dans la coque. Le sous-chemin `registry` ne contient que des noms.
 */
import {
  calculationModuleContract,
  calculationModuleLabel,
} from '@house-technical-designer/calculation-adapters/registry';

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
  readonly kind: 'NUMBER' | 'TEXT' | 'BOOLEAN';
  readonly unit?: string;
  readonly hint?: string;
}

/**
 * Where the rows of a per-object setting come from.
 *
 * A price per cubic metre is asked material by material. A price per metre of
 * run is asked product by product, and a price per unit placed model by model:
 * the same shape, three different lists, and only the first existed — so the
 * whole plumbing, wiring and equipment of a house had prices the interface
 * could not take.
 */
export type SettingTableSource = 'MATERIALS' | 'NETWORK_PRODUCTS' | 'EQUIPMENT';

/** A setting the user fills in object by object rather than once for the project. */
export interface ModuleSettingObjectTable {
  readonly key: string;
  readonly label: string;
  readonly unit: string;
  /** The project's materials unless the table says otherwise. */
  readonly source?: SettingTableSource;
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
  /**
   * Whether the rooms of the project add their own rows to this table.
   *
   * A room's category is a free string in the model, so the conventional list
   * cannot be the whole of it: a project calling a landing a `CIRCULATION`
   * asked for an occupancy the screen had no line for, and the module reported
   * an input nobody could supply.
   */
  readonly fromSpaceCategories?: boolean;
}

export interface ModuleSettingsDescriptor {
  readonly moduleId: string;
  /**
   * What this module is called.
   *
   * Read from the registry rather than written again here: the two spellings
   * had already drifted — « Thermique » on this screen and « Enveloppe
   * thermique » on the dashboard, for the same module.
   */
  readonly label: string;
  readonly fields: readonly ModuleSettingField[];
  readonly objectTables?: readonly ModuleSettingObjectTable[];
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

/** What each module's settings screen offers, before it is given its name. */
type ModuleSettingsEntry = Omit<ModuleSettingsDescriptor, 'label'>;

const MODULE_SETTINGS_ENTRIES: readonly ModuleSettingsEntry[] = [
  { moduleId: 'thermal', fields: [] },
  {
    moduleId: 'heating',
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
  {
    moduleId: 'electrical',
    fields: [],
    note: 'Tension, phases, puissances et sections se saisissent sur les nœuds et les tronçons du réseau électrique, dans l’espace Réseaux.',
  },
  { moduleId: 'ventilation', fields: [] },
  {
    moduleId: 'iaq',
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
        fromSpaceCategories: true,
      },
    ],
  },
  {
    moduleId: 'water',
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
      {
        key: 'initialVolumeL',
        kind: 'NUMBER',
        label: 'Volume au premier jour',
        unit: 'L',
        hint: 'Ce que la cuve contient quand la simulation commence. Une cuve vide noircit les premières semaines, une cuve pleine les embellit : le bilan ne choisit ni l’un ni l’autre.',
      },
    ],
  },
  {
    moduleId: 'photovoltaic',
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
    fields: [
      {
        key: 'offGrid',
        kind: 'BOOLEAN',
        label: 'Site hors réseau',
        hint: 'Coché, le stockage est dimensionné sans appui du réseau.',
      },
    ],
  },
  {
    moduleId: 'energy-balance',
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
    fields: [
      { key: 'currency', kind: 'TEXT', label: 'Devise', unit: 'code ISO' },
    ],
    objectTables: [
      { key: 'unitPriceByMaterial', label: 'Prix matériau', unit: '/m³' },
      { key: 'labourPriceByMaterial', label: 'Main-d’œuvre', unit: '/m³' },
      { key: 'wasteFactorByMaterial', label: 'Déchets', unit: '0 à 1' },
      {
        key: 'unitPriceByProduct',
        label: 'Prix du produit',
        unit: '/m',
        source: 'NETWORK_PRODUCTS',
      },
      {
        key: 'labourPriceByProduct',
        label: 'Pose du produit',
        unit: '/m',
        source: 'NETWORK_PRODUCTS',
      },
      {
        key: 'unitPriceByEquipment',
        label: 'Prix du modèle',
        unit: '/u',
        source: 'EQUIPMENT',
      },
      {
        key: 'labourPriceByEquipment',
        label: 'Pose du modèle',
        unit: '/u',
        source: 'EQUIPMENT',
      },
    ],
  },
  {
    moduleId: 'environmental',
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
    objectTables: [
      { key: 'gwpPerUnitByMaterial', label: 'Facteur GWP', unit: 'kgCO₂e/m³' },
    ],
  },
];

/**
 * The settings screen, module by module, named by the registry.
 *
 * The name was written twice — here and in the calculation registry — and the
 * two had drifted: this screen said « Thermique » where everything else said
 * « Enveloppe thermique », for the same module.
 */
export const MODULE_SETTINGS: readonly ModuleSettingsDescriptor[] =
  MODULE_SETTINGS_ENTRIES.map((entry) => ({
    ...entry,
    label: calculationModuleLabel(entry.moduleId),
  }));

/** The method and version a module declares, so a settings entry can name them. */
export const moduleContract = calculationModuleContract;

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
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

/**
 * Whether a setting stored as a flag is on.
 *
 * Earlier versions wrote 1 and 0, which is what a project file may still hold;
 * both are read, and the checkbox writes a real boolean from now on.
 */
export function flagValue(
  settings: Readonly<Record<string, JsonValue>>,
  key: string,
): boolean {
  const value = settings[key];
  return value === true || value === 1;
}

/** The settings with one flag set or cleared. */
export function withFlag(
  settings: Readonly<Record<string, JsonValue>>,
  key: string,
  value: boolean,
): Readonly<Record<string, JsonValue>> {
  return { ...settings, [key]: value };
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

/**
 * The rows of a keyed table, including the ones this project brought.
 *
 * The conventional list first, then whatever categories the rooms actually
 * carry: the screen has to be able to take every figure a module can ask for,
 * and a room's category is a free string in the model.
 */
export function keyedTableRows(
  table: ModuleSettingKeyedTable,
  project: Project,
): readonly { readonly key: string; readonly label: string }[] {
  if (table.fromSpaceCategories !== true) return table.rows;
  const known = new Set(table.rows.map(({ key }) => key));
  const extra = [
    ...new Set(
      project.building.levels
        .flatMap(({ spaces }) => spaces)
        .map(({ category }) => category)
        .filter((category) => !known.has(category)),
    ),
  ].sort();
  return [...table.rows, ...extra.map((key) => ({ key, label: key }))];
}

/**
 * Whether this catalogue can actually edit a module's setting key.
 *
 * A module names a missing row of a table by the table and the row —
 * `unitPriceByMaterial/material-masonry` — and the table is what the interface
 * offers. Answering « non » to those was answering « non » to every price a
 * project has ever failed to declare, so no `Corriger` was offered for the one
 * kind of missing input the settings screen is entirely made for.
 */
export function canEditSetting(moduleId: string, key: string): boolean {
  const descriptor = MODULE_SETTINGS.find(
    (entry) => entry.moduleId === moduleId,
  );
  if (descriptor === undefined) return false;
  const table = key.split('/')[0] ?? key;
  return (
    descriptor.fields.some((field) => field.key === key) ||
    (descriptor.objectTables ?? []).some(
      (entry) => entry.key === key || entry.key === table,
    ) ||
    (descriptor.keyedTables ?? []).some(
      (entry) => entry.key === key || entry.key === table,
    ) ||
    (descriptor.numberChoices ?? []).some((choice) => choice.key === key)
  );
}

/** The settings with one row of a per-object table set, or removed when emptied. */
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
