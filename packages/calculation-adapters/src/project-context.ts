import type {
  EquipmentDefinition,
  JsonValue,
  Project,
  Space,
  TechnicalNetwork,
  Zone,
} from '@house-technical-designer/core-domain';
import type {
  Assembly,
  AssemblyLayer,
} from '@house-technical-designer/assemblies';
import type { Material } from '@house-technical-designer/materials';
import {
  numericValue,
  squareMillimetres,
  squareMillimetresToSquareMetres,
} from '@house-technical-designer/units';
import type { CalculationJson } from '@house-technical-designer/calculation-core';

export interface ProjectWallCalculationElement {
  readonly wallId: string;
  readonly assemblyId: string;
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
}

export interface ProjectRoofCalculationElement {
  readonly roofId: string;
  readonly assemblyId: string;
  readonly projectedAreaM2: number;
  readonly surfaceAreaM2: number;
  readonly slopeDeg: number;
  readonly azimuthDeg: number;
}

/** Canonical, immutable selection of persisted project facts used by calculators. */
export interface ProjectCalculationContext {
  readonly projectId: string;
  readonly climateProfileId?: string;
  readonly materials: readonly Material[];
  readonly assemblies: readonly Assembly[];
  readonly exteriorWalls: readonly ProjectWallCalculationElement[];
  readonly spaces: readonly Space[];
  readonly zones: readonly Zone[];
  readonly roofs: readonly ProjectRoofCalculationElement[];
  readonly systems: readonly TechnicalNetwork[];
  readonly photovoltaic?: EquipmentDefinition;
  readonly battery?: EquipmentDefinition;
}

export interface ProjectCalculationRunSettings {
  readonly designDeltaK: number;
  readonly irradiationWhM2: readonly number[];
  readonly timeStepHours: number;
  readonly lightingPowerW: number;
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

function materialLayers(
  assembly: Assembly,
  materials: ReadonlyMap<string, Material>,
): readonly ProjectThermalLayer[] {
  return assembly.layers.map((layer: AssemblyLayer) => {
    const lambdaWmK = materials.get(layer.materialId)?.properties.lambdaWmK;
    return {
      layerId: layer.id,
      materialId: layer.materialId,
      thicknessM: layer.thicknessM,
      ...(typeof lambdaWmK === 'number' ? { lambdaWmK } : {}),
    };
  });
}

export function createProjectCalculationContext(
  project: Project,
): ProjectCalculationContext {
  const materials = project.materialLibrary?.materials ?? [];
  const assemblies = project.assemblies ?? [];
  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );
  const assemblyById = new Map(
    assemblies.map((assembly) => [assembly.id, assembly]),
  );
  const exteriorWalls: ProjectWallCalculationElement[] = [];
  const spaces: Space[] = [];
  const roofs: ProjectRoofCalculationElement[] = [];

  for (const level of project.building.levels) {
    spaces.push(...level.spaces);
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
      const grossAreaM2 = numericValue(
        squareMillimetresToSquareMetres(squareMillimetres(lengthMm * heightMm)),
      );
      const openingAreaMm2 = level.openings
        .filter((opening) => opening.hostElementId === wall.id)
        .reduce(
          (area, opening) => area + opening.widthMm * opening.heightMm,
          0,
        );
      const openingAreaM2 = numericValue(
        squareMillimetresToSquareMetres(squareMillimetres(openingAreaMm2)),
      );
      exteriorWalls.push({
        wallId: wall.id,
        assemblyId: assembly.id,
        grossAreaM2,
        openingAreaM2,
        netAreaM2: grossAreaM2 - openingAreaM2,
        layers: materialLayers(assembly, materialById),
      });
    }
    for (const roof of level.roofs) {
      const projectedAreaM2 = numericValue(
        squareMillimetresToSquareMetres(
          squareMillimetres(polygonAreaMm2(roof.footprint.outer)),
        ),
      );
      roofs.push({
        roofId: roof.id,
        assemblyId: roof.assemblyId,
        projectedAreaM2,
        surfaceAreaM2:
          projectedAreaM2 / Math.cos((roof.slopeDeg * Math.PI) / 180),
        slopeDeg: roof.slopeDeg,
        azimuthDeg: roof.azimuthDeg,
      });
    }
  }

  const equipment = project.equipment ?? [];
  return {
    projectId: project.id,
    ...(project.site.climateProfileId === undefined
      ? {}
      : { climateProfileId: project.site.climateProfileId }),
    materials,
    assemblies,
    exteriorWalls,
    spaces,
    zones: project.building.zones,
    roofs,
    systems: project.systems ?? [],
    ...(equipment.find(({ kind }) => kind === 'PHOTOVOLTAIC') === undefined
      ? {}
      : {
          photovoltaic: equipment.find(({ kind }) => kind === 'PHOTOVOLTAIC')!,
        }),
    ...(equipment.find(({ kind }) => kind === 'BATTERY') === undefined
      ? {}
      : { battery: equipment.find(({ kind }) => kind === 'BATTERY')! }),
  };
}

function finiteProperty(
  equipment: EquipmentDefinition | undefined,
  property: string,
): number | undefined {
  const value: JsonValue | undefined = equipment?.properties[property];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

/** Builds orchestrator inputs without copying physical facts into UI state. */
export function buildProjectCalculationInputs(
  context: ProjectCalculationContext,
  settings: ProjectCalculationRunSettings,
): Readonly<Record<string, CalculationJson>> {
  const installedPowerWp = finiteProperty(
    context.photovoltaic,
    'installedPowerWp',
  );
  const usableCapacityKWh = finiteProperty(
    context.battery,
    'usableCapacityKWh',
  );
  return {
    thermal: {
      elements: context.exteriorWalls.map((wall) => ({
        id: wall.wallId,
        areaM2: wall.netAreaM2,
        layers: wall.layers.map((layer) => ({ ...layer })),
      })),
    },
    heating: { designDeltaK: settings.designDeltaK },
    lighting: { powerW: settings.lightingPowerW },
    photovoltaic: {
      ...(installedPowerWp === undefined ? {} : { installedPowerWp }),
      irradiationWhM2: settings.irradiationWhM2,
    },
    battery: {
      hours: settings.timeStepHours,
      ...(usableCapacityKWh === undefined ? {} : { usableCapacityKWh }),
    },
    'energy-balance': {},
  };
}
