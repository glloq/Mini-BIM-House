import { describe, expect, it } from 'vitest';
import {
  calculateEnvironmentalImpacts,
  type EnvironmentalDataLink,
  type EnvironmentalDeclaration,
  type EnvironmentalQuantity,
} from './environmental-impact.js';

const quantity: EnvironmentalQuantity = {
  itemId: 'wall:brick',
  projectObjectId: 'brick',
  materialId: 'brick',
  levelId: 'ground',
  lot: 'ENVELOPE',
  value: 10,
  unit: 'm2',
};
const link: EnvironmentalDataLink = {
  projectObjectId: 'brick',
  declarationId: 'fdes-brick',
  declarationType: 'FDES',
  projectQuantityUnit: 'm2',
  functionalUnit: 'm2-wall',
  conversionFactor: 2,
};
const declaration: EnvironmentalDeclaration = {
  id: 'fdes-brick',
  type: 'FDES',
  version: '2025',
  functionalUnit: 'm2-wall',
  indicator: 'GWP_TOTAL',
  indicatorUnit: 'kgCO2e',
  impactsByStage: { PRODUCT: 3, CONSTRUCTION: 1 },
  source: 'Local declaration catalog',
  validFrom: '2025-01-01',
  validUntil: '2026-12-31',
};

describe('environmental impacts', () => {
  it('ENV-001 multiplies quantity, explicit conversion, and impact factors', () => {
    const result = calculateEnvironmentalImpacts(
      [quantity],
      [link],
      [declaration],
      '2026-01-01',
    );
    expect(result.items[0]).toMatchObject({
      functionalUnitQuantity: 20,
      impactsByStage: { PRODUCT: 60, CONSTRUCTION: 20 },
      totalImpact: 80,
    });
    expect(result.totalImpact).toBe(80);
  });
  it('ENV-002 blocks incompatible functional or project units', () => {
    const result = calculateEnvironmentalImpacts(
      [quantity],
      [{ ...link, functionalUnit: 'kg' }],
      [declaration],
      '2026-01-01',
    );
    expect(result.status).toBe('FAILED');
    expect(result.totalImpact).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('ENV_INCOMPATIBLE_UNIT');
  });
  it('ENV-003 warns when a declaration is expired', () => {
    const result = calculateEnvironmentalImpacts(
      [quantity],
      [link],
      [declaration],
      '2027-01-01',
    );
    expect(result.status).toBe('PARTIAL');
    expect(result.totalImpact).toBe(80);
    expect(result.diagnostics[0]?.code).toBe('ENV_EXPIRED_DECLARATION');
  });
  it('warns before validity and refuses to invent absent impacts', () => {
    const early = calculateEnvironmentalImpacts(
      [quantity],
      [link],
      [declaration],
      '2024-12-31',
    );
    expect(early.diagnostics[0]?.code).toBe('ENV_DECLARATION_NOT_YET_VALID');
    const missing = calculateEnvironmentalImpacts(
      [quantity],
      [link],
      [{ ...declaration, impactsByStage: {} }],
      '2026-01-01',
    );
    expect(missing.status).toBe('FAILED');
    expect(missing.items[0]?.totalImpact).toBeUndefined();
    expect(missing.diagnostics[0]?.code).toBe('ENV_MISSING_IMPACT');
  });
  it('ENV-004 keeps item, lot, level, and building sums equal', () => {
    const second = { ...quantity, itemId: 'wall:brick:2', value: 5 };
    const result = calculateEnvironmentalImpacts(
      [quantity, second],
      [link],
      [declaration],
      '2026-01-01',
    );
    const itemSum = result.items.reduce(
      (sum, item) => sum + (item.totalImpact ?? 0),
      0,
    );
    expect(result.lots[0]?.totalImpact).toBe(itemSum);
    expect(result.levels[0]?.totalImpact).toBe(itemSum);
    expect(result.totalImpact).toBe(itemSum);
  });
  it('does not infer declarations from material names and preserves missing links', () => {
    const result = calculateEnvironmentalImpacts(
      [quantity],
      [],
      [declaration],
      '2026-01-01',
    );
    expect(result.items[0]?.declarationId).toBeUndefined();
    expect(result.items[0]?.totalImpact).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('ENV_MISSING_LINK');
  });
  it('blocks aggregation of incompatible indicators', () => {
    const otherQuantity = {
      ...quantity,
      itemId: 'steel',
      projectObjectId: 'steel',
    };
    const otherLink = {
      ...link,
      projectObjectId: 'steel',
      declarationId: 'steel-data',
    };
    const otherDeclaration = {
      ...declaration,
      id: 'steel-data',
      indicator: 'WATER_USE',
      indicatorUnit: 'm3',
    };
    const result = calculateEnvironmentalImpacts(
      [quantity, otherQuantity],
      [link, otherLink],
      [declaration, otherDeclaration],
      '2026-01-01',
    );
    expect(result.totalImpact).toBeUndefined();
    expect(
      result.diagnostics.some(
        ({ code }) => code === 'ENV_INCOMPATIBLE_INDICATOR',
      ),
    ).toBe(true);
  });
});
