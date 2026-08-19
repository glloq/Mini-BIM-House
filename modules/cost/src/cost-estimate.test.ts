import { describe, expect, it } from 'vitest';
import {
  calculateCostEstimate,
  compareCostScenarios,
  type CostQuantity,
} from './cost-estimate.js';

const quantity: CostQuantity = {
  itemId: 'board',
  sourceEntityId: 'wall',
  value: 53.2,
  unit: 'm2',
  lot: 'FINISHES',
};

describe('cost estimate', () => {
  it('COST-001 rounds packaging upward without changing physical quantity', () => {
    const result = calculateCostEstimate(
      [quantity],
      [
        {
          itemId: 'board',
          materialPricePerUnit: 4,
          laborPricePerUnit: 0,
          currency: 'EUR',
          priceUnit: 'm2',
          packageQuantity: 5.4,
        },
      ],
    );
    expect(result.lines[0]).toMatchObject({
      physicalQuantity: 53.2,
      requiredQuantity: 53.2,
      packageCount: 10,
      orderedQuantity: 54,
      materialCost: 216,
      totalCost: 216,
    });
  });
  it('COST-002 changing price does not change physical or ordered quantities', () => {
    const entry = {
      itemId: 'board',
      materialPricePerUnit: 4,
      laborPricePerUnit: 0,
      currency: 'EUR',
      priceUnit: 'm2',
      packageQuantity: 5.4,
    } as const;
    const first = calculateCostEstimate([quantity], [entry]).lines[0];
    const second = calculateCostEstimate(
      [quantity],
      [{ ...entry, materialPricePerUnit: 8 }],
    ).lines[0];
    expect(second?.physicalQuantity).toBe(first?.physicalQuantity);
    expect(second?.orderedQuantity).toBe(first?.orderedQuantity);
    expect(second?.totalCost).toBe((first?.totalCost ?? 0) * 2);
  });
  it('COST-003 reports missing and incompatible currencies without a total', () => {
    const missing = calculateCostEstimate(
      [quantity],
      [
        {
          itemId: 'board',
          materialPricePerUnit: 1,
          laborPricePerUnit: 0,
          priceUnit: 'm2',
        },
      ],
    );
    expect(missing.totalCost).toBeUndefined();
    expect(missing.diagnostics[0]?.code).toBe('COST_MISSING_CURRENCY');
    const mixed = calculateCostEstimate(
      [quantity, { ...quantity, itemId: 'paint' }],
      [
        {
          itemId: 'board',
          materialPricePerUnit: 1,
          laborPricePerUnit: 0,
          currency: 'EUR',
          priceUnit: 'm2',
        },
        {
          itemId: 'paint',
          materialPricePerUnit: 1,
          laborPricePerUnit: 0,
          currency: 'USD',
          priceUnit: 'm2',
        },
      ],
    );
    expect(mixed.totalCost).toBeUndefined();
    expect(
      mixed.diagnostics.some(
        ({ code }) => code === 'COST_INCOMPATIBLE_CURRENCY',
      ),
    ).toBe(true);
  });
  it('separates material ordered quantity from labor on physical quantity and aggregates lots', () => {
    const result = calculateCostEstimate(
      [quantity],
      [
        {
          itemId: 'board',
          materialPricePerUnit: 4,
          laborPricePerUnit: 2,
          currency: 'EUR',
          priceUnit: 'm2',
          packageQuantity: 5.4,
          wasteFactor: 0.08,
        },
      ],
    );
    expect(result.lines[0]).toMatchObject({
      physicalQuantity: 53.2,
      packageCount: 11,
      laborCost: 106.4,
      totalCost: 344,
    });
    expect(result.lines[0]?.orderedQuantity).toBeCloseTo(59.4);
    expect(result.lines[0]?.materialCost).toBeCloseTo(237.6);
    expect(result.lots[0]).toMatchObject({
      lot: 'FINISHES',
      totalCost: 344,
      currency: 'EUR',
    });
    expect(result.totalCost).toBeCloseTo(344);
  });
  it('keeps missing prices and unit mismatches unknown', () => {
    const missing = calculateCostEstimate(
      [quantity],
      [{ itemId: 'board', currency: 'EUR', priceUnit: 'm2' }],
    );
    expect(missing.lines[0]?.totalCost).toBeUndefined();
    expect(missing.diagnostics[0]?.code).toBe('COST_MISSING_PRICE');
    const mismatch = calculateCostEstimate(
      [quantity],
      [
        {
          itemId: 'board',
          materialPricePerUnit: 1,
          laborPricePerUnit: 0,
          currency: 'EUR',
          priceUnit: 'kg',
        },
      ],
    );
    expect(mismatch.diagnostics[0]?.code).toBe('COST_INCOMPATIBLE_UNIT');
  });
  it('compares named scenarios without generating a composite score', () => {
    const first = calculateCostEstimate(
      [quantity],
      [
        {
          itemId: 'board',
          materialPricePerUnit: 1,
          laborPricePerUnit: 0,
          currency: 'EUR',
          priceUnit: 'm2',
        },
      ],
    );
    expect(
      compareCostScenarios([{ scenarioId: 'base', estimate: first }]),
    ).toEqual([{ scenarioId: 'base', totalCost: 53.2, currency: 'EUR' }]);
  });
});
