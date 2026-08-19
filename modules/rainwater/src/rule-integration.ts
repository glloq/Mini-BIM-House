import {
  RuleFunctionRegistry,
  type RegisteredRuleFunction,
  type RuleFunctionOutcome,
} from '@house-technical-designer/rule-engine';

export const RAINWATER_PREFILTER_FUNCTION_ID =
  'rainwater.hasRequiredPrefilter' as const;

export interface RainwaterRuleContextData {
  readonly hasPrefilter?: boolean;
}

/**
 * Registers only the evidence check. Whether a prefilter is required remains a
 * decision of the selected, versioned Rule Pack.
 */
export function registerRainwaterRuleFunctions(
  registry: RuleFunctionRegistry,
): void {
  registry.register(prefilterRuleFunction);
}

export const prefilterRuleFunction: RegisteredRuleFunction = {
  id: RAINWATER_PREFILTER_FUNCTION_ID,
  version: '1.0.0',
  evaluate(context): RuleFunctionOutcome {
    const value = context.data.hasPrefilter;
    if (typeof value !== 'boolean')
      return {
        status: 'UNKNOWN',
        message: 'Prefilter presence is unknown.',
        evidence: { expectedProperty: 'hasPrefilter' },
      };
    return {
      status: value ? 'PASS' : 'FAIL',
      message: value
        ? 'A prefilter is present.'
        : 'No prefilter is recorded for this rainwater system.',
      evidence: { hasPrefilter: value },
    };
  },
};
