import type {
  ComponentCategory,
  DoorSwing,
  Level,
  RoofEdge,
  StairType,
  StructuralMemberKind,
  TextNote,
  Opening,
  Project,
  Wall,
} from '@house-technical-designer/core-domain';
import {
  DEFAULT_NOTE_HEIGHT_MM,
  doorSwingOf,
  isDimension,
  isTextNote,
} from '@house-technical-designer/core-domain';
import type {
  JsonValue,
  SiteObstacleKind,
} from '@house-technical-designer/core-domain';
import { edgePropertySchema } from '@house-technical-designer/editor-core';
import {
  MoveWallPointCommand,
  ProjectEditorCommand,
  UpdateSiteObstacleCommand,
  UpdateDimensionCommand,
  UpdateNetworkEdgeCommand,
  UpdateNetworkNodeCommand,
  UpdateOpeningCommand,
  UpdateRoofCommand,
  UpdateSlabCommand,
  UpdateSpaceCommand,
  SetWallHeightCommand,
  UpdateComponentCommand,
  UpdateRoofStructureCommand,
  UpdateStairCommand,
  UpdateStructuralMemberCommand,
  UpdateTextNoteCommand,
  UpdateWallCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  DIMENSION_TYPE_OPTIONS,
  OPENING_TYPE_OPTIONS,
  REFERENCE_SIDE_OPTIONS,
  SLAB_ROLE_OPTIONS,
  WALL_ROLE_OPTIONS,
  COMPONENT_CATEGORY_OPTIONS,
  ROOF_EDGE_KIND_OPTIONS,
  STAIR_TYPE_OPTIONS,
  STRUCTURAL_MEMBER_OPTIONS,
  SITE_OBSTACLE_OPTIONS,
  SPACE_CATEGORY_OPTIONS as SPACE_CATEGORIES,
} from './domain-options.js';
import { polygonSurfaceEdits } from './polygon-edits.js';
import { polygonSurface } from './polygon-surface.js';

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
  /**
   * Where in the file this property lives, when it is not `<object>/<id>`.
   *
   * A scenario names what it varies by a path into the project. Nearly every
   * property here is named after the field it writes, so the path follows from
   * the object and the identifier; the ones that are not say so.
   */
  readonly scenarioPath?: string;
  /**
   * La bibliothèque où se choisit ce que ce champ désigne.
   *
   * Changer l'assemblage d'un mur demandait de quitter le plan pour
   * « Matériaux », de trouver la fiche, puis de revenir : une bibliothèque
   * était une destination alors que c'est un catalogue qu'on consulte. Le
   * champ qui désigne une fiche sait laquelle, et sait donc l'ouvrir.
   */
  readonly library?: 'materials' | 'assemblies' | 'openings' | 'equipment';
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
      library: 'assemblies',
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
          // The model is what carries the transmittance the envelope needs.
          // The field existed on the opening and nothing could write it, so
          // every window in every project was an unknown.
          id: 'definitionId',
          semanticId: 'opening.definitionId',
          library: 'openings',
          label: 'Menuiserie',
          control: {
            kind: 'SELECT',
            value: opening.definitionId ?? '',
            options: [
              { value: '', label: 'Aucune' },
              ...(project.openingTypes ?? [])
                .filter(({ category }) => category !== 'SOLAR_PROTECTION')
                .map(({ id, name }) => ({ value: id, label: name })),
            ],
          },
          apply: (value) =>
            new UpdateOpeningCommand(level.id, opening.id, {
              definitionId: value === '' ? null : value,
            }),
        },
        ...(opening.openingType === 'DOOR'
          ? doorSwingEdits(level.id, opening)
          : []),
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

/**
 * Le sens d’ouverture d’une porte, énoncé par rapport au tracé de son mur.
 *
 * Jamais « à gauche » ou « à droite » de l’écran : le même dessin retourné
 * donnerait une autre porte, et le modèle ne peut pas porter un fait qui dépend
 * de la manière dont on le regarde.
 */
