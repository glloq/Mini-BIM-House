import type { Assembly } from '@house-technical-designer/assemblies';
import {
  calculateWallNetArea,
  resolveRoofGeometry,
  type Opening,
  type Wall,
} from '@house-technical-designer/core-domain';
import {
  polygonArea,
  polylineLength,
  type Polygon2D,
} from '@house-technical-designer/geometry';
import type { Material } from '@house-technical-designer/materials';
import {
  millimetres,
  millimetresToMetres,
  numericValue,
  squareMillimetres,
  squareMillimetresToSquareMetres,
} from '@house-technical-designer/units';

/**
 * What a quantity measures.
 *
 * `COUNT` is not a measurement of the building but of what is in it: three
 * radiators are three radiators whatever their volume, and a bill of materials
 * that only knew how much concrete a house holds could say nothing about the
 * things standing in it.
 */
export type QuantityType = 'LENGTH' | 'AREA' | 'VOLUME' | 'MASS' | 'COUNT';
export type QuantityLevel = 'GEOMETRIC' | 'NET';
export interface QuantityTrace {
  readonly methodId:
    | 'wall-quantities-v1'
    | 'surface-quantities-v1'
    | 'placed-equipment-v1'
    | 'network-run-v1';
  readonly sourceEntityIds: readonly string[];
  readonly formula: string;
}
export interface QuantityItem {
  readonly id: string;
  readonly sourceEntityId: string;
  readonly materialId?: string;
  readonly assemblyId?: string;
  readonly quantityType: QuantityType;
  readonly level: QuantityLevel;
  readonly value: number;
  readonly unit: 'm' | 'm2' | 'm3' | 'kg' | 'u';
  readonly trace: QuantityTrace;
}
export interface QuantityWarning {
  readonly code:
    | 'UNKNOWN_HEIGHT'
    | 'MISSING_ASSEMBLY'
    | 'INVALID_OPENING'
    | 'MISSING_MATERIAL'
    | 'MISSING_DENSITY';
  readonly sourceEntityId: string;
  readonly message: string;
}
export interface QuantityResult {
  readonly status: 'OK' | 'PARTIAL';
  readonly items: readonly QuantityItem[];
  readonly warnings: readonly QuantityWarning[];
}

