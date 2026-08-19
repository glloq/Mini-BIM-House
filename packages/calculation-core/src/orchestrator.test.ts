import { describe, expect, it } from 'vitest';
import {
  CalculationOrchestrator,
  fingerprintValue,
  type CalculationModule,
} from './index.js';

const base: CalculationModule = {
  id: 'base',
  version: '1.0.0',
  methodId: 'base-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  calculate: (input) => ({ status: 'OK', outputs: { value: input } }),
};
const dependent: CalculationModule = {
  id: 'dependent',
  version: '1.0.0',
  methodId: 'dependent-v1',
  precision: 'ENGINEERING',
  dependencies: [{ moduleId: 'base', required: true }],
  calculate: (_input, _settings, dependencies) => ({
    status: 'OK',
    outputs: { base: dependencies.base?.outputs.value ?? null },
  }),
};

describe('calculation orchestrator', () => {
  it('resolves dependencies and reuses deterministic cache entries', async () => {
    const engine = new CalculationOrchestrator();
    engine.register(base);
    engine.register(dependent);
    const first = await engine.calculateModule('dependent', { base: 42 }, {});
    const second = await engine.calculateModule('dependent', { base: 42 }, {});
    expect(first).toMatchObject({
      status: 'OK',
      cacheHit: false,
      result: { outputs: { base: 42 } },
    });
    expect(second).toMatchObject({ status: 'OK', cacheHit: true });
  });
  it('canonicalizes object keys in fingerprints', () => {
    expect(fingerprintValue({ a: 1, b: 2 })).toBe(
      fingerprintValue({ b: 2, a: 1 }),
    );
  });
  it('rejects missing dependencies and cycles', async () => {
    const missing = new CalculationOrchestrator();
    missing.register(dependent);
    expect(await missing.calculateModule('dependent', {}, {})).toMatchObject({
      status: 'ERROR',
      code: 'MISSING_DEPENDENCY',
    });
    const cyclic = new CalculationOrchestrator();
    cyclic.register({
      ...base,
      id: 'a',
      dependencies: [{ moduleId: 'b', required: true }],
    });
    cyclic.register({
      ...base,
      id: 'b',
      dependencies: [{ moduleId: 'a', required: true }],
    });
    expect(await cyclic.calculateModule('a', {}, {})).toMatchObject({
      status: 'ERROR',
      code: 'DEPENDENCY_CYCLE',
    });
  });
  it('captures unexpected exceptions as technical errors', async () => {
    const engine = new CalculationOrchestrator();
    engine.register({
      ...base,
      calculate: () => {
        throw new Error('bug');
      },
    });
    expect(await engine.calculateModule('base', {}, {})).toEqual({
      status: 'ERROR',
      code: 'TECHNICAL_ERROR',
      message: 'bug',
    });
  });
});
