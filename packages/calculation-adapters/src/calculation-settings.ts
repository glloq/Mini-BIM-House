import type {
  JsonValue,
  ModuleSettings,
  Project,
} from '@house-technical-designer/core-domain';
import type {
  CalculationAssumption,
  CalculationJson,
} from '@house-technical-designer/calculation-core';

/**
 * Where a calculation hypothesis is allowed to come from.
 *
 * A calculation input is only legitimate when it is traceable to one of these
 * origins. Integration fixtures are deliberately not part of the list: an input
 * that cannot be resolved stays unknown and is reported through
 * {@link MissingCalculationInput}.
 */
export type CalculationInputOrigin =
  /** Persisted project facts: geometry, materials, assemblies, spaces, networks. */
  | 'PROJECT'
  /** A scenario variant applied on top of the project. */
  | 'SCENARIO'
  /** `project.calculationSettings[moduleId].settings`: explicit module hypotheses. */
  | 'MODULE_SETTINGS'
  /** An identified external climate dataset. */
  | 'CLIMATE_DATASET'
  /** An equipment definition carried by the project. */
  | 'EQUIPMENT'
  /** A documented method constant or physical constant, always declared as an assumption. */
  | 'METHOD_DEFAULT';

export interface CalculationInputProvenance {
  readonly moduleId: string;
  readonly key: string;
  readonly origin: CalculationInputOrigin;
  readonly sourceId: string;
}

export interface MissingCalculationInput {
  readonly moduleId: string;
  readonly key: string;
  /** Where the value is expected to be defined so the UI can point the user at it. */
  readonly expectedOrigin: CalculationInputOrigin;
  readonly message: string;
}

/** A constant that is documented rather than chosen per project. */
export interface DeclaredConstant {
  readonly value: number;
  readonly sourceId: string;
  readonly reference: string;
}

/**
 * Physical constants. They are properties of matter rather than design choices,
 * but they are still declared so every result can be traced back to them.
 */
export const PHYSICAL_CONSTANTS = {
  airDensityKgM3: {
    value: 1.2,
    sourceId: 'constant:dry-air-density-20c',
    reference: 'Dry air at 20 °C and 101 325 Pa',
  },
  airSpecificHeatJKgK: {
    value: 1005,
    sourceId: 'constant:dry-air-specific-heat',
    reference: 'Dry air isobaric specific heat capacity at 20 °C',
  },
  waterDensityKgM3: {
    value: 998,
    sourceId: 'constant:water-density-20c',
    reference: 'Liquid water at 20 °C',
  },
  waterSpecificHeatJKgK: {
    value: 4180,
    sourceId: 'constant:water-specific-heat',
    reference: 'Liquid water isobaric specific heat capacity at 20 °C',
  },
  waterDynamicViscosityPaS: {
    value: 0.001,
    sourceId: 'constant:water-dynamic-viscosity-20c',
    reference: 'Liquid water dynamic viscosity at 20 °C',
  },
  airDynamicViscosityPaS: {
    value: 0.000018,
    sourceId: 'constant:air-dynamic-viscosity-20c',
    reference: 'Dry air dynamic viscosity at 20 °C',
  },
  gravityMs2: {
    value: 9.81,
    sourceId: 'constant:standard-gravity',
    reference: 'Standard gravitational acceleration',
  },
  outdoorCo2Ppm: {
    value: 420,
    sourceId: 'constant:outdoor-co2',
    reference: 'Typical outdoor CO₂ background concentration',
  },
} as const satisfies Readonly<Record<string, DeclaredConstant>>;

/**
 * Method constants that have a conventional value in the referenced method.
 * Every entry can be overridden through `project.calculationSettings`, and every
 * entry that is actually used is reported as a calculation assumption.
 */
