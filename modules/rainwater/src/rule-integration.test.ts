import { describe, expect, it } from 'vitest';
import {
  evaluateRule,
  RuleFunctionRegistry,
  type RuleDefinition,
} from '@house-technical-designer/rule-engine';
import {
  RAINWATER_PREFILTER_FUNCTION_ID,
  registerRainwaterRuleFunctions,
} from './rule-integration.js';
import { simulateRainwater } from './simulation.js';

const rule: RuleDefinition = {
  id: 'RAINWATER_PREFILTER_REQUIRED',
  severity: 'ERROR',
  appliesTo: 'RainwaterSystem',
  referenceIds: ['demonstrator-reference'],
  evaluator: {
    type: 'MODULE_FUNCTION',
    functionId: RAINWATER_PREFILTER_FUNCTION_ID,
  },
};

function evaluate(hasPrefilter?: boolean) {
  const registry = new RuleFunctionRegistry();
  registerRainwaterRuleFunctions(registry);
  return evaluateRule(
    rule,
    {
      objectIds: ['rainwater-system-1'],
      data: hasPrefilter === undefined ? {} : { hasPrefilter },
    },
    {},
    registry,
  );
}

describe('rainwater Rule Pack integration', () => {
  it('returns PASS or FAIL from explicit prefilter evidence', () => {
    expect(evaluate(true)).toMatchObject({
      status: 'PASS',
      evidence: { hasPrefilter: true },
    });
    expect(evaluate(false)).toMatchObject({
      status: 'FAIL',
      evidence: { hasPrefilter: false },
    });
  });

  it('keeps missing evidence UNKNOWN', () => {
    expect(evaluate()).toMatchObject({
      status: 'UNKNOWN',
      evidence: { expectedProperty: 'hasPrefilter' },
    });
  });

  it('does not let a rule result alter the hydraulic balance (RAIN-006)', () => {
    const input = {
      climate: {
        id: 'rain',
        location: { latitude: 48, longitude: 2, timezone: 'Europe/Paris' },
        resolution: 'DAILY' as const,
        source: { id: 'test', provider: 'TEST' },
        samples: [{ timestamp: '2025-01-01', precipitationMm: 10 }],
      },
      surfaces: [
        {
          surfaceId: 'roof',
          projectedAreaM2: 10,
          runoffCoefficient: 1,
          preFilterEfficiency: 1,
          enabled: true,
        },
      ],
      demands: [{ useType: 'WC', demandSeriesL: [20] }],
      mainsTopUpSeriesL: [0],
      tank: { nominalVolumeL: 100, initialVolumeL: 0 },
    } as const;
    const before = simulateRainwater(input);
    expect(evaluate(false).status).toBe('FAIL');
    expect(simulateRainwater(input)).toEqual(before);
  });
});
