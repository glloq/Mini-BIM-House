import { describe, expect, it } from 'vitest';
import { buildRuleReport } from './report.js';
import type { RulePack, RuleResult } from './rule-pack.js';

const pack: RulePack = {
  id: 'pack',
  version: '1',
  jurisdiction: { country: 'FR' },
  validity: {},
  references: [{ id: 'ref', type: 'GUIDELINE', title: 'Public guide' }],
  rules: [
    {
      id: 'one',
      severity: 'ERROR',
      appliesTo: 'Object',
      referenceIds: ['ref'],
      evaluator: { type: 'DECLARATIVE', expression: true },
    },
    {
      id: 'two',
      severity: 'INFO',
      appliesTo: 'Object',
      referenceIds: ['ref'],
      evaluator: { type: 'DECLARATIVE', expression: true },
    },
  ],
};
const result: RuleResult = {
  ruleId: 'one',
  status: 'UNKNOWN',
  severity: 'ERROR',
  objectIds: ['wall'],
  message: 'Valeur manquante',
  referenceIds: ['ref'],
  evidence: { property: 'lambdaWmK' },
};

describe('rule report', () => {
  it('reports partial coverage and keeps UNKNOWN separate from PASS', () => {
    const report = buildRuleReport(pack, [result]);
    expect(report.summary).toEqual({
      checked: 1,
      total: 2,
      pass: 0,
      fail: 0,
      unknown: 1,
      notApplicable: 0,
      coverage: 'PARTIAL',
    });
    expect(report.items[0]?.references[0]?.title).toBe('Public guide');
  });

  it('rejects results that cannot be traced to a pack rule', () => {
    expect(() =>
      buildRuleReport(pack, [{ ...result, ruleId: 'missing' }]),
    ).toThrow(/unknown rule/);
  });
});