export const METHOD_DEFAULTS = {
  thermal: {
    insideSurfaceResistanceM2KW: {
      value: 0.13,
      sourceId: 'method-default:iso-6946-rsi-horizontal',
      reference: 'ISO 6946 internal surface resistance, horizontal heat flow',
    },
    outsideSurfaceResistanceM2KW: {
      value: 0.04,
      sourceId: 'method-default:iso-6946-rse',
      reference: 'ISO 6946 external surface resistance',
    },
  },
  hygrothermal: {
    interiorSurfaceResistanceM2KW: {
      value: 0.13,
      sourceId: 'method-default:iso-6946-rsi-horizontal',
      reference: 'ISO 6946 internal surface resistance, horizontal heat flow',
    },
    exteriorSurfaceResistanceM2KW: {
      value: 0.04,
      sourceId: 'method-default:iso-6946-rse',
      reference: 'ISO 6946 external surface resistance',
    },
  },
  acoustics: {
    reverberationConstant: {
      value: 0.161,
      sourceId: 'method-default:sabine-constant',
      reference: 'Sabine reverberation constant for air at 20 °C',
    },
  },
  water: {
    pipeRoughnessM: {
      value: 0.0000015,
      sourceId: 'method-default:drawn-pipe-roughness',
      reference: 'Absolute roughness of drawn copper or plastic pipe',
    },
  },
  ventilation: {
    ductRoughnessM: {
      value: 0.00009,
      sourceId: 'method-default:galvanised-duct-roughness',
      reference: 'Absolute roughness of galvanised steel duct',
    },
  },
  electrical: {
    copperResistivityOhmMm2PerM: {
      value: 0.01724,
      sourceId: 'method-default:copper-resistivity-20c',
      reference: 'Annealed copper resistivity at 20 °C, IEC 60028',
    },
    aluminiumResistivityOhmMm2PerM: {
      value: 0.0282,
      sourceId: 'method-default:aluminium-resistivity-20c',
      reference: 'Aluminium conductor resistivity at 20 °C',
    },
  },
} as const satisfies Readonly<
  Record<string, Readonly<Record<string, DeclaredConstant>>>
>;

