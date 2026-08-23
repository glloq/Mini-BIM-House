/**
 * Les treize destinations, et ce qu'elles s'appellent.
 *
 * Ce fichier a porté les cinq espaces de travail ; les neuf étapes de création
 * les ont remplacés (`creation-stages.ts`). Il ne reste ici que la liste des
 * destinations et leurs libellés — ce qu'une palette, un renvoi ou un
 * catalogue nomme. Où chacune vit est une question d'étape, et se lit dans le
 * registre des étapes.
 *
 * `LEGACY_` reste dans le nom tant que la refonte n'a pas fini de dissoudre
 * ces destinations : le plan devient permanent, les bibliothèques s'ouvrent
 * depuis une propriété, et la liste rétrécira jusqu'à disparaître (UX-10).
 */

/**
 * Where the old workspace went.
 *
 * The redesign is a remapping, not a demolition: every one of the thirteen
 * destinations has to stay reachable, and this list is what proves it.
 */
export const LEGACY_WORKSPACE_TABS = [
  'project',
  'plan',
  'building',
  'materials',
  'assemblies',
  'openings',
  'equipment',
  'networks',
  'calculations',
  'quantities',
  'scenarios',
  'checks',
  'documents',
] as const;
export type LegacyWorkspaceTab = (typeof LEGACY_WORKSPACE_TABS)[number];

export const LEGACY_WORKSPACE_LABELS = {
  project: 'Projet',
  plan: 'Plan',
  building: 'Niveaux et pièces',
  materials: 'Matériaux',
  assemblies: 'Assemblages',
  openings: 'Menuiseries',
  equipment: 'Équipements',
  networks: 'Réseaux',
  calculations: 'Calculs',
  quantities: 'Quantités',
  scenarios: 'Scénarios',
  checks: 'Vérifications',
  documents: 'Vues et feuilles',
} as const satisfies Record<LegacyWorkspaceTab, string>;
