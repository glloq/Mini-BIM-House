import {
  assemblyId,
  assemblyLayerId,
} from '@house-technical-designer/assemblies';
import {
  entityId,
  type ModuleSettings,
  type ProjectFile,
  type TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import { materialId } from '@house-technical-designer/materials';
import type { ClimateDataset } from '@house-technical-designer/climate';

const point = (x: number, y: number, z = 0) => ({ x, y, z });

const moduleSettings = (
  moduleId: string,
  methodId: string,
  settings: ModuleSettings['settings'],
): ModuleSettings => ({
  moduleId,
  moduleVersion: '2.0.0',
  methodId,
  settings,
});

/** One-room water, wastewater, ventilation and lighting systems. */
function preReferenceNetworks(): readonly TechnicalNetwork[] {
  const space = 'space';
  return [
    {
      id: 'water',
      discipline: 'WATER',
      systemType: 'POTABLE_COLD',
      nodes: [
        { id: 'water:source', kind: 'SOURCE', position: point(0, 0, 400) },
        {
          id: 'water:sink',
          kind: 'FIXTURE',
          position: point(4000, 0, 400),
          spaceId: space,
          fixtureType: 'SINK',
          designFlowLps: 0.2,
        } as TechnicalNetwork['nodes'][number],
      ],
      ports: [
        {
          id: 'water:out',
          nodeId: 'water:source',
          role: 'FLOW',
          direction: 'OUT',
        },
        { id: 'water:in', nodeId: 'water:sink', role: 'FLOW', direction: 'IN' },
      ],
      edges: [
        {
          id: 'water:pipe',
          fromPortId: 'water:out',
          toPortId: 'water:in',
          path: [point(0, 0, 400), point(4000, 0, 400)],
          kind: 'PIPE',
          properties: { internalDiameterM: 0.0166, localLossCoefficient: 1.2 },
        },
      ],
    },
    {
      id: 'wastewater',
      discipline: 'WASTEWATER',
      systemType: 'COMBINED_WASTEWATER',
      nodes: [
        {
          id: 'wastewater:sink',
          kind: 'FIXTURE',
          position: point(4000, 0, -150),
          spaceId: space,
          dischargeUnits: 1,
        } as TechnicalNetwork['nodes'][number],
        {
          id: 'wastewater:outlet',
          kind: 'OUTLET',
          position: point(5000, 0, -300),
        },
      ],
      ports: [
        {
          id: 'wastewater:out',
          nodeId: 'wastewater:sink',
          role: 'FLOW',
          direction: 'OUT',
        },
        {
          id: 'wastewater:in',
          nodeId: 'wastewater:outlet',
          role: 'FLOW',
          direction: 'IN',
        },
      ],
      edges: [
        {
          id: 'wastewater:pipe',
          fromPortId: 'wastewater:out',
          toPortId: 'wastewater:in',
          path: [point(4000, 0, -150), point(5000, 0, -300)],
          kind: 'GRAVITY_PIPE',
          properties: { internalDiameterM: 0.04 },
        },
      ],
    },
    {
      id: 'ventilation',
      discipline: 'VENTILATION',
      systemType: 'EXTRACT',
      nodes: [
        { id: 'ventilation:unit', kind: 'FAN', position: point(4800, 0, 2300) },
        {
          id: 'ventilation:extract',
          kind: 'TERMINAL',
          position: point(2500, 2000, 2300),
          spaceId: space,
          airRole: 'EXTRACT',
          targetFlowM3h: 60,
        } as TechnicalNetwork['nodes'][number],
      ],
      ports: [
        {
          id: 'ventilation:out',
          nodeId: 'ventilation:unit',
          role: 'AIR',
          direction: 'OUT',
        },
        {
          id: 'ventilation:in',
          nodeId: 'ventilation:extract',
          role: 'AIR',
          direction: 'IN',
        },
      ],
      edges: [
        {
          id: 'ventilation:duct',
          fromPortId: 'ventilation:out',
          toPortId: 'ventilation:in',
          path: [point(4800, 0, 2300), point(2500, 2000, 2300)],
          kind: 'DUCT',
          properties: {
            airRole: 'EXTRACT',
            shape: 'ROUND',
            diameterM: 0.125,
            localLossCoefficient: 0.6,
          },
        },
      ],
    },
    {
      id: 'electrical',
      discipline: 'ELECTRICAL',
      systemType: 'ELECTRICAL',
      nodes: [
        {
          id: 'electrical:board',
          kind: 'DISTRIBUTION_BOARD',
          position: point(4800, 0, 1400),
          properties: { nominalVoltageV: 230, phases: 1 },
        },
        {
          id: 'electrical:lighting-circuit',
          kind: 'CIRCUIT',
          position: point(4800, 200, 1400),
          properties: {
            nominalVoltageV: 230,
            phases: 1,
            protectionRatingA: 10,
            conductorSectionMm2: 1.5,
          },
        },
        {
          id: 'electrical:luminaire',
          kind: 'LUMINAIRE',
          position: point(2500, 2000, 2400),
          spaceId: space,
          catalogItemId: 'luminaire',
          properties: { powerFactor: 0.95, demandFactor: 1 },
        } as TechnicalNetwork['nodes'][number],
      ],
      ports: [
        {
          id: 'electrical:out',
          nodeId: 'electrical:board',
          role: 'POWER',
          direction: 'OUT',
        },
        {
          id: 'electrical:circuit-in',
          nodeId: 'electrical:lighting-circuit',
          role: 'POWER',
          direction: 'IN',
        },
        {
          id: 'electrical:circuit-out',
          nodeId: 'electrical:lighting-circuit',
          role: 'POWER',
          direction: 'OUT',
        },
        {
          id: 'electrical:in',
          nodeId: 'electrical:luminaire',
          role: 'POWER',
          direction: 'IN',
        },
      ],
      edges: [
        {
          id: 'electrical:feeder',
          fromPortId: 'electrical:out',
          toPortId: 'electrical:circuit-in',
          path: [point(4800, 0, 1400), point(4800, 200, 1400)],
          kind: 'CABLE',
          properties: { conductorSectionMm2: 1.5, conductorMaterial: 'COPPER' },
        },
        {
          id: 'electrical:cable',
          fromPortId: 'electrical:circuit-out',
          toPortId: 'electrical:in',
          path: [point(4800, 200, 1400), point(2500, 2000, 2400)],
          kind: 'CABLE',
          properties: { conductorSectionMm2: 1.5, conductorMaterial: 'COPPER' },
        },
      ],
    },
  ];
}

/**
 * Monthly and hourly datasets for the pre-reference site, small enough to keep
 * the harness fast while still exercising the real climate-driven code paths.
 */
export function createPreReferenceClimate(): readonly ClimateDataset[] {
  const location = { latitude: 48, longitude: 2, timezone: 'Europe/Paris' };
  const source = { id: 'pre-reference-fixture', provider: 'PROJECT_FIXTURE' };
  return [
    {
      id: 'fixture-climate',
      location,
      resolution: 'MONTHLY',
      source,
      samples: [
        {
          timestamp: '2026-01',
          airTemperatureC: 4,
          relativeHumidity: 0.85,
          precipitationMm: 70,
          globalHorizontalIrradianceWhM2: 25_000,
        },
        {
          timestamp: '2026-07',
          airTemperatureC: 19,
          relativeHumidity: 0.7,
          precipitationMm: 40,
          globalHorizontalIrradianceWhM2: 155_000,
        },
      ],
    },
    {
      id: 'fixture-climate-design-day',
      location,
      resolution: 'HOURLY',
      source: { id: 'pre-reference-design-day', provider: 'PROJECT_FIXTURE' },
      samples: [
        {
          timestamp: '2026-04-15T12:00:00+02:00',
          airTemperatureC: 16,
          relativeHumidity: 0.6,
          precipitationMm: 0,
          globalHorizontalIrradianceWhM2: 850,
        },
        {
          timestamp: '2026-04-15T13:00:00+02:00',
          airTemperatureC: 16.5,
          relativeHumidity: 0.58,
          precipitationMm: 0,
          globalHorizontalIrradianceWhM2: 820,
        },
      ],
    },
  ];
}

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
            properties: { lambdaWmK: 0.04, densityKgM3: 45, mu: 1.3 },
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
      systems: preReferenceNetworks(),
      equipment: [
        {
          id: 'pv',
          kind: 'PHOTOVOLTAIC',
          catalogKind: 'GENERIC',
          properties: { installedPowerWp: 4000 },
        },
        {
          id: 'battery',
          kind: 'BATTERY',
          catalogKind: 'GENERIC',
          properties: {
            usableCapacityKWh: 5,
            minimumSoc: 0.1,
            maximumSoc: 0.95,
            initialSoc: 0.5,
            maxChargePowerKW: 2.5,
            maxDischargePowerKW: 2.5,
            chargeEfficiency: 0.95,
            dischargeEfficiency: 0.95,
          },
        },
        {
          id: 'fan',
          kind: 'FAN',
          catalogKind: 'GENERIC',
          properties: { designFlowM3h: 60, nominalPowerW: 18 },
        },
        {
          id: 'dhw-tank',
          kind: 'DHW_TANK',
          catalogKind: 'GENERIC',
          properties: { tankVolumeL: 150, usefulHeatingPowerW: 1800 },
        },
        {
          id: 'rain-tank',
          kind: 'RAINWATER_TANK',
          catalogKind: 'GENERIC',
          properties: { nominalVolumeL: 3000, initialVolumeL: 1500 },
        },
        {
          id: 'luminaire',
          kind: 'LUMINAIRE',
          catalogKind: 'GENERIC',
          properties: {
            name: 'Fixture luminaire',
            luminousFluxLm: 1400,
            electricalPowerW: 12,
          },
        },
      ],
      scenarios: [
        {
          id: 'scenario-insulation-plus',
          name: 'Thicker insulation',
          baseProjectRevision: 'fixture-1',
          overrides: [
            {
              path: 'assemblies/0/layers/0/thicknessM',
              operation: 'SET',
              value: 0.4,
            },
          ],
        },
      ],
      calculationSettings: {
        thermal: moduleSettings('thermal', 'assembly-u-value-v1', {}),
        heating: moduleSettings('heating', 'design-heating-steady-state-v1', {
          designIndoorTemperatureC: 20,
          designOutdoorTemperatureC: -7,
        }),
        dhw: moduleSettings('dhw', 'sensible-water-heating-v1', {
          householdOccupants: 2,
          dailyUseVolumeLPerOccupant: 40,
          coldWaterTemperatureC: 10,
          useTemperatureC: 40,
          storageTemperatureC: 60,
          annualOperatingDays: 365,
        }),
        lighting: moduleSettings('lighting', 'lumen-average-v1', {
          utilizationFactor: 0.6,
          maintenanceFactor: 0.8,
          operatingHoursPerDay: 3,
        }),
        ventilation: moduleSettings(
          'ventilation',
          'duct-darcy-weisbach-v1',
          {},
        ),
        iaq: moduleSettings('iaq', 'co2-mass-balance-v1', {
          co2GenerationM3sPerOccupant: 0.0000047,
          initialConcentrationPpm: 500,
          durationHours: 4,
          occupantsByCategory: { LIVING: 2 },
        }),
        water: moduleSettings('water', 'pipe-darcy-weisbach-v1', {
          simultaneityFactor: 0.5,
        }),
        wastewater: moduleSettings('wastewater', 'discharge-unit-gravity-v1', {
          designFlowM3sPerDischargeUnit: 0.0004,
          minimumSlope: 0.01,
        }),
        rainwater: moduleSettings('rainwater', 'tank-water-balance-v1', {
          runoffCoefficient: 0.9,
          preFilterEfficiency: 0.95,
          dailyDemandL: 80,
        }),
        photovoltaic: moduleSettings('photovoltaic', 'offline-pv-v1', {
          performanceRatio: 0.8,
        }),
        battery: moduleSettings('battery', 'battery-configuration-v1', {
          offGrid: 0,
        }),
        'energy-balance': moduleSettings(
          'energy-balance',
          'physical-energy-balance-v1',
          { heatingSetpointTemperatureC: 19 },
        ),
        hygrothermal: moduleSettings('hygrothermal', 'glaser-steady-state-v1', {
          indoorTemperatureC: 20,
          indoorRelativeHumidity: 0.5,
          period: 'design-winter',
        }),
        acoustics: moduleSettings('acoustics', 'sabine-reverberation-v1', {
          bandsHz: [500, 1000],
          defaultSurfaceAbsorption: { '500': 0.08, '1000': 0.09 },
        }),
        cost: moduleSettings('cost', 'quantity-priced-estimate-v1', {
          currency: 'EUR',
          unitPriceByMaterial: { insulation: 95 },
          wasteFactorByMaterial: { insulation: 0.1 },
        }),
        environmental: moduleSettings(
          'environmental',
          'declaration-linked-impact-v1',
          {
            indicator: 'GWP',
            validAt: '2026-01-01',
            declarationSource:
              'Generic demonstration data — not a manufacturer declaration',
            gwpPerUnitByMaterial: { insulation: 140 },
          },
        ),
      },
      drawingViews: [],
    },
    references: {},
    extensions: {},
  };
}
