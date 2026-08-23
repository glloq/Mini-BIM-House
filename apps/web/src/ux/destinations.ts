/**
 * Les treize destinations, et ce qu'elles s'appellent.
 *
 * Ce fichier a porté les cinq espaces de travail ; les neuf étapes de création
 * les ont remplacés (`creation-stages.ts`), et il ne reste ici que la liste
 * des écrans que l'application ouvre et leurs libellés — ce qu'une palette, un
 * renvoi ou un catalogue nomme. Où chacun vit est une question d'étape, et se
 * lit dans le registre des étapes.
 *
 * Le mot « workspace » a disparu du nom avec la chose qu'il désignait. Ces
 * treize-là ne sont pas un héritage à retirer : ce sont des écrans réels, et
 * quatre d'entre eux — les bibliothèques — s'ouvrent désormais depuis une
 * propriété plutôt que depuis une liste. La refonte les a redistribués, pas
 * supprimés, et un test refuse qu'un seul devienne inatteignable.
 */

export const DESTINATIONS = [
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
export type DestinationId = (typeof DESTINATIONS)[number];

export const DESTINATION_LABELS = {
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
} as const satisfies Record<DestinationId, string>;
