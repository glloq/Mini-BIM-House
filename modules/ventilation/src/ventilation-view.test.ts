import { describe, expect, it } from 'vitest';
import { calculateDuctAirflow, type AirflowMethod } from './airflow.js';
import type { VentilationNetwork } from './ventilation-domain.js';
import {
  createVentilationDuctInspector,
  createVentilationOverlay,
  createVentilationScene,
} from './ventilation-view.js';

const network: VentilationNetwork = {
  id: 'supply',
  discipline: 'VENTILATION',
  systemType: 'SUPPLY',
  nodes: [
    { id: 'source', kind: 'SOURCE', position: { x: 0, y: 0, z: 0 } },
    {
      id: 'terminal',
      kind: 'TERMINAL',
      position: { x: 3_000, y: 4_000, z: 0 },
      terminal: { roomId: 'room', role: 'SUPPLY' },
    },
  ],
  ports: [
    { id: 'out', nodeId: 'source', role: 'AIR', direction: 'OUT' },
    { id: 'in', nodeId: 'terminal', role: 'AIR', direction: 'IN' },
  ],
  edges: [
    {
      id: 'duct',
      kind: 'DUCT',
      fromPortId: 'out',
      toPortId: 'in',
      path: [
        { x: 0, y: 0, z: 0 },
        { x: 3_000, y: 4_000, z: 0 },
      ],
      properties: {
        airRole: 'SUPPLY',
        shape: 'ROUND',
        diameterM: 0.125,
        roughnessM: 0.000_09,
        localLossCoefficient: 0,
      },
    },
  ],
};

const method: AirflowMethod = {
  methodId: 'darcy-air-v1',
  airDensityKgM3: 1.2,
  dynamicViscosityPaS: 0.000_018,
};
const result = calculateDuctAirflow(
  { duct: network.edges[0]!, flowM3h: 100 },
  method,
);

describe('ventilation view and analysis overlays', () => {
  it('projects persisted routes as semantic supply geometry', () => {
    expect(createVentilationScene(network, { duct: result })[0]).toMatchObject({
      sourceObjectId: 'duct',
      semanticRole: 'VENT_SUPPLY',
      discipline: 'VENTILATION',
      state: 'NORMAL',
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: [
            { x: 0, y: 0 },
            { x: 3_000, y: 4_000 },
          ],
        },
      },
      metadata: { lengthM: 5, flowM3h: 100 },
    });
  });

  it('builds unit-bearing flow, velocity, and pressure overlays', () => {
    expect(createVentilationOverlay('flow', 'AIRFLOW', [result])).toMatchObject(
      {
        metric: 'airflow',
        unit: 'm3/h',
        values: { duct: 100 },
      },
    );
    expect(
      createVentilationOverlay('velocity', 'VELOCITY', [result]),
    ).toMatchObject({
      unit: 'm/s',
      values: { duct: result.velocityMs },
    });
    expect(
      createVentilationOverlay('pressure', 'PRESSURE_LOSS', [result]),
    ).toMatchObject({
      unit: 'Pa',
      values: { duct: result.totalPressureLossPa },
    });
  });

  it('represents unavailable pressure as UNKNOWN, not zero', () => {
    const partial = calculateDuctAirflow(
      {
        duct: {
          ...network.edges[0]!,
          properties: {
            airRole: 'SUPPLY',
            shape: 'ROUND',
            diameterM: 0.125,
            roughnessM: 0.000_09,
          },
        },
        flowM3h: 100,
      },
      method,
    );
    expect(
      createVentilationOverlay('pressure', 'PRESSURE_LOSS', [partial]),
    ).toMatchObject({
      values: { duct: null },
      states: { duct: 'UNKNOWN' },
    });
  });

  it('creates an inspector with derived SI values and warnings', () => {
    expect(
      createVentilationDuctInspector(network, 'duct', result),
    ).toMatchObject({
      airRole: 'SUPPLY',
      shape: 'ROUND',
      lengthM: 5,
      diameterM: 0.125,
      flowM3h: 100,
      warnings: [],
    });
  });
});
