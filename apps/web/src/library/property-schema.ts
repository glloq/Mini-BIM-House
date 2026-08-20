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
  /** Upper bound, when the quantity has one physically. */
  readonly max?: number;
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
    max: 1,
  },
  {
    key: 'dischargeEfficiency',
    label: 'Rendement de décharge',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
    max: 1,
  },
  {
    key: 'minimumSoc',
    label: 'État de charge minimal',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
    max: 1,
  },
  {
    key: 'maximumSoc',
    label: 'État de charge maximal',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
    max: 1,
  },
  {
    key: 'initialSoc',
    label: 'État de charge initial',
    kind: 'NUMBER',
    unit: '0 à 1',
    group: 'Stockage',
    min: 0,
    max: 1,
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
 * Whether a value falls outside what the quantity can physically be.
 *
 * A rate of return greater than one and a negative power are not opinions: they
 * are impossible, and storing them would make a calculation produce a number
 * that looks like a result. The message says the bound rather than only that
 * the value is refused.
 */
export function rangeIssue(
  descriptor: PropertyDescriptor,
  value: JsonValue,
): string | undefined {
  if (typeof value !== 'number') return undefined;
  const { min, max } = descriptor;
  if (min !== undefined && max !== undefined && (value < min || value > max))
    return `${descriptor.label} : la valeur doit être comprise entre ${min} et ${max}.`;
  if (min !== undefined && value < min)
    return `${descriptor.label} : la valeur ne peut pas être inférieure à ${min}.`;
  if (max !== undefined && value > max)
    return `${descriptor.label} : la valeur ne peut pas dépasser ${max}.`;
  return undefined;
}

interface PropertyInvariant {
  readonly check: (
    read: (key: string) => number | undefined,
  ) => string | undefined;
}

/**
 * The rules that tie several properties of one equipment together.
 *
 * Each property can be within its own bounds while the set is impossible — a
 * minimum state of charge above the maximum, a tank filled past its own volume.
 * A rule only speaks when both of the values it compares are present: an
 * unknown value stays unknown, it does not become a violation.
 */
const PROPERTY_INVARIANTS: readonly PropertyInvariant[] = [
  {
    check: (read) => {
      const low = read('minimumSoc');
      const high = read('maximumSoc');
      return low === undefined || high === undefined || low < high
        ? undefined
        : 'L’état de charge minimal doit rester inférieur au maximal.';
    },
  },
  {
    check: (read) => {
      const initial = read('initialSoc');
      if (initial === undefined) return undefined;
      const low = read('minimumSoc');
      const high = read('maximumSoc');
      if (low !== undefined && initial < low)
        return 'L’état de charge initial est sous le minimum déclaré.';
      if (high !== undefined && initial > high)
        return 'L’état de charge initial dépasse le maximum déclaré.';
      return undefined;
    },
  },
  {
    check: (read) => {
      const initial = read('initialVolumeL');
      const nominal = read('nominalVolumeL');
      return initial === undefined ||
        nominal === undefined ||
        initial <= nominal
        ? undefined
        : 'Le volume initial dépasse le volume nominal de la cuve.';
    },
  },
  {
    check: (read) => {
      const loss = read('standbyLossW');
      const nominal = read('nominalPowerW');
      return loss === undefined || nominal === undefined || loss <= nominal
        ? undefined
        : 'Les pertes à l’arrêt dépassent la puissance nominale.';
    },
  },
];

/** The invariants a property record breaks, in the order they are declared. */
export function invariantIssues(
  properties: Readonly<Record<string, JsonValue>>,
): readonly string[] {
  const read = (key: string): number | undefined => {
    const value = properties[key];
    return typeof value === 'number' ? value : undefined;
  };
  return PROPERTY_INVARIANTS.map((invariant) => invariant.check(read)).filter(
    (message): message is string => message !== undefined,
  );
}

/**
 * Why a committed value cannot be stored, if it cannot.
 *
 * Bounds are checked first, then the invariants the new value takes part in:
 * a rule about two other properties that was already broken is not reported
 * here, since this edit is not what broke it.
 */
export function propertyIssue(
  properties: Readonly<Record<string, JsonValue>>,
  descriptor: PropertyDescriptor,
  next: Readonly<Record<string, JsonValue>>,
): string | undefined {
  const value = next[descriptor.key];
  if (value === undefined) return undefined;
  const range = rangeIssue(descriptor, value);
  if (range !== undefined) return range;
  const before = new Set(invariantIssues(properties));
  return invariantIssues(next).find((message) => !before.has(message));
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