export function calculateWallQuantities(
  walls: readonly Wall[],
  openings: readonly Opening[],
  assemblies: readonly Assembly[],
  materials: readonly Material[],
): QuantityResult {
  const items: QuantityItem[] = [];
  const warnings: QuantityWarning[] = [];
  const assemblyById = new Map(
    assemblies.map((assembly) => [assembly.id, assembly]),
  );
  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );
  for (const wall of walls) {
    const lengthM = numericValue(
      millimetresToMetres(
        millimetres(
          polylineLength({ points: wall.path.points, closed: false }),
        ),
      ),
    );
    items.push(
      item(
        `${wall.id}:length`,
        wall,
        'LENGTH',
        'GEOMETRIC',
        lengthM,
        'm',
        'reference path length',
      ),
    );
    if (wall.heightMode !== 'EXPLICIT') {
      warnings.push({
        code: 'UNKNOWN_HEIGHT',
        sourceEntityId: wall.id,
        message: 'Wall height requires level resolution.',
      });
      continue;
    }
    const hostedOpenings = openings.filter(({ host }) => host.id === wall.id);
    const area = calculateWallNetArea(wall, hostedOpenings);
    if (area.status !== 'OK') {
      warnings.push({
        code: 'INVALID_OPENING',
        sourceEntityId: wall.id,
        message:
          area.status === 'UNKNOWN'
            ? area.reason
            : area.issues.map(({ message }) => message).join('; '),
      });
      continue;
    }
    const grossM2 = numericValue(
      squareMillimetresToSquareMetres(squareMillimetres(area.grossAreaMm2)),
    );
    const netM2 = numericValue(
      squareMillimetresToSquareMetres(squareMillimetres(area.netAreaMm2)),
    );
    items.push(
      item(
        `${wall.id}:gross-area`,
        wall,
        'AREA',
        'GEOMETRIC',
        grossM2,
        'm2',
        'path length × explicit height',
      ),
    );
    const netSources = [wall.id, ...hostedOpenings.map(({ id }) => id)];
    items.push(
      item(
        `${wall.id}:net-area`,
        wall,
        'AREA',
        'NET',
        netM2,
        'm2',
        'gross area − hosted opening rectangles',
        netSources,
      ),
    );
    const assembly = assemblyById.get(wall.assemblyId);
    if (assembly === undefined) {
      warnings.push({
        code: 'MISSING_ASSEMBLY',
        sourceEntityId: wall.id,
        message: `Assembly ${wall.assemblyId} is missing.`,
      });
      continue;
    }
    assembly.layers.forEach((layer, layerIndex) => {
      const volumeM3 = netM2 * layer.thicknessM;
      const layerSources = [...netSources, assembly.id, layer.id];
      items.push({
        ...item(
          `${wall.id}:layer:${layer.id}:volume`,
          wall,
          'VOLUME',
          'NET',
          volumeM3,
          'm3',
          'net wall area × layer thickness',
          layerSources,
        ),
        materialId: layer.materialId,
        assemblyId: assembly.id,
      });
      const material = materialById.get(layer.materialId);
      if (material === undefined) {
        warnings.push({
          code: 'MISSING_MATERIAL',
          sourceEntityId: wall.id,
          message: `Layer ${layerIndex} references missing material ${layer.materialId}.`,
        });
      } else if (material.properties.densityKgM3 === undefined) {
        warnings.push({
          code: 'MISSING_DENSITY',
          sourceEntityId: wall.id,
          message: `Material ${material.id} has unknown density; mass was not calculated.`,
        });
      } else {
        items.push({
          ...item(
            `${wall.id}:layer:${layer.id}:mass`,
            wall,
            'MASS',
            'NET',
            volumeM3 * material.properties.densityKgM3,
            'kg',
            'layer volume × material density',
            [...layerSources, material.id],
          ),
          materialId: material.id,
          assemblyId: assembly.id,
        });
      }
    });
  }
  return { status: warnings.length === 0 ? 'OK' : 'PARTIAL', items, warnings };
}

function item(
  id: string,
  wall: Wall,
  quantityType: QuantityType,
  level: QuantityLevel,
  value: number,
  unit: QuantityItem['unit'],
  formula: string,
  sourceEntityIds: readonly string[] = [wall.id],
): QuantityItem {
  return {
    id,
    sourceEntityId: wall.id,
    assemblyId: wall.assemblyId,
    quantityType,
    level,
    value,
    unit,
    trace: { methodId: 'wall-quantities-v1', sourceEntityIds, formula },
  };
}

/**
 * A horizontal surface the takeoff has to count, with its area already
 * resolved.
 *
 * A slab's area comes from its polygon and a roof plane's from its slope, and
 * both are geometry somebody else has already done. What the takeoff needs is
 * the number and the build-up, not a second implementation of the resolution.
 */
export interface SurfaceQuantity {
  readonly id: string;
  readonly assemblyId: string;
  readonly areaM2: number;
  /** What it is, so the trace says which formula produced the figure. */
  readonly what: 'slab' | 'roof';
}

/**
 * What the floors and the roof are made of, counted like the walls.
 *
 * The takeoff read the walls and nothing else. A house's ground slab, its
 * intermediate floor and its roof planes are half of what it is made of — the
 * concrete, the screed, the joists, the deck, the two hundred and forty
 * millimetres of insulation over the ceiling — and none of it reached the
 * bill of materials, the cost total or the carbon total. A total that silently
 * omits half the building reads as complete and is not.
 *
 * The same items as a wall, minus the two that only a wall has: there is no
 * gross area and no net area, because nothing is subtracted from a slab. An
 * opening in a roof would change that, and there is no such thing yet — see
 * CG-09.
 */
