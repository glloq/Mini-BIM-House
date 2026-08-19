import type {
  CalculationAssumption,
  CalculationJson,
  CalculationModule,
  CalculationResult,
  CalculationValidation,
  CalculationWarning,
  ModuleCalculation,
} from '@house-technical-designer/calculation-core';
import {
  aggregateThermalEnvelope,
  calculateElementTransmission,
  type ThermalElementResult,
} from '@house-technical-designer/thermal';
import { calculateHeatingLoads } from '@house-technical-designer/heating';
import { calculateLumenMethod } from '@house-technical-designer/lighting';
import { offlineSimplePvBackend } from '@house-technical-designer/photovoltaic';
import { calculatePipeHydraulics } from '@house-technical-designer/water';
import { calculateDuctAirflow } from '@house-technical-designer/ventilation';
import { simulateRainwater } from '@house-technical-designer/rainwater';
import { simulateCo2Balance } from '@house-technical-designer/iaq';
import { assessSteadyStateHygrothermal } from '@house-technical-designer/hygrothermal';
import {
  calculateRoomAcoustics,
  OCTAVE_BANDS_HZ,
  type OctaveBandHz,
} from '@house-technical-designer/acoustics';
import { calculateDwh } from '@house-technical-designer/dhw';
import { calculateCostEstimate } from '@house-technical-designer/cost';
import { calculateEnvironmentalImpacts } from '@house-technical-designer/environmental';
import { analyzeWastewaterNetwork } from '@house-technical-designer/wastewater';
import { calculateEnergyBalance } from '@house-technical-designer/energy-balance';
import type { ClimateDataset } from '@house-technical-designer/climate';

const ok = (): CalculationValidation => ({ valid: true });
const invalid = (
  ...issues: readonly { readonly path: string; readonly message: string }[]
): CalculationValidation => ({ valid: false, issues: [...issues] });

function isRecord(
  value: CalculationJson | undefined,
): value is { readonly [key: string]: CalculationJson } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function record(
  value: CalculationJson,
): Readonly<Record<string, CalculationJson>> | undefined {
  return isRecord(value) ? value : undefined;
}
function number(value: CalculationJson | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
function string(value: CalculationJson | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
function list(
  value: CalculationJson | undefined,
): readonly CalculationJson[] | undefined {
  return Array.isArray(value) ? value : undefined;
}
function rows(
  value: CalculationJson | undefined,
): readonly Readonly<Record<string, CalculationJson>>[] {
  return (list(value) ?? []).filter(isRecord);
}
function numbers(
  value: CalculationJson | undefined,
): readonly (number | undefined)[] {
  return (list(value) ?? []).map((item) => number(item));
}
function numberRecord(
  value: CalculationJson | undefined,
): Readonly<Record<string, number>> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === 'number',
    ),
  );
}
function dependency(
  dependencies: Readonly<Record<string, CalculationResult>>,
  id: string,
): Readonly<Record<string, CalculationJson>> {
  return dependencies[id]?.outputs ?? {};
}

/** Requires the listed keys to be present as finite numbers. */
function requireNumbers(
  input: CalculationJson,
  keys: readonly string[],
): CalculationValidation {
  const data = record(input);
  if (data === undefined)
    return invalid({ path: '/', message: 'Input must be an object.' });
  const issues = keys
    .filter((key) => number(data[key]) === undefined)
    .map((key) => ({
      path: `/${key}`,
      message: `${key} is required and must be resolved from the project.`,
    }));
  return issues.length === 0 ? ok() : invalid(...issues);
}

function missingWarning(
  code: string,
  message: string,
  objectIds?: readonly string[],
): CalculationWarning {
  return {
    code,
    severity: 'WARNING',
    message,
    ...(objectIds === undefined ? {} : { objectIds }),
  };
}

function assumption(
  id: string,
  value: CalculationJson,
  source: string,
): CalculationAssumption {
  return { id, value, source };
}

/** Assumptions echoing the method constants carried by the input itself. */
function declaredConstants(
  data: Readonly<Record<string, CalculationJson>>,
  keys: readonly string[],
  source: string,
): readonly CalculationAssumption[] {
  return keys
    .filter((key) => number(data[key]) !== undefined)
    .map((key) => assumption(key, data[key]!, source));
}

export const thermalAdapter: CalculationModule = {
  id: 'thermal',
  version: '2.0.0',
  methodId: 'assembly-u-value-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/thermal',
  inputPaths: ['building.levels.walls', 'assemblies', 'materialLibrary'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.elements).length === 0)
      return invalid({
        path: '/elements',
        message:
          'At least one exterior wall with a resolved assembly is required.',
      });
    return requireNumbers(input, [
      'insideSurfaceResistanceM2KW',
      'outsideSurfaceResistanceM2KW',
    ]);
  },
  calculate(input) {
    const data = record(input)!;
    const method = {
      id: 'assembly-u-value-v1',
      version: '2',
      insideSurfaceResistanceM2KW: number(data.insideSurfaceResistanceM2KW)!,
      outsideSurfaceResistanceM2KW: number(data.outsideSurfaceResistanceM2KW)!,
    };
    const results: ThermalElementResult[] = rows(data.elements).map(
      (element) => {
        const layers = rows(element.layers).map((layer) => {
          const lambdaWmK = number(layer.lambdaWmK);
          return {
            layerId: string(layer.layerId)!,
            materialId: string(layer.materialId)!,
            thicknessM: number(layer.thicknessM)!,
            ...(lambdaWmK === undefined ? {} : { lambdaWmK }),
          };
        });
        return calculateElementTransmission(
          string(element.id)!,
          number(element.areaM2)!,
          layers,
          method,
        );
      },
    );
    const aggregation = aggregateThermalEnvelope({
      elements: results.map((result, index) => {
        const element = rows(data.elements)[index]!;
        const levelId = string(element.levelId);
        return { result, ...(levelId === undefined ? {} : { levelId }) };
      }),
      bridgeMode: 'NONE',
    });
    const totalAreaM2 = results.reduce(
      (total, result) => total + result.netAreaM2,
      0,
    );
    const heatTransferCoefficientWK =
      aggregation.totalHeatTransferCoefficientWK;
    return {
      status: aggregation.status,
      outputs: {
        heatTransferCoefficientWK: heatTransferCoefficientWK ?? null,
        uValueWm2K:
          heatTransferCoefficientWK === undefined || totalAreaM2 === 0
            ? null
            : heatTransferCoefficientWK / totalAreaM2,
        totalAreaM2,
        elements: results.map((result) => ({
          id: result.elementId,
          netAreaM2: result.netAreaM2,
          uValueWm2K: result.uValueWm2K ?? null,
          totalResistanceM2KW: result.totalResistanceM2KW ?? null,
          heatTransferCoefficientWK: result.heatTransferCoefficientWK ?? null,
        })),
        levels: aggregation.levels.map((level) => ({
          id: level.id,
          heatTransferCoefficientWK: level.heatTransferCoefficientWK ?? null,
        })),
      },
      warnings: aggregation.diagnostics.map(({ code, message, layerId }) =>
        missingWarning(
          code,
          message,
          layerId === undefined ? undefined : [layerId],
        ),
      ),
      assumptions: declaredConstants(
        data,
        ['insideSurfaceResistanceM2KW', 'outsideSurfaceResistanceM2KW'],
        'project calculation settings or ISO 6946 surface resistances',
      ),
      references: [
        {
          id: 'iso-6946',
          title:
            'ISO 6946 — Building components, thermal resistance and transmittance',
        },
      ],
    };
  },
};

