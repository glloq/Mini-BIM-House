import type {
  EquipmentDefinition,
  JsonValue,
  Level,
  NetworkProductSnapshot,
  Project,
  ResolvedPlacedEquipment,
  Space,
  TechnicalNetwork,
  Zone,
} from '@house-technical-designer/core-domain';
import {
  allRoofPlanes,
  placedEquipment,
  placedEquipmentByFamily,
  placedEquipmentByKind,
  placedEquipmentBySpace,
} from '@house-technical-designer/core-domain';
import type {
  Assembly,
  AssemblyLayer,
} from '@house-technical-designer/assemblies';
import type { Material } from '@house-technical-designer/materials';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  numericValue,
  squareMillimetres,
  squareMillimetresToSquareMetres,
} from '@house-technical-designer/units';
import { calculateWallQuantities } from '@house-technical-designer/quantities';
import { ProjectCalculationSettings } from './calculation-settings.js';

export interface ProjectWallCalculationElement {
  readonly wallId: string;
  readonly assemblyId: string;
  readonly levelId: string;
  readonly grossAreaM2: number;
  readonly openingAreaM2: number;
  readonly netAreaM2: number;
  readonly layers: readonly ProjectThermalLayer[];
}

export interface ProjectThermalLayer {
  readonly layerId: string;
  readonly materialId: string;
  readonly thicknessM: number;
  readonly lambdaWmK?: number;
  readonly mu?: number;
}

export interface ProjectRoofCalculationElement {
  readonly roofId: string;
  readonly assemblyId: string;
  readonly levelId: string;
  readonly projectedAreaM2: number;
  readonly surfaceAreaM2: number;
  readonly slopeDeg: number;
  readonly azimuthDeg: number;
}

/** A space with the derived geometry calculators need, never persisted. */
export interface ProjectSpaceCalculationElement {
  readonly spaceId: string;
  readonly levelId: string;
  readonly name: string;
  readonly category: string;
  readonly usageProfileId?: string;
  readonly thermalZoneId?: string;
  readonly floorAreaM2?: number;
  readonly perimeterM?: number;
  readonly heightM?: number;
  readonly volumeM3?: number;
}

/** Design and time-series conditions read from an identified climate dataset. */
export interface ProjectClimateContext {
  readonly datasetId: string;
  readonly sourceId: string;
  readonly provider: string;
  readonly resolution: ClimateDataset['resolution'];
  readonly periods: readonly string[];
  readonly airTemperatureC: readonly (number | undefined)[];
  readonly precipitationMm: readonly (number | undefined)[];
  readonly globalHorizontalIrradianceWhM2: readonly (number | undefined)[];
  readonly relativeHumidity: readonly (number | undefined)[];
  /** Coldest sampled outdoor air temperature; undefined when unsampled. */
  readonly minimumAirTemperatureC?: number;
  readonly meanRelativeHumidity?: number;
}

export interface ProjectQuantityLine {
  readonly itemId: string;
  readonly sourceEntityId: string;
  readonly materialId?: string;
  readonly value: number;
  readonly unit: string;
  readonly quantityType: string;
}

