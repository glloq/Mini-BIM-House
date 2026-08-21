import type {
  Level,
  Opening,
  Project,
  Wall,
} from '@house-technical-designer/core-domain';
import { isDimension } from '@house-technical-designer/core-domain';
import {
  MoveWallPointCommand,
  ProjectEditorCommand,
  UpdateDimensionCommand,
  UpdateNetworkNodeCommand,
  UpdateOpeningCommand,
  UpdateRoofCommand,
  UpdateSlabCommand,
  UpdateSpaceCommand,
  SetWallHeightCommand,
  UpdateWallCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  DIMENSION_TYPE_OPTIONS,
  OPENING_TYPE_OPTIONS,
  REFERENCE_SIDE_OPTIONS,
  SLAB_ROLE_OPTIONS,
  WALL_ROLE_OPTIONS,
  SPACE_CATEGORY_OPTIONS as SPACE_CATEGORIES,
} from './domain-options.js';

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
  /**
   * What this property is, across families.
   *
   * A wall and a slab both have a `role`, and they are not the same role: one
   * takes EXTERIOR or PARTITION, the other FLOOR or TERRACE. Editing several
   * objects at once compares this rather than the field name, so a selection of
   * both is never offered a single menu that would write nonsense into one of
   * them. Two families may share a meaning on purpose — that is what giving
   * them the same value here says.
   */
  readonly semanticId: string;
  readonly label: string;
  readonly control: InspectorControl;
  readonly hint?: string;
  readonly apply: (value: string) => ProjectCommand | undefined;
}

/**
 * Usages a room can be given.
 *
 * The domain keeps the category a free string, so this list is the
 * application's proposal rather than a closed set: a project may carry a
 * category this menu does not offer, and it is shown as it is.
 */
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

/**
 * Length and bearing of a straight wall, as the user reads them on a plan.
 *
 * Typing a length moves the far end along the axis the wall already has; typing
 * an angle turns it around its start. Both are expressed as a move of one
 * point, so they go through the same validation as dragging that point — an
 * opening that would end up outside its wall refuses the edit either way.
 */
