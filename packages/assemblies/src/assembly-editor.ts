import type { Material, MaterialId } from '@house-technical-designer/materials';
import {
  metres,
  metresToMillimetres,
  millimetres,
  millimetresToMetres,
  numericValue,
} from '@house-technical-designer/units';
import { createAssembly } from './assemblies.js';
import type { Assembly, AssemblyLayer } from './types.js';

export interface AssemblyEditorLayer {
  readonly index: number;
  readonly layer: AssemblyLayer;
  readonly material?: Material;
  readonly missingMaterial: boolean;
  readonly startMm: number;
  readonly endMm: number;
  readonly hatchId?: string;
}

export interface AssemblyEditorModel {
  readonly assembly: Assembly;
  readonly layers: readonly AssemblyEditorLayer[];
  readonly totalThicknessMm: number;
  readonly issues: readonly string[];
}

export function buildAssemblyEditorModel(
  assembly: Assembly,
  materials: readonly Material[],
): AssemblyEditorModel {
  const materialById = new Map(
    materials.map((material) => [material.id, material]),
  );
  const layers: AssemblyEditorLayer[] = [];
  const issues: string[] = [];
  let cursorMm = 0;
  assembly.layers.forEach((layer, index) => {
    const material = materialById.get(layer.materialId);
    const thicknessMm = numericValue(
      metresToMillimetres(metres(layer.thicknessM)),
    );
    const endMm = cursorMm + thicknessMm;
    if (material === undefined)
      issues.push(
        `layers[${index}].materialId: unknown material ${layer.materialId}`,
      );
    layers.push({
      index,
      layer,
      ...(material === undefined ? {} : { material }),
      missingMaterial: material === undefined,
      startMm: cursorMm,
      endMm,
      ...(material?.appearance?.hatchId === undefined
        ? {}
        : { hatchId: material.appearance.hatchId }),
    });
    cursorMm = endMm;
  });
  return { assembly, layers, totalThicknessMm: cursorMm, issues };
}

export function moveAssemblyLayer(
  assembly: Assembly,
  fromIndex: number,
  toIndex: number,
): Assembly {
  assertLayerIndex(assembly, fromIndex);
  assertLayerIndex(assembly, toIndex);
  const layers = [...assembly.layers];
  const [layer] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, layer!);
  return createAssembly({ ...assembly, layers });
}

export function setAssemblyLayerThicknessMm(
  assembly: Assembly,
  layerIndex: number,
  thicknessMm: number,
): Assembly {
  assertLayerIndex(assembly, layerIndex);
  const thicknessM = numericValue(
    millimetresToMetres(millimetres(thicknessMm)),
  );
  const layers = assembly.layers.map((layer, index) =>
    index === layerIndex ? { ...layer, thicknessM } : layer,
  );
  return createAssembly({ ...assembly, layers });
}

export function setAssemblyLayerMaterial(
  assembly: Assembly,
  layerIndex: number,
  materialId: MaterialId,
  availableMaterials: ReadonlySet<MaterialId>,
): Assembly {
  assertLayerIndex(assembly, layerIndex);
  const layers = assembly.layers.map((layer, index) =>
    index === layerIndex ? { ...layer, materialId } : layer,
  );
  return createAssembly({ ...assembly, layers }, availableMaterials);
}

function assertLayerIndex(assembly: Assembly, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= assembly.layers.length)
    throw new RangeError(`Layer index ${index} is outside the assembly.`);
}
