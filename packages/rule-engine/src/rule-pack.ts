export type RuleSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type RuleStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface RulePackJurisdiction {
  readonly country: string;
  readonly region?: string;
  readonly municipality?: string;
  readonly domain?: string;
}

export interface RulePackValidity {
  readonly from?: string;
  readonly to?: string | null;
}

export interface StandardReference {
  readonly id: string;
  readonly type:
    | 'LAW'
    | 'REGULATION'
    | 'STANDARD'
    | 'DTU'
    | 'GUIDELINE'
    | 'DATA_SOURCE'
    | 'OTHER';
  readonly title: string;
  readonly version?: string;
  readonly url?: string;
  readonly notes?: string;
}

export type RuleEvaluator =
  | { readonly type: 'DECLARATIVE'; readonly expression: unknown }
  | { readonly type: 'JSON_LOGIC'; readonly expression: unknown }
  | { readonly type: 'MODULE_FUNCTION'; readonly functionId: string };

export interface RuleDefinition {
  readonly id: string;
  readonly severity: RuleSeverity;
  readonly appliesTo: string;
  readonly evaluator: RuleEvaluator;
  readonly message?: string;
  readonly referenceIds?: readonly string[];
  readonly tags?: readonly string[];
}

export interface RulePack {
  readonly id: string;
  readonly version: string;
  readonly jurisdiction: RulePackJurisdiction;
  readonly validity: RulePackValidity;
  readonly references?: readonly StandardReference[];
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly rules: readonly RuleDefinition[];
}

export interface RuleResult {
  readonly ruleId: string;
  readonly status: RuleStatus;
  readonly severity: RuleSeverity;
  readonly objectIds: readonly string[];
  readonly message: string;
  readonly referenceIds: readonly string[];
  readonly evidence?: Readonly<Record<string, unknown>>;
  readonly suggestion?: RuleSuggestion;
}

export interface RuleSuggestion {
  readonly type: 'TEXT' | 'COMMAND_PROPOSAL';
  readonly description: string;
  readonly commandId?: string;
  readonly commandArgs?: unknown;
}

export interface RulePackIssue {
  readonly code:
    | 'EMPTY_VALUE'
    | 'INVALID_DATE'
    | 'INVALID_DATE_RANGE'
    | 'DUPLICATE_REFERENCE'
    | 'DUPLICATE_RULE'
    | 'MISSING_REFERENCE'
    | 'INVALID_EVALUATOR';
  readonly path: string;
  readonly message: string;
}

export function validateRulePack(pack: RulePack): readonly RulePackIssue[] {
  const issues: RulePackIssue[] = [];
  requireText(pack.id, 'id', issues);
  requireText(pack.version, 'version', issues);
  requireText(pack.jurisdiction.country, 'jurisdiction.country', issues);
  if (pack.validity.from !== undefined)
    validateDate(pack.validity.from, 'validity.from', issues);
  if (pack.validity.to !== undefined && pack.validity.to !== null)
    validateDate(pack.validity.to, 'validity.to', issues);
  if (
    pack.validity.from !== undefined &&
    pack.validity.to !== undefined &&
    pack.validity.to !== null &&
    pack.validity.from > pack.validity.to
  )
    issues.push({
      code: 'INVALID_DATE_RANGE',
      path: 'validity',
      message: 'validity.from must not be after validity.to',
    });
  const referenceIds = new Set<string>();
  for (const [index, reference] of (pack.references ?? []).entries()) {
    requireText(reference.id, `references[${index}].id`, issues);
    requireText(reference.title, `references[${index}].title`, issues);
    if (referenceIds.has(reference.id))
      issues.push({
        code: 'DUPLICATE_REFERENCE',
        path: `references[${index}].id`,
        message: `duplicate reference ${reference.id}`,
      });
    referenceIds.add(reference.id);
  }
  const ruleIds = new Set<string>();
  for (const [index, rule] of pack.rules.entries()) {
    requireText(rule.id, `rules[${index}].id`, issues);
    requireText(rule.appliesTo, `rules[${index}].appliesTo`, issues);
    if (ruleIds.has(rule.id))
      issues.push({
        code: 'DUPLICATE_RULE',
        path: `rules[${index}].id`,
        message: `duplicate rule ${rule.id}`,
      });
    ruleIds.add(rule.id);
    if ((rule.referenceIds ?? []).length === 0)
      issues.push({
        code: 'MISSING_REFERENCE',
        path: `rules[${index}].referenceIds`,
        message: 'at least one reference is required',
      });
    for (const referenceId of rule.referenceIds ?? []) {
      if (!referenceIds.has(referenceId))
        issues.push({
          code: 'MISSING_REFERENCE',
          path: `rules[${index}].referenceIds`,
          message: `unknown reference ${referenceId}`,
        });
    }
    if (
      rule.evaluator.type === 'MODULE_FUNCTION' &&
      rule.evaluator.functionId.trim() === ''
    )
      issues.push({
        code: 'INVALID_EVALUATOR',
        path: `rules[${index}].evaluator.functionId`,
        message: 'functionId must not be empty',
      });
  }
  return issues;
}

export function createRulePack(pack: RulePack): RulePack {
  const issues = validateRulePack(pack);
  if (issues.length > 0)
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  return structuredClone(pack);
}

function requireText(
  value: string,
  path: string,
  issues: RulePackIssue[],
): void {
  if (value.trim() === '')
    issues.push({ code: 'EMPTY_VALUE', path, message: 'must not be empty' });
}

function validateDate(
  value: string,
  path: string,
  issues: RulePackIssue[],
): void {
  if (!isIsoDate(value))
    issues.push({
      code: 'INVALID_DATE',
      path,
      message: 'must be a valid YYYY-MM-DD date',
    });
}

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
