import type {
  Opening,
  Slab,
  Wall,
} from '@house-technical-designer/core-domain';
import {
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
