import { describe, expect, it } from 'vitest';
import { RulePackRegistry } from './registry.js';
import {
  validateRulePack,
  type RulePack,
  type RuleResult,
} from './rule-pack.js';

const reference = {
  id: 'source',
  type: 'REGULATION',
  title: 'Open test reference',
} as const;

function pack(version: string, from: string, to: string | null): RulePack {
  return {
    id: 'test-pack',
    version,
    jurisdiction: { country: 'FR', domain: 'TEST' },
    validity: { from, to },
    references: [reference],
    rules: [
      {
        id: 'TEST_RULE',
        severity: 'WARNING',
        appliesTo: 'TestObject',
        message: 'Test result.',
        referenceIds: ['source'],
        evaluator: { type: 'MODULE_FUNCTION', functionId: 'test.evaluate' },
      },
    ],
  };
}

describe('rule pack core', () => {
  it('selects the version applicable on the project date and explains why', () => {
    const registry = new RulePackRegistry();
    registry.register(pack('1.0.0', '2025-01-01', '2025-12-31'));
    registry.register(pack('2.0.0', '2026-01-01', null));
    const result = registry.select('test-pack', '2026-08-19');
    expect(result.status).toBe('SELECTED');
    if (result.status !== 'SELECTED') throw new Error('Expected selection');
    expect(result.selection.pack.version).toBe('2.0.0');
    expect(result.selection.explanation).toContain('2026-08-19');
  });

  it('returns an explicit conflict for overlapping versions', () => {
    const registry = new RulePackRegistry();
    registry.register(pack('1.0.0', '2025-01-01', null));
    registry.register(pack('2.0.0', '2026-01-01', null));
    const result = registry.select('test-pack', '2026-08-19');
    expect(result.status).toBe('CONFLICT');
    if (result.status !== 'CONFLICT') throw new Error('Expected conflict');
    expect(result.candidates.map(({ version }) => version)).toEqual([
      '1.0.0',
      '2.0.0',
    ]);
  });

  it('validates dates and referenced sources', () => {
    const invalid: RulePack = {
      ...pack('1.0.0', '2026-02-30', '2025-01-01'),
      rules: [
        {
          id: 'RULE',
          severity: 'ERROR',
          appliesTo: 'Object',
          referenceIds: ['missing'],
          evaluator: { type: 'MODULE_FUNCTION', functionId: '' },
        },
      ],
    };
    expect(validateRulePack(invalid).map(({ code }) => code)).toEqual([
      'INVALID_DATE',
      'INVALID_DATE_RANGE',
      'MISSING_REFERENCE',
      'INVALID_EVALUATOR',
    ]);
  });

  it('requires every rule to cite at least one reference', () => {
    const uncited: RulePack = {
      ...pack('1.0.0', '2026-01-01', null),
      rules: [
        {
          id: 'UNCITED',
          severity: 'INFO',
          appliesTo: 'Object',
          evaluator: { type: 'DECLARATIVE', expression: true },
        },
      ],
    };
    expect(validateRulePack(uncited).map(({ code }) => code)).toContain(
      'MISSING_REFERENCE',
    );
  });

  it('represents missing evidence as UNKNOWN rather than PASS', () => {
    const result: RuleResult = {
      ruleId: 'TEST_RULE',
      status: 'UNKNOWN',
      severity: 'WARNING',
      objectIds: ['object'],
      message: 'Required input is unknown.',
      referenceIds: ['source'],
    };
    expect(result.status).toBe('UNKNOWN');
  });
});