export const heatingAdapter: CalculationModule = {
  id: 'heating',
  version: '2.0.0',
  methodId: 'design-heating-steady-state-v1',
  precision: 'ENGINEERING',
  dependencies: [{ moduleId: 'thermal', required: true }],
  settingsSchemaId: 'project://calculationSettings/heating',
  inputPaths: [
    'building.levels.spaces',
    'systems.VENTILATION',
    'calculationSettings.heating',
  ],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.rooms).length === 0)
      return invalid({
        path: '/rooms',
        message: 'The project declares no space to compute a heating load for.',
      });
    return requireNumbers(input, [
      'designIndoorTemperatureC',
      'designOutdoorTemperatureC',
      'airDensityKgM3',
      'airSpecificHeatJKgK',
    ]);
  },
  calculate(input, _settings, dependencies) {
    const data = record(input)!;
    const indoorC = number(data.designIndoorTemperatureC)!;
    const outdoorC = number(data.designOutdoorTemperatureC)!;
    const deltaK = indoorC - outdoorC;
    const envelopeH = number(
      dependency(dependencies, 'thermal').heatTransferCoefficientWK,
    );
    const roomRows = rows(data.rooms);
    const totalFloorAreaM2 = roomRows.reduce(
      (total, room) => total + (number(room.floorAreaM2) ?? 0),
      0,
    );
    const recovery = number(data.heatRecoveryEfficiency);
    const warnings: CalculationWarning[] = [];
    if (envelopeH === undefined)
      warnings.push(
        missingWarning(
          'HEATING_MISSING_TRANSMISSION',
          'The thermal module could not resolve the envelope heat transfer coefficient.',
        ),
      );
    if (totalFloorAreaM2 <= 0)
      warnings.push(
        missingWarning(
          'HEATING_MISSING_FLOOR_AREA',
          'Spaces declare no floor area, so envelope losses cannot be allocated per room.',
        ),
      );
    const rooms = roomRows.map((room) => {
      const roomId = string(room.roomId)!;
      const floorAreaM2 = number(room.floorAreaM2);
      const share =
        envelopeH === undefined ||
        floorAreaM2 === undefined ||
        totalFloorAreaM2 <= 0
          ? undefined
          : (envelopeH * floorAreaM2) / totalFloorAreaM2;
      const flowM3h = number(room.ventilationFlowM3h);
      return {
        roomId,
        ...(floorAreaM2 === undefined ? {} : { floorAreaM2 }),
        ...(share === undefined
          ? {}
          : { transmissionHeatTransferCoefficientWK: share }),
        designTemperatureDifferenceK: deltaK,
        ...(flowM3h === undefined
          ? {}
          : { ventilationFlowM3s: flowM3h / 3600 }),
        ...(recovery === undefined
          ? {}
          : { heatRecoveryPresent: true, heatRecoveryEfficiency: recovery }),
        otherW: 0,
      };
    });
    const result = calculateHeatingLoads(rooms, {
      id: 'design-heating-steady-state-v1',
      version: '2',
      airDensityKgM3: number(data.airDensityKgM3)!,
      airSpecificHeatJKgK: number(data.airSpecificHeatJKgK)!,
    });
    const ventilationH = rooms.reduce<number>(
      (total, room) =>
        total +
        (room.ventilationFlowM3s ?? 0) *
          number(data.airDensityKgM3)! *
          number(data.airSpecificHeatJKgK)! *
          (1 - (recovery ?? 0)),
      0,
    );
    return {
      status: result.status,
      outputs: {
        designLoadW: result.designLoadW ?? null,
        designTemperatureDifferenceK: deltaK,
        transmissionHeatTransferCoefficientWK: envelopeH ?? null,
        ventilationHeatTransferCoefficientWK: ventilationH,
        rooms: result.roomLoads.map((room) => ({
          roomId: room.roomId,
          totalW: room.totalW ?? null,
          transmissionW: room.transmissionW ?? null,
          ventilationW: room.ventilationW ?? null,
          wattsPerM2: room.wattsPerM2 ?? null,
        })),
      },
      warnings: [
        ...warnings,
        ...result.diagnostics.map(({ code, message, roomId }) =>
          missingWarning(code, message, [roomId]),
        ),
      ],
      assumptions: [
        assumption(
          'transmissionAllocation',
          'floor-area-prorata',
          'Envelope transmission is allocated to rooms in proportion to their floor area.',
        ),
        assumption(
          'designIndoorTemperatureC',
          indoorC,
          'project calculation settings',
        ),
        assumption(
          'designOutdoorTemperatureC',
          outdoorC,
          'project calculation settings or climate dataset',
        ),
        ...declaredConstants(
          data,
          ['airDensityKgM3', 'airSpecificHeatJKgK'],
          'declared physical constants',
        ),
      ],
      references: [
        {
          id: 'iso-12831',
          title: 'ISO 12831 — Design heat load, steady state',
        },
      ],
    };
  },
};

export const dhwAdapter: CalculationModule = {
  id: 'dhw',
  version: '2.0.0',
  methodId: 'sensible-water-heating-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/dhw',
  inputPaths: ['equipment.DHW_TANK', 'calculationSettings.dhw'],
  validate(input) {
    return requireNumbers(input, [
      'dailyUseVolumeL',
      'coldWaterTemperatureC',
      'useTemperatureC',
      'storageTemperatureC',
      'tankVolumeL',
      'usefulHeatingPowerW',
      'annualOperatingDays',
      'waterDensityKgM3',
      'waterSpecificHeatJKgK',
    ]);
  },
  calculate(input) {
    const data = record(input)!;
    const result = calculateDwh(
      {
        dailyUseVolumeL: number(data.dailyUseVolumeL)!,
        coldWaterTemperatureC: number(data.coldWaterTemperatureC)!,
        useTemperatureC: number(data.useTemperatureC)!,
        storageTemperatureC: number(data.storageTemperatureC)!,
        tankVolumeL: number(data.tankVolumeL)!,
        usefulHeatingPowerW: number(data.usefulHeatingPowerW)!,
        annualOperatingDays: number(data.annualOperatingDays)!,
      },
      {
        id: 'sensible-water-heating-v1',
        version: '2',
        waterDensityKgM3: number(data.waterDensityKgM3)!,
        waterSpecificHeatJKgK: number(data.waterSpecificHeatJKgK)!,
      },
    );
    return {
      status: 'OK',
      outputs: {
        annualUsefulEnergyKWh: result.annualUsefulEnergyKWh ?? null,
        dailyUsefulEnergyKWh: result.dailyUsefulEnergyKWh ?? null,
        requiredStorageL: result.requiredStorageL ?? null,
        tankReheatingEnergyKWh: result.tankReheatingEnergyKWh ?? null,
        reheatingTimeH: result.reheatingTimeH ?? null,
        occupants: number(data.occupants) ?? null,
      },
      assumptions: [
        assumption(
          'dailyUseVolumeL',
          number(data.dailyUseVolumeL)!,
          'occupancy and per-occupant volume from the project calculation settings',
        ),
        ...declaredConstants(
          data,
          ['waterDensityKgM3', 'waterSpecificHeatJKgK'],
          'declared physical constants',
        ),
      ],
      references: [
        {
          id: 'dhw-sensible-heat',
          title: 'Sensible heating of stored domestic hot water',
        },
      ],
    };
  },
};