function doorSwingEdits(
  levelId: string,
  opening: Opening,
): readonly InspectorEdit[] {
  const swing = doorSwingOf(opening);
  return [
    {
      id: 'swing.hinge',
      semanticId: 'opening.swing.hinge',
      label: 'Gond',
      control: {
        kind: 'SELECT',
        value: swing.hinge,
        options: [
          { value: 'START', label: 'Début du mur' },
          { value: 'END', label: 'Fin du mur' },
        ],
      },
      apply: (value) =>
        new UpdateOpeningCommand(levelId, opening.id, {
          swing: { ...swing, hinge: value as DoorSwing['hinge'] },
        }),
    },
    {
      id: 'swing.opensTo',
      semanticId: 'opening.swing.opensTo',
      label: 'Ouvre vers',
      control: {
        kind: 'SELECT',
        value: swing.opensTo,
        options: [
          { value: 'LEFT_OF_HOST', label: 'Gauche du mur' },
          { value: 'RIGHT_OF_HOST', label: 'Droite du mur' },
        ],
      },
      apply: (value) =>
        new UpdateOpeningCommand(levelId, opening.id, {
          swing: { ...swing, opensTo: value as DoorSwing['opensTo'] },
        }),
    },
  ];
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
          library: 'assemblies',
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
        // Et son contour, mesuré et corrigeable — le même jeu de champs que
        // pour une toiture, une trémie ou une parcelle.
        ...polygonSurfaceEdits(project, level.id, objectId),
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
        ...polygonSurfaceEdits(project, level.id, objectId),
      ];
  }
  return undefined;
}

/** Les propriétés modifiables d’une cote. */
/** What a note lets the user change: what it says and how big it says it. */
export function noteEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const note = level.annotations.find(
      (annotation): annotation is TextNote =>
        annotation.id === objectId && isTextNote(annotation),
    );
    if (note === undefined) continue;
    return [
      {
        id: 'text',
        semanticId: 'note.text',
        label: 'Texte',
        control: { kind: 'TEXT', value: note.text },
        hint: 'Écrit tel quel sur le plan ; aucun calcul ne le lit.',
        apply: (value) =>
          value.trim() === ''
            ? undefined
            : new UpdateTextNoteCommand(level.id, note.id, { text: value }),
      },
      {
        id: 'heightMm',
        semanticId: 'note.heightMm',
        label: 'Hauteur des lettres',
        control: {
          kind: 'NUMBER',
          value: note.heightMm ?? DEFAULT_NOTE_HEIGHT_MM,
          unit: 'mm',
          step: 0.5,
          min: 0.5,
        },
        hint: 'Sur le papier, à l’échelle de la feuille.',
        apply: (value) => {
          const heightMm = parsed(value);
          return heightMm === undefined || heightMm <= 0
            ? undefined
            : new UpdateTextNoteCommand(level.id, note.id, { heightMm });
        },
      },
      {
        id: 'rotationDeg',
        semanticId: 'note.rotationDeg',
        label: 'Orientation',
        control: {
          kind: 'NUMBER',
          value: note.rotationDeg ?? 0,
          unit: '°',
          step: 15,
        },
        apply: (value) => {
          const rotationDeg = parsed(value);
          return rotationDeg === undefined
            ? undefined
            : new UpdateTextNoteCommand(level.id, note.id, { rotationDeg });
        },
      },
    ];
  }
  return undefined;
}

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
        scenarioPath: `systems/${network.id}/nodes/${node.id}/position/${axis}`,
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

