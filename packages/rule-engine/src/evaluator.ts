import type { RuleDefinition, RuleResult, RuleStatus } from './rule-pack.js';

export interface RuleEvaluationContext {
  readonly objectIds: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

export interface RuleFunctionOutcome {
  readonly status: RuleStatus;
  readonly message?: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface RegisteredRuleFunction {
  readonly id: string;
  readonly version: string;
  readonly evaluate: (
    context: RuleEvaluationContext,
    parameters: Readonly<Record<string, unknown>>,
  ) => RuleFunctionOutcome;
}

export type DeclarativeExpression =
  | { readonly op: 'exists'; readonly path: string }
  | {
      readonly op: 'eq' | 'gt' | 'gte' | 'lt' | 'lte';
      readonly path: string;
      readonly value: string | number | boolean | null;
    }
  | {
      readonly op: 'and' | 'or';
      readonly expressions: readonly DeclarativeExpression[];
    }
  | { readonly op: 'not'; readonly expression: DeclarativeExpression };

export class RuleFunctionRegistry {
  readonly #functions = new Map<string, RegisteredRuleFunction>();

  register(definition: RegisteredRuleFunction): void {
    if (definition.id.trim() === '' || definition.version.trim() === '')
      throw new TypeError('Rule function ID and version must not be empty');
    if (this.#functions.has(definition.id))
      throw new Error(`Rule function ${definition.id} is already registered`);
    this.#functions.set(definition.id, definition);
  }

  get(id: string): RegisteredRuleFunction | undefined {
    return this.#functions.get(id);
  }
}

export function evaluateRule(
  rule: RuleDefinition,
  context: RuleEvaluationContext,
  parameters: Readonly<Record<string, unknown>>,
  functions: RuleFunctionRegistry,
): RuleResult {
  const outcome = evaluate(rule, context, parameters, functions);
  return {
    ruleId: rule.id,
    status: outcome.status,
    severity: rule.severity,
    objectIds: [...context.objectIds],
    message: outcome.message ?? rule.message ?? defaultMessage(outcome.status),
    referenceIds: [...(rule.referenceIds ?? [])],
    ...(outcome.evidence === undefined ? {} : { evidence: outcome.evidence }),
  };
}

function evaluate(
  rule: RuleDefinition,
  context: RuleEvaluationContext,
  parameters: Readonly<Record<string, unknown>>,
  functions: RuleFunctionRegistry,
): RuleFunctionOutcome {
  if (rule.evaluator.type === 'MODULE_FUNCTION') {
    const registered = functions.get(rule.evaluator.functionId);
    if (registered === undefined)
      return {
        status: 'UNKNOWN',
        message: `Rule function ${rule.evaluator.functionId} is not registered.`,
      };
    return registered.evaluate(context, parameters);
  }
  if (rule.evaluator.type === 'JSON_LOGIC')
    return {
      status: 'UNKNOWN',
      message: 'JSON_LOGIC evaluation is not enabled by this engine version.',
    };
  const expression = parseDeclarativeExpression(rule.evaluator.expression);
  if (expression === undefined)
    return { status: 'UNKNOWN', message: 'Declarative expression is invalid.' };
  const value = evaluateExpression(expression, context.data);
  return {
    status: value === undefined ? 'UNKNOWN' : value ? 'PASS' : 'FAIL',
    evidence: { expression },
  };
}

export function parseDeclarativeExpression(
  input: unknown,
): DeclarativeExpression | undefined {
  if (!isRecord(input) || typeof input.op !== 'string') return undefined;
  if (input.op === 'exists')
    return typeof input.path === 'string'
      ? { op: 'exists', path: input.path }
      : undefined;
  if (['eq', 'gt', 'gte', 'lt', 'lte'].includes(input.op)) {
    if (typeof input.path !== 'string' || !isComparableLiteral(input.value))
      return undefined;
    return {
      op: input.op as 'eq' | 'gt' | 'gte' | 'lt' | 'lte',
      path: input.path,
      value: input.value,
    };
  }
  if (input.op === 'not') {
    const expression = parseDeclarativeExpression(input.expression);
    return expression === undefined ? undefined : { op: 'not', expression };
  }
  if (input.op === 'and' || input.op === 'or') {
    if (!Array.isArray(input.expressions) || input.expressions.length === 0)
      return undefined;
    const expressions = input.expressions.map(parseDeclarativeExpression);
    if (expressions.some((expression) => expression === undefined))
      return undefined;
    return {
      op: input.op,
      expressions: expressions as readonly DeclarativeExpression[],
    };
  }
  return undefined;
}

function evaluateExpression(
  expression: DeclarativeExpression,
  data: Readonly<Record<string, unknown>>,
): boolean | undefined {
  if (expression.op === 'exists')
    return resolvePath(data, expression.path).found;
  if (expression.op === 'not') {
    const value = evaluateExpression(expression.expression, data);
    return value === undefined ? undefined : !value;
  }
  if (expression.op === 'and' || expression.op === 'or') {
    const values = expression.expressions.map((item) =>
      evaluateExpression(item, data),
    );
    if (expression.op === 'and') {
      if (values.includes(false)) return false;
      return values.includes(undefined) ? undefined : true;
    }
    if (values.includes(true)) return true;
    return values.includes(undefined) ? undefined : false;
  }
  if (!('path' in expression))
    throw new Error('Unhandled declarative expression');
  const resolved = resolvePath(data, expression.path);
  if (!resolved.found || !isComparableLiteral(resolved.value)) return undefined;
  if (expression.op === 'eq') return resolved.value === expression.value;
  if (
    typeof resolved.value !== 'number' ||
    typeof expression.value !== 'number'
  )
    return undefined;
  if (expression.op === 'gt') return resolved.value > expression.value;
  if (expression.op === 'gte') return resolved.value >= expression.value;
  if (expression.op === 'lt') return resolved.value < expression.value;
  return resolved.value <= expression.value;
}

function resolvePath(
  data: Readonly<Record<string, unknown>>,
  path: string,
): { readonly found: boolean; readonly value?: unknown } {
  if (path === '' || path.split('.').some(isUnsafeKey)) return { found: false };
  let value: unknown = data;
  for (const key of path.split('.')) {
    if (!isRecord(value) || !Object.hasOwn(value, key)) return { found: false };
    value = value[key];
  }
  return { found: true, value };
}

function isUnsafeKey(key: string): boolean {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isComparableLiteral(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function defaultMessage(status: RuleStatus): string {
  return `Rule evaluation returned ${status}.`;
}
