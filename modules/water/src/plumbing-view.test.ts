import { describe, expect, it } from 'vitest';
import {
  calculatePipeHydraulics,
  type HydraulicContext,
} from './hydraulics.js';
import {
  createPlumbingScene,
  createWaterPipeInspector,
} from './plumbing-view.js';
import type { WaterNetwork } from './water-domain.js';

const network: WaterNetwork = {
  id: 'hot-water',
  discipline: 'WATER',
  systemType: 'DOMESTIC_HOT_WATER',
  nodes: [
    { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
    { id: 'sink', kind: 'FIXTURE', position: { x: 3000, y: 4000, z: 0 } },
  ],
  ports: [
    { id: 'out', nodeId: 'source', role: 'OUT', direction: 'OUT' },
    { id: 'in', nodeId: 'sink', role: 'IN', direction: 'IN' },
  ],
  edges: [
    {
      id: 'pipe',
      fromPortId: 'out',
      toPortId: 'in',
      kind: 'PIPE',
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 3000, y: 4000, z: 0 },
      ],
      properties: {
        internalDiameterM: 0.012,
        materialId: 'pex',
        roughnessM: 0.000_001_5,
        localLossCoefficient: 0,
      },
    },
  ],
};
const context: HydraulicContext = {
  fluidDensityKgM3: 998,
  dynamicViscosityPaS: 0.001,
  gravityMs2: 9.81,
  methodId: 'darcy-v1',
};
const hydraulics = calculatePipeHydraulics(
  {
    segmentId: 'pipe',
    lengthM: 5,
    internalDiameterM: 0.012,
    flowM3s: 0.0001,
    roughnessM: 0.000_001_5,
    localLossCoefficient: 0,
  },
  context,
);

describe('plumbing plan and inspector', () => {
  it('creates semantic hot-water geometry from the persisted 3D route', () => {
    const [primitive] = createPlumbingScene(network, { pipe: hydraulics });
    expect(primitive).toMatchObject({
      sourceObjectId: 'pipe',
      semanticRole: 'WATER_HOT',
      discipline: 'WATER',
      state: 'NORMAL',
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: [
            { x: 0, y: 0 },
            { x: 3000, y: 4000 },
          ],
        },
      },
      metadata: { systemType: 'DOMESTIC_HOT_WATER', lengthM: 5 },
    });
  });

  it('builds an inspector with explicit units and derived results', () => {
    const inspector = createWaterPipeInspector(network, 'pipe', hydraulics);
    expect(inspector).toMatchObject({
      networkType: 'DOMESTIC_HOT_WATER',
      materialId: 'pex',
      lengthM: 5,
      internalDiameterM: 0.012,
      internalDiameterMm: 12,
      flowM3s: 0.0001,
    });
    expect(inspector.velocityMs).toBeDefined();
    expect(inspector.pressureLossPa).toBeDefined();
    expect(inspector.warnings).toEqual([]);
  });

  it('shows missing pipe properties as warnings without inventing values', () => {
    const unknown: WaterNetwork = {
      ...network,
      edges: network.edges.map((edge) => ({ ...edge, properties: {} })),
    };
    const [primitive] = createPlumbingScene(unknown);
    const inspector = createWaterPipeInspector(unknown, 'pipe');
    expect(primitive?.state).toBe('WARNING');
    expect(inspector.internalDiameterM).toBeUndefined();
    expect(inspector.materialId).toBeUndefined();
    expect(inspector.warnings).toHaveLength(2);
  });
});
