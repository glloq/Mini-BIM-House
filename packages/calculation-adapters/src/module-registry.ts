/**
 * The seventeen modules, named once.
 *
 * There were three lists of them: the adapters, their identifiers, and their
 * labels in the application. Three lists of the same seventeen things drift,
 * and the drift shows as a module that runs with no name, or a name with
 * nothing behind it.
 *
 * This file holds no code and imports nothing, so naming a module costs the
 * application a few hundred bytes rather than seventeen calculation engines.
 * What each module *does* is attached to these identifiers elsewhere, and the
 * compiler refuses a map that misses one.
 */
export interface CalculationModuleDescriptor {
  readonly id: string;
  readonly label: string;
}

export const CALCULATION_MODULES = [
  { id: 'thermal', label: 'Enveloppe thermique' },
  { id: 'heating', label: 'Chauffage' },
  { id: 'dhw', label: 'Eau chaude sanitaire' },
  { id: 'lighting', label: 'Éclairage' },
  { id: 'electrical', label: 'Électricité' },
  { id: 'ventilation', label: 'Ventilation' },
  { id: 'iaq', label: 'Qualité de l’air' },
  { id: 'water', label: 'Eau froide' },
  { id: 'wastewater', label: 'Évacuations' },
  { id: 'rainwater', label: 'Eau de pluie' },
  { id: 'photovoltaic', label: 'Photovoltaïque' },
  { id: 'battery', label: 'Stockage' },
  { id: 'energy-balance', label: 'Bilan énergétique' },
  { id: 'hygrothermal', label: 'Hygrothermie' },
  { id: 'acoustics', label: 'Acoustique' },
  { id: 'cost', label: 'Coût' },
  { id: 'environmental', label: 'Environnement' },
] as const satisfies readonly CalculationModuleDescriptor[];

export type ProjectCalculationModuleId =
  (typeof CALCULATION_MODULES)[number]['id'];

export const PROJECT_CALCULATION_MODULE_IDS: readonly ProjectCalculationModuleId[] =
  CALCULATION_MODULES.map(({ id }) => id);

/** What this module is called, wherever it is named. */
export function calculationModuleLabel(moduleId: string): string {
  return (
    CALCULATION_MODULES.find(({ id }) => id === moduleId)?.label ?? moduleId
  );
}
