import type { JsonValue } from '@house-technical-designer/core-domain';
import type { DraftFieldKind } from '../DraftField.js';

/**
 * How one stored property is presented and edited.
 *
 * The key is what the model and the calculations read; the label and the unit
 * are what the user reads. Neither is derived from the other, so renaming a
 * label never changes what a module consumes, and a key with no descriptor is
 * still shown — under its own name, rather than hidden.
 */
export interface PropertyDescriptor {
  readonly key: string;
  readonly label: string;
  readonly kind: DraftFieldKind;
  readonly unit?: string;
  readonly group: string;
  readonly min?: number;
  readonly hint?: string;
}

const DESCRIPTORS: readonly PropertyDescriptor[] = [
  { key: 'name', label: 'Nom', kind: 'TEXT', group: 'Identité' },
  {
    key: 'systemType',
    label: 'Type de système',
    kind: 'TEXT',
    group: 'Identité',
  },
  {
    key: 'nominalPowerW',
    label: 'Puissance nominale',
    kind: 'NUMBER',
    unit: 'W',
    group: 'Puissance',
    min: 0,
  },
  {
    key: 'electricalPowerW',
    label: 'Puissance électrique',
    kind: 'NUMBER',
    unit: 'W',
    group: 'Puissance',
    min: 0,
  },
  {
    key: 'usefulHeatingPowerW',
    label: 'Puissance utile de chauffe',
    kind: 'NUMBER',
    unit: 'W',
    group: 'Puissance',
    min: 0,
  },
  {
    key: 'standbyLossW',
    label: 'Pertes à l’arrêt',
    kind: 'NUMBER',
    unit: 'W',
    group: 'Puissance',
    min: 0,
  },
  {
    key: 'luminousFluxLm',
    label: 'Flux lumineux',
    kind: 'NUMBER',
    unit: 'lm',
    group: 'Photométrie',
    min: 0,
  },
  {
    key: 'colorTemperatureK',
    label: 'Température de couleur',
    kind: 'NUMBER',
    unit: 'K',
    group: 'Photométrie',
    min: 0,
  },
  {
    key: 'usableCapacityKWh',
    label: 'Capacité utile',
    kind: 'NUMBER',
    unit: 'kWh',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'maxChargePowerKW',
    label: 'Puissance de charge maximale',
    kind: 'NUMBER',
    unit: 'kW',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'maxDischargePowerKW',
    label: 'Puissance de décharge maximale',
    kind: 'NUMBER',
    unit: 'kW',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'chargeEfficiency',
    label: 'Rendement de charge',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'dischargeEfficiency',
    label: 'Rendement de décharge',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'minimumSoc',
    label: 'État de charge minimal',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'maximumSoc',
    label: 'État de charge maximal',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'initialSoc',
    label: 'État de charge initial',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
  },
  {
    key: 'tankVolumeL',
    label: 'Volume de ballon',
    kind: 'NUMBER',
    unit: 'L',
    group: 'Volumes',
    min: 0,
  },
  {
    key: 'nominalVolumeL',
    label: 'Volume nominal',
    kind: 'NUMBER',
    unit: 'L',
    group: 'Volumes',
    min: 0,
  },
  {
    key: 'initialVolumeL',
    label: 'Volume initial',
    kind: 'NUMBER',
    unit: 'L',
    group: 'Volumes',
    min: 0,
  },
  {
    key: 'designFlowM3h',
    label: 'Débit de dimensionnement',
    kind: 'NUMBER',
    unit: 'm³/h',
    group: 'Débits',
    min: 0,
  },
  {
    key: 'flowM3h',
    label: 'Débit',
    kind: 'NUMBER',
    unit: 'm³/h',
    group: 'Débits',
    min: 0,
  },
  {
    key: 'staticPressurePa',
    label: 'Pression statique',
    kind: 'NUMBER',
    unit: 'Pa',
    group: 'Débits',
    min: 0,
  },
  {
    key: 'installedPowerWp',
    label: 'Puissance crête installée',
    kind: 'NUMBER',
    unit: 'Wc',
    group: 'Photovoltaïque',
    min: 0,
  },
  {
    key: 'moduleCount',
    label: 'Nombre de modules',
    kind: 'NUMBER',
    unit: 'modules',
    group: 'Photovoltaïque',
    min: 0,
  },
  {
    key: 'moduleAreaM2',
    label: 'Surface d’un module',
    kind: 'NUMBER',
    unit: 'm²',
    group: 'Photovoltaïque',
    min: 0,
  },
];

const BY_KEY = new Map(
  DESCRIPTORS.map((descriptor) => [descriptor.key, descriptor]),
);

/**
 * How to present a stored property.
 *
 * A key the catalogue does not describe is still editable, under its own name
 * and in an "Autres" group: hiding it would make the application look as
 * though it had lost the value.
 */
export function describeProperty(
  key: string,
  value: JsonValue,
): PropertyDescriptor {
  const known = BY_KEY.get(key);
  if (known !== undefined) return known;
  return {
    key,
    label: key,
    kind:
      typeof value === 'number'
        ? 'NUMBER'
        : typeof value === 'boolean'
          ? 'BOOLEAN'
          : 'TEXT',
    group: 'Autres',
    hint: 'Propriété non décrite par le catalogue : elle est affichée telle qu’elle est enregistrée.',
  };
}

/** Descriptors for a property record, grouped in the order the groups appear. */
export function describeProperties(
  properties: Readonly<Record<string, JsonValue>>,
): readonly {
  readonly group: string;
  readonly entries: readonly {
    readonly descriptor: PropertyDescriptor;
    readonly value: JsonValue;
  }[];
}[] {
  const groups = new Map<
    string,
    { descriptor: PropertyDescriptor; value: JsonValue }[]
  >();
  for (const [key, value] of Object.entries(properties)) {
    const descriptor = describeProperty(key, value);
    const entries = groups.get(descriptor.group) ?? [];
    entries.push({ descriptor, value });
    groups.set(descriptor.group, entries);
  }
  return [...groups.entries()].map(([group, entries]) => ({ group, entries }));
}

/**
 * The property record after a field is committed.
 *
 * An emptied field removes the property rather than storing a value nobody
 * chose — and never NaN, which is not a value a project file can hold.
 * `undefined` means the text was not a number, so nothing is written.
 */
export function withProperty(
  properties: Readonly<Record<string, JsonValue>>,
  descriptor: PropertyDescriptor,
  raw: string,
): Readonly<Record<string, JsonValue>> | undefined {
  const next: Record<string, JsonValue> = { ...properties };
  if (descriptor.kind === 'BOOLEAN') {
    next[descriptor.key] = raw === 'true';
    return next;
  }
  if (raw.trim() === '') {
    delete next[descriptor.key];
    return next;
  }
  if (descriptor.kind === 'TEXT') {
    next[descriptor.key] = raw;
    return next;
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value)) return undefined;
  next[descriptor.key] = value;
  return next;
}
