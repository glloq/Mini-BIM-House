import type { Project } from '@house-technical-designer/core-domain';
import type {
  RuleEvaluationContext,
  RulePack,
  RuleReport,
  RuleResult,
} from '@house-technical-designer/rule-engine';
import {
  RuleFunctionRegistry,
  buildRuleReport,
  evaluateRule,
  validateRulePack,
} from '@house-technical-designer/rule-engine';
import { registerRainwaterRuleFunctions } from '@house-technical-designer/rainwater';
import rainwaterPack from '../../../../examples/rule-pack.example.json';

/**
 * Rule packs the application ships.
 *
 * These are examples, and they say so. A pack states its jurisdiction, its
 * validity and the texts it refers to; the application never adds a rule of its
 * own, because a rule with no published source is not a rule.
 */
export const AVAILABLE_RULE_PACKS: readonly RulePack[] = [
  rainwaterPack as RulePack,
];

export function findRulePack(packId: string): RulePack | undefined {
  return AVAILABLE_RULE_PACKS.find(({ id }) => id === packId);
}

/** Pack identifiers the project has activated. */
export function enabledRulePackIds(project: Project): readonly string[] {
  return (project.regulatoryContext?.enabledRulePacks ?? []).filter(
    (entry): entry is string => typeof entry === 'string',
  );
}

function registry(): RuleFunctionRegistry {
  const functions = new RuleFunctionRegistry();
  registerRainwaterRuleFunctions(functions);
  return functions;
}

/**
 * What the project offers a rule as evidence.
 *
 * Only facts the project actually declares are passed. A rule that asks for
 * something absent resolves to UNKNOWN — which is the answer — rather than
 * being handed a default that would turn into a PASS.
 */
function evidenceFor(project: Project): RuleEvaluationContext {
  const rainwater = (project.systems ?? []).find(
    ({ discipline }) => discipline === 'RAINWATER',
  );
  const prefilter = rainwater?.nodes.find(({ kind }) => kind === 'PREFILTER');
  return {
    objectIds: rainwater === undefined ? [] : [rainwater.id],
    data: {
      ...(rainwater === undefined
        ? {}
        : { hasPrefilter: prefilter !== undefined }),
    },
  };
}

export interface RulePackEvaluation {
  readonly pack: RulePack;
  readonly report?: RuleReport;
  /** Why the pack could not be evaluated, when it could not. */
  readonly error?: string;
}

/** Runs every activated pack against the project. */
export function evaluateRulePacks(
  project: Project,
): readonly RulePackEvaluation[] {
  const functions = registry();
  const context = evidenceFor(project);
  return enabledRulePackIds(project).map((packId) => {
    const pack = findRulePack(packId);
    if (pack === undefined)
      return {
        pack: {
          id: packId,
          version: 'inconnue',
          jurisdiction: { country: '—' },
          validity: {},
          rules: [],
        } as unknown as RulePack,
        error: `Le référentiel ${packId} n'est pas fourni par cette version de l'application.`,
      };
    const issues = validateRulePack(pack);
    if (issues.length > 0)
      return { pack, error: `Référentiel invalide : ${issues[0]!.message}` };
    const results: RuleResult[] = pack.rules.map((rule) =>
      evaluateRule(rule, context, {}, functions),
    );
    return { pack, report: buildRuleReport(pack, results) };
  });
}
