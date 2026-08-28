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
 *
 * **La promesse du paragraphe précédent n'était pas tenue.** Ce fichier
 * n'importait rien, mais le barillet du paquet le réexportait à côté des
 * dix-sept moteurs, et l'écran des réglages importait le barillet pour lire
 * un libellé et une méthode. Les dix-sept moteurs arrivaient donc au premier
 * écran de tout le monde, y compris de celui qui n'ouvre jamais l'onglet des
 * calculs. Le sous-chemin `@house-technical-designer/calculation-adapters/registry`
 * existe désormais pour cela, et `registry-only.test.ts` vérifie que ce
 * fichier reste sans dépendance.
 *
 * La méthode et la version y sont ajoutées pour la même raison : les lire
 * demandait le module, donc le moteur. Ce sont des données sur un module, pas
 * du calcul, et un test les confronte à ce que les moteurs déclarent — la
 * dérive que ce fichier existe pour empêcher.
 */
export interface CalculationModuleDescriptor {
  readonly id: string;
  readonly label: string;
  /** La méthode qu'il applique, telle que le moteur la nomme. */
  readonly methodId: string;
  /** Sa version, qui change quand le résultat change. */
  readonly version: string;
}

export const CALCULATION_MODULES = [
  {
    id: 'thermal',
    label: 'Enveloppe thermique',
    methodId: 'assembly-u-value-v1',
    version: '2.0.0',
  },
  {
    id: 'heating',
    label: 'Chauffage',
    methodId: 'design-heating-steady-state-v1',
    version: '2.0.0',
  },
  {
    id: 'dhw',
    label: 'Eau chaude sanitaire',
    methodId: 'sensible-water-heating-v1',
    version: '2.0.0',
  },
  {
    id: 'lighting',
    label: 'Éclairage',
    methodId: 'lumen-average-v1',
    version: '2.0.0',
  },
  {
    id: 'electrical',
    label: 'Électricité',
    methodId: 'balanced-active-power-demand-v1',
    version: '1.0.0',
  },
  {
    id: 'ventilation',
    label: 'Ventilation',
    methodId: 'duct-darcy-weisbach-v1',
    version: '2.0.0',
  },
  {
    id: 'iaq',
    label: 'Qualité de l’air',
    methodId: 'co2-mass-balance-v1',
    version: '2.0.0',
  },
  {
    id: 'water',
    label: 'Eau froide',
    methodId: 'pipe-darcy-weisbach-v1',
    version: '2.0.0',
  },
  {
    id: 'wastewater',
    label: 'Évacuations',
    methodId: 'discharge-unit-gravity-v1',
    version: '2.0.0',
  },
  {
    id: 'rainwater',
    label: 'Eau de pluie',
    methodId: 'tank-water-balance-v1',
    version: '2.0.0',
  },
  {
    id: 'photovoltaic',
    label: 'Photovoltaïque',
    methodId: 'offline-pv-v1',
    version: '2.0.0',
  },
  {
    id: 'battery',
    label: 'Stockage',
    methodId: 'battery-configuration-v1',
    version: '2.0.0',
  },
  {
    id: 'energy-balance',
    label: 'Bilan énergétique',
    methodId: 'physical-energy-balance-v1',
    version: '2.0.0',
  },
  {
    id: 'hygrothermal',
    label: 'Hygrothermie',
    methodId: 'glaser-steady-state-v1',
    version: '2.0.0',
  },
  {
    id: 'acoustics',
    label: 'Acoustique',
    methodId: 'sabine-reverberation-v1',
    version: '2.0.0',
  },
  {
    id: 'cost',
    label: 'Coût',
    methodId: 'quantity-priced-estimate-v1',
    version: '2.0.0',
  },
  {
    id: 'environmental',
    label: 'Environnement',
    methodId: 'declaration-linked-impact-v1',
    version: '2.0.0',
  },
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

/** La méthode et la version qu'un module déclare, sans charger le module. */
export function calculationModuleContract(
  moduleId: string,
): { readonly methodId: string; readonly version: string } | undefined {
  const found = CALCULATION_MODULES.find(({ id }) => id === moduleId);
  return found === undefined
    ? undefined
    : { methodId: found.methodId, version: found.version };
}