/** What a thing placed in the building lets the user change. */
export function componentEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const component = (level.components ?? []).find(
      ({ id }) => id === objectId,
    );
    if (component === undefined) continue;
    return [
      {
        id: 'name',
        semanticId: 'component.name',
        label: 'Nom',
        control: { kind: 'TEXT', value: component.name ?? '' },
        hint: 'Vide, le composant prend le nom de sa catégorie.',
        apply: (value) =>
          new UpdateComponentCommand(level.id, component.id, { name: value }),
      },
      {
        id: 'category',
        semanticId: 'component.category',
        label: 'Catégorie',
        control: {
          kind: 'SELECT',
          value: component.category,
          options: COMPONENT_CATEGORY_OPTIONS,
        },
        apply: (value) =>
          new UpdateComponentCommand(level.id, component.id, {
            category: value as ComponentCategory,
          }),
      },
      {
        id: 'definitionId',
        semanticId: 'component.definitionId',
        library: 'equipment',
        label: 'Modèle catalogue',
        control: {
          kind: 'SELECT',
          value: component.definitionId ?? '',
          options: [
            { value: '', label: 'Aucun modèle' },
            ...(project.equipment ?? []).map((definition) => ({
              value: definition.id,
              label: `${definition.kind} · ${definition.id}`,
            })),
          ],
        },
        hint: 'Les propriétés physiques appartiennent au modèle, pas à l’objet posé.',
        apply: (value) =>
          new UpdateComponentCommand(level.id, component.id, {
            definitionId: value === '' ? null : value,
          }),
      },
      {
        id: 'spaceId',
        semanticId: 'component.spaceId',
        label: 'Pièce',
        control: {
          kind: 'SELECT',
          value: component.spaceId ?? '',
          options: [
            { value: '', label: 'Aucune pièce déclarée' },
            ...level.spaces.map((space) => ({
              value: space.id,
              label: space.name,
            })),
          ],
        },
        apply: (value) =>
          new UpdateComponentCommand(level.id, component.id, {
            spaceId: value === '' ? null : value,
          }),
      },
      {
        id: 'elevationMm',
        semanticId: 'component.elevationMm',
        label: 'Altitude sur le niveau',
        control: {
          kind: 'NUMBER',
          value: component.elevationMm,
          unit: 'mm',
          step: 10,
        },
        apply: (value) => {
          const elevationMm = parsed(value);
          return elevationMm === undefined
            ? undefined
            : new UpdateComponentCommand(level.id, component.id, {
                elevationMm,
              });
        },
      },
      {
        id: 'rotationDeg',
        semanticId: 'component.rotationDeg',
        label: 'Orientation',
        control: {
          kind: 'NUMBER',
          value: component.rotationDeg,
          unit: '°',
          step: 5,
        },
        apply: (value) => {
          const rotationDeg = parsed(value);
          return rotationDeg === undefined
            ? undefined
            : new UpdateComponentCommand(level.id, component.id, {
                rotationDeg,
              });
        },
      },
    ];
  }
  return undefined;
}