function isRecord(
  value: JsonValue | undefined,
): value is { readonly [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads calculation hypotheses from a project and records where each value came
 * from. The reader never invents a design choice: an absent value is recorded as
 * missing so the caller can surface it instead of computing on a guess.
 */
export class ProjectCalculationSettings {
  readonly #settings: Readonly<Record<string, ModuleSettings>>;
  readonly #provenance: CalculationInputProvenance[] = [];
  readonly #missing: MissingCalculationInput[] = [];
  readonly #assumptions = new Map<string, Map<string, CalculationAssumption>>();

  constructor(settings: Readonly<Record<string, ModuleSettings>> = {}) {
    this.#settings = settings;
  }

  static fromProject(project: Project): ProjectCalculationSettings {
    return new ProjectCalculationSettings(project.calculationSettings ?? {});
  }

  get provenance(): readonly CalculationInputProvenance[] {
    return this.#provenance;
  }

  get missing(): readonly MissingCalculationInput[] {
    return this.#missing;
  }

  moduleSettings(moduleId: string): ModuleSettings | undefined {
    return this.#settings[moduleId];
  }

  /** Assumptions actually consumed by a module, in declaration order. */
  assumptionsFor(moduleId: string): readonly CalculationAssumption[] {
    return [...(this.#assumptions.get(moduleId)?.values() ?? [])];
  }

  #raw(moduleId: string, key: string): JsonValue | undefined {
    return this.#settings[moduleId]?.settings[key];
  }

  #record(
    moduleId: string,
    key: string,
    origin: CalculationInputOrigin,
    sourceId: string,
  ): void {
    this.#provenance.push({ moduleId, key, origin, sourceId });
  }

  #declare(moduleId: string, assumption: CalculationAssumption): void {
    const byId =
      this.#assumptions.get(moduleId) ??
      new Map<string, CalculationAssumption>();
    byId.set(assumption.id, assumption);
    this.#assumptions.set(moduleId, byId);
  }

  /** Records a value the caller resolved from project data or equipment. */
  note(
    moduleId: string,
    key: string,
    origin: CalculationInputOrigin,
    sourceId: string,
  ): void {
    this.#record(moduleId, key, origin, sourceId);
  }

  /**
   * Records a hypothesis the adapter made rather than read.
   *
   * Some values have a defensible default that is still a choice: a segment
   * with no fitting stated is taken as having none. Written down here, it
   * travels with the result instead of disappearing into it.
   */
  assume(
    moduleId: string,
    id: string,
    value: CalculationJson,
    source: string,
  ): void {
    this.#declare(moduleId, { id, value, source });
  }

  /** Records that a required value could not be resolved anywhere. */
  reportMissing(
    moduleId: string,
    key: string,
    expectedOrigin: CalculationInputOrigin,
    message: string,
  ): void {
    this.#missing.push({ moduleId, key, expectedOrigin, message });
  }

  /** Reads an explicit module hypothesis, reporting it as missing when absent. */
  requiredNumber(
    moduleId: string,
    key: string,
    message: string,
  ): number | undefined {
    const value = this.#raw(moduleId, key);
    if (typeof value === 'number' && Number.isFinite(value)) {
      this.#record(
        moduleId,
        key,
        'MODULE_SETTINGS',
        this.#settings[moduleId]?.methodId ?? moduleId,
      );
      return value;
    }
    this.reportMissing(moduleId, key, 'MODULE_SETTINGS', message);
    return undefined;
  }

  optionalNumber(moduleId: string, key: string): number | undefined {
    const value = this.#raw(moduleId, key);
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    this.#record(
      moduleId,
      key,
      'MODULE_SETTINGS',
      this.#settings[moduleId]?.methodId ?? moduleId,
    );
    return value;
  }

  optionalString(moduleId: string, key: string): string | undefined {
    const value = this.#raw(moduleId, key);
    if (typeof value !== 'string' || value === '') return undefined;
    this.#record(
      moduleId,
      key,
      'MODULE_SETTINGS',
      this.#settings[moduleId]?.methodId ?? moduleId,
    );
    return value;
  }

  optionalNumberArray(
    moduleId: string,
    key: string,
  ): readonly number[] | undefined {
    const value = this.#raw(moduleId, key);
    if (!Array.isArray(value)) return undefined;
    const numbers = value.filter(
      (item): item is number =>
        typeof item === 'number' && Number.isFinite(item),
    );
    if (numbers.length !== value.length || numbers.length === 0)
      return undefined;
    this.#record(
      moduleId,
      key,
      'MODULE_SETTINGS',
      this.#settings[moduleId]?.methodId ?? moduleId,
    );
    return numbers;
  }

  optionalNumberRecord(
    moduleId: string,
    key: string,
  ): Readonly<Record<string, number>> | undefined {
    const value = this.#raw(moduleId, key);
    if (!isRecord(value)) return undefined;
    const entries = Object.entries(value).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    );
    if (entries.length === 0) return undefined;
    this.#record(
      moduleId,
      key,
      'MODULE_SETTINGS',
      this.#settings[moduleId]?.methodId ?? moduleId,
    );
    return Object.fromEntries(entries);
  }

  /**
   * Reads a method constant: the project value when present, otherwise the
   * documented default. Either way the resulting value is declared as an
   * assumption so no conventional number stays silent.
   */
  methodConstant(moduleId: keyof typeof METHOD_DEFAULTS, key: string): number {
    const defaults = METHOD_DEFAULTS[moduleId] as Readonly<
      Record<string, DeclaredConstant>
    >;
    const declared = defaults[key];
    if (declared === undefined)
      throw new TypeError(`No documented default for ${moduleId}.${key}.`);
    const override = this.#raw(moduleId, key);
    if (typeof override === 'number' && Number.isFinite(override)) {
      this.#record(
        moduleId,
        key,
        'MODULE_SETTINGS',
        this.#settings[moduleId]?.methodId ?? moduleId,
      );
      this.#declare(moduleId, {
        id: key,
        value: override,
        source: `project:calculationSettings.${moduleId}`,
      });
      return override;
    }
    this.#record(moduleId, key, 'METHOD_DEFAULT', declared.sourceId);
    this.#declare(moduleId, {
      id: key,
      value: declared.value,
      source: `${declared.sourceId} — ${declared.reference}`,
    });
    return declared.value;
  }

  /** Declares a physical constant used by a module. */
  physicalConstant(
    moduleId: string,
    key: keyof typeof PHYSICAL_CONSTANTS,
  ): number {
    const declared = PHYSICAL_CONSTANTS[key];
    this.#record(moduleId, key, 'METHOD_DEFAULT', declared.sourceId);
    this.#declare(moduleId, {
      id: key,
      value: declared.value,
      source: `${declared.sourceId} — ${declared.reference}`,
    });
    return declared.value;
  }
}

/** Serialises the provenance ledger so a module can echo it in its outputs. */
export function provenanceOutputs(
  provenance: readonly CalculationInputProvenance[],
  moduleId: string,
): CalculationJson {
  return provenance
    .filter((entry) => entry.moduleId === moduleId)
    .map(({ key, origin, sourceId }) => ({ key, origin, sourceId }));
}
