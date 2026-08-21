import type {
  ComponentCategory,
  RoofEdgeKind,
  SiteObstacleKind,
  StructuralMemberKind,
  StairType,
  Opening,
  Slab,
  Wall,
} from '@house-technical-designer/core-domain';
import {
  COMPONENT_CATEGORIES,
  ROOF_EDGE_KINDS,
  SITE_OBSTACLE_KINDS,
  STRUCTURAL_MEMBER_KINDS,
  STAIR_TYPES,
  DIMENSION_TYPES,
  OPENING_TYPES,
  SLAB_ROLES,
  WALL_REFERENCE_SIDES,
  WALL_ROLES,
  type DimensionType,
} from '@house-technical-designer/core-domain';

export interface DomainOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Menu options built from the domain's own list of allowed values.
 *
 * The labels are keyed by the domain type, so a value the model does not
 * accept cannot be offered, and a value the model gains without a label here
 * stops the build. Restating an enum by hand is how "INTERIOR" once reached a
 * field that only knows CENTER, LEFT and RIGHT — TypeScript could not see it
 * because the interface cast the string on its way out.
 */
export function optionsFrom<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>,
): readonly DomainOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

export const WALL_ROLE_OPTIONS = optionsFrom<Wall['role']>(WALL_ROLES, {
  EXTERIOR: 'Extérieur',
  INTERIOR: 'Intérieur',
  PARTITION: 'Cloison',
  OTHER: 'Autre',
});

/**
 * Which face the drawn path represents.
 *
 * Left and right are relative to the direction the wall was drawn in. They are
 * not "inside" and "outside": which side faces the interior belongs to the
 * enclosure, not to a single wall, and the model does not claim to know it.
 */
export const REFERENCE_SIDE_OPTIONS = optionsFrom<Wall['referenceSide']>(
  WALL_REFERENCE_SIDES,
  {
    CENTER: 'Axe du mur',
    LEFT: 'Face gauche (sens du tracé)',
    RIGHT: 'Face droite (sens du tracé)',
  },
);

export const SLAB_ROLE_OPTIONS = optionsFrom<Slab['role']>(SLAB_ROLES, {
  FLOOR: 'Plancher',
  CEILING: 'Plafond',
  FOUNDATION: 'Fondation',
  TERRACE: 'Terrasse',
  OTHER: 'Autre',
});

export const OPENING_TYPE_OPTIONS = optionsFrom<Opening['openingType']>(
  OPENING_TYPES,
  {
    DOOR: 'Porte',
    WINDOW: 'Fenêtre',
    VOID: 'Trémie',
    OTHER: 'Autre',
  },
);

export const DIMENSION_TYPE_OPTIONS = optionsFrom<DimensionType>(
  DIMENSION_TYPES,
  {
    ALIGNED: 'Alignée',
    HORIZONTAL: 'Horizontale',
    VERTICAL: 'Verticale',
  },
);

/**
 * What a room is for, as the interface offers it.
 *
 * The domain takes a free string here — a category it does not enumerate — so
 * this list is what the application proposes and not what the model allows: a
 * project holding a category absent from this list stays valid and keeps it.
 */
export const SPACE_CATEGORY_OPTIONS: readonly DomainOption[] = [
  { value: 'LIVING', label: 'Séjour' },
  { value: 'KITCHEN', label: 'Cuisine' },
  { value: 'BEDROOM', label: 'Chambre' },
  { value: 'BATHROOM', label: 'Salle de bains' },
  { value: 'WC', label: 'WC' },
  { value: 'HALL', label: 'Entrée' },
  { value: 'CORRIDOR', label: 'Dégagement' },
  { value: 'GARAGE', label: 'Garage' },
  { value: 'STORAGE', label: 'Cellier' },
  { value: 'TECHNICAL', label: 'Local technique' },
  { value: 'OTHER', label: 'Autre' },
];

/** What a placed component is for, keyed by the domain's own list. */
export const COMPONENT_CATEGORY_OPTIONS = optionsFrom<ComponentCategory>(
  COMPONENT_CATEGORIES,
  {
    HEATING: 'Chauffage',
    SANITARY: 'Sanitaire',
    VENTILATION: 'Ventilation',
    ELECTRICAL: 'Électricité',
    LIGHTING: 'Éclairage',
    PHOTOVOLTAIC: 'Photovoltaïque',
    APPLIANCE: 'Appareil',
    FURNITURE: 'Mobilier',
    OTHER: 'Autre',
  },
);

/** The shapes of flight the domain accepts. */
export const STAIR_TYPE_OPTIONS = optionsFrom<StairType>(STAIR_TYPES, {
  STRAIGHT: 'Droit',
  L_SHAPED: 'Quart tournant',
  U_SHAPED: 'Deux quarts tournants',
  SPIRAL: 'Hélicoïdal',
});

/** What one side of a roof does, keyed by the domain's own list. */
export const ROOF_EDGE_KIND_OPTIONS = optionsFrom<RoofEdgeKind>(
  ROOF_EDGE_KINDS,
  { SLOPED: 'Pan', GABLE: 'Pignon' },
);

/** The structural members the domain accepts. */
export const STRUCTURAL_MEMBER_OPTIONS = optionsFrom<StructuralMemberKind>(
  STRUCTURAL_MEMBER_KINDS,
  { COLUMN: 'Poteau', BEAM: 'Poutre', FOOTING: 'Fondation' },
);

/** What can stand on the site around the house. */
export const SITE_OBSTACLE_OPTIONS = optionsFrom<SiteObstacleKind>(
  SITE_OBSTACLE_KINDS,
  {
    BUILDING: 'Bâtiment voisin',
    TREE: 'Arbre',
    EXCLUSION: 'Zone exclue',
    OTHER: 'Autre',
  },
);
