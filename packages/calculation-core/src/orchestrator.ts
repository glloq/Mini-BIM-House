export type CalculationJson =
  | null
  | boolean
  | number
  | string
  | readonly CalculationJson[]
  | { readonly [key: string]: CalculationJson };
export interface CalculationDependency {
  readonly moduleId: string;
  readonly required: boolean;
}
export interface CalculationValidationIssue {
  readonly path: string;
  readonly message: string;
}
export type CalculationValidation =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly issues: readonly CalculationValidationIssue[];
    };
export interface CalculationWarning {
  readonly code: string;
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly message: string;
  readonly objectIds?: readonly string[];
}
export interface CalculationAssumption {
  readonly id: string;
  readonly value: CalculationJson;
  readonly source?: string;
}
export interface CalculationReference {
  readonly id: string;
  readonly title: string;
  readonly url?: string;
}
export interface CalculationResult {
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly precision: 'ESTIMATE' | 'ENGINEERING' | 'STANDARD' | 'REGULATORY';
  readonly status: 'OK' | 'PARTIAL' | 'FAILED';
  readonly methodId: string;
  readonly inputFingerprint: string;
  readonly outputs: Readonly<Record<string, CalculationJson>>;
  readonly warnings: readonly CalculationWarning[];
  readonly assumptions: readonly CalculationAssumption[];
  readonly references: readonly CalculationReference[];
  readonly trace?: {
    readonly formulas?: readonly string[];
    readonly sourceIds?: readonly string[];
    readonly dependencyFingerprints: readonly string[];
  };
}
export interface ModuleCalculation {
  readonly status: CalculationResult['status'];
  readonly outputs: CalculationResult['outputs'];
  readonly warnings?: readonly CalculationWarning[];
  readonly assumptions?: readonly CalculationAssumption[];
  readonly references?: readonly CalculationReference[];
  readonly trace?: Omit<
    NonNullable<CalculationResult['trace']>,
    'dependencyFingerprints'
  >;
}
export interface CalculationModule {
  readonly id: string;
  readonly version: string;
  readonly methodId: string;
  readonly precision: CalculationResult['precision'];
  readonly dependencies: readonly CalculationDependency[];
  /** Schema identifier for serializable worker-bound settings. */
  readonly settingsSchemaId: string;
  /** Project/domain paths owned by this module for invalidation. */
  readonly inputPaths: readonly string[];
  validate(
    input: CalculationJson,
    settings: CalculationJson,
  ): CalculationValidation;
  calculate(
    input: CalculationJson,
    settings: CalculationJson,
    dependencies: Readonly<Record<string, CalculationResult>>,
    signal?: AbortSignal,
  ): ModuleCalculation | Promise<ModuleCalculation>;
}
export type CalculationRunResult =
  | {
      readonly status: 'OK';
      readonly result: CalculationResult;
      readonly cacheHit: boolean;
    }
  | {
      readonly status: 'ERROR';
      readonly code:
        | 'UNKNOWN_MODULE'
        | 'MISSING_DEPENDENCY'
        | 'DEPENDENCY_CYCLE'
        | 'INVALID_INPUT'
        | 'ABORTED'
        | 'TECHNICAL_ERROR';
      readonly message: string;
    };

/**
 * Ce qu'un cache dit de lui-même.
 *
 * Sans ces trois nombres, « les résultats sont réutilisés » est une croyance.
 * Avec eux, c'est une mesure : un test peut affirmer que déplacer un mur
 * recalcule cinq modules sur dix-sept, et le jour où quelqu'un ajoute au
 * calcul une valeur qui change à chaque appel — un horodatage, un identifiant
 * tiré au sort — le compte de réutilisations tombe à zéro et le test le dit.
 */
export interface CalculationCacheStatistics {
  /** Entrées gardées en ce moment. */
  readonly entries: number;
  /** Calculs évités depuis la création de l'orchestrateur. */
  readonly hits: number;
  /** Calculs réellement exécutés. */
  readonly misses: number;
  /** Entrées supprimées faute de place. */
  readonly evictions: number;
}

/**
 * Combien de résultats un orchestrateur garde.
 *
 * Un cache qui ne se vide jamais est une fuite : dix-sept modules par révision,
 * et une séance de travail en produit des centaines. Cinq cent douze entrées
 * font une trentaine de révisions de projet — assez pour qu'annuler et refaire
 * ne recalcule rien, ce qui est le geste que ce cache existe pour rendre
 * gratuit. Au-delà, la plus anciennement utilisée s'en va : ce qu'on regarde
 * maintenant vaut mieux que ce qu'on regardait il y a une heure.
 */
export const DEFAULT_CALCULATION_CACHE_ENTRIES = 512;