/** What a stair lets the user change; its riser height follows and is not one. */
export function stairEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const stair = level.stairs.find(({ id }) => id === objectId);
    if (stair === undefined) continue;
    const upper = project.building.levels.filter(
      ({ elevationMm }) => elevationMm > level.elevationMm,
    );
    return [
      {
        id: 'topLevelId',
        semanticId: 'stair.topLevelId',
        label: 'Niveau d’arrivée',
        control: {
          kind: 'SELECT',
          value: stair.topLevelId,
          options: upper.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
          })),
        },
        apply: (value) =>
          new UpdateStairCommand(level.id, stair.id, { topLevelId: value }),
      },
      {
        id: 'stairType',
        semanticId: 'stair.stairType',
        label: 'Type',
        control: {
          kind: 'SELECT',
          value: stair.stairType,
          options: STAIR_TYPE_OPTIONS,
        },
        apply: (value) =>
          new UpdateStairCommand(level.id, stair.id, {
            stairType: value as StairType,
          }),
      },
      {
        id: 'riserCount',
        semanticId: 'stair.riserCount',
        label: 'Contremarches',
        control: { kind: 'NUMBER', value: stair.riserCount, step: 1, min: 2 },
        hint: 'La hauteur de marche s’en déduit avec la montée.',
        apply: (value) => {
          const riserCount = parsed(value);
          return riserCount === undefined
            ? undefined
            : new UpdateStairCommand(level.id, stair.id, { riserCount });
        },
      },
      {
        id: 'treadDepthMm',
        semanticId: 'stair.treadDepthMm',
        label: 'Giron',
        control: {
          kind: 'NUMBER',
          value: stair.treadDepthMm,
          unit: 'mm',
          step: 10,
          min: 1,
        },
        apply: (value) => {
          const treadDepthMm = parsed(value);
          return treadDepthMm === undefined
            ? undefined
            : new UpdateStairCommand(level.id, stair.id, { treadDepthMm });
        },
      },
      {
        id: 'widthMm',
        semanticId: 'stair.widthMm',
        label: 'Emmarchement',
        control: {
          kind: 'NUMBER',
          value: stair.widthMm,
          unit: 'mm',
          step: 50,
          min: 1,
        },
        apply: (value) => {
          const widthMm = parsed(value);
          return widthMm === undefined
            ? undefined
            : new UpdateStairCommand(level.id, stair.id, { widthMm });
        },
      },
    ];
  }
  return undefined;
}

/**
 * What a roof described by its outline lets the user change.
 *
 * Every side is offered on its own: which is a slope and which is a gable is
 * the decision that turns one outline into a hipped roof, a two-sided roof or
 * a single pitch, and it belongs to the side.
 */
export function roofStructureEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const roof = (level.roofStructures ?? []).find(({ id }) => id === objectId);
    if (roof === undefined) continue;
    const withEdge = (index: number, next: RoofEdge) =>
      new UpdateRoofStructureCommand(level.id, roof.id, {
        edges: roof.edges.map((edge, position) =>
          position === index ? next : edge,
        ),
      });
    return [
      {
        id: 'assemblyId',
        semanticId: 'roofStructure.assemblyId',
        label: 'Assemblage',
        control: {
          kind: 'SELECT',
          value: roof.assemblyId,
          options: assemblyOptions(project, ['ROOF', 'FLOOR']),
        },
        apply: (value) =>
          new UpdateRoofStructureCommand(level.id, roof.id, {
            assemblyId: value,
          }),
      },
      {
        id: 'baseElevationMm',
        semanticId: 'roofStructure.baseElevationMm',
        label: 'Altitude d’égout',
        control: {
          kind: 'NUMBER',
          value: roof.baseElevationMm,
          unit: 'mm',
          step: 50,
        },
        apply: (value) => {
          const baseElevationMm = parsed(value);
          return baseElevationMm === undefined
            ? undefined
            : new UpdateRoofStructureCommand(level.id, roof.id, {
                baseElevationMm,
              });
        },
      },
      ...roof.edges.flatMap((edge, index) => [
        {
          id: `edge${index}Kind`,
          semanticId: `roofStructure.edge.kind`,
          label: `Côté ${index + 1}`,
          control: {
            kind: 'SELECT' as const,
            value: edge.kind,
            options: ROOF_EDGE_KIND_OPTIONS,
          },
          apply: (value: string) =>
            withEdge(index, { ...edge, kind: value as RoofEdge['kind'] }),
        },
        {
          id: `edge${index}Slope`,
          semanticId: `roofStructure.edge.slopeDeg`,
          label: `Côté ${index + 1} · pente`,
          control: {
            kind: 'NUMBER' as const,
            value: edge.slopeDeg,
            unit: '°',
            step: 1,
          },
          apply: (value: string) => {
            const slopeDeg = parsed(value);
            return slopeDeg === undefined
              ? undefined
              : withEdge(index, { ...edge, slopeDeg });
          },
        },
        {
          id: `edge${index}Overhang`,
          semanticId: `roofStructure.edge.overhangMm`,
          label: `Côté ${index + 1} · débord`,
          control: {
            kind: 'NUMBER' as const,
            value: edge.overhangMm,
            unit: 'mm',
            step: 50,
            min: 0,
          },
          apply: (value: string) => {
            const overhangMm = parsed(value);
            return overhangMm === undefined
              ? undefined
              : withEdge(index, { ...edge, overhangMm });
          },
        },
      ]),
    ];
  }
  return undefined;
}

