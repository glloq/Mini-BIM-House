import { describe, expect, it } from 'vitest';
import type { HydraulicContext } from './hydraulics.js';
import { sizeWaterPipe, type WaterPipeCatalogEntry } from './sizing.js';

const context: HydraulicContext = {
  fluidDensityKgM3: 998,
  dynamicViscosityPaS: 0.001,
  gravityMs2: 9.81,
  methodId: 'darcy-weisbach-haaland-v1',
};
const catalog: readonly WaterPipeCatalogEntry[] = [
  {
    id: 'd16',
    internalDiameterM: 0.016,
    materialId: 'pex',
    roughnessM: 0.000_001_5,
  },
  {
    id: 'd10',
    internalDiameterM: 0.01,
    materialId: 'pex',
    roughnessM: 0.000_001_5,
  },
  {
    id: 'd12',
    internalDiameterM: 0.012,
    materialId: 'pex',
    roughnessM: 0.000_001_5,
  },
];

describe('water pipe sizing', () => {
  it('selects the smallest catalog diameter satisfying explicit limits', () => {
    const result = sizeWaterPipe(
      {
        segmentId: 'pipe',
        lengthM: 10,
        flowM3s: 0.0001,
        localLossCoefficient: 0,
      },
      catalog,
      { methodId: 'project-water-method-v1', maximumVelocityMs: 0.8 },
      context,
    );
    expect(result.status).toBe('SIZED');
    expect(result.suggestedCatalogEntryId).toBe('d16');
    expect(
      result.candidates.map(({ catalogEntryId }) => catalogEntryId),
    ).toEqual(['d10', 'd12', 'd16']);
    expect(result.candidates.map(({ status }) => status)).toEqual([
      'REJECTED',
      'REJECTED',
      'ACCEPTED',
    ]);
  });

  it('returns NO_MATCH when every diameter is proven insufficient', () => {
    const result = sizeWaterPipe(
      { segmentId: 'pipe', lengthM: 10, flowM3s: 0.0001 },
      catalog,
      { methodId: 'strict-method', maximumVelocityMs: 0.1 },
      context,
    );
    expect(result.status).toBe('NO_MATCH');
    expect(result.suggestedCatalogEntryId).toBeUndefined();
  });

  it('does not skip an unknown smaller candidate to make a recommendation', () => {
    const uncertainCatalog: readonly WaterPipeCatalogEntry[] = [
      { id: 'small-unknown', internalDiameterM: 0.012, materialId: 'unknown' },
      {
        id: 'large-known',
        internalDiameterM: 0.02,
        materialId: 'pex',
        roughnessM: 0.000_001_5,
      },
    ];
    const result = sizeWaterPipe(
      {
        segmentId: 'pipe',
        lengthM: 5,
        flowM3s: 0.0001,
        localLossCoefficient: 0,
      },
      uncertainCatalog,
      { methodId: 'pressure-method', maximumPressureLossPa: 20_000 },
      context,
    );
    expect(result.candidates.map(({ status }) => status)).toEqual([
      'UNKNOWN',
      'ACCEPTED',
    ]);
    expect(result.status).toBe('UNKNOWN');
    expect(result.suggestedCatalogEntryId).toBeUndefined();
  });

  it('keeps sizing unknown when flow or active limits are absent', () => {
    const missingFlow = sizeWaterPipe(
      { segmentId: 'pipe', lengthM: 5 },
      catalog,
      { methodId: 'method', maximumVelocityMs: 1 },
      context,
    );
    const missingLimits = sizeWaterPipe(
      { segmentId: 'pipe', lengthM: 5, flowM3s: 0.0001 },
      catalog,
      { methodId: 'method' },
      context,
    );
    expect(missingFlow.status).toBe('UNKNOWN');
    expect(missingLimits.status).toBe('UNKNOWN');
  });

  it('rejects duplicate catalog IDs rather than using load order', () => {
    expect(() =>
      sizeWaterPipe(
        { segmentId: 'pipe', lengthM: 5, flowM3s: 0.0001 },
        [catalog[0]!, { ...catalog[0]!, internalDiameterM: 0.02 }],
        { methodId: 'method', maximumVelocityMs: 1 },
        context,
      ),
    ).toThrow(/Duplicate/);
  });
});
