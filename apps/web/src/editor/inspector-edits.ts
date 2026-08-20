import type {
  Level,
  Project,
  Wall,
} from '@house-technical-designer/core-domain';
import { isDimension } from '@house-technical-designer/core-domain';
import {
  UpdateDimensionCommand,
  UpdateNetworkNodeCommand,
  UpdateOpeningCommand,
  UpdateRoofCommand,
  UpdateSlabCommand,
  UpdateSpaceCommand,
  UpdateWallCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

/** A control the inspector offers for one editable property. */
export type InspectorControl =
  | {
      readonly kind: 'NUMBER';
      readonly value: number;
      readonly unit?: string;
      readonly step?: number;
      readonly min?: number;
    }
  | {
      readonly kind: 'SELECT';
      readonly value: string;
      readonly options: readonly {
        readonly value: string;
        readonly label: string;
      }[];
    }
  | {
      readonly kind: 'TEXT';
      readonly value: string;
      readonly placeholder?: string;
    };

/**
 * One property the selected object exposes for editing.
 *
 * `apply` returns the command that writes the new value, so every inspector
 * edit goes through the same validation and the same undo history as a
 * command issued from the plan. An edit that cannot be expressed returns
 * nothing rather than writing something approximate.
 */
export interface InspectorEdit {
  readonly id: string;
  readonly label: string;
  readonly control: InspectorControl;
  readonly hint?: string;
  readonly apply: (value: string) => ProjectCommand | undefined;
}

const WALL_ROLES = [
  { value: 'EXTERIOR', label: 'Extérieur' },
  { value: 'INTERIOR', label: 'Intérieur' },
  { value: 'PARTITION', label: 'Cloison' },
  { value: 'OTHER', label: 'Autre' },
];

const REFERENCE_SIDES = [
  { value: 'CENTER', label: 'Axe' },
  { value: 'INTERIOR', label: 'Face intérieure' },
  { value: 'EXTERIOR', label: 'Face extérieure' },
];

const SLAB_ROLES = [
  { value: 'FLOOR', label: 'Plancher' },
  { value: 'CEILING', label: 'Plafond' },
  { value: 'TERRACE', label: 'Terrasse' },
];

const SPACE_CATEGORIES = [
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

const DIMENSION_TYPES = [
  { value: 'ALIGNED', label: 'Alignée' },
  { value: 'HORIZONTAL', label: 'Horizontale' },
  { value: 'VERTICAL', label: 'Verticale' },
];

function assemblyOptions(project: Project, categories: readonly string[]) {
  return (project.assemblies ?? [])
    .filter(({ category }) => categories.includes(category))
    .map(({ id, name }) => ({ value: id, label: name }));
}

/** A number the user typed, or nothing when it is not one. */
function parsed(value: string): number | undefined {
  const parsedValue = Number(value.replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function wallEdits(
  project: Project,
  level: Level,
  wall: Wall,
): readonly InspectorEdit[] {
  const edits: InspectorEdit[] = [
    {
      id: 'assemblyId',
      label: 'Assemblage',
      control: {
        kind: 'SELECT',
        value: wall.assemblyId,
        options: assemblyOptions(project, ['WALL', 'PARTITION']),
      },
      apply: (value) =>
        new UpdateWallCommand(level.id, wall.id, { assemblyId: value }),
    },
    {
      id: 'role',
      label: 'Rôle',
      control: { kind: 'SELECT', value: wall.role, options: WALL_ROLES },
      hint: "Le rôle décide de l'appartenance à l'enveloppe thermique.",
      apply: (value) =>
        new UpdateWallCommand(level.id, wall.id, {
          role: value as Wall['role'],
        }),
    },
    {
      id: 'referenceSide',
      label: 'Face de référence',
      control: {
        kind: 'SELECT',
        value: wall.referenceSide,
        options: REFERENCE_SIDES,
      },
      apply: (value) =>
        new UpdateWallCommand(level.id, wall.id, {
          referenceSide: value as Wall['referenceSide'],
        }),
    },
    {
      id: 'baseOffsetMm',
      label: 'Décalage en pied',
      control: {
        kind: 'NUMBER',
        value: wall.baseOffsetMm,
        unit: 'mm',
        step: 10,
      },
      apply: (value) => {
        const baseOffsetMm = parsed(value);
        return baseOffsetMm === undefined
          ? undefined
          : new UpdateWallCommand(level.id, wall.id, { baseOffsetMm });
      },
    },
  ];
  if (wall.heightMode === 'EXPLICIT')
    edits.push({
      id: 'heightMm',
      label: 'Hauteur',
      control: {
        kind: 'NUMBER',
        value: wall.heightMm,
        unit: 'mm',
        step: 10,
        min: 1,
      },
      apply: (value) => {
        const heightMm = parsed(value);
        return heightMm === undefined
          ? undefined
          : new UpdateWallCommand(level.id, wall.id, { heightMm });
      },
    });
  return edits;
}

/**
 * The properties the selected object lets the user change.
 *
 * The toolbar creates; the inspector modifies. An object with nothing editable
 * returns an empty list rather than a disabled form.
 */
export function editsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] {
  for (const level of project.building.levels) {
    const wall = level.walls.find(({ id }) => id === objectId);
    if (wall !== undefined) return wallEdits(project, level, wall);

    const opening = level.openings.find(({ id }) => id === objectId);
    if (opening !== undefined)
      return [
        {
          id: 'openingType',
          label: 'Type',
          control: {
            kind: 'SELECT',
            value: opening.openingType,
            options: [
              { value: 'DOOR', label: 'Porte' },
              { value: 'WINDOW', label: 'Fenêtre' },
            ],
          },
          apply: (value) =>
            new UpdateOpeningCommand(level.id, opening.id, {
              openingType: value as 'DOOR' | 'WINDOW',
            }),
        },
        ...(
          [
            ['widthMm', 'Largeur', opening.widthMm],
            ['heightMm', 'Hauteur', opening.heightMm],
            ['sillHeightMm', 'Allège', opening.sillHeightMm],
            [
              'offsetAlongHostMm',
              'Position sur le mur',
              opening.offsetAlongHostMm,
            ],
          ] as const
        ).map(([field, label, value]) => ({
          id: field,
          label,
          control: { kind: 'NUMBER' as const, value, unit: 'mm', step: 10 },
          apply: (next: string) => {
            const parsedValue = parsed(next);
            return parsedValue === undefined
              ? undefined
              : new UpdateOpeningCommand(level.id, opening.id, {
                  [field]: parsedValue,
                });
          },
        })),
      ];

    const space = level.spaces.find(({ id }) => id === objectId);
    if (space !== undefined)
      return [
        {
          id: 'name',
          label: 'Nom',
          control: { kind: 'TEXT', value: space.name },
          apply: (value) =>
            new UpdateSpaceCommand(level.id, space.id, { name: value }),
        },
        {
          id: 'category',
          label: 'Usage',
          control: {
            kind: 'SELECT',
            value: space.category,
            options: SPACE_CATEGORIES,
          },
          apply: (value) =>
            new UpdateSpaceCommand(level.id, space.id, { category: value }),
        },
      ];

    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined)
      return [
        {
          id: 'assemblyId',
          label: 'Assemblage',
          control: {
            kind: 'SELECT',
            value: slab.assemblyId,
            options: assemblyOptions(project, ['FLOOR', 'CEILING']),
          },
          apply: (value) =>
            new UpdateSlabCommand(level.id, slab.id, { assemblyId: value }),
        },
        {
          id: 'role',
          label: 'Rôle',
          control: { kind: 'SELECT', value: slab.role, options: SLAB_ROLES },
          apply: (value) =>
            new UpdateSlabCommand(level.id, slab.id, {
              role: value as typeof slab.role,
            }),
        },
        {
          id: 'elevationOffsetMm',
          label: 'Décalage',
          control: {
            kind: 'NUMBER',
            value: slab.elevationOffsetMm,
            unit: 'mm',
            step: 10,
          },
          apply: (value) => {
            const elevationOffsetMm = parsed(value);
            return elevationOffsetMm === undefined
              ? undefined
              : new UpdateSlabCommand(level.id, slab.id, {
                  elevationOffsetMm,
                });
          },
        },
      ];

    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined)
      return [
        {
          id: 'assemblyId',
          label: 'Assemblage',
          control: {
            kind: 'SELECT',
            value: roof.assemblyId,
            options: assemblyOptions(project, ['ROOF', 'FLOOR']),
          },
          apply: (value) =>
            new UpdateRoofCommand(level.id, roof.id, { assemblyId: value }),
        },
        {
          id: 'slopeDeg',
          label: 'Pente',
          control: {
            kind: 'NUMBER',
            value: roof.slopeDeg,
            unit: '°',
            step: 1,
            min: 0,
          },
          apply: (value) => {
            const slopeDeg = parsed(value);
            return slopeDeg === undefined
              ? undefined
              : new UpdateRoofCommand(level.id, roof.id, { slopeDeg });
          },
        },
        {
          id: 'azimuthDeg',
          label: 'Azimut',
          control: {
            kind: 'NUMBER',
            value: roof.azimuthDeg,
            unit: '°',
            step: 1,
            min: 0,
          },
          apply: (value) => {
            const azimuthDeg = parsed(value);
            return azimuthDeg === undefined
              ? undefined
              : new UpdateRoofCommand(level.id, roof.id, { azimuthDeg });
          },
        },
      ];

    const dimension = level.annotations.find(({ id }) => id === objectId);
    if (dimension !== undefined && isDimension(dimension))
      return [
        {
          id: 'type',
          label: 'Type',
          control: {
            kind: 'SELECT',
            value: dimension.type,
            options: DIMENSION_TYPES,
          },
          apply: (value) =>
            new UpdateDimensionCommand(level.id, dimension.id, {
              type: value as typeof dimension.type,
            }),
        },
        {
          id: 'offsetMm',
          label: 'Décalage',
          control: {
            kind: 'NUMBER',
            value: dimension.offsetMm,
            unit: 'mm',
            step: 50,
          },
          apply: (value) => {
            const offsetMm = parsed(value);
            return offsetMm === undefined
              ? undefined
              : new UpdateDimensionCommand(level.id, dimension.id, {
                  offsetMm,
                });
          },
        },
        {
          id: 'overrideText',
          label: 'Texte imposé',
          control: {
            kind: 'TEXT',
            value: dimension.overrideText ?? '',
            placeholder: 'valeur mesurée',
          },
          hint: "Un texte imposé s'affiche à la place de la valeur, il ne la remplace pas.",
          apply: (value) =>
            new UpdateDimensionCommand(level.id, dimension.id, {
              overrideText: value.trim() === '' ? null : value,
            }),
        },
      ];
  }

  for (const network of project.systems ?? []) {
    const node = network.nodes.find(({ id }) => id === objectId);
    if (node === undefined) continue;
    const spaces = project.building.levels.flatMap(({ spaces: levelSpaces }) =>
      levelSpaces.map(({ id, name }) => ({ value: id, label: name })),
    );
    return [
      {
        id: 'spaceId',
        label: 'Pièce desservie',
        control: {
          kind: 'SELECT',
          value: node.spaceId ?? '',
          options: [{ value: '', label: 'Non renseignée' }, ...spaces],
        },
        apply: (value) =>
          new UpdateNetworkNodeCommand(network.id, node.id, {
            spaceId: value === '' ? null : value,
          }),
      },
      ...(
        [
          ['x', 'Position X'],
          ['y', 'Position Y'],
          ['z', 'Position Z'],
        ] as const
      ).map(([axis, label]) => ({
        id: `position-${axis}`,
        label,
        control: {
          kind: 'NUMBER' as const,
          value: node.position[axis],
          unit: 'mm',
          step: 50,
        },
        apply: (next: string) => {
          const value = parsed(next);
          return value === undefined
            ? undefined
            : new UpdateNetworkNodeCommand(network.id, node.id, {
                position: { ...node.position, [axis]: value },
              });
        },
      })),
    ];
  }

  return [];
}
