import { describe, expect, it } from 'vitest';
import {
  nextConcentrationFraction,
  simulateCo2Balance,
} from './co2-balance.js';

const base = {
  roomId: 'living-room',
  roomVolumeM3: 100,
  timeStepSeconds: 3_600,
  initialConcentrationPpm: 420,
  outdoorConcentrationPpm: 420,
  generationM3s: [0, 0],
  ventilationFlowM3h: [100, 100],
} as const;

describe('simplified room CO2 balance', () => {
  it('implements IAQ-001: equal indoor/outdoor concentration remains stable', () => {
    const result = simulateCo2Balance(base);
    expect(result.status).toBe('OK');
    expect(
      result.steps.map(({ concentrationEndPpm }) => concentrationEndPpm),
    ).toEqual([420, 420]);
  });

  it('implements IAQ-002: generation without ventilation increases concentration', () => {
    const result = simulateCo2Balance({
      ...base,
      generationM3s: [0.000_005, 0.000_005],
      ventilationFlowM3h: [0, 0],
    });
    expect(result.steps[0]!.concentrationEndPpm).toBeGreaterThan(420);
    expect(result.steps[1]!.concentrationEndPpm).toBeGreaterThan(
      result.steps[0]!.concentrationEndPpm,
    );
  });

  it('implements IAQ-003: more ventilation lowers the approached concentration', () => {
    const low = nextConcentrationFraction(
      420 / 1_000_000,
      420 / 1_000_000,
      0.000_005,
      20 / 3_600,
      100,
      86_400,
    );
    const high = nextConcentrationFraction(
      420 / 1_000_000,
      420 / 1_000_000,
      0.000_005,
      100 / 3_600,
      100,
      86_400,
    );
    expect(high).toBeLessThan(low);
  });

  it('keeps missing generation and airflow UNKNOWN instead of zero', () => {
    const result = simulateCo2Balance({
      ...base,
      generationM3s: [undefined],
      ventilationFlowM3h: [undefined],
    });
    expect(result.status).toBe('UNKNOWN');
    expect(result.steps).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'IAQ_UNKNOWN_GENERATION',
      'IAQ_UNKNOWN_VENTILATION_FLOW',
    ]);
  });

  it('rejects invalid volumes, concentrations, and mismatched profiles', () => {
    expect(
      simulateCo2Balance({
        ...base,
        roomVolumeM3: 0,
        initialConcentrationPpm: -1,
        ventilationFlowM3h: [100],
      }).status,
    ).toBe('INVALID');
    expect(
      simulateCo2Balance({
        ...base,
        generationM3s: [1, 1],
        ventilationFlowM3h: [0, 0],
      }).status,
    ).toBe('INVALID');
  });

  it('records timestamps and deterministic summary indicators', () => {
    const result = simulateCo2Balance({
      ...base,
      timestamps: ['2025-01-01T00:00:00Z', '2025-01-01T01:00:00Z'],
    });
    expect(result.steps[0]?.timestamp).toBe('2025-01-01T00:00:00Z');
    expect(result).toMatchObject({
      meanConcentrationPpm: 420,
      maximumConcentrationPpm: 420,
      finalConcentrationPpm: 420,
    });
  });
});