export const lightingAdapter: CalculationModule = {
  id: 'lighting',
  version: '2.0.0',
  methodId: 'lumen-average-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/lighting',
  inputPaths: [
    'building.levels.spaces',
    'systems.ELECTRICAL',
    'equipment.LUMINAIRE',
  ],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.placements).length === 0)
      return invalid({
        path: '/placements',
        message: 'No luminaire is placed on the electrical network.',
      });
    return requireNumbers(input, ['utilizationFactor', 'maintenanceFactor']);
  },
  calculate(input) {
    const data = record(input)!;
    const utilizationFactor = number(data.utilizationFactor)!;
    const maintenanceFactor = number(data.maintenanceFactor)!;
    const luminaires = rows(data.luminaires)
      .filter(
        (luminaire) =>
          number(luminaire.luminousFluxLm) !== undefined &&
          number(luminaire.electricalPowerW) !== undefined,
      )
      .map((luminaire) => ({
        id: string(luminaire.id)!,
        name: string(luminaire.name) ?? string(luminaire.id)!,
        luminousFluxLm: number(luminaire.luminousFluxLm)!,
        electricalPowerW: number(luminaire.electricalPowerW)!,
        source: {
          sourceType:
            string(luminaire.catalogKind) === 'PRODUCT'
              ? ('MANUFACTURER' as const)
              : ('CATALOG' as const),
          reference: string(luminaire.id)!,
        },
      }));
    const knownLuminaireIds = new Set(luminaires.map(({ id }) => id));
    const placements = rows(data.placements).filter(
      (placement) =>
        string(placement.roomId) !== undefined &&
        knownLuminaireIds.has(string(placement.luminaireId) ?? ''),
    );
    const warnings: CalculationWarning[] = rows(data.placements)
      .filter((placement) => !placements.includes(placement))
      .map((placement) =>
        missingWarning(
          'LIGHTING_UNRESOLVED_PLACEMENT',
          `Luminaire node ${string(placement.id) ?? '?'} has no space or no catalogue entry.`,
          [string(placement.id) ?? ''],
        ),
      );
    const roomResults = rows(data.rooms).flatMap((room) => {
      const roomId = string(room.roomId)!;
      const roomAreaM2 = number(room.roomAreaM2);
      const roomPlacements = placements.filter(
        (placement) => string(placement.roomId) === roomId,
      );
      if (roomPlacements.length === 0) return [];
      if (roomAreaM2 === undefined) {
        warnings.push(
          missingWarning(
            'LIGHTING_MISSING_ROOM_AREA',
            `Space ${string(room.name) ?? roomId} has no derivable floor area.`,
            [roomId],
          ),
        );
        return [];
      }
      const result = calculateLumenMethod({
        roomId,
        roomAreaM2,
        utilizationFactor,
        maintenanceFactor,
        placements: roomPlacements.map((placement) => ({
          id: string(placement.id)!,
          luminaireId: string(placement.luminaireId)!,
          roomId,
          position: {
            x: number(record(placement.position ?? null)?.x) ?? 0,
            y: number(record(placement.position ?? null)?.y) ?? 0,
          },
        })),
        luminaires,
      });
      return [
        {
          roomId,
          name: string(room.name) ?? roomId,
          luminaireCount: result.luminaireCount,
          averageIlluminanceLux: result.averageIlluminanceLux,
          installedPowerW: result.installedPowerW,
          powerDensityWm2: result.powerDensityWm2,
        },
      ];
    });
    const installedPowerW = roomResults.reduce(
      (total, room) => total + room.installedPowerW,
      0,
    );
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        installedPowerW,
        rooms: roomResults,
        operatingHoursPerDay: number(data.operatingHoursPerDay) ?? null,
      },
      warnings,
      assumptions: declaredConstants(
        data,
        ['utilizationFactor', 'maintenanceFactor'],
        'project calculation settings',
      ),
      references: [
        {
          id: 'lumen-method',
          title: 'Average illuminance by the lumen method',
        },
      ],
    };
  },
};

export const ventilationAdapter: CalculationModule = {
  id: 'ventilation',
  version: '2.0.0',
  methodId: 'duct-darcy-weisbach-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/ventilation',
  inputPaths: ['systems.VENTILATION'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.segments).length === 0)
      return invalid({
        path: '/segments',
        message: 'The project has no ventilation duct to size.',
      });
    return requireNumbers(input, ['airDensityKgM3', 'dynamicViscosityPaS']);
  },
  calculate(input) {
    const data = record(input)!;
    const context = {
      methodId: 'darcy-weisbach',
      airDensityKgM3: number(data.airDensityKgM3)!,
      dynamicViscosityPaS: number(data.dynamicViscosityPaS)!,
    };
    const warnings: CalculationWarning[] = [];
    const segments = rows(data.segments).map((segment) => {
      const id = string(segment.id)!;
      const diameterM = number(segment.diameterM);
      const flowM3h = number(segment.flowM3h);
      if (diameterM === undefined || flowM3h === undefined) {
        warnings.push(
          missingWarning(
            'VENTILATION_INCOMPLETE_SEGMENT',
            `Duct ${id} has no diameter or no served design flow.`,
            [id],
          ),
        );
        return {
          id,
          velocityMs: null,
          pressureLossPa: null,
          flowM3h: flowM3h ?? null,
        };
      }
      const lengthM = number(segment.lengthM)!;
      const result = calculateDuctAirflow(
        {
          duct: {
            id,
            fromPortId: `${id}:from`,
            toPortId: `${id}:to`,
            path: [
              { x: 0, y: 0, z: 0 },
              { x: lengthM * 1000, y: 0, z: 0 },
            ],
            kind: 'DUCT',
            properties: {
              airRole: 'SUPPLY',
              shape: 'ROUND',
              diameterM,
              roughnessM: number(segment.roughnessM)!,
              localLossCoefficient: number(segment.localLossCoefficient) ?? 0,
            },
          },
          flowM3h,
        },
        context,
      );
      return {
        id,
        flowM3h,
        lengthM,
        diameterM,
        velocityMs: result.velocityMs ?? null,
        pressureLossPa: result.totalPressureLossPa ?? null,
      };
    });
    const totalPressureLossPa = segments.reduce<number>(
      (total, segment) => total + (number(segment.pressureLossPa) ?? 0),
      0,
    );
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        segments,
        totalPressureLossPa,
        terminals: rows(data.terminals).map((terminal) => ({ ...terminal })),
        designFlowM3h: rows(data.terminals).reduce<number>(
          (total, terminal) => total + (number(terminal.targetFlowM3h) ?? 0),
          0,
        ),
      },
      warnings,
      assumptions: declaredConstants(
        data,
        ['airDensityKgM3', 'dynamicViscosityPaS'],
        'declared physical constants',
      ),
      references: [
        { id: 'darcy-weisbach', title: 'Darcy–Weisbach duct pressure loss' },
      ],
    };
  },
};

export const iaqAdapter: CalculationModule = {
  id: 'iaq',
  version: '2.0.0',
  methodId: 'co2-mass-balance-v1',
  precision: 'ENGINEERING',
  dependencies: [{ moduleId: 'ventilation', required: false }],
  settingsSchemaId: 'project://calculationSettings/iaq',
  inputPaths: ['building.levels.spaces', 'systems.VENTILATION'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.rooms).length === 0)
      return invalid({
        path: '/rooms',
        message:
          'The project declares no space to assess indoor air quality in.',
      });
    return requireNumbers(input, [
      'co2GenerationM3sPerOccupant',
      'initialConcentrationPpm',
      'durationHours',
      'outdoorConcentrationPpm',
    ]);
  },
  calculate(input) {
    const data = record(input)!;
    const generationPerOccupant = number(data.co2GenerationM3sPerOccupant)!;
    const durationHours = number(data.durationHours)!;
    const steps = Math.max(1, Math.round(durationHours));
    const warnings: CalculationWarning[] = [];
    const rooms = rows(data.rooms).flatMap((room) => {
      const roomId = string(room.roomId)!;
      const volumeM3 = number(room.volumeM3);
      const flowM3h = number(room.flowM3h);
      const occupants = number(room.occupants);
      if (
        volumeM3 === undefined ||
        flowM3h === undefined ||
        occupants === undefined
      ) {
        warnings.push(
          missingWarning(
            'IAQ_INCOMPLETE_ROOM',
            `Space ${string(room.name) ?? roomId} lacks a volume, a ventilation flow or an occupancy.`,
            [roomId],
          ),
        );
        return [];
      }
      const result = simulateCo2Balance({
        roomId,
        roomVolumeM3: volumeM3,
        timeStepSeconds: 3600,
        initialConcentrationPpm: number(data.initialConcentrationPpm)!,
        outdoorConcentrationPpm: number(data.outdoorConcentrationPpm)!,
        generationM3s: Array.from(
          { length: steps },
          () => generationPerOccupant * occupants,
        ),
        ventilationFlowM3h: Array.from({ length: steps }, () => flowM3h),
      });
      return [
        {
          roomId,
          name: string(room.name) ?? roomId,
          occupants,
          volumeM3,
          flowM3h,
          finalConcentrationPpm: result.finalConcentrationPpm ?? null,
          maximumConcentrationPpm: result.maximumConcentrationPpm ?? null,
        },
      ];
    });
    const peaks = rooms
      .map((room) => number(room.maximumConcentrationPpm))
      .filter((value): value is number => value !== undefined);
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        rooms,
        peakConcentrationPpm: peaks.length === 0 ? null : Math.max(...peaks),
      },
      warnings,
      assumptions: [
        ...declaredConstants(
          data,
          [
            'co2GenerationM3sPerOccupant',
            'initialConcentrationPpm',
            'durationHours',
          ],
          'project calculation settings',
        ),
        ...declaredConstants(
          data,
          ['outdoorConcentrationPpm'],
          'declared outdoor background concentration',
        ),
        assumption(
          'occupancyProfile',
          'constant',
          'Occupancy and CO₂ generation are held constant over the simulated duration.',
        ),
      ],
      references: [
        { id: 'co2-mass-balance', title: 'Single-zone CO₂ mass balance' },
      ],
    };
  },
};