/** Canonical, immutable selection of persisted project facts used by calculators. */
export interface ProjectCalculationContext {
  readonly projectId: string;
  readonly scenarioId?: string;
  readonly climateProfileId?: string;
  readonly climate?: ProjectClimateContext;
  /**
   * Finest uniform sub-daily dataset available, used by the modules that need a
   * regular time step (storage dispatch, hourly ledgers).
   */
  readonly subDailyClimate?: ProjectClimateContext;
  readonly materials: readonly Material[];
  readonly assemblies: readonly Assembly[];
  readonly exteriorWalls: readonly ProjectWallCalculationElement[];
  readonly spaces: readonly ProjectSpaceCalculationElement[];
  readonly rawSpaces: readonly Space[];
  readonly zones: readonly Zone[];
  readonly roofs: readonly ProjectRoofCalculationElement[];
  readonly systems: readonly TechnicalNetwork[];
  readonly networksByDiscipline: Readonly<
    Record<string, readonly TechnicalNetwork[]>
  >;
  readonly equipment: readonly EquipmentDefinition[];
  readonly equipmentByKind: Readonly<
    Record<string, readonly EquipmentDefinition[]>
  >;
  /**
   * The things actually standing in the building, model and placement
   * together.
   *
   * The context used to offer the catalogue entries alone, so a project with
   * three radiators and a project with one were the same project as far as
   * every calculation was concerned, and moving something changed nothing.
   * Whatever depends on how many there are, or on where they are, reads these.
   */
  /**
   * The products this project holds, which is what its runs are made of.
   *
   * Read before the catalogue installed today: correcting a tube must not
   * resize a network somebody drew six months ago.
   */
  readonly networkProducts: readonly NetworkProductSnapshot[];
  readonly placedEquipment: readonly ResolvedPlacedEquipment[];
  readonly placedEquipmentByFamily: Readonly<
    Record<string, readonly ResolvedPlacedEquipment[]>
  >;
  readonly placedEquipmentByKind: Readonly<
    Record<string, readonly ResolvedPlacedEquipment[]>
  >;
  readonly placedEquipmentBySpace: Readonly<
    Record<string, readonly ResolvedPlacedEquipment[]>
  >;
  readonly quantities: readonly ProjectQuantityLine[];
  readonly photovoltaic?: EquipmentDefinition;
  readonly battery?: EquipmentDefinition;
  readonly settings: ProjectCalculationSettings;
}

export interface ProjectCalculationContextOptions {
  /**
   * External climate datasets for the site. The dataset matching
   * `site.climateProfileId` becomes the primary one; an hourly dataset is used
   * additionally by the modules that require a uniform sub-daily time step.
   * Without any dataset the climate-dependent modules report missing inputs
   * instead of assuming weather.
   */
  readonly climate?: ClimateDataset | readonly ClimateDataset[];
  readonly scenarioId?: string;
}

function polygonAreaMm2(
  points: readonly { readonly x: number; readonly y: number }[],
): number {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

function polygonPerimeterMm(
  points: readonly { readonly x: number; readonly y: number }[],
): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    total += Math.hypot(next.x - current.x, next.y - current.y);
  }
  return total;
}

function squareMetres(areaMm2: number): number {
  return numericValue(
    squareMillimetresToSquareMetres(squareMillimetres(areaMm2)),
  );
}

function materialLayers(
  assembly: Assembly,
  materials: ReadonlyMap<string, Material>,
): readonly ProjectThermalLayer[] {
  return assembly.layers.map((layer: AssemblyLayer) => {
    const properties = materials.get(layer.materialId)?.properties;
    const lambdaWmK = properties?.lambdaWmK;
    const mu = properties?.mu;
    return {
      layerId: layer.id,
      materialId: layer.materialId,
      thicknessM: layer.thicknessM,
      ...(typeof lambdaWmK === 'number' ? { lambdaWmK } : {}),
      ...(typeof mu === 'number' ? { mu } : {}),
    };
  });
}

function spaceElement(
  space: Space,
  level: Level,
): ProjectSpaceCalculationElement {
  const polygon =
    space.boundaryMode === 'MANUAL' ? space.manualPolygon : undefined;
  const floorAreaM2 =
    polygon === undefined
      ? undefined
      : squareMetres(polygonAreaMm2(polygon.outer));
  const perimeterM =
    polygon === undefined
      ? undefined
      : polygonPerimeterMm(polygon.outer) / 1000;
  const heightM = level.defaultStoreyHeightMm / 1000;
  return {
    spaceId: space.id,
    levelId: level.id,
    name: space.name,
    category: space.category,
    ...(space.usageProfileId === undefined
      ? {}
      : { usageProfileId: space.usageProfileId }),
    ...(space.thermalZoneId === undefined
      ? {}
      : { thermalZoneId: space.thermalZoneId }),
    ...(floorAreaM2 === undefined ? {} : { floorAreaM2 }),
    ...(perimeterM === undefined ? {} : { perimeterM }),
    ...(Number.isFinite(heightM) && heightM > 0 ? { heightM } : {}),
    ...(floorAreaM2 === undefined || !Number.isFinite(heightM) || heightM <= 0
      ? {}
      : { volumeM3: floorAreaM2 * heightM }),
  };
}

