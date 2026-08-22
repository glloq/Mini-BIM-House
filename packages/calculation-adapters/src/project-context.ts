import type {
  EquipmentDefinition,
  JsonValue,
  Level,
  NetworkProductSnapshot,
  Project,
  EnvelopeElement,
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
  resolveEnvelope,
  resolveRoofGeometry,
  resolveSpaceGeometry,
  resolveWallGeometry,
} from '@house-technical-designer/core-domain';
import type {
  Assembly,
  AssemblyLayer,
} from '@house-technical-designer/assemblies';
import type { Material } from '@house-technical-designer/materials';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  calculateWallQuantities,
  networkRunQuantities,
  placedEquipmentQuantities,
} from '@house-technical-designer/quantities';
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
  /**
   * Why this room has no geometry, when it has none.
   *
   * A room that cannot be measured is not a room of zero square metres: the
   * modules report it as a missing input and this says what to fix.
   */
  readonly unresolvedGeometry?: string;
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
  /** How the line was arrived at, so a reader can tell a wall from a run. */
  readonly methodId: string;
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
  /**
   * Everything that separates the heated house from the outside, the ground
   * and the unheated: walls, the windows and doors cut through them, roofs
   * and the slabs that actually close the house.
   */
  readonly envelope: readonly EnvelopeElement[];
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

/**
 * A room, as the one answer the project has about its geometry.
 *
 * It used to read `manualPolygon` and nothing else, so a room drawn by the
 * walls around it reached every calculation with no surface, no perimeter and
 * no volume — visible on the plan, absent from the heating, the air quality,
 * the lighting and the acoustics.
 */
function spaceElement(
  space: Space,
  level: Level,
): ProjectSpaceCalculationElement {
  const resolved = resolveSpaceGeometry(space, level);
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
    ...(resolved.floorAreaM2 === undefined
      ? {}
      : { floorAreaM2: resolved.floorAreaM2 }),
    ...(resolved.perimeterM === undefined
      ? {}
      : { perimeterM: resolved.perimeterM }),
    ...(resolved.heightM === undefined ? {} : { heightM: resolved.heightM }),
    ...(resolved.volumeM3 === undefined ? {} : { volumeM3: resolved.volumeM3 }),
    ...(resolved.unresolved === undefined
      ? {}
      : { unresolvedGeometry: resolved.unresolved }),
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
      // The one answer about how high a wall stands. Reading only `heightMm`
      // left every wall built up to a storey out of the envelope: the house
      // computed had fewer walls than the house on the screen.
      const resolved = resolveWallGeometry(project, wall, level);
      if (
        resolved.grossAreaM2 === undefined ||
        resolved.netAreaM2 === undefined
      )
        continue;
      exteriorWalls.push({
        wallId: wall.id,
        assemblyId: assembly.id,
        levelId: level.id,
        grossAreaM2: resolved.grossAreaM2,
        openingAreaM2: resolved.openingAreaM2,
        netAreaM2: resolved.netAreaM2,
        layers: materialLayers(assembly, materialById),
      });
    }
    for (const roof of allRoofPlanes(level)) {
      const resolved = resolveRoofGeometry(roof, level);
      roofs.push({
        roofId: roof.id,
        assemblyId: roof.assemblyId,
        levelId: level.id,
        projectedAreaM2: resolved.projectedAreaM2,
        surfaceAreaM2: resolved.surfaceAreaM2,
        slopeDeg: resolved.slopeDeg,
        azimuthDeg: resolved.azimuthDeg,
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
    envelope: resolveEnvelope(project),
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
    quantities: [
      ...quantityResult.items,
      // What the house holds, counted, and how much of each product it runs.
      // A bill of materials that knew only how much concrete a house contains
      // could say nothing about the twelve radiators standing in it, nor about
      // the forty metres of tube feeding them.
      ...placedEquipmentQuantities(placed),
      ...networkRunQuantities(systems.flatMap(({ edges }) => edges)),
    ].map((item) => ({
      itemId: item.id,
      sourceEntityId: item.sourceEntityId,
      ...(item.materialId === undefined ? {} : { materialId: item.materialId }),
      value: item.value,
      unit: item.unit,
      quantityType: item.quantityType,
      methodId: item.trace.methodId,
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