export const waterAdapter: CalculationModule = {
  id: 'water',
  version: '2.0.0',
  methodId: 'pipe-darcy-weisbach-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/water',
  inputPaths: ['systems.WATER'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.segments).length === 0)
      return invalid({
        path: '/segments',
        message: 'The project has no water pipe to size.',
      });
    return requireNumbers(input, [
      'fluidDensityKgM3',
      'dynamicViscosityPaS',
      'gravityMs2',
      'simultaneityFactor',
    ]);
  },
  calculate(input) {
    const data = record(input)!;
    const context = {
      fluidDensityKgM3: number(data.fluidDensityKgM3)!,
      dynamicViscosityPaS: number(data.dynamicViscosityPaS)!,
      gravityMs2: number(data.gravityMs2)!,
      methodId: 'darcy-weisbach',
    };
    const warnings: CalculationWarning[] = [];
    const segments = rows(data.segments).map((segment) => {
      const id = string(segment.id)!;
      const internalDiameterM = number(segment.internalDiameterM);
      const flowM3s = number(segment.flowM3s);
      if (
        internalDiameterM === undefined ||
        flowM3s === undefined ||
        flowM3s <= 0
      ) {
        warnings.push(
          missingWarning(
            'WATER_INCOMPLETE_SEGMENT',
            `Pipe ${id} has no internal diameter or no served design flow.`,
            [id],
          ),
        );
        return { id, velocityMs: null, pressureLossPa: null };
      }
      const result = calculatePipeHydraulics(
        {
          segmentId: id,
          lengthM: number(segment.lengthM)!,
          internalDiameterM,
          flowM3s,
          roughnessM: number(segment.roughnessM)!,
          localLossCoefficient: number(segment.localLossCoefficient) ?? 0,
        },
        context,
      );
      return {
        id,
        internalDiameterM,
        flowM3s,
        lengthM: number(segment.lengthM)!,
        velocityMs: result.velocityMs ?? null,
        pressureLossPa: result.totalPressureLossPa ?? null,
      };
    });
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        segments,
        totalPressureLossPa: segments.reduce<number>(
          (total, segment) => total + (number(segment.pressureLossPa) ?? 0),
          0,
        ),
        maximumVelocityMs: segments.reduce<number | null>((peak, segment) => {
          const velocity = number(segment.velocityMs);
          if (velocity === undefined) return peak;
          return peak === null ? velocity : Math.max(peak, velocity);
        }, null),
      },
      warnings,
      assumptions: [
        ...declaredConstants(
          data,
          ['fluidDensityKgM3', 'dynamicViscosityPaS', 'gravityMs2'],
          'declared physical constants',
        ),
        ...declaredConstants(
          data,
          ['simultaneityFactor'],
          'project calculation settings',
        ),
      ],
      references: [
        { id: 'darcy-weisbach', title: 'Darcy–Weisbach pipe pressure loss' },
      ],
    };
  },
};

export const wastewaterAdapter: CalculationModule = {
  id: 'wastewater',
  version: '2.0.0',
  methodId: 'discharge-unit-gravity-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/wastewater',
  inputPaths: ['systems.WASTEWATER'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.edges).length === 0)
      return invalid({
        path: '/edges',
        message: 'The project has no gravity pipe to assess.',
      });
    return requireNumbers(input, ['designFlowM3sPerDischargeUnit']);
  },
  calculate(input) {
    const data = record(input)!;
    const perUnit = number(data.designFlowM3sPerDischargeUnit)!;
    const minimumSlope = number(data.minimumSlope);
    const network = {
      id: string(data.networkId) ?? 'wastewater',
      discipline: 'WASTEWATER' as const,
      systemType: 'COMBINED_WASTEWATER' as const,
      nodes: rows(data.nodes).map((node) => {
        const dischargeUnits = number(node.dischargeUnits);
        const position = record(node.position ?? null)!;
        return {
          id: string(node.id)!,
          kind: string(node.kind) as 'FIXTURE',
          position: {
            x: number(position.x)!,
            y: number(position.y)!,
            z: number(position.z)!,
          },
          ...(dischargeUnits === undefined ? {} : { dischargeUnits }),
        };
      }),
      ports: rows(data.ports).map((port) => ({
        id: string(port.id)!,
        nodeId: string(port.nodeId)!,
        role: string(port.role)!,
        direction: string(port.direction) as 'IN' | 'OUT' | 'BIDIRECTIONAL',
      })),
      edges: rows(data.edges).map((edge) => {
        const internalDiameterM = number(edge.internalDiameterM);
        return {
          id: string(edge.id)!,
          kind: 'GRAVITY_PIPE' as const,
          fromPortId: string(edge.fromPortId)!,
          toPortId: string(edge.toPortId)!,
          path: rows(edge.path).map((point) => ({
            x: number(point.x)!,
            y: number(point.y)!,
            z: number(point.z)!,
          })),
          properties:
            internalDiameterM === undefined ? {} : { internalDiameterM },
        };
      }),
    };
    const result = analyzeWastewaterNetwork(network, {
      id: 'discharge-unit-gravity-v1',
      version: '2',
      designFlowM3s: (units) => units * perUnit,
    });
    const warnings: CalculationWarning[] = result.diagnostics.map(
      ({ code, message, entityId, severity }) => ({
        code,
        severity: severity === 'ERROR' ? 'ERROR' : 'WARNING',
        message,
        objectIds: [entityId],
      }),
    );
    const belowMinimum =
      minimumSlope === undefined
        ? []
        : result.segments.filter(
            (segment) =>
              segment.slope !== undefined && segment.slope < minimumSlope,
          );
    for (const segment of belowMinimum)
      warnings.push(
        missingWarning(
          'WASTEWATER_SLOPE_BELOW_MINIMUM',
          `Segment ${segment.segmentId} slopes at ${segment.slope!.toFixed(4)}, under the configured minimum ${minimumSlope!}.`,
          [segment.segmentId],
        ),
      );
    return {
      status:
        result.status === 'OK' && belowMinimum.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        segments: result.segments.map((segment) => ({
          id: segment.segmentId,
          slope: segment.slope ?? null,
          designFlowM3s: segment.designFlowM3s ?? null,
          lengthM: segment.lengthM ?? null,
          totalDischargeUnits: segment.totalDischargeUnits ?? null,
        })),
        totalDischargeUnits: rows(data.nodes).reduce<number>(
          (total, node) => total + (number(node.dischargeUnits) ?? 0),
          0,
        ),
      },
      warnings,
      assumptions: declaredConstants(
        data,
        ['designFlowM3sPerDischargeUnit', 'minimumSlope'],
        'project calculation settings',
      ),
      references: [
        {
          id: 'discharge-units',
          title: 'Discharge-unit method for gravity drainage',
        },
      ],
    };
  },
};

