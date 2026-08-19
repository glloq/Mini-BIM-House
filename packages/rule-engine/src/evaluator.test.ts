import { describe, expect, it } from 'vitest';
import { evaluateRule, RuleFunctionRegistry } from './evaluator.js';
import type { RuleDefinition } from './rule-pack.js';

function rule(evaluator: RuleDefinition['evaluator']): RuleDefinition {
  return {
    id: 'RULE',
    severity: 'ERROR',
    appliesTo: 'Object',
    evaluator,
    message: 'Requirement evaluated.',
    referenceIds: ['reference'],
  };
}
const context = {
  objectIds: ['object'],
  data: { system: { count: 2, enabled: true } },
} as const;

describe('rule evaluators', () => {
  it('evaluates declarative comparisons without executable expressions', () => {
    const result = evaluateRule(
      rule({
        type: 'DECLARATIVE',
        expression: {
          op: 'and',
          expressions: [
            { op: 'gte', path: 'system.count', value: 2 },
            { op: 'eq', path: 'system.enabled', value: true },
          ],
        },
      }),
      context,
      {},
      new RuleFunctionRegistry(),
    );
    expect(result.status).toBe('PASS');
  });

  it('preserves UNKNOWN when a required property is absent', () => {
    const result = evaluateRule(
      rule({
        type: 'DECLARATIVE',
        expression: { op: 'gte', path: 'system.unknown', value: 1 },
      }),
      context,
      {},
      new RuleFunctionRegistry(),
    );
    expect(result.status).toBe('UNKNOWN');
  });

  it('blocks prototype traversal in declarative paths', () => {
    const result = evaluateRule(
      rule({
        type: 'DECLARATIVE',
        expression: { op: 'exists', path: 'system.__proto__.value' },
      }),
      context,
      {},
      new RuleFunctionRegistry(),
    );
    expect(result.status).toBe('FAIL');
  });

  it('runs a versioned registered function with explicit parameters', () => {
    const functions = new RuleFunctionRegistry();
    functions.register({
      id: 'test.minimumCount',
      version: '1.0.0',
      evaluate: ({ data }, parameters) => ({
        status:
          typeof data.count === 'number' &&
          typeof parameters.minimum === 'number'
            ? data.count >= parameters.minimum
              ? 'PASS'
              : 'FAIL'
            : 'UNKNOWN',
        evidence: { count: data.count, minimum: parameters.minimum },
      }),
    });
    const result = evaluateRule(
      rule({ type: 'MODULE_FUNCTION', functionId: 'test.minimumCount' }),
      { objectIds: ['object'], data: { count: 3 } },
      { minimum: 2 },
      functions,
    );
    expect(result.status).toBe('PASS');
    expect(result.evidence).toEqual({ count: 3, minimum: 2 });
  });

  it('returns UNKNOWN for an unregistered function and disabled JSON Logic', () => {
    const functions = new RuleFunctionRegistry();
    const missing = evaluateRule(
      rule({ type: 'MODULE_FUNCTION', functionId: 'missing' }),
      context,
      {},
      functions,
    );
    const jsonLogic = evaluateRule(
      rule({ type: 'JSON_LOGIC', expression: { remote: 'forbidden' } }),
      context,
      {},
      functions,
    );
    expect(missing.status).toBe('UNKNOWN');
    expect(jsonLogic.status).toBe('UNKNOWN');
  });
});
