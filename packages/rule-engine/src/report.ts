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

/** Builds display data without claiming overall regulatory compliance. */
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
    if (seen.has(result.ruleId))
      throw new RangeError(`Duplicate result for rule ${result.ruleId}`);
    seen.add(result.ruleId);
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
  return {
    packId: pack.id,
    packVersion: pack.version,
    summary: {
      checked: results.length,
      total: pack.rules.length,
      pass: count('PASS'),
      fail: count('FAIL'),
      unknown: count('UNKNOWN'),
      notApplicable: count('NOT_APPLICABLE'),
      coverage: results.length === pack.rules.length ? 'COMPLETE' : 'PARTIAL',
    },
    items,
  };
}