export const rainwaterAdapter: CalculationModule = {
  id: 'rainwater',
  version: '2.0.0',
  methodId: 'tank-water-balance-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/rainwater',
  inputPaths: [
    'building.levels.roofs',
    'equipment.RAINWATER_TANK',
    'site.climate',
  ],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.surfaces).length === 0)
      return invalid({
        path: '/surfaces',
        message: 'The project declares no roof plane to collect rain from.',
      });
    if (list(data.precipitationMm) === undefined)
      return invalid({
        path: '/precipitationMm',
        message: 'A climate dataset with precipitation is required.',
      });
    return requireNumbers(input, ['nominalVolumeL', 'dailyDemandL']);
  },
  calculate(input) {
    const data = record(input)!;
    const periods = (list(data.periods) ?? []).map((period) => string(period)!);
    const precipitation = numbers(data.precipitationMm);
    const hours = numbers(data.periodHours);
    const dailyDemandL = number(data.dailyDemandL)!;
    const climate: ClimateDataset = {
      id: string(data.climateDatasetId) ?? 'project-climate',
      location: { latitude: 0, longitude: 0, timezone: 'UTC' },
      resolution: 'MONTHLY',
      source: {
        id: string(data.climateDatasetId) ?? 'project',
        provider: 'PROJECT',
      },
      samples: periods.map((timestamp, index) => ({
        timestamp,
        ...(precipitation[index] === undefined
          ? {}
          : { precipitationMm: precipitation[index] }),
      })),
    };
    const demandSeriesL = periods.map((_, index) => {
      const periodHours = hours[index];
      return periodHours === undefined ? 0 : (dailyDemandL * periodHours) / 24;
    });
    const result = simulateRainwater({
      climate,
      surfaces: rows(data.surfaces).map((surface) => ({
        surfaceId: string(surface.surfaceId)!,
        projectedAreaM2: number(surface.projectedAreaM2)!,
        runoffCoefficient: number(surface.runoffCoefficient)!,
        preFilterEfficiency: number(surface.preFilterEfficiency)!,
        enabled: true,
      })),
      demands: [{ useType: 'NON_POTABLE', demandSeriesL }],
      mainsTopUpSeriesL: periods.map(() => 0),
      tank: {
        nominalVolumeL: number(data.nominalVolumeL)!,
        initialVolumeL: number(data.initialVolumeL) ?? 0,
      },
    });
    return {
      status: result.status === 'OK' ? 'OK' : 'PARTIAL',
      outputs: {
        collectedL: result.indicators?.collectedL ?? null,
        demandL: result.indicators?.demandL ?? null,
        servedL: result.indicators?.servedL ?? null,
        shortageL: result.indicators?.shortageL ?? null,
        overflowL: result.indicators?.overflowL ?? null,
        coverageRatio: result.indicators?.coverageRatio ?? null,
        emptyStepCount: result.indicators?.emptyStepCount ?? null,
        storageL: result.steps.map((step) => step.storageL),
        periods,
      },
      warnings: result.diagnostics.map(({ code, message, path }) =>
        missingWarning(code, `${path}: ${message}`),
      ),
      assumptions: [
        ...declaredConstants(
          data,
          ['dailyDemandL', 'nominalVolumeL', 'initialVolumeL'],
          'project calculation settings and rainwater tank equipment',
        ),
        assumption(
          'demandProfile',
          'uniform-daily',
          'Non-potable demand is spread uniformly across each climate period.',
        ),
      ],
      references: [
        { id: 'rain-water-balance', title: 'Rainwater tank water balance' },
      ],
    };
  },
};

export const photovoltaicAdapter: CalculationModule = {
  id: 'photovoltaic',
  version: '2.0.0',
  methodId: 'offline-pv-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/photovoltaic',
  inputPaths: [
    'equipment.PHOTOVOLTAIC',
    'building.levels.roofs',
    'site.climate',
  ],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    const irradiation = numbers(data.irradiationWhM2);
    if (
      irradiation.length === 0 ||
      irradiation.some((value) => value === undefined)
    )
      return invalid({
        path: '/irradiationWhM2',
        message:
          'A complete irradiation series from the climate dataset is required.',
      });
    return requireNumbers(input, ['installedPowerWp', 'performanceRatio']);
  },
  async calculate(input) {
    const data = record(input)!;
    const periods = (list(data.periods) ?? []).map((period) => string(period)!);
    const irradiation = numbers(data.irradiationWhM2).map((value) => value!);
    const result = await offlineSimplePvBackend.calculate({
      installedPowerWp: number(data.installedPowerWp)!,
      planeIrradiation: irradiation.map((value, index) => ({
        period: periods[index] ?? String(index),
        irradiationWhM2: value,
      })),
      performanceRatio: number(data.performanceRatio)!,
      source: {
        provider: string(data.climateProvider) ?? 'PROJECT',
        ...(string(data.climateDatasetId) === undefined
          ? {}
          : { datasetId: string(data.climateDatasetId)! }),
      },
    });
    const dispatchPeriods = (list(data.dispatchPeriods) ?? []).map((period) =>
      string(period)!,
    );
    const dispatchIrradiation = numbers(data.dispatchIrradiationWhM2);
    const dispatch =
      dispatchPeriods.length === 0 ||
      dispatchIrradiation.some((value) => value === undefined)
        ? undefined
        : await offlineSimplePvBackend.calculate({
            installedPowerWp: number(data.installedPowerWp)!,
            planeIrradiation: dispatchIrradiation.map((value, index) => ({
              period: dispatchPeriods[index] ?? String(index),
              irradiationWhM2: value!,
            })),
            performanceRatio: number(data.performanceRatio)!,
            source: {
              provider: string(data.climateProvider) ?? 'PROJECT',
              ...(string(data.dispatchClimateDatasetId) === undefined
                ? {}
                : { datasetId: string(data.dispatchClimateDatasetId)! }),
            },
          });
    return {
      status: 'OK',
      outputs: {
        periods,
        generationWh: result.periods.map(({ energyKWh }) => energyKWh * 1000),
        annualGenerationKWh: result.periods.reduce(
          (total, { energyKWh }) => total + energyKWh,
          0,
        ),
        dispatchPeriods,
        dispatchGenerationWh:
          dispatch === undefined
            ? null
            : dispatch.periods.map(({ energyKWh }) => energyKWh * 1000),
        installedPowerWp: number(data.installedPowerWp)!,
        ...(number(data.availableAreaM2) === undefined
          ? {}
          : { roofAreaM2: number(data.availableAreaM2)! }),
      },
      assumptions: [
        ...declaredConstants(
          data,
          ['performanceRatio'],
          'project calculation settings',
        ),
        assumption(
          'planeIrradiation',
          'global-horizontal',
          'Plane-of-array irradiation is taken as the global horizontal irradiance of the dataset; no transposition to the roof tilt is applied.',
        ),
      ],
      references: [
        {
          id: 'pv-simple-yield',
          title: 'Simplified performance-ratio photovoltaic yield',
        },
      ],
    };
  },
};

export const batteryAdapter: CalculationModule = {
  id: 'battery',
  version: '2.0.0',
  methodId: 'battery-configuration-v1',
  precision: 'ENGINEERING',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/battery',
  inputPaths: ['equipment.BATTERY'],
  validate(input) {
    return requireNumbers(input, [
      'usableCapacityKWh',
      'minimumSoc',
      'maximumSoc',
      'initialSoc',
      'maxChargePowerKW',
      'maxDischargePowerKW',
      'chargeEfficiency',
      'dischargeEfficiency',
    ]);
  },
  calculate(input) {
    const data = record(input)!;
    const hours = numbers(data.periodHours);
    const uniformStep =
      hours.length > 0 && hours.every((value) => value === hours[0])
        ? hours[0]
        : undefined;
    const warnings: CalculationWarning[] = [];
    if (uniformStep === undefined)
      warnings.push(
        missingWarning(
          'BATTERY_NO_UNIFORM_TIME_STEP',
          'Storage dispatch needs a uniform sub-daily time step; the energy ledger will report storage as not assessed.',
        ),
      );
    return {
      status: uniformStep === undefined ? 'PARTIAL' : 'OK',
      outputs: {
        usableCapacityKWh: number(data.usableCapacityKWh)!,
        minimumSoc: number(data.minimumSoc)!,
        maximumSoc: number(data.maximumSoc)!,
        initialSoc: number(data.initialSoc)!,
        maxChargePowerKW: number(data.maxChargePowerKW)!,
        maxDischargePowerKW: number(data.maxDischargePowerKW)!,
        chargeEfficiency: number(data.chargeEfficiency)!,
        dischargeEfficiency: number(data.dischargeEfficiency)!,
        roundTripEfficiency:
          number(data.chargeEfficiency)! * number(data.dischargeEfficiency)!,
        offGrid: data.offGrid === true,
        timeStepHours: uniformStep ?? null,
        periods: list(data.periods) ?? [],
      },
      warnings,
      assumptions: [],
      references: [
        {
          id: 'battery-dispatch',
          title: 'Self-consumption battery dispatch model',
        },
      ],
    };
  },
};

