import type { ProjectFile } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { loadProjectJson } from '@house-technical-designer/project-io/files';
import referenceHouse from '../../../examples/reference-house/reference.houseproj.json';
import monthlyClimate from '../../../examples/reference-house/climate-monthly.json';
import designDayClimate from '../../../examples/reference-house/climate-design-day.json';

export type DemoProjectResult =
  | { readonly status: 'OK'; readonly file: ProjectFile }
  | { readonly status: 'ERROR'; readonly message: string };

/**
 * Loads the reference house shipped with the repository.
 *
 * It goes through the same validation as an imported file, so the demonstration
 * project can never bypass the persisted contract the application enforces.
 */
export function loadDemoProject(): DemoProjectResult {
  const result = loadProjectJson(JSON.stringify(referenceHouse));
  if (result.status === 'OK') return { status: 'OK', file: result.file };
  return {
    status: 'ERROR',
    message: `La maison de démonstration est invalide (${result.status}).`,
  };
}

/** Climate datasets the demonstration project is calculated with. */
export function demoClimateDatasets(): readonly ClimateDataset[] {
  return [monthlyClimate as ClimateDataset, designDayClimate as ClimateDataset];
}
