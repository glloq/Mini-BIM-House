import type {
  RulePack,
  RuleResult,
  RuleStatus,
  StandardReference,
} from './rule-pack.js';

export interface RuleReportSummary {
  readonly checked: number;
  readonly total: number;
  readonly pass: number;
  readonly fail: number;
  readonly unknown: number;
  readonly notApplicable: number;
  readonly coverage: 'COMPLETE' | 'PARTIAL';
}

export interface RuleReportItem {
  readonly result: RuleResult;
  readonly references: readonly StandardReference[];
}

export interface RuleReport {
  readonly packId: string;
  readonly packVersion: string;
  readonly summary: RuleReportSummary;
  readonly items: readonly RuleReportItem[];
}

/**
 * Builds display data without claiming overall regulatory compliance.
 *
 * A rule may be judged once per object it applies to, so several results may
 * share a rule identifier as long as they judge different objects. Collapsing
 * them would let a pass on one system hide a failure on another; what is still
 * refused is the same rule judged twice on the same object.
 */
export function buildRuleReport(
  pack: RulePack,
  results: readonly RuleResult[],
): RuleReport {
  const rules = new Set(pack.rules.map(({ id }) => id));
  const references = new Map(
    (pack.references ?? []).map((reference) => [reference.id, reference]),
  );
  const seen = new Set<string>();
  const items = results.map((result): RuleReportItem => {
    if (!rules.has(result.ruleId))
      throw new RangeError(`Result references unknown rule ${result.ruleId}`);
    const subject = `${result.ruleId}\u0000${[...result.objectIds].sort().join(',')}`;
    if (seen.has(subject))
      throw new RangeError(
        `Duplicate result for rule ${result.ruleId} on ${result.objectIds.join(', ') || 'the project'}`,
      );
    seen.add(subject);
    return {
      result: structuredClone(result),
      references: result.referenceIds.map((id) => {
        const reference = references.get(id);
        if (reference === undefined)
          throw new RangeError(`Result references unknown source ${id}`);
        return structuredClone(reference);
      }),
    };
  });
  const count = (status: RuleStatus): number =>
    results.filter((result) => result.status === status).length;
  const judged = new Set(results.map(({ ruleId }) => ruleId));
  return {
    packId: pack.id,
    packVersion: pack.version,
    summary: {
      // Coverage counts rules, not verdicts: a rule judged on three systems is
      // one rule checked, and three results.
      checked: judged.size,
      total: pack.rules.length,
      pass: count('PASS'),
      fail: count('FAIL'),
      unknown: count('UNKNOWN'),
      notApplicable: count('NOT_APPLICABLE'),
      coverage: judged.size === pack.rules.length ? 'COMPLETE' : 'PARTIAL',
    },
    items,
  };
}
