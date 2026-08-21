import { describe, expect, it } from 'vitest';
import {
  NETWORK_PRODUCT_REGISTRY,
  networkProduct,
  networkProductsOfFamily,
  productPhysicalProperties,
  resolvedSegmentProperties,
} from './index.js';

describe('what a run is made of', () => {
  it('holds the products the catalogue ships', () => {
    expect(NETWORK_PRODUCT_REGISTRY.length).toBe(66);
    expect(networkProduct('pipe-pex-16x1.5')?.domain).toBe('PLUMBING');
    expect(networkProduct('nowhere')).toBeUndefined();
    expect(networkProductsOfFamily('WATER_PIPE').length).toBeGreaterThan(0);
  });

  it('states every product’s version, since a run records the one it used', () => {
    for (const product of NETWORK_PRODUCT_REGISTRY)
      expect(product.version, product.id).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it('converts the trade’s units into the ones the hydraulics read', () => {
    // The catalogue says a bore in millimetres; the calculations work in
    // metres. Somebody had to convert, and until now that somebody was
    // whoever typed the segment's properties by hand, forty times per project.
    const physical = productPhysicalProperties(
      networkProduct('pipe-pex-16x1.5')!,
    );
    expect(physical.internalDiameterM).toBeCloseTo(0.013, 6);
    expect(physical.roughnessM).toBeCloseTo(0.000_007, 9);
    expect(physical.material).toBe('PEX');
  });

  it('produces nothing for what a product does not state', () => {
    // A product with no bore yields no diameter: the calculation then says the
    // run is not sized, which is true, rather than sizing it on a number
    // nobody supplied.
    expect(productPhysicalProperties({ id: 'bare', properties: {} })).toEqual(
      {},
    );
  });

  it('lets the run have the last word over its product', () => {
    // A segment's own properties are what this run measures or overrides.
    const resolved = resolvedSegmentProperties('pipe-pex-16x1.5', {
      internalDiameterM: 0.02,
      slopePercent: 2,
    });
    expect(resolved.internalDiameterM).toBe(0.02);
    expect(resolved.roughnessM).toBeCloseTo(0.000_007, 9);
    expect(resolved.slopePercent).toBe(2);
  });

  it('prefers the copy the project holds to the catalogue installed today', () => {
    // A file has to open the same way in two years. Reading the installed
    // catalogue would resize every network already drawn, the day somebody
    // corrects a tube.
    const resolved = resolvedSegmentProperties('pipe-pex-16x1.5', undefined, [
      { id: 'pipe-pex-16x1.5', properties: { innerDiameterMm: 11 } },
    ]);
    expect(resolved.internalDiameterM).toBeCloseTo(0.011, 6);
  });

  it('leaves a run naming no product exactly as it is', () => {
    expect(resolvedSegmentProperties(undefined, { slopePercent: 2 })).toEqual({
      slopePercent: 2,
    });
  });
});
