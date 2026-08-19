import { bench, describe } from 'vitest';
import {
  connectedComponents,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import { validatePolyline } from '@house-technical-designer/geometry';
import {
  drawingViewId,
  graphicProfileId,
  renderSemanticSceneToSvg,
  type DrawingView,
  type GraphicProfile,
  type SemanticScene,
} from '@house-technical-designer/drawing-engine';
import {
  aggregateThermalEnvelope,
  calculateElementTransmission,
} from '@house-technical-designer/thermal';
import { simulateBatteryDispatch } from '@house-technical-designer/battery';

const wallPaths = Array.from({ length: 100 }, (_, index) => ({
  points: [
    { x: index * 100, y: 0 },
    { x: index * 100, y: 5000 },
  ],
  closed: false,
}));

const profileId = graphicProfileId('benchmark-profile');
const view: DrawingView = {
  id: drawingViewId('benchmark-plan'),
  type: 'PLAN',
  scale: 50,
  viewport: { min: { x: 0, y: 0 }, max: { x: 100_000, y: 100_000 } },
  visibleDisciplines: ['ARCHITECTURE'],
  graphicProfileId: profileId,
};
const profile: GraphicProfile = {
  id: profileId,
  name: 'Benchmark',
  roleTokens: { WALL_CUT: 'wall' },
};
const scene: SemanticScene = {
  viewId: view.id,
  primitives: Array.from({ length: 1000 }, (_, index) => ({
    id: `primitive-${index}`,
    semanticRole: 'WALL_CUT' as const,
    geometry: {
      kind: 'POLYLINE' as const,
      polyline: {
        points: [
          { x: index * 10, y: 0 },
          { x: index * 10, y: 5000 },
        ],
        closed: false,
      },
    },
    layer: 'walls',
    zIndex: index,
    discipline: 'ARCHITECTURE' as const,
  })),
};

const network: TechnicalNetwork = {
  id: 'benchmark-network',
  discipline: 'WATER',
  systemType: 'BENCHMARK',
  nodes: Array.from({ length: 501 }, (_, index) => ({
    id: `node-${index}`,
    kind: index === 0 ? 'SOURCE' : 'JUNCTION',
    position: { x: index * 100, y: 0, z: 0 },
  })),
  ports: Array.from({ length: 1000 }, (_, index) => ({
    id: `port-${index}`,
    nodeId: `node-${Math.ceil(index / 2)}`,
    role: 'FLOW',
    direction: index % 2 === 0 ? ('OUT' as const) : ('IN' as const),
  })),
  edges: Array.from({ length: 500 }, (_, index) => ({
    id: `edge-${index}`,
    fromPortId: `port-${index * 2}`,
    toPortId: `port-${index * 2 + 1}`,
    path: [
      { x: index * 100, y: 0, z: 0 },
      { x: (index + 1) * 100, y: 0, z: 0 },
    ],
    kind: 'SEGMENT',
  })),
};

const periods = Array.from({ length: 8760 }, (_, index) => String(index));
const hourlyLoadKWh = periods.map(() => 1);
const hourlyPvKWh = periods.map((_, index) =>
  index % 24 >= 8 && index % 24 < 18 ? 1.5 : 0,
);
const surfaceResistances = {
  id: 'benchmark-surfaces',
  version: '1',
  insideSurfaceResistanceM2KW: 0.13,
  outsideSurfaceResistanceM2KW: 0.04,
};

describe('PR-070 performance baseline', () => {
  bench(
    'validates 100 wall paths',
    () => {
      for (const path of wallPaths) validatePolyline(path);
    },
    { time: 100, warmupTime: 50 },
  );

  bench(
    'renders 1000 semantic SVG primitives',
    () => {
      renderSemanticSceneToSvg(scene, view, profile, {
        tokens: { wall: { stroke: '#111', strokeWidthPaperMm: 0.5 } },
      });
    },
    { time: 100, warmupTime: 50 },
  );

  bench(
    'finds components in a 500-segment network',
    () => {
      connectedComponents(network);
    },
    { time: 100, warmupTime: 50 },
  );

  bench(
    'simulates one year of hourly battery dispatch',
    () => {
      simulateBatteryDispatch({
        timeStepHours: 1,
        periods,
        loadKWh: hourlyLoadKWh,
        pvKWh: hourlyPvKWh,
        battery: {
          usableCapacityKWh: 5,
          minimumSoc: 0.1,
          maximumSoc: 0.9,
          initialSoc: 0.5,
          maxChargePowerKW: 3,
          maxDischargePowerKW: 3,
          chargeEfficiency: 0.95,
          dischargeEfficiency: 0.95,
        },
        offGrid: false,
      });
    },
    { time: 100, warmupTime: 50 },
  );

  bench(
    'aggregates a complete 100-element thermal envelope',
    () => {
      const thermalElements = Array.from({ length: 100 }, (_, index) => ({
        result: calculateElementTransmission(
          `element-${index}`,
          10,
          [
            {
              layerId: 'layer',
              materialId: 'material',
              thicknessM: 0.2,
              lambdaWmK: 0.04,
            },
          ],
          surfaceResistances,
        ),
        roomId: `room-${index % 10}`,
        zoneId: 'zone',
        levelId: 'ground',
      }));
      aggregateThermalEnvelope({
        elements: thermalElements,
        bridgeMode: 'NONE',
        designTemperatureDifferenceK: 25,
      });
    },
    { time: 100, warmupTime: 50 },
  );
});