export function calculateSurfaceQuantities(
  surfaces: readonly SurfaceQuantity[],
  assemblies: readonly Assembly[],
  materials: readonly Material[],
): QuantityResult {
  const items: QuantityItem[] = [];
  const warnings: QuantityWarning[] = [];
  const assemblyById = new Map(
    assemblies.map((assembly) => [String(assembly.id), assembly]),
  );
  const materialById = new Map(
    materials.map((material) => [String(material.id), material]),
  );
  for (const surface of surfaces) {
    const trace = (
      formula: string,
      sourceEntityIds: readonly string[] = [surface.id],
    ): QuantityTrace => ({
      methodId: 'surface-quantities-v1',
      sourceEntityIds,
      formula,
    });
    items.push({
      id: `${surface.id}:area`,
      sourceEntityId: surface.id,
      assemblyId: surface.assemblyId,
      quantityType: 'AREA',
      level: 'GEOMETRIC',
      value: surface.areaM2,
      unit: 'm2',
      trace: trace(
        surface.what === 'roof'
          ? 'projected footprint ÷ cosine of the slope'
          : 'polygon area',
      ),
    });
    const assembly = assemblyById.get(surface.assemblyId);
    if (assembly === undefined) {
      warnings.push({
        code: 'MISSING_ASSEMBLY',
        sourceEntityId: surface.id,
        message: `Assembly ${surface.assemblyId} is missing.`,
      });
      continue;
    }
    for (const [layerIndex, layer] of assembly.layers.entries()) {
      const volumeM3 = surface.areaM2 * layer.thicknessM;
      const layerSources = [surface.id, String(assembly.id), String(layer.id)];
      items.push({
        id: `${surface.id}:layer:${layer.id}:volume`,
        sourceEntityId: surface.id,
        assemblyId: surface.assemblyId,
        materialId: layer.materialId,
        quantityType: 'VOLUME',
        level: 'NET',
        value: volumeM3,
        unit: 'm3',
        trace: trace(`${surface.what} area × layer thickness`, layerSources),
      });
      const material = materialById.get(String(layer.materialId));
      if (material === undefined) {
        warnings.push({
          code: 'MISSING_MATERIAL',
          sourceEntityId: surface.id,
          message: `Layer ${layerIndex} references missing material ${layer.materialId}.`,
        });
        continue;
      }
      const density = material.properties.densityKgM3;
      if (density === undefined) {
        warnings.push({
          code: 'MISSING_DENSITY',
          sourceEntityId: surface.id,
          message: `Material ${material.id} has unknown density; mass was not calculated.`,
        });
        continue;
      }
      items.push({
        id: `${surface.id}:layer:${layer.id}:mass`,
        sourceEntityId: surface.id,
        assemblyId: surface.assemblyId,
        materialId: material.id,
        quantityType: 'MASS',
        level: 'NET',
        value: volumeM3 * density,
        unit: 'kg',
        trace: trace('layer volume × material density', [
          ...layerSources,
          String(material.id),
        ]),
      });
    }
  }
  return { status: warnings.length === 0 ? 'OK' : 'PARTIAL', items, warnings };
}

/**
 * The floors and the roof planes of a project, with their areas resolved once.
 *
 * A slab's area is its polygon; a roof plane's is its footprint divided by the
 * cosine of its slope — geometry the model already resolves. This asks for it
 * rather than implementing it a second time, which is how two numbers for one
 * surface start disagreeing.
 */
export function surfacesToCount(project: {
  readonly building: {
    readonly levels: readonly {
      readonly slabs: readonly {
        readonly id: string;
        readonly assemblyId: string;
        readonly polygon: Polygon2D;
      }[];
      readonly roofs: readonly {
        readonly id: string;
        readonly assemblyId: string;
      }[];
    }[];
  };
}): readonly SurfaceQuantity[] {
  const surfaces: SurfaceQuantity[] = [];
  for (const level of project.building.levels) {
    for (const slab of level.slabs)
      surfaces.push({
        id: String(slab.id),
        assemblyId: String(slab.assemblyId),
        areaM2: numericValue(
          squareMillimetresToSquareMetres(
            squareMillimetres(polygonArea(slab.polygon)),
          ),
        ),
        what: 'slab',
      });
    for (const roof of level.roofs)
      surfaces.push({
        id: String(roof.id),
        assemblyId: String(roof.assemblyId),
        areaM2: resolveRoofGeometry(roof as never, level as never)
          .surfaceAreaM2,
        what: 'roof',
      });
  }
  return surfaces;
}