function climateContext(dataset: ClimateDataset): ProjectClimateContext {
  const periods = dataset.samples.map(
    (sample, index) => sample.timestamp ?? String(index),
  );
  const airTemperatureC = dataset.samples.map(
    ({ airTemperatureC: value }) => value,
  );
  const relativeHumidity = dataset.samples.map(
    ({ relativeHumidity: value }) => value,
  );
  const knownTemperatures = airTemperatureC.filter(
    (value): value is number => typeof value === 'number',
  );
  const knownHumidity = relativeHumidity.filter(
    (value): value is number => typeof value === 'number',
  );
  return {
    datasetId: dataset.id,
    sourceId: dataset.source.id,
    provider: dataset.source.provider,
    resolution: dataset.resolution,
    periods,
    airTemperatureC,
    relativeHumidity,
    precipitationMm: dataset.samples.map(({ precipitationMm: value }) => value),
    globalHorizontalIrradianceWhM2: dataset.samples.map(
      ({ globalHorizontalIrradianceWhM2: value }) => value,
    ),
    ...(knownTemperatures.length === 0
      ? {}
      : { minimumAirTemperatureC: Math.min(...knownTemperatures) }),
    ...(knownHumidity.length === 0
      ? {}
      : {
          meanRelativeHumidity:
            knownHumidity.reduce((total, value) => total + value, 0) /
            knownHumidity.length,
        }),
  };
}

function groupBy<T>(
  items: readonly T[],
  key: (item: T) => string,
): Readonly<Record<string, readonly T[]>> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const bucket = grouped[key(item)] ?? [];
    bucket.push(item);
    grouped[key(item)] = bucket;
  }
  return grouped;
}

