import type {
  CalculationJson,
  CalculationModule,
  CalculationResult,
  CalculationValidation,
} from '@house-technical-designer/calculation-core';
import { calculateElementTransmission } from '@house-technical-designer/thermal';
import { calculateHeatingLoads } from '@house-technical-designer/heating';
import { calculateLumenMethod } from '@house-technical-designer/lighting';
import { offlineSimplePvBackend } from '@house-technical-designer/photovoltaic';
import { simulateBatteryDispatch } from '@house-technical-designer/battery';
import { calculatePipeHydraulics } from '@house-technical-designer/water';
import { calculateDuctAirflow } from '@house-technical-designer/ventilation';
import { collectedVolumeL } from '@house-technical-designer/rainwater';
import { simulateCo2Balance } from '@house-technical-designer/iaq';
import { assessSteadyStateHygrothermal } from '@house-technical-designer/hygrothermal';
import { calculateRoomAcoustics } from '@house-technical-designer/acoustics';
import { calculateDwh } from '@house-technical-designer/dhw';
import { calculateCostEstimate } from '@house-technical-designer/cost';
import { calculateEnvironmentalImpacts } from '@house-technical-designer/environmental';
import { analyzeWastewaterNetwork } from '@house-technical-designer/wastewater';

const ok = (): CalculationValidation => ({ valid: true });
const invalid = (message: string): CalculationValidation => ({
  valid: false,
  issues: [{ path: '/', message }],
});
function record(
  value: CalculationJson,
): Readonly<Record<string, CalculationJson>> | undefined {
  return isRecord(value) ? value : undefined;
}
function isRecord(
  value: CalculationJson,
): value is { readonly [key: string]: CalculationJson } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function number(value: CalculationJson | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
function numbers(
  value: CalculationJson | undefined,
): readonly number[] | undefined {
  return Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
    ? value
    : undefined;
}
function dependency(
  dependencies: Readonly<Record<string, CalculationResult>>,
  id: string,
): Readonly<Record<string, CalculationJson>> {
  return dependencies[id]?.outputs ?? {};
}

export const thermalAdapter: CalculationModule = {
  id: 'thermal',
  version: '1.0.0',
  methodId: 'assembly-u-value-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'integration://thermal-settings',
  inputPaths: ['building.geometry', 'assemblies', 'materials.thermal'],
  validate(input) {
    const data = record(input);
    return data !== undefined &&
      number(data.areaM2) !== undefined &&
      number(data.thicknessM) !== undefined &&
      number(data.lambdaWmK) !== undefined
      ? ok()
      : invalid('areaM2, thicknessM and lambdaWmK are required finite numbers');
  },
  calculate(input) {
    const data = record(input)!;
    const result = calculateElementTransmission(
      'envelope',
      number(data.areaM2)!,
      [
        {
          layerId: 'insulation',
          materialId: 'insulation',
          thicknessM: number(data.thicknessM)!,
          lambdaWmK: number(data.lambdaWmK)!,
        },
      ],
      {
        id: 'integration-surfaces',
        version: '1',
        insideSurfaceResistanceM2KW: 0.13,
        outsideSurfaceResistanceM2KW: 0.04,
      },
    );
    return {
      status: result.status,
      outputs: {
        uValueWm2K: result.uValueWm2K ?? null,
        heatTransferCoefficientWK: result.heatTransferCoefficientWK ?? null,
      },
    };
  },
};

export const heatingAdapter: CalculationModule = {
  id: 'heating',
  version: '1.0.0',
  methodId: 'design-heating-v1',
  precision: 'ENGINEERING',
  dependencies: [{ moduleId: 'thermal', required: true }],
  settingsSchemaId: 'integration://heating-settings',
  inputPaths: ['climate.design', 'ventilation', 'thermal'],
  validate(input) {
    const data = record(input);
    return data !== undefined && number(data.designDeltaK) !== undefined
      ? ok()
      : invalid('designDeltaK is required');
  },
  calculate(input, _settings, dependencies) {
    const data = record(input)!;
    const h = number(
      dependency(dependencies, 'thermal').heatTransferCoefficientWK,
    );
    const result = calculateHeatingLoads(
      [
        {
          roomId: 'house',
          transmissionHeatTransferCoefficientWK: h!,
          designTemperatureDifferenceK: number(data.designDeltaK)!,
          ventilationFlowM3s: 0,
          otherW: 0,
        },
      ],
      {
        id: 'integration-heating',
        version: '1',
        airDensityKgM3: 1.2,
        airSpecificHeatJKgK: 1005,
      },
    );
    return {
      status: result.status,
      outputs: { designLoadW: result.designLoadW ?? null },
    };
  },
};

export const lightingAdapter: CalculationModule = {
  id: 'lighting',
  version: '1.0.0',
  methodId: 'lumen-average-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'integration://lighting-settings',
  inputPaths: ['spaces', 'equipment.lighting'],
  validate(input) {
    const data = record(input);
    return data !== undefined && number(data.powerW) !== undefined
      ? ok()
      : invalid('powerW is required');
  },
  calculate(input) {
    const powerW = number(record(input)!.powerW)!;
    const result = calculateLumenMethod({
      roomId: 'house',
      roomAreaM2: 50,
      utilizationFactor: 0.6,
      maintenanceFactor: 0.8,
      placements: [
        {
          id: 'light-1',
          luminaireId: 'luminaire',
          roomId: 'house',
          position: { x: 0, y: 0 },
        },
      ],
      luminaires: [
        {
          id: 'luminaire',
          name: 'Light',
          luminousFluxLm: 1000,
          electricalPowerW: powerW,
          source: { sourceType: 'USER' },
        },
      ],
    });
    return {
      status: 'OK',
      outputs: { installedPowerW: result.installedPowerW },
    };
  },
};

export const photovoltaicAdapter: CalculationModule = {
  id: 'photovoltaic',
  version: '1.0.0',
  methodId: 'offline-pv-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'integration://pv-settings',
  inputPaths: ['building.roofs', 'site.climate', 'equipment.pv'],
  validate(input) {
    const data = record(input);
    return data !== undefined &&
      number(data.installedPowerWp) !== undefined &&
      numbers(data.irradiationWhM2) !== undefined
      ? ok()
      : invalid('installedPowerWp and irradiationWhM2 are required');
  },
  async calculate(input) {
    const data = record(input)!;
    const irradiation = numbers(data.irradiationWhM2)!;
    const result = await offlineSimplePvBackend.calculate({
      installedPowerWp: number(data.installedPowerWp)!,
      planeIrradiation: irradiation.map((value, index) => ({
        period: String(index),
        irradiationWhM2: value,
      })),
      performanceRatio: 0.8,
      source: { provider: 'integration-fixture' },
    });
    return {
      status: 'OK',
      outputs: {
        generationWh: result.periods.map(({ energyKWh }) => energyKWh * 1000),
      },
    };
  },
};

export const batteryAdapter: CalculationModule = {
  id: 'battery',
  version: '1.0.0',
  methodId: 'pv-self-consumption-dispatch-v1',
  precision: 'ENGINEERING',
  dependencies: [
    { moduleId: 'photovoltaic', required: true },
    { moduleId: 'lighting', required: true },
    { moduleId: 'heating', required: true },
  ],
  settingsSchemaId: 'integration://battery-settings',
  inputPaths: ['equipment.battery', 'energy.loads', 'photovoltaic'],
  validate(input) {
    const data = record(input);
    return data !== undefined && number(data.hours) !== undefined
      ? ok()
      : invalid('hours is required');
  },
  calculate(input, _settings, dependencies) {
    const hours = number(record(input)!.hours)!;
    const pv = numbers(dependency(dependencies, 'photovoltaic').generationWh)!;
    const lighting = number(
      dependency(dependencies, 'lighting').installedPowerW,
    )!;
    const heating = number(dependency(dependencies, 'heating').designLoadW)!;
    const load = pv.map(() => ((lighting + heating) * hours) / 1000);
    const result = simulateBatteryDispatch({
      timeStepHours: hours,
      periods: pv.map((_, index) => String(index)),
      loadKWh: load,
      pvKWh: pv.map((value) => value / 1000),
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
    return {
      status: result.status === 'OK' ? 'OK' : 'FAILED',
      outputs: {
        loadKWh: load,
        pvKWh: pv.map((value) => value / 1000),
        gridImportKWh: result.gridImportKWh ?? null,
        gridExportKWh: result.gridExportKWh ?? null,
        chargeLossKWh: result.chargeLossKWh ?? null,
        dischargeLossKWh: result.dischargeLossKWh ?? null,
        initialStoredEnergyKWh: result.initialStoredEnergyKWh ?? null,
        finalStoredEnergyKWh: result.finalStoredEnergyKWh ?? null,
      },
    };
  },
};

export const energyBalanceAdapter: CalculationModule = {
  id: 'energy-balance',
  version: '1.0.0',
  methodId: 'integrated-ledger-v1',
  precision: 'ENGINEERING',
  dependencies: [{ moduleId: 'battery', required: true }],
  settingsSchemaId: 'integration://energy-settings',
  inputPaths: ['energy'],
  validate: () => ok(),
  calculate(_input, _settings, dependencies) {
    const data = dependency(dependencies, 'battery');
    const load = numbers(data.loadKWh)!.reduce((a, b) => a + b, 0);
    const pv = numbers(data.pvKWh)!.reduce((a, b) => a + b, 0);
    const gridImport = number(data.gridImportKWh)!;
    const gridExport = number(data.gridExportKWh)!;
    const losses = number(data.chargeLossKWh)! + number(data.dischargeLossKWh)!;
    const storageDelta =
      number(data.finalStoredEnergyKWh)! - number(data.initialStoredEnergyKWh)!;
    return {
      status: 'OK',
      outputs: {
        loadKWh: load,
        pvKWh: pv,
        gridImportKWh: gridImport,
        gridExportKWh: gridExport,
        lossesKWh: losses,
        storageDeltaKWh: storageDelta,
        conservationResidualKWh:
          pv + gridImport - load - gridExport - losses - storageDelta,
        energyUseIds: ['heating:electricity', 'lighting:electricity'],
      },
    };
  },
};

function scalarAdapter(
  id: string,
  inputPaths: readonly string[],
  calculate: (
    data: Readonly<Record<string, CalculationJson>>,
  ) => Readonly<Record<string, CalculationJson>>,
): CalculationModule {
  return {
    id,
    version: '1.0.0',
    methodId: `${id}-integration-v1`,
    precision: 'ENGINEERING',
    dependencies: [],
    settingsSchemaId: `integration://${id}-settings`,
    inputPaths,
    validate(input) {
      return record(input) === undefined
        ? invalid('input must be an object')
        : ok();
    },
    calculate(input) {
      return { status: 'OK', outputs: calculate(record(input)!) };
    },
  };
}

export const waterAdapter = scalarAdapter(
  'water',
  ['systems.water'],
  (data) => {
    const result = calculatePipeHydraulics(
      {
        segmentId: 'pipe',
        lengthM: number(data.lengthM)!,
        internalDiameterM: number(data.diameterM)!,
        flowM3s: number(data.flowM3s)!,
        roughnessM: 0.0000015,
        localLossCoefficient: 0,
      },
      {
        fluidDensityKgM3: 998,
        dynamicViscosityPaS: 0.001,
        gravityMs2: 9.81,
        methodId: 'darcy-weisbach',
      },
    );
    return {
      velocityMs: result.velocityMs ?? null,
      pressureLossPa: result.totalPressureLossPa ?? null,
    };
  },
);
export const ventilationAdapter = scalarAdapter(
  'ventilation',
  ['systems.ventilation'],
  (data) => {
    const diameterM = number(data.diameterM)!;
    const result = calculateDuctAirflow(
      {
        duct: {
          id: 'duct',
          fromPortId: 'a',
          toPortId: 'b',
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 5000, y: 0, z: 0 },
          ],
          kind: 'DUCT',
          properties: {
            airRole: 'SUPPLY',
            shape: 'ROUND',
            diameterM,
            roughnessM: 0.00009,
            localLossCoefficient: 0,
          },
        },
        flowM3h: number(data.flowM3h)!,
      },
      {
        methodId: 'darcy-weisbach',
        airDensityKgM3: 1.2,
        dynamicViscosityPaS: 0.000018,
      },
    );
    return {
      velocityMs: result.velocityMs ?? null,
      pressureLossPa: result.totalPressureLossPa ?? null,
    };
  },
);
export const rainwaterAdapter = scalarAdapter(
  'rainwater',
  ['site.climate', 'building.roofs'],
  (data) => ({
    collectedL: collectedVolumeL(number(data.precipitationMm)!, [
      {
        surfaceId: 'roof',
        projectedAreaM2: number(data.areaM2)!,
        runoffCoefficient: 0.9,
        preFilterEfficiency: 0.95,
        enabled: true,
      },
    ]),
  }),
);
export const wastewaterAdapter = scalarAdapter(
  'wastewater',
  ['systems.wastewater'],
  (data) => {
    const endZ = number(data.endElevationMm)!;
    const result = analyzeWastewaterNetwork(
      {
        id: 'ww',
        discipline: 'WASTEWATER',
        systemType: 'GREYWATER',
        nodes: [
          {
            id: 'fixture',
            kind: 'FIXTURE',
            position: { x: 0, y: 0, z: 100 },
            dischargeUnits: 1,
          },
          {
            id: 'outlet',
            kind: 'OUTLET',
            position: { x: 1000, y: 0, z: endZ },
          },
        ],
        ports: [
          { id: 'from', nodeId: 'fixture', role: 'FLOW', direction: 'OUT' },
          { id: 'to', nodeId: 'outlet', role: 'FLOW', direction: 'IN' },
        ],
        edges: [
          {
            id: 'pipe',
            kind: 'GRAVITY_PIPE',
            fromPortId: 'from',
            toPortId: 'to',
            path: [
              { x: 0, y: 0, z: 100 },
              { x: 1000, y: 0, z: endZ },
            ],
            properties: { internalDiameterM: 0.1 },
          },
        ],
      },
      {
        id: 'fixture-unit',
        version: '1',
        designFlowM3s: (units) => units * 0.001,
      },
    );
    return {
      slope: result.segments[0]?.slope ?? null,
      designFlowM3s: result.segments[0]?.designFlowM3s ?? null,
    };
  },
);
export const iaqAdapter = scalarAdapter(
  'iaq',
  ['spaces', 'systems.ventilation'],
  (data) => {
    const result = simulateCo2Balance({
      roomId: 'house',
      roomVolumeM3: number(data.volumeM3)!,
      timeStepSeconds: 3600,
      initialConcentrationPpm: 500,
      outdoorConcentrationPpm: 420,
      generationM3s: [0.000005],
      ventilationFlowM3h: [number(data.flowM3h)!],
    });
    return { finalConcentrationPpm: result.finalConcentrationPpm ?? null };
  },
);
export const hygrothermalAdapter = scalarAdapter(
  'hygrothermal',
  ['assemblies', 'materials.hygrothermal', 'climate'],
  (data) => {
    const result = assessSteadyStateHygrothermal({
      assemblyId: 'wall',
      period: 'winter',
      layers: [
        {
          id: 'layer',
          thicknessM: 0.2,
          thermalResistanceM2KW: number(data.resistanceM2KW)!,
          mu: 10,
        },
      ],
      indoorTemperatureC: 20,
      indoorRelativeHumidity: 0.5,
      outdoorTemperatureC: 0,
      outdoorRelativeHumidity: 0.8,
      interiorSurfaceResistanceM2KW: 0.13,
      exteriorSurfaceResistanceM2KW: 0.04,
    });
    return {
      applicability: result.applicability,
      interfaceCount: result.interfaces.length,
    };
  },
);
export const acousticsAdapter = scalarAdapter(
  'acoustics',
  ['spaces', 'materials.acoustic'],
  (data) => {
    const coefficient = number(data.absorption)!;
    const result = calculateRoomAcoustics(
      {
        roomId: 'house',
        volumeM3: 125,
        surfaces: [
          {
            surfaceId: 'room',
            areaM2: 100,
            absorptionCoefficientByBand: { 500: coefficient },
          },
        ],
      },
      {
        id: 'sabine',
        version: '1',
        reverberationConstant: 0.161,
        bandsHz: [500],
        assumptions: [],
      },
    );
    return { reverberationTimeS: result.bands[0]?.reverberationTimeS ?? null };
  },
);
export const dhwAdapter = scalarAdapter(
  'dhw',
  ['equipment.dhw', 'scenarios.occupancy'],
  (data) => {
    const result = calculateDwh(
      {
        dailyUseVolumeL: number(data.dailyVolumeL)!,
        coldWaterTemperatureC: 10,
        useTemperatureC: 40,
        storageTemperatureC: 60,
        tankVolumeL: 200,
        usefulHeatingPowerW: 2000,
        annualOperatingDays: 365,
      },
      {
        id: 'sensible-water',
        version: '1',
        waterDensityKgM3: 998,
        waterSpecificHeatJKgK: 4180,
      },
    );
    return { annualUsefulEnergyKWh: result.annualUsefulEnergyKWh ?? null };
  },
);
export const costAdapter = scalarAdapter(
  'cost',
  ['quantities', 'catalogs.cost'],
  (data) => {
    const result = calculateCostEstimate(
      [
        {
          itemId: 'wall',
          sourceEntityId: 'wall',
          value: number(data.quantity)!,
          unit: 'm2',
          lot: 'ENVELOPE',
        },
      ],
      [
        {
          itemId: 'wall',
          materialPricePerUnit: number(data.price)!,
          currency: 'EUR',
          priceUnit: 'm2',
        },
      ],
    );
    return { totalCost: result.totalCost ?? null };
  },
);
export const environmentalAdapter = scalarAdapter(
  'environmental',
  ['quantities', 'catalogs.environmental'],
  (data) => {
    const result = calculateEnvironmentalImpacts(
      [
        {
          itemId: 'wall',
          projectObjectId: 'wall',
          lot: 'ENVELOPE',
          value: number(data.quantity)!,
          unit: 'm2',
        },
      ],
      [
        {
          projectObjectId: 'wall',
          declarationId: 'epd',
          declarationType: 'FDES',
          projectQuantityUnit: 'm2',
          functionalUnit: 'm2',
          conversionFactor: 1,
        },
      ],
      [
        {
          id: 'epd',
          type: 'FDES',
          version: '1',
          functionalUnit: 'm2',
          indicator: 'GWP',
          indicatorUnit: 'kgCO2e',
          impactsByStage: { PRODUCT: number(data.impact)! },
          source: 'fixture',
        },
      ],
      '2026-01-01',
    );
    return { totalImpact: result.totalImpact ?? null };
  },
);

export const REFERENCE_INTEGRATION_MODULES = [
  thermalAdapter,
  heatingAdapter,
  lightingAdapter,
  photovoltaicAdapter,
  batteryAdapter,
  energyBalanceAdapter,
  waterAdapter,
  ventilationAdapter,
  rainwaterAdapter,
  wastewaterAdapter,
  iaqAdapter,
  hygrothermalAdapter,
  acousticsAdapter,
  dhwAdapter,
  costAdapter,
  environmentalAdapter,
] as const;