function straightWallEdits(level: Level, wall: Wall): readonly InspectorEdit[] {
  const start = wall.path.points[0];
  const end = wall.path.points[1];
  if (start === undefined || end === undefined || wall.path.points.length !== 2)
    return [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthMm = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const moveEnd = (nextLengthMm: number, nextAngleDeg: number) => {
    const radians = (nextAngleDeg * Math.PI) / 180;
    return new ProjectEditorCommand(
      `wall:point:${wall.id}:1`,
      'Modifier la géométrie du mur',
      level.id,
      new MoveWallPointCommand(`wall:point:${wall.id}`, wall.id, 1, {
        x: start.x + Math.cos(radians) * nextLengthMm,
        y: start.y + Math.sin(radians) * nextLengthMm,
      }),
    );
  };
  return [
    {
      id: 'lengthMm',
      semanticId: 'wall.lengthMm',
      label: 'Longueur',
      control: {
        kind: 'NUMBER',
        value: Math.round(lengthMm),
        unit: 'mm',
        step: 10,
        min: 1,
      },
      hint: 'Mesurée sur l’axe ; le mur pivote autour de son point de départ.',
      apply: (value) => {
        const next = parsed(value);
        return next === undefined || next <= 0
          ? undefined
          : moveEnd(next, angleDeg);
      },
    },
    {
      id: 'angleDeg',
      semanticId: 'wall.angleDeg',
      label: 'Angle',
      control: {
        kind: 'NUMBER',
        value: Number(angleDeg.toFixed(2)),
        unit: '°',
        step: 0.5,
      },
      hint: 'Depuis l’axe X du plan, dans le sens trigonométrique.',
      apply: (value) => {
        const next = parsed(value);
        return next === undefined ? undefined : moveEnd(lengthMm, next);
      },
    },
  ];
}

function wallEdits(
  project: Project,
  level: Level,
  wall: Wall,
): readonly InspectorEdit[] {
  const edits: InspectorEdit[] = [
    ...straightWallEdits(level, wall),
    {
      id: 'assemblyId',
      semanticId: 'wall.assemblyId',
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
      semanticId: 'wall.role',
      label: 'Rôle',
      control: {
        kind: 'SELECT',
        value: wall.role,
        options: WALL_ROLE_OPTIONS,
      },
      hint: "Le rôle décide de l'appartenance à l'enveloppe thermique.",
      apply: (value) =>
        new UpdateWallCommand(level.id, wall.id, {
          role: value as Wall['role'],
        }),
    },
    {
      id: 'referenceSide',
      semanticId: 'wall.referenceSide',
      label: 'Face de référence',
      control: {
        kind: 'SELECT',
        value: wall.referenceSide,
        options: REFERENCE_SIDE_OPTIONS,
      },
      apply: (value) =>
        new UpdateWallCommand(level.id, wall.id, {
          referenceSide: value as Wall['referenceSide'],
        }),
    },
    {
      id: 'baseOffsetMm',
      semanticId: 'wall.baseOffsetMm',
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
  // Reaching a storey above and standing a stated height are two shapes of the
  // same wall, not two fields that may both be set. The domain has accepted
  // TO_LEVEL from the beginning and no screen could produce one.
  const upper = project.building.levels.filter(
    ({ elevationMm }) => elevationMm > level.elevationMm,
  );
  edits.push({
    id: 'heightMode',
    semanticId: 'wall.heightMode',
    label: 'Hauteur définie par',
    control: {
      kind: 'SELECT',
      value: wall.heightMode,
      options: [
        { value: 'EXPLICIT', label: 'Une hauteur saisie' },
        { value: 'TO_LEVEL', label: 'Le niveau supérieur' },
      ],
    },
    hint:
      upper.length === 0
        ? 'Aucun niveau au-dessus de celui-ci.'
        : 'Un mur monté jusqu’à un niveau suit ce niveau quand il se déplace.',
    apply: (value) => {
      if (value === wall.heightMode) return undefined;
      if (value === 'EXPLICIT')
        return new SetWallHeightCommand(level.id, wall.id, {
          mode: 'EXPLICIT',
          heightMm: level.defaultStoreyHeightMm,
        });
      const top = upper[0];
      return top === undefined
        ? undefined
        : new SetWallHeightCommand(level.id, wall.id, {
            mode: 'TO_LEVEL',
            topLevelId: top.id,
          });
    },
  });
  if (wall.heightMode === 'EXPLICIT')
    edits.push({
      id: 'heightMm',
      semanticId: 'wall.heightMm',
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
  else
    edits.push(
      {
        id: 'topLevelId',
        semanticId: 'wall.topLevelId',
        label: 'Niveau supérieur',
        control: {
          kind: 'SELECT',
          value: wall.topLevelId,
          options: upper.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
          })),
        },
        apply: (value) =>
          new SetWallHeightCommand(level.id, wall.id, {
            mode: 'TO_LEVEL',
            topLevelId: value,
            ...(wall.topOffsetMm === undefined
              ? {}
              : { topOffsetMm: wall.topOffsetMm }),
          }),
      },
      {
        id: 'topOffsetMm',
        semanticId: 'wall.topOffsetMm',
        label: 'Décalage en tête',
        control: {
          kind: 'NUMBER',
          value: wall.topOffsetMm ?? 0,
          unit: 'mm',
          step: 10,
        },
        hint: 'Négatif pour s’arrêter sous le niveau, positif pour le dépasser.',
        apply: (value) => {
          const topOffsetMm = parsed(value);
          return topOffsetMm === undefined
            ? undefined
            : new SetWallHeightCommand(level.id, wall.id, {
                mode: 'TO_LEVEL',
                topLevelId: wall.topLevelId,
                topOffsetMm,
              });
        },
      },
    );
  return edits;
}

/**
 * The properties the selected object lets the user change.
 *
 * The toolbar creates; the inspector modifies. An object with nothing editable
 * returns an empty list rather than a disabled form.
 */

/** Les propriétés modifiables d’un mur, ou rien si l’identifiant n’en désigne pas un. */
export function wallEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const wall = level.walls.find(({ id }) => id === objectId);
    if (wall !== undefined) return wallEdits(project, level, wall);
  }
  return undefined;
}

