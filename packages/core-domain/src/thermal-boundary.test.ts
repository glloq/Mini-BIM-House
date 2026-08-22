import { assemblyId } from '@house-technical-designer/assemblies';
import { describe, expect, it } from 'vitest';

import { resolveEnvelope } from './envelope.js';
import {
  createBuilding,
  createProjectMetadata,
  createSite,
} from './factories.js';
import { entityId } from './ids.js';
import type { Level, Project } from './types.js';

function level(over: Partial<Level> = {}): Level {
  return {
    id: entityId<'Level'>('ground'),
    name: 'Rez-de-chaussée',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls: [],
    slabs: [],
    roofs: [],
    openings: [],
    stairs: [],
    annotations: [],
    spaces: [],
    ...over,
  };
}

function project(one: Level): Project {
  return {
    id: entityId<'Project'>('p'),
    metadata: createProjectMetadata('Maison', '2026-01-01T00:00:00.000Z'),
    site: createSite(),
    building: createBuilding([one]),
  };
}

const CEILING = {
  id: entityId<'Slab'>('ceiling'),
  type: 'SLAB' as const,
  levelId: entityId<'Level'>('ground'),
  polygon: {
    outer: [
      { x: 0, y: 0 },
      { x: 10000, y: 0 },
      { x: 10000, y: 8000 },
      { x: 0, y: 8000 },
    ],
  },
  assemblyId: assemblyId('assembly-ceiling'),
  role: 'CEILING' as const,
  elevationOffsetMm: 0,
};

const FOOTPRINT = {
  outer: [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 8000 },
    { x: 0, y: 8000 },
  ],
};

const ROOF_STRUCTURE = {
  id: entityId<'Roof'>('roof'),
  type: 'ROOF' as const,
  levelId: entityId<'Level'>('ground'),
  footprint: FOOTPRINT,
  edges: FOOTPRINT.outer.map(() => ({
    kind: 'SLOPED' as const,
    slopeDeg: 30,
    overhangMm: 0,
  })),
  assemblyId: assemblyId('assembly-roof'),
  baseElevationMm: 2500,
};

/**
 * A house is closed at the top in one of two ways, and the model says which.
 *
 * The envelope used to count both: the ceiling rule looked at `level.roofs`
 * while the roof loop read `allRoofPlanes()`, which also holds the roofs
 * described by their outline. A house with a modern roof and a ceiling lost
 * its heat through both, and its design load came out too high.
 */
describe('where the heated house stops, upwards', () => {
  it('charges the ceiling and not the roof over it', () => {
    const elements = resolveEnvelope(
      project(level({ slabs: [CEILING], roofStructures: [ROOF_STRUCTURE] })),
    );
    expect(elements.filter(({ kind }) => kind === 'ROOF')).toEqual([]);
    const ceiling = elements.find(({ kind }) => kind === 'CEILING');
    expect(ceiling).toBeDefined();
    // The roof space between them is not heated, and it is warmer than
    // outside: the calculation is entitled to know that.
    expect(ceiling?.boundaryCondition).toBe('UNHEATED');
  });

  it('charges the roof when there is no ceiling under it', () => {
    const elements = resolveEnvelope(
      project(level({ roofStructures: [ROOF_STRUCTURE] })),
    );
    expect(
      elements.filter(({ kind }) => kind === 'ROOF').length,
    ).toBeGreaterThan(0);
    expect(elements.filter(({ kind }) => kind === 'CEILING')).toEqual([]);
  });

  it('treats a ceiling with nothing above it as the outside', () => {
    const elements = resolveEnvelope(project(level({ slabs: [CEILING] })));
    const ceiling = elements.find(({ kind }) => kind === 'CEILING');
    expect(ceiling?.boundaryCondition).toBe('EXTERIOR');
  });

  it('does the same for a roof described plane by plane', () => {
    // The old rule read this collection and this one only, which is why the
    // modern roof slipped past it.
    const plane = {
      id: entityId<'RoofPlane'>('plane'),
      type: 'ROOF_PLANE' as const,
      levelId: entityId<'Level'>('ground'),
      footprint: FOOTPRINT,
      assemblyId: assemblyId('assembly-roof'),
      slopeDeg: 30,
      azimuthDeg: 180,
      baseElevationMm: 2500,
    };
    const elements = resolveEnvelope(
      project(level({ slabs: [CEILING], roofs: [plane] })),
    );
    expect(elements.filter(({ kind }) => kind === 'ROOF')).toEqual([]);
    expect(
      elements.find(({ kind }) => kind === 'CEILING')?.boundaryCondition,
    ).toBe('UNHEATED');
  });
});
