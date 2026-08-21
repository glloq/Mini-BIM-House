import { describe, expect, it } from 'vitest';
import type {
  Project,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import { buildPlanView } from './plan-view.js';
import { defaultVisibility } from './layers.js';

function level(id: string, elevationMm: number) {
  return {
    id: entityId<'Level'>(id),
    name: id,
    elevationMm,
    defaultStoreyHeightMm: 2500,
    walls: [],
    slabs: [],
    roofs: [],
    openings: [],
    stairs: [],
    spaces: [],
    annotations: [],
  };
}

function node(id: string, levelId: string | undefined, x: number) {
  return {
    id,
    kind: 'FIXTURE',
    position: { x, y: 0, z: 0 },
    ...(levelId === undefined ? {} : { levelId }),
  };
}

function network(): TechnicalNetwork {
  return {
    id: 'water',
    discipline: 'WATER',
    systemType: 'POTABLE_COLD',
    nodes: [
      node('ground-source', 'ground', 0),
      node('ground-sink', 'ground', 1000),
      node('upper-sink', 'upper', 2000),
      node('floating', undefined, 3000),
    ],
    ports: [
      {
        id: 'ground-source-out',
        nodeId: 'ground-source',
        role: 'SUPPLY',
        direction: 'OUT',
      },
      {
        id: 'ground-sink-in',
        nodeId: 'ground-sink',
        role: 'SUPPLY',
        direction: 'IN',
      },
      {
        id: 'ground-source-riser',
        nodeId: 'ground-source',
        role: 'SUPPLY',
        direction: 'OUT',
      },
      {
        id: 'upper-sink-in',
        nodeId: 'upper-sink',
        role: 'SUPPLY',
        direction: 'IN',
      },
    ],
    edges: [
      {
        id: 'on-ground',
        fromPortId: 'ground-source-out',
        toPortId: 'ground-sink-in',
        kind: 'PIPE',
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 1000, y: 0, z: 0 },
        ],
      },
      {
        id: 'riser',
        fromPortId: 'ground-source-riser',
        toPortId: 'upper-sink-in',
        kind: 'PIPE',
        path: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 2700 },
          { x: 2000, y: 0, z: 2700 },
        ],
      },
    ],
  };
}

function project(): Project {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Deux niveaux',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: { levels: [level('ground', 0), level('upper', 2700)], zones: [] },
    systems: [network()],
  };
}

function drawnOn(levelId: string): readonly string[] {
  const plan = buildPlanView(project(), {
    levelId,
    layers: { ...defaultVisibility(), 'water.pipes': true },
  });
  return plan.primitives
    .filter(({ layer }) => layer === 'water.pipes')
    .map(({ sourceObjectId }) => sourceObjectId ?? '');
}

/**
 * A plan of one storey shows that storey.
 *
 * Every network object was drawn on every level, so the ground floor plan
 * carried the pipes of the first floor — and those objects also took part in
 * deciding how the plan was framed.
 */
describe('which network objects a storey draws', () => {
  it('draws the objects of the storey being shown', () => {
    const ground = drawnOn('ground');
    expect(ground).toContain('ground-source');
    expect(ground).toContain('ground-sink');
    expect(ground).toContain('on-ground');
  });

  it('leaves out the objects of another storey', () => {
    const ground = drawnOn('ground');
    expect(ground).not.toContain('upper-sink');
    const upper = drawnOn('upper');
    expect(upper).not.toContain('ground-sink');
    expect(upper).not.toContain('on-ground');
  });

  it('draws a segment joining two storeys on both', () => {
    // That is what a riser is: it passes through this floor on its way to the
    // other.
    expect(drawnOn('ground')).toContain('riser');
    expect(drawnOn('upper')).toContain('riser');
  });

  it('says which segments rise, so the drawing can mark them', () => {
    const plan = buildPlanView(project(), {
      levelId: 'ground',
      layers: { ...defaultVisibility(), 'water.pipes': true },
    });
    const riser = plan.primitives.find(
      ({ sourceObjectId }) => sourceObjectId === 'riser',
    );
    expect(riser?.metadata?.riser).toBe(true);
    const flat = plan.primitives.find(
      ({ sourceObjectId }) => sourceObjectId === 'on-ground',
    );
    expect(flat?.metadata?.riser).toBe(false);
  });

  it('shows an object that names no storey wherever one looks', () => {
    // The plan cannot invent a level the model does not state, and hiding it
    // would make it invisible everywhere.
    expect(drawnOn('ground')).toContain('floating');
    expect(drawnOn('upper')).toContain('floating');
  });

  it('draws the ports of a node only where the node is', () => {
    expect(drawnOn('ground')).toContain('ground-source-out');
    expect(drawnOn('ground')).not.toContain('upper-sink-in');
  });
});