export class CalculationOrchestrator {
  readonly #modules = new Map<string, CalculationModule>();
  /*
   * L'ordre d'insertion d'une `Map` est l'ordre de dernière écriture ; une
   * lecture réécrit donc son entrée pour la remettre en queue, et la tête est
   * toujours la moins récemment utilisée. C'est un cache LRU sans structure
   * supplémentaire, ce qui est exactement ce qu'il faut ici.
   */
  readonly #cache = new Map<string, CalculationResult>();
  readonly #capacity: number;
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  constructor(capacity: number = DEFAULT_CALCULATION_CACHE_ENTRIES) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new RangeError('Cache capacity must be a positive integer.');
    this.#capacity = capacity;
  }

  /** Ce que le cache a évité, en trois nombres qu'un test peut lire. */
  statistics(): CalculationCacheStatistics {
    return {
      entries: this.#cache.size,
      hits: this.#hits,
      misses: this.#misses,
      evictions: this.#evictions,
    };
  }

  register(module: CalculationModule): void {
    if (this.#modules.has(module.id))
      throw new TypeError(
        `Calculation module ${module.id} is already registered.`,
      );
    this.#modules.set(module.id, module);
  }
  async calculateModule(
    moduleId: string,
    inputs: Readonly<Record<string, CalculationJson>>,
    settings: Readonly<Record<string, CalculationJson>>,
    signal?: AbortSignal,
  ): Promise<CalculationRunResult> {
    return this.#calculate(moduleId, inputs, settings, [], signal);
  }
  clearCache(): void {
    this.#cache.clear();
    this.#hits = 0;
    this.#misses = 0;
    this.#evictions = 0;
  }

  /**
   * Lit une entrée en la remettant en queue.
   *
   * Rien de plus qu'un `get`, sauf que le fait de s'en servir la rend récente :
   * un module qu'on consulte à chaque calcul ne doit pas être évincé par une
   * révision de plus.
   */
  #read(fingerprint: string): CalculationResult | undefined {
    const cached = this.#cache.get(fingerprint);
    if (cached === undefined) return undefined;
    this.#cache.delete(fingerprint);
    this.#cache.set(fingerprint, cached);
    return cached;
  }

  #write(fingerprint: string, result: CalculationResult): void {
    this.#cache.set(fingerprint, result);
    while (this.#cache.size > this.#capacity) {
      const oldest = this.#cache.keys().next();
      if (oldest.done === true) break;
      this.#cache.delete(oldest.value);
      this.#evictions += 1;
    }
  }
  async #calculate(
    moduleId: string,
    inputs: Readonly<Record<string, CalculationJson>>,
    settings: Readonly<Record<string, CalculationJson>>,
    stack: readonly string[],
    signal?: AbortSignal,
  ): Promise<CalculationRunResult> {
    if (signal?.aborted === true)
      return {
        status: 'ERROR',
        code: 'ABORTED',
        message: 'Calculation was aborted.',
      };
    const module = this.#modules.get(moduleId);
    if (module === undefined)
      return {
        status: 'ERROR',
        code: 'UNKNOWN_MODULE',
        message: `Module ${moduleId} is not registered.`,
      };
    if (stack.includes(moduleId))
      return {
        status: 'ERROR',
        code: 'DEPENDENCY_CYCLE',
        message: `Dependency cycle: ${[...stack, moduleId].join(' → ')}`,
      };
    const dependencyResults: Record<string, CalculationResult> = {};
    for (const dependency of module.dependencies) {
      if (!this.#modules.has(dependency.moduleId)) {
        if (dependency.required)
          return {
            status: 'ERROR',
            code: 'MISSING_DEPENDENCY',
            message: `Required dependency ${dependency.moduleId} is not registered.`,
          };
        continue;
      }
      const result = await this.#calculate(
        dependency.moduleId,
        inputs,
        settings,
        [...stack, moduleId],
        signal,
      );
      if (result.status === 'ERROR') return result;
      dependencyResults[dependency.moduleId] = result.result;
    }
    const input = inputs[moduleId] ?? null;
    const moduleSettings = settings[moduleId] ?? null;
    const validation = module.validate(input, moduleSettings);
    if (!validation.valid)
      return {
        status: 'ERROR',
        code: 'INVALID_INPUT',
        message: validation.issues
          .map(({ path, message }) => `${path}: ${message}`)
          .join('; '),
      };
    const fingerprint = fingerprintValue({
      moduleId,
      version: module.version,
      methodId: module.methodId,
      input,
      settings: moduleSettings,
      dependencies: Object.fromEntries(
        Object.entries(dependencyResults).map(([id, result]) => [
          id,
          result.inputFingerprint,
        ]),
      ),
    });
    const cached = this.#read(fingerprint);
    if (cached !== undefined) {
      this.#hits += 1;
      return { status: 'OK', result: cached, cacheHit: true };
    }
    this.#misses += 1;
    try {
      const calculated = await module.calculate(
        input,
        moduleSettings,
        dependencyResults,
        signal,
      );
      if (isAborted(signal))
        return {
          status: 'ERROR',
          code: 'ABORTED',
          message: 'Calculation was aborted.',
        };
      canonicalize(calculated.outputs);
      calculated.assumptions?.forEach(({ value }) => canonicalize(value));
      const result: CalculationResult = {
        moduleId,
        moduleVersion: module.version,
        precision: module.precision,
        status: calculated.status,
        methodId: module.methodId,
        inputFingerprint: fingerprint,
        outputs: calculated.outputs,
        warnings: calculated.warnings ?? [],
        assumptions: calculated.assumptions ?? [],
        references: calculated.references ?? [],
        trace: {
          ...(calculated.trace ?? {}),
          dependencyFingerprints: Object.values(dependencyResults).map(
            ({ inputFingerprint }) => inputFingerprint,
          ),
        },
      };
      this.#write(fingerprint, result);
      return { status: 'OK', result, cacheHit: false };
    } catch (error: unknown) {
      return {
        status: 'ERROR',
        code: 'TECHNICAL_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown calculation failure.',
      };
    }
  }
}

export function fingerprintValue(value: CalculationJson): string {
  const canonical = JSON.stringify(canonicalize(value));
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(canonical)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}
function canonicalize(value: CalculationJson): CalculationJson {
  if (isCalculationArray(value)) return value.map(canonicalize);
  if (typeof value === 'object' && value !== null)
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key]!)]),
    );
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new RangeError('Calculation fingerprints require finite numbers.');
  return value;
}

function isCalculationArray(
  value: CalculationJson,
): value is readonly CalculationJson[] {
  return Array.isArray(value);
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}
