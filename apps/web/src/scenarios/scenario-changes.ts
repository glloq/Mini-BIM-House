import type {
  Project,
  ScenarioOverride,
} from '@house-technical-designer/core-domain';
import { resolve } from '@house-technical-designer/editor-core';
import { MODULE_SETTINGS } from '../project/settings-catalog.js';
import {
  buildingScenarioTargets,
  type ScenarioTarget,
} from './scenario-paths.js';
export {
  buildingScenarioTargets,
  type ScenarioTarget,
} from './scenario-paths.js';

function stringify(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  return '';
}

/** Every value of the project a scenario may vary, grouped for a menu. */
export function scenarioTargets(project: Project): readonly ScenarioTarget[] {
  const targets: ScenarioTarget[] = [...buildingScenarioTargets(project)];
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
  if (target.options !== undefined)
    return target.options.some(({ value }) => value === raw)
      ? { path: target.path, operation: 'SET', value: raw }
      : undefined;
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