export const energyBalanceAdapter: CalculationModule = {
  id: 'energy-balance',
  version: '2.0.0',
  methodId: 'physical-energy-balance-v1',
  precision: 'ENGINEERING',
  dependencies: [
    { moduleId: 'heating', required: true },
    { moduleId: 'lighting', required: true },
    { moduleId: 'dhw', required: true },
    { moduleId: 'photovoltaic', required: true },
    { moduleId: 'battery', required: false },
    { moduleId: 'ventilation', required: false },
  ],
  settingsSchemaId: 'project://calculationSettings/energy-balance',
  inputPaths: [
    'site.climate',
    'equipment',
    'calculationSettings.energy-balance',
  ],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    const hours = numbers(data.periodHours);
    if (hours.length === 0 || hours.some((value) => value === undefined))
      return invalid({
        path: '/periodHours',
        message:
          'A climate dataset with resolvable period durations is required.',
      });
    if (hours.some((value) => value !== hours[0]))
      return invalid({
        path: '/periodHours',
        message: 'The energy ledger requires a uniform time step.',
      });
    return requireNumbers(input, ['heatingSetpointTemperatureC']);
  },
  calculate(input, _settings, dependencies) {
    const data = record(input)!;
    const hours = numbers(data.periodHours).map((value) => value!);
    const stepHours = hours[0]!;
    const periods = (list(data.periods) ?? []).map((period) => string(period)!);
    const outdoor = numbers(data.outdoorTemperatureC);
    const setpointC = number(data.heatingSetpointTemperatureC)!;
    const warnings: CalculationWarning[] = [];

    const heating = dependency(dependencies, 'heating');
    const transmissionH = number(heating.transmissionHeatTransferCoefficientWK);
    const ventilationH = number(heating.ventilationHeatTransferCoefficientWK);
    const heatingH =
      transmissionH === undefined
        ? undefined
        : transmissionH + (ventilationH ?? 0);
    if (heatingH === undefined)
      warnings.push(
        missingWarning(
          'ENERGY_MISSING_HEATING_COEFFICIENT',
          'The heating module could not resolve a building heat transfer coefficient.',
        ),
      );
    const heatingWh = periods.map((_, index) => {
      const outdoorC = outdoor[index];
      if (heatingH === undefined || outdoorC === undefined) return undefined;
      return heatingH * Math.max(0, setpointC - outdoorC) * stepHours;
    });
    if (heatingWh.some((value) => value === undefined))
      warnings.push(
        missingWarning(
          'ENERGY_MISSING_OUTDOOR_TEMPERATURE',
          'The climate dataset has gaps in its outdoor temperature series.',
        ),
      );

    const lightingPowerW = number(
      dependency(dependencies, 'lighting').installedPowerW,
    );
    const operatingHoursPerDay = number(
      dependency(dependencies, 'lighting').operatingHoursPerDay,
    );
    const lightingWh = periods.map(() =>
      lightingPowerW === undefined || operatingHoursPerDay === undefined
        ? undefined
        : (lightingPowerW * operatingHoursPerDay * stepHours) / 24,
    );
    if (lightingWh.some((value) => value === undefined))
      warnings.push(
        missingWarning(
          'ENERGY_MISSING_LIGHTING_PROFILE',
          'Lighting operating hours are not declared, so lighting energy is unknown.',
        ),
      );

    const annualDhwKWh = number(
      dependency(dependencies, 'dhw').annualUsefulEnergyKWh,
    );
    const totalHours = stepHours * periods.length;
    const dhwWh = periods.map(() =>
      annualDhwKWh === undefined || totalHours === 0
        ? undefined
        : (annualDhwKWh * 1000 * stepHours) / (365 * 24),
    );

    const fanPowerW = number(data.ventilationFanPowerW) ?? 0;
    const ventilationWh = periods.map(() => fanPowerW * stepHours);

    const pv = dependency(dependencies, 'photovoltaic');
    const pvPeriods = (list(pv.dispatchPeriods) ?? []).map((period) =>
      string(period)!,
    );
    const pvGeneration = numbers(pv.dispatchGenerationWh);
    const pvAligned = pvPeriods.length === periods.length;
    const pvWh = periods.map((_period, index) =>
      pvAligned ? (pvGeneration[index] ?? 0) : 0,
    );
    if (!pvAligned && pvPeriods.length > 0)
      warnings.push(
        missingWarning(
          'ENERGY_PV_PERIOD_MISMATCH',
          `Photovoltaic production is reported over ${pvPeriods.length} dispatch periods while the ledger runs over ${periods.length}; it is excluded from this balance.`,
        ),
      );

    const batteryOutputs = dependency(dependencies, 'battery');
    const batteryStep = number(batteryOutputs.timeStepHours);
    const batteryUsable = number(batteryOutputs.usableCapacityKWh);
    const storageAssessed =
      batteryUsable !== undefined && batteryStep === stepHours;
    if (batteryUsable !== undefined && !storageAssessed)
      warnings.push(
        missingWarning(
          'ENERGY_STORAGE_NOT_ASSESSED',
          'The battery time step does not match the ledger time step; storage dispatch is not assessed.',
        ),
      );

    const series = (values: readonly (number | undefined)[]) => ({
      timestepSeconds: stepHours * 3600,
      start: periods[0] ?? 'period-0',
      unit: 'Wh' as const,
      values,
    });
    const result = calculateEnergyBalance({
      scenarioId: string(data.scenarioId) ?? 'project',
      uses: [
        {
          id: 'heating',
          usage: 'HEATING',
          vector: 'ELECTRICITY',
          series: series(heatingWh),
        },
        {
          id: 'dhw',
          usage: 'DHW',
          vector: 'ELECTRICITY',
          series: series(dhwWh),
        },
        {
          id: 'lighting',
          usage: 'LIGHTING',
          vector: 'ELECTRICITY',
          series: series(lightingWh),
        },
        {
          id: 'ventilation',
          usage: 'VENTILATION',
          vector: 'ELECTRICITY',
          series: series(ventilationWh),
        },
      ],
      pvElectricity: series(pvWh),
      ...(storageAssessed
        ? {
            battery: {
              usableCapacityKWh: batteryUsable,
              minimumSoc: number(batteryOutputs.minimumSoc)!,
              maximumSoc: number(batteryOutputs.maximumSoc)!,
              initialSoc: number(batteryOutputs.initialSoc)!,
              maxChargePowerKW: number(batteryOutputs.maxChargePowerKW)!,
              maxDischargePowerKW: number(batteryOutputs.maxDischargePowerKW)!,
              chargeEfficiency: number(batteryOutputs.chargeEfficiency)!,
              dischargeEfficiency: number(batteryOutputs.dischargeEfficiency)!,
            },
          }
        : {}),
      offGrid: batteryOutputs.offGrid === true,
    });
    return {
      status:
        result.status === 'OK'
          ? warnings.length === 0
            ? 'OK'
            : 'PARTIAL'
          : result.status === 'UNKNOWN'
            ? 'PARTIAL'
            : 'FAILED',
      outputs: {
        periods,
        timeStepHours: stepHours,
        climateDatasetId: string(data.climateDatasetId) ?? null,
        resolution: string(data.resolution) ?? null,
        storageAssessed,
        totalByUsageWh: result.totalByUsageWh ?? null,
        totalElectricLoadWh: result.totalElectricLoadWh ?? null,
        totalPvWh: result.totalPvWh ?? null,
        peakElectricPowerW: result.peakElectricPowerW ?? null,
        gridImportWh: result.gridImportWh ?? null,
        gridExportWh: result.gridExportWh ?? null,
        selfConsumptionRatio: result.selfConsumptionRatio ?? null,
        selfSufficiencyRatio: result.selfSufficiencyRatio ?? null,
        conservationResidualWh: result.conservationResidualWh ?? null,
        finalStoredEnergyKWh:
          result.batteryDispatch?.finalStoredEnergyKWh ?? null,
        stateOfCharge:
          result.batteryDispatch?.steps.map((step) => step.stateOfCharge) ??
          null,
        heatingWh: heatingWh.map((value) => value ?? null),
        lightingWh: lightingWh.map((value) => value ?? null),
        dhwWh: dhwWh.map((value) => value ?? null),
        ventilationWh: ventilationWh.map((value) => value ?? null),
        pvWh: pvWh.map((value) => value ?? null),
      },
      warnings: [
        ...warnings,
        ...result.diagnostics.map(({ code, message, path }) =>
          missingWarning(code, `${path}: ${message}`),
        ),
      ],
      assumptions: [
        assumption(
          'heatingEnergyMethod',
          'degree-hours-v1',
          'Heating energy is the building heat transfer coefficient times the positive setpoint-to-outdoor temperature difference over each period; solar and internal gains are not credited.',
        ),
        assumption(
          'dhwProfile',
          'uniform-annual',
          'Domestic hot water energy is spread uniformly over the year.',
        ),
        assumption(
          'ventilationProfile',
          'continuous',
          'Ventilation fans are assumed to run continuously at their nominal power.',
        ),
        ...declaredConstants(
          data,
          ['heatingSetpointTemperatureC'],
          'project calculation settings',
        ),
      ],
      references: [
        {
          id: 'energy-ledger',
          title: 'Physical final-energy balance with storage',
        },
      ],
    };
  },
};

