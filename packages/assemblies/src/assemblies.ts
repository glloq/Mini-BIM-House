import type { MaterialId } from '@house-technical-designer/materials';
import {
  metres,
  metresToMillimetres,
  numericValue,
  type Metres,
  type Millimetres,
} from '@house-technical-designer/units';
import type {
  Assembly,
  AssemblyId,
  AssemblyIssue,
  AssemblyLayerId,
} from './types.js';

export function assemblyId(value: string): AssemblyId {
  if (value.trim() === '') throw new TypeError('Assembly ID must not be empty');
  return value as AssemblyId;
}

export function assemblyLayerId(value: string): AssemblyLayerId {
  if (value.trim() === '')
    throw new TypeError('Assembly layer ID must not be empty');
  return value as AssemblyLayerId;
}

export function validateAssembly(
  assembly: Assembly,
  availableMaterials?: ReadonlySet<MaterialId>,
): readonly AssemblyIssue[] {
  const issues: AssemblyIssue[] = [];
  if (assembly.id.trim() === '')
    issues.push(issue('EMPTY_ID', 'id', 'must not be empty'));
  if (assembly.name.trim() === '')
    issues.push(issue('EMPTY_NAME', 'name', 'must not be empty'));
  if (assembly.layers.length === 0)
    issues.push(issue('NO_LAYERS', 'layers', 'requires at least one layer'));
  const ids = new Set<string>();
  assembly.layers.forEach((layer, index) => {
    if (ids.has(layer.id))
      issues.push(
        issue('DUPLICATE_LAYER_ID', `layers[${index}].id`, 'must be unique'),
      );
    ids.add(layer.id);
    if (!Number.isFinite(layer.thicknessM) || layer.thicknessM <= 0) {
      issues.push(
        issue(
          'INVALID_THICKNESS',
          `layers[${index}].thicknessM`,
          'must be finite and greater than zero',
        ),
      );
    }
    if (
      availableMaterials !== undefined &&
      !availableMaterials.has(layer.materialId)
    ) {
      issues.push(
        issue(
          'MISSING_MATERIAL',
          `layers[${index}].materialId`,
          `unknown material ${layer.materialId}`,
        ),
      );
    }
  });
  return issues;
}

export function createAssembly(
  assembly: Assembly,
  availableMaterials?: ReadonlySet<MaterialId>,
): Assembly {
  const issues = validateAssembly(assembly, availableMaterials);
  if (issues.length > 0)
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  return structuredClone(assembly);
}

export function totalThicknessMetres(assembly: Assembly): Metres {
  return metres(
    assembly.layers.reduce((total, layer) => total + layer.thicknessM, 0),
  );
}

export function totalThicknessMillimetres(assembly: Assembly): Millimetres {
  return metresToMillimetres(totalThicknessMetres(assembly));
}

export function reverseAssembly(assembly: Assembly): Assembly {
  return {
    ...structuredClone(assembly),
    layers: [...assembly.layers]
      .reverse()
      .map((layer) => structuredClone(layer)),
  };
}

export function serializedTotalThicknessM(assembly: Assembly): number {
  return numericValue(totalThicknessMetres(assembly));
}

function issue(
  code: AssemblyIssue['code'],
  path: string,
  message: string,
): AssemblyIssue {
  return { code, path, message };
}