export function createProjectCalculationContext(
  project: Project,
  options: ProjectCalculationContextOptions = {},
): ProjectCalculationContext {
  const settings = ProjectCalculationSettings.fromProject(project);
  const materials = project.materialLibrary?.materials ?? [];
  const assemblies = project.assemblies ?? [];
  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );
  const assemblyById = new Map(
    assemblies.map((assembly) => [assembly.id, assembly]),
  );
  const exteriorWalls: ProjectWallCalculationElement[] = [];
  const spaces: ProjectSpaceCalculationElement[] = [];
  const rawSpaces: Space[] = [];
  const roofs: ProjectRoofCalculationElement[] = [];

  for (const level of project.building.levels) {
    rawSpaces.push(...level.spaces);
    spaces.push(...level.spaces.map((space) => spaceElement(space, level)));
    for (const wall of level.walls) {
      if (wall.role !== 'EXTERIOR') continue;
      const assembly = assemblyById.get(wall.assemblyId);
      if (assembly === undefined) continue;
      const heightMm =
        wall.heightMode === 'EXPLICIT' ? wall.heightMm : undefined;
      if (heightMm === undefined) continue;
      let lengthMm = 0;
      for (let index = 1; index < wall.path.points.length; index += 1) {
        const previous = wall.path.points[index - 1]!;
        const current = wall.path.points[index]!;
        lengthMm += Math.hypot(current.x - previous.x, current.y - previous.y);
      }
      const grossAreaM2 = squareMetres(lengthMm * heightMm);
      const openingAreaMm2 = level.openings
        .filter((opening) => opening.hostElementId === wall.id)
        .reduce(
          (area, opening) => area + opening.widthMm * opening.heightMm,
          0,
        );
      const openingAreaM2 = squareMetres(openingAreaMm2);
      exteriorWalls.push({
        wallId: wall.id,
        assemblyId: assembly.id,
        levelId: level.id,
        grossAreaM2,
        openingAreaM2,
        netAreaM2: grossAreaM2 - openingAreaM2,
        layers: materialLayers(assembly, materialById),
      });
    }
    for (const roof of allRoofPlanes(level)) {
      const projectedAreaM2 = squareMetres(
        polygonAreaMm2(roof.footprint.outer),
      );
      roofs.push({
        roofId: roof.id,
        assemblyId: roof.assemblyId,
        levelId: level.id,
        projectedAreaM2,
        surfaceAreaM2:
          projectedAreaM2 / Math.cos((roof.slopeDeg * Math.PI) / 180),
        slopeDeg: roof.slopeDeg,
        azimuthDeg: roof.azimuthDeg,
      });
    }
  }

  const equipment = project.equipment ?? [];
  const placed = placedEquipment(project);
  const systems = project.systems ?? [];
  const quantityResult = calculateWallQuantities(
    project.building.levels.flatMap((level) => [...level.walls]),
    project.building.levels.flatMap((level) => [...level.openings]),
    assemblies,
    materials,
  );
  const datasets =
    options.climate === undefined
      ? []
      : Array.isArray(options.climate)
        ? [...(options.climate as readonly ClimateDataset[])]
        : [options.climate as ClimateDataset];
  const primaryDataset =
    datasets.find(({ id }) => id === project.site.climateProfileId) ??
    datasets.find(({ resolution }) => resolution !== 'HOURLY') ??
    datasets[0];
  const subDailyDataset = datasets.find(
    ({ resolution }) => resolution === 'HOURLY',
  );
  const climate =
    primaryDataset === undefined ? undefined : climateContext(primaryDataset);
  const subDailyClimate =
    subDailyDataset === undefined ? undefined : climateContext(subDailyDataset);

  return {
    projectId: project.id,
    ...(options.scenarioId === undefined
      ? {}
      : { scenarioId: options.scenarioId }),
    ...(project.site.climateProfileId === undefined
      ? {}
      : { climateProfileId: project.site.climateProfileId }),
    ...(climate === undefined ? {} : { climate }),
    ...(subDailyClimate === undefined ? {} : { subDailyClimate }),
    materials,
    assemblies,
    exteriorWalls,
    spaces,
    rawSpaces,
    zones: project.building.zones,
    roofs,
    systems,
    networksByDiscipline: groupBy(systems, ({ discipline }) => discipline),
    equipment,
    equipmentByKind: groupBy(equipment, ({ kind }) => kind),
    networkProducts: project.networkProducts ?? [],
    placedEquipment: placed,
    placedEquipmentByFamily: placedEquipmentByFamily(placed),
    placedEquipmentByKind: placedEquipmentByKind(placed),
    placedEquipmentBySpace: placedEquipmentBySpace(placed),
    quantities: quantityResult.items.map((item) => ({
      itemId: item.id,
      sourceEntityId: item.sourceEntityId,
      ...(item.materialId === undefined ? {} : { materialId: item.materialId }),
      value: item.value,
      unit: item.unit,
      quantityType: item.quantityType,
    })),
    ...(equipment.find(({ kind }) => kind === 'PHOTOVOLTAIC') === undefined
      ? {}
      : {
          photovoltaic: equipment.find(({ kind }) => kind === 'PHOTOVOLTAIC')!,
        }),
    ...(equipment.find(({ kind }) => kind === 'BATTERY') === undefined
      ? {}
      : { battery: equipment.find(({ kind }) => kind === 'BATTERY')! }),
    settings,
  };
}

/** Reads a finite numeric equipment property, recording where it came from. */
export function equipmentNumber(
  context: ProjectCalculationContext,
  equipment: EquipmentDefinition | undefined,
  property: string,
  moduleId: string,
): number | undefined {
  const value: JsonValue | undefined = equipment?.properties[property];
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  context.settings.note(moduleId, property, 'EQUIPMENT', equipment!.id);
  return value;
}