export const hygrothermalAdapter: CalculationModule = {
  id: 'hygrothermal',
  version: '2.0.0',
  methodId: 'glaser-steady-state-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/hygrothermal',
  inputPaths: ['assemblies', 'materialLibrary', 'site.climate'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.assemblies).length === 0)
      return invalid({
        path: '/assemblies',
        message: 'At least one exterior assembly is required.',
      });
    return requireNumbers(input, [
      'indoorTemperatureC',
      'indoorRelativeHumidity',
      'outdoorTemperatureC',
      'outdoorRelativeHumidity',
      'interiorSurfaceResistanceM2KW',
      'exteriorSurfaceResistanceM2KW',
    ]);
  },
  calculate(input) {
    const data = record(input)!;
    const warnings: CalculationWarning[] = [];
    const assessments = rows(data.assemblies).flatMap((assembly) => {
      const assemblyId = string(assembly.assemblyId)!;
      const layers = rows(assembly.layers).map((layer) => ({
        id: string(layer.id)!,
        thicknessM: number(layer.thicknessM)!,
        lambdaWmK: number(layer.lambdaWmK),
        mu: number(layer.mu),
      }));
      if (
        layers.some(
          ({ lambdaWmK, mu }) => lambdaWmK === undefined || mu === undefined,
        )
      ) {
        warnings.push(
          missingWarning(
            'HYGROTHERMAL_INCOMPLETE_LAYERS',
            `Assembly ${assemblyId} has layers without a conductivity or a vapour resistance factor.`,
            [assemblyId],
          ),
        );
        return [];
      }
      const result = assessSteadyStateHygrothermal({
        assemblyId,
        period: string(data.period) ?? 'design-winter',
        layers: layers.map((layer) => ({
          id: layer.id,
          thicknessM: layer.thicknessM,
          thermalResistanceM2KW: layer.thicknessM / layer.lambdaWmK!,
          mu: layer.mu!,
        })),
        indoorTemperatureC: number(data.indoorTemperatureC)!,
        indoorRelativeHumidity: number(data.indoorRelativeHumidity)!,
        outdoorTemperatureC: number(data.outdoorTemperatureC)!,
        outdoorRelativeHumidity: number(data.outdoorRelativeHumidity)!,
        interiorSurfaceResistanceM2KW: number(
          data.interiorSurfaceResistanceM2KW,
        )!,
        exteriorSurfaceResistanceM2KW: number(
          data.exteriorSurfaceResistanceM2KW,
        )!,
      });
      return [
        {
          assemblyId,
          elementId: string(assembly.elementId) ?? assemblyId,
          applicability: result.applicability,
          condensationRisk: result.interfaces.some((item) => item.condensation),
          interfaces: result.interfaces.map((item) => ({
            interfaceIndex: item.interfaceIndex,
            afterLayerId: item.afterLayerId ?? null,
            temperatureC: item.temperatureC,
            saturationPressurePa: item.saturationPressurePa,
            vaporPressurePa: item.vaporPressurePa,
            relativeHumidity: item.relativeHumidity,
            condensation: item.condensation,
          })),
        },
      ];
    });
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        assemblies: assessments,
        condensationRiskCount: assessments.filter(
          ({ condensationRisk }) => condensationRisk,
        ).length,
      },
      warnings: [
        ...warnings,
        missingWarning(
          'HYGROTHERMAL_METHOD_LIMITS',
          'Steady-state vapour diffusion only: no moisture storage, no air leakage, no rain, no dynamic drying.',
        ),
      ],
      assumptions: [
        ...declaredConstants(
          data,
          [
            'indoorTemperatureC',
            'indoorRelativeHumidity',
            'outdoorTemperatureC',
            'outdoorRelativeHumidity',
          ],
          'project calculation settings and climate dataset',
        ),
        ...declaredConstants(
          data,
          ['interiorSurfaceResistanceM2KW', 'exteriorSurfaceResistanceM2KW'],
          'ISO 6946 surface resistances',
        ),
      ],
      references: [
        {
          id: 'iso-13788',
          title: 'ISO 13788 — Glaser steady-state assessment',
        },
      ],
    };
  },
};

export const acousticsAdapter: CalculationModule = {
  id: 'acoustics',
  version: '2.0.0',
  methodId: 'sabine-reverberation-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/acoustics',
  inputPaths: ['building.levels.spaces', 'materialLibrary'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.rooms).length === 0)
      return invalid({
        path: '/rooms',
        message: 'The project declares no space to assess.',
      });
    const bands = numbers(data.bandsHz);
    if (
      bands.length === 0 ||
      bands.some(
        (band) =>
          band === undefined ||
          !(OCTAVE_BANDS_HZ as readonly number[]).includes(band),
      )
    )
      return invalid({
        path: '/bandsHz',
        message: `Declare the octave bands to assess (${OCTAVE_BANDS_HZ.join(', ')} Hz) in the module settings.`,
      });
    return requireNumbers(input, ['reverberationConstant']);
  },
  calculate(input) {
    const data = record(input)!;
    const bands = numbers(data.bandsHz)
      .map((band) => band!)
      .filter((band): band is OctaveBandHz =>
        (OCTAVE_BANDS_HZ as readonly number[]).includes(band),
      );
    const defaults = numberRecord(data.defaultSurfaceAbsorption);
    const warnings: CalculationWarning[] = [];
    const rooms = rows(data.rooms).flatMap((room) => {
      const roomId = string(room.roomId)!;
      const volumeM3 = number(room.volumeM3);
      const floorAreaM2 = number(room.floorAreaM2);
      const wallAreaM2 = number(room.wallAreaM2);
      if (
        volumeM3 === undefined ||
        floorAreaM2 === undefined ||
        wallAreaM2 === undefined
      ) {
        warnings.push(
          missingWarning(
            'ACOUSTICS_INCOMPLETE_ROOM',
            `Space ${string(room.name) ?? roomId} has no derivable volume or surfaces.`,
            [roomId],
          ),
        );
        return [];
      }
      const absorptionByBand = Object.fromEntries(
        bands.map((band) => [String(band), defaults[String(band)] ?? 0]),
      );
      if (Object.values(absorptionByBand).every((value) => value === 0))
        warnings.push(
          missingWarning(
            'ACOUSTICS_MISSING_ABSORPTION',
            `No surface absorption is declared for ${string(room.name) ?? roomId}; reverberation cannot be assessed.`,
            [roomId],
          ),
        );
      const result = calculateRoomAcoustics(
        {
          roomId,
          volumeM3,
          surfaces: [
            {
              surfaceId: `${roomId}:floor`,
              areaM2: floorAreaM2,
              absorptionCoefficientByBand: absorptionByBand,
            },
            {
              surfaceId: `${roomId}:ceiling`,
              areaM2: floorAreaM2,
              absorptionCoefficientByBand: absorptionByBand,
            },
            {
              surfaceId: `${roomId}:walls`,
              areaM2: wallAreaM2,
              absorptionCoefficientByBand: absorptionByBand,
            },
          ],
        },
        {
          id: 'sabine-reverberation-v1',
          version: '2',
          reverberationConstant: number(data.reverberationConstant)!,
          bandsHz: bands,
          assumptions: [
            'Diffuse field, uniform absorption over floor, ceiling and walls.',
          ],
        },
      );
      return [
        {
          roomId,
          name: string(room.name) ?? roomId,
          volumeM3,
          bands: result.bands.map((band) => ({
            bandHz: band.bandHz,
            reverberationTimeS: band.reverberationTimeS ?? null,
            equivalentAbsorptionAreaM2: band.equivalentAbsorptionAreaM2 ?? null,
          })),
        },
      ];
    });
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: { rooms, bandsHz: bands },
      warnings,
      assumptions: [
        ...declaredConstants(
          data,
          ['reverberationConstant'],
          'Sabine method constant',
        ),
        assumption(
          'surfaceComposition',
          'floor-ceiling-walls',
          'Room surfaces are derived from the space polygon and the storey height; furniture and openings are not modelled.',
        ),
      ],
      references: [{ id: 'sabine', title: 'Sabine reverberation time' }],
    };
  },
};

