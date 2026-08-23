/**
 * What a room is, as a drawing needs to know it.
 *
 * The model holds a free string for a room's use, because a project may name
 * uses this version never enumerated and must not lose them. A drawing cannot
 * work from a free string: « CHAMBRE », « Bedroom » and « SLEEPING » are one
 * colour on a plan and three different keys in a style table. So the model
 * keeps its own word and the scene carries this canonical one beside it.
 */
export type SpaceGraphicCategory =
  | 'BEDROOM'
  | 'LIVING'
  | 'KITCHEN'
  | 'LIVING_KITCHEN'
  | 'BATHROOM'
  | 'WC'
  | 'CIRCULATION'
  | 'STORAGE'
  | 'GARAGE'
  | 'TECHNICAL'
  | 'UTILITY'
  | 'OFFICE'
  | 'OTHER';

export const SPACE_GRAPHIC_CATEGORIES: readonly SpaceGraphicCategory[] = [
  'BEDROOM',
  'LIVING',
  'KITCHEN',
  'LIVING_KITCHEN',
  'BATHROOM',
  'WC',
  'CIRCULATION',
  'STORAGE',
  'GARAGE',
  'TECHNICAL',
  'UTILITY',
  'OFFICE',
  'OTHER',
];

/**
 * The words each graphic category answers to.
 *
 * French and English both, because the interface offers French labels over
 * English values and a project imported from elsewhere carries whatever it
 * carried. A word absent from this table is not an error: the room is drawn as
 * a room, which is what `OTHER` means.
 */
const ALIASES: Readonly<Record<SpaceGraphicCategory, readonly string[]>> = {
  LIVING_KITCHEN: [
    'LIVING KITCHEN',
    'KITCHEN LIVING',
    'SEJOUR CUISINE',
    'CUISINE SEJOUR',
    'PIECE DE VIE',
    'OPEN KITCHEN',
    'CUISINE OUVERTE',
  ],
  BEDROOM: [
    'BEDROOM',
    'BED',
    'CHAMBRE',
    'CHAMBRES',
    'SLEEPING',
    'MASTER BEDROOM',
    'SUITE PARENTALE',
    'CH',
  ],
  LIVING: [
    'LIVING',
    'LIVING ROOM',
    'SEJOUR',
    'SALON',
    'SALLE A MANGER',
    'DINING',
    'DINING ROOM',
    'LOUNGE',
  ],
  KITCHEN: ['KITCHEN', 'CUISINE', 'KITCHENETTE'],
  BATHROOM: [
    'BATHROOM',
    'BATH',
    'BAINS',
    'SALLE DE BAINS',
    'SALLE DE BAIN',
    'SALLE D EAU',
    'SDB',
    'SHOWER ROOM',
    'DOUCHE',
  ],
  WC: ['WC', 'TOILET', 'TOILETS', 'TOILETTES', 'LAVATORY', 'RESTROOM'],
  CIRCULATION: [
    'CIRCULATION',
    'CORRIDOR',
    'COULOIR',
    'HALL',
    'HALLWAY',
    'ENTREE',
    'ENTRY',
    'ENTRANCE',
    'DEGAGEMENT',
    'PALIER',
    'LANDING',
    'ESCALIER',
    'STAIRS',
    'STAIRWELL',
    'CAGE D ESCALIER',
  ],
  STORAGE: [
    'STORAGE',
    'STORE',
    'CELLIER',
    'RANGEMENT',
    'PLACARD',
    'CLOSET',
    'DRESSING',
    'PANTRY',
    'GARDE MANGER',
    'CAVE',
    'CELLAR',
    'DEBARRAS',
  ],
  GARAGE: ['GARAGE', 'CARPORT', 'PARKING', 'ABRI VOITURE'],
  TECHNICAL: [
    'TECHNICAL',
    'TECHNIQUE',
    'LOCAL TECHNIQUE',
    'PLANT',
    'PLANT ROOM',
    'BOILER ROOM',
    'CHAUFFERIE',
    'SERVER',
  ],
  UTILITY: [
    'UTILITY',
    'UTILITY ROOM',
    'BUANDERIE',
    'LAUNDRY',
    'LINGERIE',
    'ARRIERE CUISINE',
  ],
  OFFICE: ['OFFICE', 'BUREAU', 'STUDY', 'WORKSHOP', 'ATELIER'],
  OTHER: ['OTHER', 'AUTRE', 'UNDEFINED', 'NONE'],
};

const BY_ALIAS = new Map<string, SpaceGraphicCategory>(
  Object.entries(ALIASES).flatMap(([category, words]) =>
    words.map((word) => [word, category as SpaceGraphicCategory] as const),
  ),
);

/**
 * The canonical graphic category of a room's stated use.
 *
 * Accents, case and punctuation are levelled first, so « Salle-de-bains » and
 * « SALLE DE BAINS » are the same room to a drawing. Anything unrecognised is
 * `OTHER`, never a guess: an unknown use stays unknown.
 */
export function spaceGraphicCategory(
  category: string | null | undefined,
): SpaceGraphicCategory {
  if (category === null || category === undefined) return 'OTHER';
  const normalized = category
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/gu, ' ')
    .trim();
  if (normalized === '') return 'OTHER';
  return BY_ALIAS.get(normalized) ?? 'OTHER';
}