/** What a structural member lets the user change. */
export function structureEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const level of project.building.levels) {
    const member = (level.structure ?? []).find(({ id }) => id === objectId);
    if (member === undefined) continue;
    return [
      {
        id: 'kind',
        semanticId: 'structure.kind',
        label: 'Élément',
        control: {
          kind: 'SELECT',
          value: member.kind,
          options: STRUCTURAL_MEMBER_OPTIONS,
        },
        hint: 'Une poutre court entre deux points ; un poteau se tient en un.',
        apply: (value) =>
          new UpdateStructuralMemberCommand(level.id, member.id, {
            kind: value as StructuralMemberKind,
          }),
      },
      ...(
        [
          ['widthMm', 'Largeur'],
          ['depthMm', 'Profondeur'],
          ['heightMm', 'Hauteur'],
        ] as const
      ).map(([key, label]) => ({
        id: key,
        semanticId: `structure.${key}`,
        label,
        control: {
          kind: 'NUMBER' as const,
          value: member[key] ?? 0,
          unit: 'mm',
          step: 10,
          min: 1,
        },
        apply: (next: string) => {
          const parsedValue = parsed(next);
          return parsedValue === undefined
            ? undefined
            : new UpdateStructuralMemberCommand(level.id, member.id, {
                [key]: parsedValue,
              });
        },
      })),
      {
        id: 'materialId',
        semanticId: 'structure.materialId',
        library: 'materials',
        label: 'Matériau',
        control: {
          kind: 'SELECT',
          value: member.materialId ?? '',
          options: [
            { value: '', label: 'Aucun matériau désigné' },
            ...(project.materialLibrary?.materials ?? []).map((material) => ({
              value: material.id,
              label: material.name,
            })),
          ],
        },
        apply: (value) =>
          new UpdateStructuralMemberCommand(level.id, member.id, {
            materialId: value === '' ? null : value,
          }),
      },
    ];
  }
  return undefined;
}

/**
 * What a routed segment lets the user change, from the plan.
 *
 * A segment was described but never edited here: its physical properties
 * belonged to the networks workspace, so what a pipe is made of could only be
 * said somewhere other than where the pipe is. What it may carry is the
 * discipline's own schema, so a new discipline brings its own fields.
 */