export const costAdapter: CalculationModule = {
  id: 'cost',
  version: '2.0.0',
  methodId: 'quantity-priced-estimate-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/cost',
  inputPaths: ['quantities', 'calculationSettings.cost'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.quantities).length === 0)
      return invalid({
        path: '/quantities',
        message: 'The project takeoff produced no priced quantity.',
      });
    if (!isRecord(data.unitPriceByMaterial))
      return invalid({
        path: '/unitPriceByMaterial',
        message:
          'Declare unit prices per material in the cost module settings.',
      });
    return ok();
  },
  calculate(input) {
    const data = record(input)!;
    const prices = numberRecord(data.unitPriceByMaterial);
    const waste = numberRecord(data.wasteFactorByMaterial);
    const currency = string(data.currency) ?? 'EUR';
    const lines = rows(data.quantities);
    const priced = lines.filter(
      (line) => prices[string(line.materialId) ?? ''] !== undefined,
    );
    const warnings = lines
      .filter((line) => !priced.includes(line))
      .map((line) =>
        missingWarning(
          'COST_MISSING_PRICE',
          `No unit price is declared for material ${string(line.materialId) ?? '?'}.`,
          [string(line.sourceEntityId) ?? ''],
        ),
      );
    const result = calculateCostEstimate(
      priced.map((line) => ({
        itemId: string(line.itemId)!,
        sourceEntityId: string(line.sourceEntityId)!,
        value: number(line.value)!,
        unit: string(line.unit) as 'm3',
        lot: 'ENVELOPE' as const,
      })),
      priced.map((line) => {
        const materialId = string(line.materialId)!;
        const wasteFactor = waste[materialId];
        return {
          itemId: string(line.itemId)!,
          materialPricePerUnit: prices[materialId]!,
          currency,
          priceUnit: string(line.unit) as 'm3',
          ...(wasteFactor === undefined ? {} : { wasteFactor }),
          source: {
            sourceType: 'USER' as const,
            reference: 'project calculation settings',
          },
        };
      }),
    );
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        totalCost: result.totalCost ?? null,
        currency: result.currency ?? currency,
        lots: result.lots.map((lot) => ({
          lot: lot.lot,
          totalCost: lot.totalCost ?? null,
        })),
        lines: result.lines.map((line) => ({
          itemId: line.itemId,
          sourceEntityId: line.sourceEntityId,
          physicalQuantity: line.physicalQuantity,
          orderedQuantity: line.orderedQuantity ?? null,
          totalCost: line.totalCost ?? null,
        })),
      },
      warnings: [
        ...warnings,
        ...result.diagnostics.map(({ code, message, itemId }) =>
          missingWarning(
            code,
            message,
            itemId === undefined ? undefined : [itemId],
          ),
        ),
      ],
      assumptions: [
        assumption(
          'priceSource',
          'project calculation settings',
          'Unit prices are user-declared and carry no supplier quotation.',
        ),
      ],
      references: [],
    };
  },
};

export const environmentalAdapter: CalculationModule = {
  id: 'environmental',
  version: '2.0.0',
  methodId: 'declaration-linked-impact-v1',
  precision: 'ESTIMATE',
  dependencies: [],
  settingsSchemaId: 'project://calculationSettings/environmental',
  inputPaths: ['quantities', 'calculationSettings.environmental'],
  validate(input) {
    const data = record(input);
    if (data === undefined)
      return invalid({ path: '/', message: 'Input must be an object.' });
    if (rows(data.quantities).length === 0)
      return invalid({
        path: '/quantities',
        message: 'The project takeoff produced no quantity to assess.',
      });
    if (!isRecord(data.gwpPerUnitByMaterial))
      return invalid({
        path: '/gwpPerUnitByMaterial',
        message: 'Declare impact factors per material in the module settings.',
      });
    if (string(data.declarationSource) === undefined)
      return invalid({
        path: '/declarationSource',
        message:
          'Environmental factors must name the declaration they come from.',
      });
    return ok();
  },
  calculate(input) {
    const data = record(input)!;
    const impacts = numberRecord(data.gwpPerUnitByMaterial);
    const source = string(data.declarationSource)!;
    const indicator = string(data.indicator) ?? 'GWP';
    const validAt = string(data.validAt) ?? '1970-01-01';
    const lines = rows(data.quantities);
    const covered = lines.filter(
      (line) => impacts[string(line.materialId) ?? ''] !== undefined,
    );
    const warnings = lines
      .filter((line) => !covered.includes(line))
      .map((line) =>
        missingWarning(
          'ENV_MISSING_DECLARATION',
          `No environmental declaration covers material ${string(line.materialId) ?? '?'}.`,
          [string(line.sourceEntityId) ?? ''],
        ),
      );
    const result = calculateEnvironmentalImpacts(
      covered.map((line) => ({
        itemId: string(line.itemId)!,
        projectObjectId: string(line.sourceEntityId)!,
        materialId: string(line.materialId)!,
        lot: 'ENVELOPE',
        value: number(line.value)!,
        unit: string(line.unit) as 'm3',
      })),
      covered.map((line) => ({
        projectObjectId: string(line.sourceEntityId)!,
        declarationId: `declaration:${string(line.materialId)!}`,
        declarationType: 'DED' as const,
        projectQuantityUnit: string(line.unit) as 'm3',
        functionalUnit: string(line.unit)!,
        conversionFactor: 1,
      })),
      [...new Set(covered.map((line) => string(line.materialId)!))].map(
        (materialId) => ({
          id: `declaration:${materialId}`,
          type: 'DED' as const,
          version: '1',
          functionalUnit: 'm3',
          indicator,
          indicatorUnit: 'kgCO2e/m3',
          impactsByStage: { PRODUCT: impacts[materialId]! },
          source,
        }),
      ),
      validAt,
    );
    return {
      status: warnings.length === 0 ? 'OK' : 'PARTIAL',
      outputs: {
        totalImpact: result.totalImpact ?? null,
        indicator,
        indicatorUnit: 'kgCO2e/m3',
        declarationSource: source,
        items: result.items.map((item) => ({
          itemId: item.itemId,
          projectObjectId: item.projectObjectId,
          totalImpact: item.totalImpact ?? null,
        })),
      },
      warnings: [
        ...warnings,
        ...result.diagnostics.map(({ code, message, itemId }) =>
          missingWarning(
            code,
            message,
            itemId === undefined ? undefined : [itemId],
          ),
        ),
        missingWarning(
          'ENV_GENERIC_DATA',
          `Impacts come from default environmental data (${source}) and must not be read as manufacturer declarations.`,
        ),
      ],
      assumptions: [
        assumption(
          'lifeCycleStages',
          'PRODUCT',
          'Only the product stage is accounted for; construction, use and end of life are excluded.',
        ),
      ],
      references: [],
    };
  },
};

/** Modules fed entirely from persisted project facts, scenarios and datasets. */
export const PROJECT_CALCULATION_MODULES = [
  thermalAdapter,
  heatingAdapter,
  dhwAdapter,
  lightingAdapter,
  ventilationAdapter,
  iaqAdapter,
  waterAdapter,
  wastewaterAdapter,
  rainwaterAdapter,
  photovoltaicAdapter,
  batteryAdapter,
  energyBalanceAdapter,
  hygrothermalAdapter,
  acousticsAdapter,
  costAdapter,
  environmentalAdapter,
] as const;

/** @deprecated Use {@link PROJECT_CALCULATION_MODULES}. */
export const REFERENCE_INTEGRATION_MODULES = PROJECT_CALCULATION_MODULES;

export type { ModuleCalculation };
