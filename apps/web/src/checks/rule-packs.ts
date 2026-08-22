import { rulePackSelections } from '@house-technical-designer/core-domain';
import type {
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import type {
  RuleEvaluationContext,
  RulePack,
  RulePackContext,
  RuleReport,
  RuleResult,
} from '@house-technical-designer/rule-engine';
import {
  RuleFunctionRegistry,
  RulePackRegistry,
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
  return rulePackSelections(project.regulatoryContext).map(({ id }) => id);
}

/**
 * A pack the project pinned at a version the repository no longer ships.
 *
 * A project checked against a text, then reopened once the text has moved on,
 * is checked against something else. Saying so is what keeps a report from
 * quietly changing its mind.
 */
export interface RulePackDrift {
  readonly id: string;
  readonly checkedAt: string;
  readonly installed?: string;
}

export function rulePackDrift(project: Project): readonly RulePackDrift[] {
  return rulePackSelections(project.regulatoryContext).flatMap((selection) => {
    if (selection.version === undefined) return [];
    const installed = findRulePack(selection.id)?.version;
    return installed === selection.version
      ? []
      : [
          {
            id: selection.id,
            checkedAt: selection.version,
            ...(installed === undefined ? {} : { installed }),
          },
        ];
  });
}

function packRegistry(): RulePackRegistry {
  const registry = new RulePackRegistry();
  for (const pack of AVAILABLE_RULE_PACKS)
    if (validateRulePack(pack).length === 0) registry.register(pack);
  return registry;
}

function functionRegistry(): RuleFunctionRegistry {
  const functions = new RuleFunctionRegistry();
  registerRainwaterRuleFunctions(functions);
  return functions;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Where and when the project says it is being assessed.
 *
 * A missing reference date is not replaced by today's: which text applies is a
 * fact about the project, and assuming a date would silently pick a version.
 */
export function assessmentContext(
  project: Project,
): RulePackContext | undefined {
  const regulatory = project.regulatoryContext;
  if (regulatory === undefined) return undefined;
  const referenceDate = regulatory.referenceDate;
  if (referenceDate === undefined || !ISO_DATE.test(referenceDate))
    return undefined;
  return {
    country: regulatory.country,
    ...(regulatory.region === undefined ? {} : { region: regulatory.region }),
    referenceDate,
  };
}

/**
 * The objects a rule is about, each with the evidence the project holds.
 *
 * One entry per object, so three rainwater systems produce three verdicts
 * rather than one taken from whichever came first. An object the project
 * carries but says nothing about yields no evidence, and the rule answers
 * UNKNOWN.
 */
function subjectsFor(
  project: Project,
  appliesTo: string,
): readonly RuleEvaluationContext[] {
  if (appliesTo === 'RainwaterSystem')
    return (project.systems ?? [])
      .filter(({ discipline }) => discipline === 'RAINWATER')
      .map((network) => rainwaterSubject(network));
  return [];
}

function rainwaterSubject(network: TechnicalNetwork): RuleEvaluationContext {
  const prefilter = network.nodes.find(({ kind }) => kind === 'PREFILTER');
  return {
    objectIds: [network.id],
    data: { hasPrefilter: prefilter !== undefined },
  };
}

export interface RulePackEvaluation {
  readonly packId: string;
  readonly pack?: RulePack;
  readonly report?: RuleReport;
  /** Why the pack produced no verdict, when it produced none. */
  readonly notice?: string;
}

/**
 * Runs every activated pack the project's jurisdiction and date actually admit.
 *
 * A pack is resolved before it is executed: the wrong country, a date outside
 * its validity, two overlapping versions or an unknown identifier all end in a
 * stated reason instead of a verdict. A referential that does not apply must
 * never return "Validé".
 */
export function evaluateRulePacks(
  project: Project,
): readonly RulePackEvaluation[] {
  const packs = packRegistry();
  const functions = functionRegistry();
  const context = assessmentContext(project);
  return enabledRulePackIds(project).map((packId): RulePackEvaluation => {
    if (context === undefined)
      return {
        packId,
        notice: `${packId} n'est pas exécuté : le projet ne déclare pas de pays et de date de référence valides. Renseignez-les dans l'espace Projet.`,
      };
    const resolution = packs.resolve(packId, context);
    if (resolution.status !== 'SELECTED')
      return { packId, notice: resolution.explanation };
    const pack = resolution.selection.pack;
    const results: RuleResult[] = pack.rules.flatMap((rule) => {
      const subjects = subjectsFor(project, rule.appliesTo);
      if (subjects.length === 0)
        return [
          evaluateRule(
            rule,
            { objectIds: [], data: {} },
            pack.parameters ?? {},
            functions,
          ),
        ].map((result) => ({
          ...result,
          status: 'NOT_APPLICABLE' as const,
          message: `Le projet ne contient aucun ${rule.appliesTo} : cette règle ne s'applique pas.`,
        }));
      return subjects.map((subject) =>
        evaluateRule(rule, subject, pack.parameters ?? {}, functions),
      );
    });
    return {
      packId,
      pack,
      report: buildRuleReport(pack, results),
    };
  });
}