/** Les propriétés modifiables d’une ouverture. */
export function openingEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const opening = level.openings.find(({ id }) => id === objectId);
    if (opening !== undefined)
      return [
        {
          id: 'openingType',
          semanticId: 'opening.openingType',
          label: 'Type',
          control: {
            kind: 'SELECT',
            value: opening.openingType,
            options: OPENING_TYPE_OPTIONS,
          },
          apply: (value) =>
            new UpdateOpeningCommand(level.id, opening.id, {
              openingType: value as Opening['openingType'],
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
          semanticId: `opening.${field}`,
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
  }
  return undefined;
}

/** Les propriétés modifiables d’une pièce. */
export function spaceEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const space = level.spaces.find(({ id }) => id === objectId);
    if (space !== undefined)
      return [
        {
          id: 'name',
          semanticId: 'space.name',
          label: 'Nom',
          control: { kind: 'TEXT', value: space.name },
          apply: (value) =>
            new UpdateSpaceCommand(level.id, space.id, { name: value }),
        },
        {
          id: 'category',
          semanticId: 'space.category',
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
  }
  return undefined;
}

/** Les propriétés modifiables d’une dalle. */
export function slabEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined)
      return [
        {
          id: 'assemblyId',
          semanticId: 'slab.assemblyId',
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
          semanticId: 'slab.role',
          label: 'Rôle',
          control: {
            kind: 'SELECT',
            value: slab.role,
            options: SLAB_ROLE_OPTIONS,
          },
          apply: (value) =>
            new UpdateSlabCommand(level.id, slab.id, {
              role: value as typeof slab.role,
            }),
        },
        {
          id: 'elevationOffsetMm',
          semanticId: 'slab.elevationOffsetMm',
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
  }
  return undefined;
}

/** Les propriétés modifiables d’un pan de toiture. */
export function roofEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined)
      return [
        {
          id: 'assemblyId',
          semanticId: 'roof.assemblyId',
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
          semanticId: 'roof.slopeDeg',
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
          semanticId: 'roof.azimuthDeg',
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
  }
  return undefined;
}

/** Les propriétés modifiables d’une cote. */
export function dimensionEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const dimension = level.annotations.find(({ id }) => id === objectId);
    if (dimension !== undefined && isDimension(dimension))
      return [
        {
          id: 'type',
          semanticId: 'dimension.type',
          label: 'Type',
          control: {
            kind: 'SELECT',
            value: dimension.type,
            options: DIMENSION_TYPE_OPTIONS,
          },
          apply: (value) =>
            new UpdateDimensionCommand(level.id, dimension.id, {
              type: value as typeof dimension.type,
            }),
        },
        {
          id: 'offsetMm',
          semanticId: 'dimension.offsetMm',
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
          semanticId: 'networkNode.overrideText',
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
  return undefined;
}

/** Les propriétés modifiables d’un nœud de réseau. */
export function networkNodeEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const network of project.systems ?? []) {
    const node = network.nodes.find(({ id }) => id === objectId);
    if (node === undefined) continue;
    const spaces = project.building.levels.flatMap(({ spaces: levelSpaces }) =>
      levelSpaces.map(({ id, name }) => ({ value: id, label: name })),
    );
    return [
      {
        id: 'spaceId',
        semanticId: 'networkNode.spaceId',
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
        semanticId: `networkNode.position.${axis}`,
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
  return undefined;
}
