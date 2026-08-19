import {
  assemblyId,
  assemblyLayerId,
} from '@house-technical-designer/assemblies';
import {
  entityId,
  type ProjectFile,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import { materialId } from '@house-technical-designer/materials';

const point = (x: number, y: number, z = 0) => ({ x, y, z });
const network = (
  id: string,
  discipline: TechnicalNetwork['discipline'],
): TechnicalNetwork => ({
  id,
  discipline,
  systemType: `${discipline}_INTEGRATION`,
  nodes: [
    { id: `${id}:source`, kind: 'SOURCE', position: point(0, 0) },
    { id: `${id}:terminal`, kind: 'TERMINAL', position: point(1000, 0) },
  ],
  ports: [
    { id: `${id}:out`, nodeId: `${id}:source`, role: 'FLOW', direction: 'OUT' },
    { id: `${id}:in`, nodeId: `${id}:terminal`, role: 'FLOW', direction: 'IN' },
  ],
  edges: [
    {
      id: `${id}:edge`,
      fromPortId: `${id}:out`,
      toPortId: `${id}:in`,
      path: [point(0, 0), point(1000, 0)],
      kind: 'SEGMENT',
    },
  ],
});

/** Deliberately smaller than PR-069: one room and only integration-critical systems. */
export function createPreReferenceProject(): ProjectFile {
  const levelId = entityId<'Level'>('ground');
  const wallAssembly = assemblyId('wall-assembly');
  const floorAssembly = assemblyId('floor-assembly');
  const insulation = materialId('insulation');
  const polygon = {
    outer: [point(0, 0), point(5000, 0), point(5000, 4000), point(0, 4000)].map(
      ({ x, y }) => ({ x, y }),
    ),
  };
  return {
    format: 'house-technical-designer-project',
    schemaVersion: '1.0.0',
    project: {
      id: entityId<'Project'>('pre-reference'),
      metadata: {
        name: 'Pre-reference integration fixture',
        createdAt: '2026-08-19T00:00:00Z',
        updatedAt: '2026-08-19T00:00:00Z',
        projectRevision: 'fixture-1',
      },
      site: { northAngleDeg: 0, climateProfileId: 'fixture-climate' },
      materialLibrary: {
        materials: [
          {
            id: insulation,
            name: 'Fixture insulation',
            kind: 'GENERIC',
            properties: { lambdaWmK: 0.04 },
          },
        ],
      },
      assemblies: [
        {
          id: wallAssembly,
          name: 'Wall',
          category: 'WALL',
          layers: [
            {
              id: assemblyLayerId('wall-layer'),
              materialId: insulation,
              thicknessM: 0.2,
              role: 'INSULATION',
            },
          ],
        },
        {
          id: floorAssembly,
          name: 'Floor and roof',
          category: 'FLOOR',
          layers: [
            {
              id: assemblyLayerId('floor-layer'),
              materialId: insulation,
              thicknessM: 0.25,
              role: 'INSULATION',
            },
          ],
        },
      ],
      building: {
        levels: [
          {
            id: levelId,
            name: 'Ground',
            elevationMm: 0,
            defaultStoreyHeightMm: 2500,
            walls: [
              {
                id: entityId<'Wall'>('wall'),
                type: 'WALL',
                levelId,
                path: {
                  points: [
                    { x: 0, y: 0 },
                    { x: 5000, y: 0 },
                  ],
                },
                referenceSide: 'CENTER',
                assemblyId: wallAssembly,
                baseOffsetMm: 0,
                heightMode: 'EXPLICIT',
                heightMm: 2500,
                role: 'EXTERIOR',
              },
            ],
            openings: [
              {
                id: entityId<'Opening'>('window'),
                type: 'OPENING',
                openingType: 'WINDOW',
                hostElementId: entityId<'Wall'>('wall'),
                offsetAlongHostMm: 1000,
                sillHeightMm: 900,
                widthMm: 1200,
                heightMm: 1000,
              },
            ],
            slabs: [
              {
                id: entityId<'Slab'>('slab'),
                type: 'SLAB',
                levelId,
                polygon,
                assemblyId: floorAssembly,
                elevationOffsetMm: 0,
                role: 'FLOOR',
              },
            ],
            roofs: [
              {
                id: entityId<'RoofPlane'>('roof'),
                type: 'ROOF_PLANE',
                levelId,
                footprint: polygon,
                assemblyId: floorAssembly,
                slopeDeg: 30,
                azimuthDeg: 180,
                baseElevationMm: 2500,
              },
            ],
            spaces: [
              {
                id: entityId<'Space'>('space'),
                type: 'SPACE',
                levelId,
                name: 'Room',
                category: 'LIVING',
                boundaryMode: 'MANUAL',
                manualPolygon: polygon,
              },
            ],
            stairs: [],
            annotations: [],
          },
        ],
        zones: [],
      },
      systems: [
        network('water', 'WATER'),
        network('ventilation', 'VENTILATION'),
        network('electrical', 'ELECTRICAL'),
      ],
      equipment: [
        {
          id: 'pv',
          kind: 'PHOTOVOLTAIC',
          catalogKind: 'CUSTOM',
          properties: { installedPowerWp: 4000 },
        },
        {
          id: 'battery',
          kind: 'BATTERY',
          catalogKind: 'CUSTOM',
          properties: { usableCapacityKWh: 5 },
        },
      ],
      scenarios: [],
      calculationSettings: {},
      drawingViews: [],
    },
    references: {},
    extensions: {},
  };
}
