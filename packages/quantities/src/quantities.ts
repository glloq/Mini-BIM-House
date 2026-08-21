import type { Assembly } from '@house-technical-designer/assemblies';
import {
  calculateWallNetArea,
  type Opening,
  type Wall,
} from '@house-technical-designer/core-domain';
import { polylineLength } from '@house-technical-designer/geometry';
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
    'wall-quantities-v1' | 'placed-equipment-v1' | 'network-run-v1';
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
    const hostedOpenings = openings.filter(
      ({ hostElementId }) => hostElementId === wall.id,
    );
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
