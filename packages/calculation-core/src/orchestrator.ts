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

export class CalculationOrchestrator {
  readonly #modules = new Map<string, CalculationModule>();
  readonly #cache = new Map<string, CalculationResult>();
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
    const cached = this.#cache.get(fingerprint);
    if (cached !== undefined)
      return { status: 'OK', result: cached, cacheHit: true };
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
      this.#cache.set(fingerprint, result);
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
