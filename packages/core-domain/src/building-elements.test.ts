import { describe, expect, it } from 'vitest';
import { entityId } from './ids.js';
import { validateRoofPlane } from './roof-plane.js';
import { validateSlab } from './slab.js';
import { assemblyId } from '@house-technical-designer/assemblies';

const square = {
  outer: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3000 },
    { x: 0, y: 3000 },
  ],
};
const persistedAssemblyId = assemblyId('assembly');

describe('MVP horizontal building elements', () => {
  it('validates a slab persisted in millimetres', () => {
    expect(
      validateSlab({
        id: entityId<'Slab'>('slab'),
        type: 'SLAB',
        levelId: entityId<'Level'>('ground'),
        polygon: square,
        assemblyId: persistedAssemblyId,
        elevationOffsetMm: 0,
        role: 'FLOOR',
      }),
    ).toEqual([]);
  });

  it('rejects an invalid roof slope and non-finite elevation', () => {
    expect(
      validateRoofPlane({
        id: entityId<'RoofPlane'>('roof'),
        type: 'ROOF_PLANE',
        levelId: entityId<'Level'>('ground'),
        footprint: square,
        assemblyId: persistedAssemblyId,
        slopeDeg: 90,
        azimuthDeg: 180,
        baseElevationMm: Number.NaN,
      }),
    ).toEqual(
      expect.arrayContaining([
        'slopeDeg must be finite and in [0, 90)',
        'baseElevationMm must be finite',
      ]),
    );
  });
});