export function networkEdgeEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  for (const network of project.systems ?? []) {
    const edge = network.edges.find(({ id }) => id === objectId);
    if (edge === undefined) continue;
    const held = edge.properties ?? {};
    return edgePropertySchema(network.discipline).map((descriptor) => {
      const value = held[descriptor.key];
      const write = (next: JsonValue | undefined) => {
        const { [descriptor.key]: _replaced, ...rest } = held;
        return new UpdateNetworkEdgeCommand(
          network.id,
          edge.id,
          next === undefined ? rest : { ...rest, [descriptor.key]: next },
        );
      };
      // A segment keeps what it is made of under `properties`, so the path a
      // scenario would vary is not the object's path plus the field name.
      const scenarioPath = `systems/${network.id}/edges/${edge.id}/properties/${descriptor.key}`;
      if (descriptor.kind === 'CHOICE')
        return {
          id: descriptor.key,
          semanticId: `networkEdge.${descriptor.key}`,
          scenarioPath,
          label: descriptor.label,
          control: {
            kind: 'SELECT' as const,
            value: typeof value === 'string' ? value : '',
            options: [
              { value: '', label: 'Non renseigné' },
              ...(descriptor.options ?? []),
            ],
          },
          ...(descriptor.hint === undefined ? {} : { hint: descriptor.hint }),
          apply: (next: string) => write(next === '' ? undefined : next),
        };
      return {
        id: descriptor.key,
        semanticId: `networkEdge.${descriptor.key}`,
        scenarioPath,
        label: descriptor.label,
        control: {
          kind: 'NUMBER' as const,
          value: typeof value === 'number' ? value : 0,
          ...(descriptor.unit === undefined ? {} : { unit: descriptor.unit }),
          ...(descriptor.min === undefined ? {} : { min: descriptor.min }),
          // A diameter is held in metres and a section in square millimetres;
          // one step of the arrows has to mean something in both, so it is the
          // unit that decides it and not a number chosen once for all fields.
          step: descriptor.unit === 'm' ? 0.001 : 1,
        },
        ...(descriptor.hint === undefined ? {} : { hint: descriptor.hint }),
        apply: (next: string) => {
          // An emptied field is a value nobody stated any more, not a zero.
          if (next.trim() === '') return write(undefined);
          const parsedValue = parsed(next);
          return parsedValue === undefined ? undefined : write(parsedValue);
        },
      };
    });
  }
  return undefined;
}

/**
 * Ce qu'un terrain laisse corriger.
 *
 * La parcelle et les emprises n'avaient **aucune** propriété modifiable : une
 * parcelle mal bornée se retraçait, et un obstacle mal nommé restait mal
 * nommé. Ce sont pourtant des contours comme les autres — plus, pour un
 * obstacle, ce qu'il est et quelle hauteur il fait.
 */
export function siteEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  const surface = polygonSurfaceEdits(project, undefined, objectId);
  if (objectId === 'site:parcel')
    return project.site.parcelBoundary === undefined ? undefined : surface;

  const obstacle = (project.site.obstacles ?? []).find(
    ({ id }) => id === objectId,
  );
  if (obstacle === undefined) return undefined;
  return [
    {
      id: 'name',
      semanticId: 'site.obstacle.name',
      label: 'Nom',
      control: {
        kind: 'TEXT',
        value: obstacle.name ?? '',
        placeholder: obstacle.kind ?? 'Sans nom',
      },
      apply: (value) =>
        new UpdateSiteObstacleCommand(obstacle.id, { name: value }),
    },
    {
      id: 'kind',
      semanticId: 'site.obstacle.kind',
      label: 'Nature',
      control: {
        kind: 'SELECT',
        value: obstacle.kind ?? 'OTHER',
        options: SITE_OBSTACLE_OPTIONS,
      },
      apply: (value) =>
        new UpdateSiteObstacleCommand(obstacle.id, {
          kind: value as SiteObstacleKind,
        }),
    },
    {
      id: 'heightMm',
      semanticId: 'site.obstacle.heightMm',
      label: 'Hauteur',
      // Une hauteur inconnue n'est pas une hauteur nulle : un arbre de zéro
      // mètre ne porte aucune ombre, et c'est l'ombre qu'on calcule.
      hint: 'Vide : hauteur inconnue.',
      control: {
        kind: 'NUMBER',
        value: obstacle.heightMm ?? 0,
        unit: 'mm',
        step: 100,
        min: 0,
      },
      apply: (value) => {
        const heightMm = parsed(value);
        return heightMm === undefined
          ? undefined
          : new UpdateSiteObstacleCommand(obstacle.id, { heightMm });
      },
    },
    ...surface,
  ];
}

/** Les propriétés d'une trémie : son contour, et rien d'autre. */
export function slabHoleEditsFor(
  project: Project,
  objectId: string,
): readonly InspectorEdit[] | undefined {
  const surface = polygonSurface(project, undefined, objectId);
  if (surface?.kind !== 'SLAB_HOLE') return undefined;
  return polygonSurfaceEdits(project, surface.levelId, objectId);
}
