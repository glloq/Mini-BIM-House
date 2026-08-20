import type {
  Project,
  ScenarioOverride,
} from '@house-technical-designer/core-domain';
import { resolve } from '@house-technical-designer/editor-core';
import { MODULE_SETTINGS } from '../project/settings-catalog.js';

/**
 * Something a scenario can vary, named the way the drawing names it.
 *
 * The user picks a wall, a layer, an equipment property or a calculation
 * setting; the path into the project file is derived from that choice. A JSON
 * path is a persistence detail, not a question to ask someone comparing two
 * insulation thicknesses.
 */
export interface ScenarioTarget {
  readonly path: string;
  readonly label: string;
  readonly group: string;
  readonly unit?: string;
  /** Value the base project declares, so the change reads as "from → to". */
  readonly currentValue: string;
  readonly numeric: boolean;
}

function stringify(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  return '';
}

/** Every value of the project a scenario may vary, grouped for a menu. */
export function scenarioTargets(project: Project): readonly ScenarioTarget[] {
  const targets: ScenarioTarget[] = [];

  project.building.levels.forEach((level, levelIndex) => {
    level.walls.forEach((wall, wallIndex) => {
      targets.push({
        path: `building/levels/${levelIndex}/walls/${wallIndex}/assemblyId`,
        label: `Assemblage du mur ${wall.id}`,
        group: `Murs — ${level.name}`,
        currentValue: wall.assemblyId,
        numeric: false,
      });
      if (wall.heightMode === 'EXPLICIT')
        targets.push({
          path: `building/levels/${levelIndex}/walls/${wallIndex}/heightMm`,
          label: `Hauteur du mur ${wall.id}`,
          group: `Murs — ${level.name}`,
          unit: 'mm',
          currentValue: String(wall.heightMm),
          numeric: true,
        });
    });
  });

  (project.assemblies ?? []).forEach((assembly, assemblyIndex) => {
    assembly.layers.forEach((layer, layerIndex) => {
      targets.push({
        path: `assemblies/${assemblyIndex}/layers/${layerIndex}/thicknessM`,
        label: `${assembly.name} — épaisseur de ${layer.materialId}`,
        group: 'Assemblages',
        unit: 'm',
        currentValue: String(layer.thicknessM),
        numeric: true,
      });
    });
  });

  (project.equipment ?? []).forEach((equipment, equipmentIndex) => {
    for (const [key, value] of Object.entries(equipment.properties)) {
      if (typeof value !== 'number' && typeof value !== 'string') continue;
      targets.push({
        path: `equipment/${equipmentIndex}/properties/${key}`,
        label: `${equipment.id} — ${key}`,
        group: 'Équipements',
        currentValue: stringify(value),
        numeric: typeof value === 'number',
      });
    }
  });

  for (const descriptor of MODULE_SETTINGS) {
    const settings = project.calculationSettings?.[descriptor.moduleId];
    if (settings === undefined) continue;
    for (const field of descriptor.fields) {
      const value = settings.settings[field.key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'number' && typeof value !== 'string') continue;
      targets.push({
        path: `calculationSettings/${descriptor.moduleId}/settings/${field.key}`,
        label: `${descriptor.label} — ${field.label}`,
        group: 'Réglages de calcul',
        ...(field.unit === undefined ? {} : { unit: field.unit }),
        currentValue: stringify(value),
        numeric: field.kind === 'NUMBER',
      });
    }
  }

  return targets;
}

/** The change a target and a typed value describe, or nothing when unusable. */
export function scenarioOverride(
  target: ScenarioTarget,
  raw: string,
): ScenarioOverride | undefined {
  if (raw.trim() === '') return undefined;
  if (!target.numeric)
    return { path: target.path, operation: 'SET', value: raw };
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value)
    ? { path: target.path, operation: 'SET', value }
    : undefined;
}

export interface ScenarioChangeRow {
  readonly path: string;
  readonly label: string;
  readonly from: string;
  readonly to: string;
  readonly unit?: string;
}

/**
 * A scenario's changes, read as "what it is now → what the scenario makes it".
 *
 * A change whose target no longer exists is still listed, with its former
 * value reported as unknown rather than hidden: a scenario that no longer
 * applies has to be visible.
 */
export function scenarioChangeRows(
  project: Project,
  overrides: readonly ScenarioOverride[],
): readonly ScenarioChangeRow[] {
  const targets = new Map(
    scenarioTargets(project).map((target) => [target.path, target]),
  );
  return overrides.map((override) => {
    const target = targets.get(override.path);
    const current = resolve(project, override.path);
    return {
      path: override.path,
      label: target?.label ?? override.path,
      from: current === undefined ? 'inconnu' : stringify(current),
      to:
        override.operation === 'REMOVE' ? 'retiré' : stringify(override.value),
      ...(target?.unit === undefined ? {} : { unit: target.unit }),
    };
  });
}
