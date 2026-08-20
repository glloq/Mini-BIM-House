import { describe, expect, it } from 'vitest';
import { RulePackRegistry, jurisdictionApplies } from './registry.js';
import type { RulePack } from './rule-pack.js';

function pack(overrides: Partial<RulePack> = {}): RulePack {
  return {
    id: 'fr-rainwater',
    version: '1.0.0',
    jurisdiction: { country: 'FR' },
    validity: { from: '2025-03-15', to: null },
    references: [
      { id: 'order', type: 'REGULATION', title: 'Arrêté de référence' },
    ],
    rules: [
      {
        id: 'PREFILTER',
        severity: 'ERROR',
        appliesTo: 'RainwaterSystem',
        referenceIds: ['order'],
        evaluator: { type: 'DECLARATIVE', expression: true },
      },
    ],
    ...overrides,
  };
}

const inFrance = { country: 'FR', referenceDate: '2026-01-01' };

/**
 * A rule pack answers a question about a place and a date. Running one outside
 * either is not a stricter check — it is a verdict about the wrong thing.
 */
describe('rule pack applicability', () => {
  it('refuses a pack written for another country', () => {
    const registry = new RulePackRegistry();
    registry.register(pack());
    const result = registry.resolve('fr-rainwater', {
      country: 'BE',
      referenceDate: '2026-01-01',
    });
    expect(result.status).toBe('NOT_APPLICABLE');
    if (result.status === 'NOT_APPLICABLE')
      expect(result.explanation).toContain('BE');
  });

  it('refuses a regional pack when the project names no region', () => {
    const registry = new RulePackRegistry();
    registry.register(pack({ jurisdiction: { country: 'FR', region: 'BRE' } }));
    expect(registry.resolve('fr-rainwater', inFrance).status).toBe(
      'NOT_APPLICABLE',
    );
    expect(
      registry.resolve('fr-rainwater', { ...inFrance, region: 'IDF' }).status,
    ).toBe('NOT_APPLICABLE');
    expect(
      registry.resolve('fr-rainwater', { ...inFrance, region: 'bre' }).status,
    ).toBe('SELECTED');
  });

  it('applies a national pack to any region of its country', () => {
    const registry = new RulePackRegistry();
    registry.register(pack());
    expect(
      registry.resolve('fr-rainwater', { ...inFrance, region: 'BRE' }).status,
    ).toBe('SELECTED');
  });

  it('refuses a date before and after the validity period', () => {
    const registry = new RulePackRegistry();
    registry.register(
      pack({ validity: { from: '2025-03-15', to: '2025-12-31' } }),
    );
    expect(
      registry.resolve('fr-rainwater', {
        country: 'FR',
        referenceDate: '2025-01-01',
      }).status,
    ).toBe('NOT_FOUND');
    expect(
      registry.resolve('fr-rainwater', {
        country: 'FR',
        referenceDate: '2026-01-01',
      }).status,
    ).toBe('NOT_FOUND');
    expect(
      registry.resolve('fr-rainwater', {
        country: 'FR',
        referenceDate: '2025-06-01',
      }).status,
    ).toBe('SELECTED');
  });

  it('refuses to choose between two versions that overlap on the date', () => {
    const registry = new RulePackRegistry();
    registry.register(pack({ version: '1.0.0' }));
    registry.register(
      pack({ version: '2.0.0', validity: { from: '2025-06-01' } }),
    );
    const result = registry.resolve('fr-rainwater', inFrance);
    expect(result.status).toBe('CONFLICT');
    if (result.status === 'CONFLICT') expect(result.candidates).toHaveLength(2);
  });

  it('names an identifier it does not know', () => {
    const registry = new RulePackRegistry();
    expect(registry.resolve('unknown', inFrance).status).toBe('NOT_FOUND');
  });

  it('selects the version whose period covers the date', () => {
    const registry = new RulePackRegistry();
    registry.register(
      pack({
        version: '1.0.0',
        validity: { from: '2024-01-01', to: '2025-12-31' },
      }),
    );
    registry.register(
      pack({ version: '2.0.0', validity: { from: '2026-01-01' } }),
    );
    const result = registry.resolve('fr-rainwater', inFrance);
    expect(result.status).toBe('SELECTED');
    if (result.status === 'SELECTED')
      expect(result.selection.pack.version).toBe('2.0.0');
  });

  it('explains an applicable jurisdiction as well as an inapplicable one', () => {
    expect(jurisdictionApplies(pack(), inFrance).explanation).toContain('FR');
  });
});
