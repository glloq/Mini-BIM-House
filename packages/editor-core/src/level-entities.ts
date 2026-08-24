import {
  entityId,
  isDimension,
  levelEntities,
  type EntityFamily,
  type Level,
  type ProjectEntity,
} from '@house-technical-designer/core-domain';

/**
 * What each family of a storey does when the storey is copied, moved or
 * deleted.
 *
 * Three commands used to answer these questions separately, each with its own
 * list written by hand. They disagreed, and the disagreement was not
 * theoretical: a storey holding a whole roof, three posts and a heat pump
 * counted as empty, so deleting it took all of them with it without a word,
 * and moving the storey left the roof at the old height. Two families had been
 * added to the model and reached one list out of three.
 *
 * So the answer is a table, and a test proves the table covers exactly the
 * families a storey can hold. Adding a family to the model now fails that test
 * until somebody has said what happens to it here.
 */
export interface LevelFamilyPolicy {
  readonly family: EntityFamily;
  /**
   * Whether one of these stops the storey from being deleted.
   *
   * Everything the file carries does, including what this version cannot yet
   * edit: a stair nobody can select is still work, and losing it silently
   * loses it for good.
   */
  readonly blocksRemoval: boolean;
  /**
   * Whether its height is stored absolutely and must move with the storey.
   *
   * A roof states the height of its base above the ground; a component states
   * how high it sits above its own floor. Moving the storey moves the first
   * and leaves the second alone, and getting that backwards is how a roof ends
   * up floating a storey below its walls.
   */
  readonly absoluteHeight: boolean;
  /** Whether duplicating the storey copies it. */
  readonly duplicated: boolean;
}

export const LEVEL_FAMILY_POLICIES: readonly LevelFamilyPolicy[] = [
  {
    family: 'WALL',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'OPENING',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'SPACE',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'SLAB',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'ROOF_PLANE',
    blocksRemoval: true,
    absoluteHeight: true,
    duplicated: true,
  },
  {
    family: 'ROOF_STRUCTURE',
    blocksRemoval: true,
    absoluteHeight: true,
    duplicated: true,
  },
  {
    family: 'STAIR',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'STRUCTURAL_MEMBER',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'COMPONENT',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  {
    family: 'ANNOTATION',
    blocksRemoval: true,
    absoluteHeight: false,
    duplicated: true,
  },
  // The storey itself is not something the storey contains.
  {
    family: 'LEVEL',
    blocksRemoval: false,
    absoluteHeight: false,
    duplicated: false,
  },
];

const BY_FAMILY = new Map(
  LEVEL_FAMILY_POLICIES.map((policy) => [policy.family, policy]),
);

/**
 * Everything a storey holds that deleting it would take away.
 *
 * Read from the project's own index rather than from a list kept here, which
 * is the only way a family added to the model cannot be forgotten.
 */
export function levelContents(level: Level): readonly ProjectEntity[] {
  return levelEntities(level).filter(
    ({ family }) => BY_FAMILY.get(family)?.blocksRemoval === true,
  );
}

/** The same storey with everything whose height is absolute moved with it. */
export function raisedContents(level: Level, deltaZ: number): Level {
  if (deltaZ === 0) return level;
  return {
    ...level,
    roofs: level.roofs.map((roof) => ({
      ...roof,
      baseElevationMm: roof.baseElevationMm + deltaZ,
    })),
    ...(level.roofStructures === undefined
      ? {}
      : {
          roofStructures: level.roofStructures.map((roof) => ({
            ...roof,
            baseElevationMm: roof.baseElevationMm + deltaZ,
          })),
        }),
  };
}

/**
 * A copy of one storey, everything it holds included.
 *
 * References inside the storey follow the copy — an opening keeps its own
 * wall, a dimension measures the copied walls, a component stays fixed to the
 * copy of what carried it — and references leaving it do not: a catalogue
 * entry is the same entry, and a stair climbs to whatever storey is above
 * where the copy lands.
 */
export function duplicatedLevel(
  source: Level,
  draft: {
    readonly id: string;
    readonly name: string;
    readonly elevationMm: number;
    readonly defaultStoreyHeightMm: number;
  },
  topLevelId: string | undefined,
): Level {
  const levelId = entityId<'Level'>(draft.id);
  const suffix = `@${draft.id}`;
  const own = new Set(levelEntities(source).map(({ id }) => id));
  /** An identifier of this storey follows the copy; anything else does not. */
  const copied = (id: string): string => (own.has(id) ? `${id}${suffix}` : id);
  const deltaZ = draft.elevationMm - source.elevationMm;
  return raisedContents(
    {
      id: levelId,
      name: draft.name,
      elevationMm: draft.elevationMm,
      defaultStoreyHeightMm: draft.defaultStoreyHeightMm,
      walls: source.walls.map((wall) => ({
        ...wall,
        id: entityId<'Wall'>(copied(wall.id)),
        levelId,
      })),
      openings: source.openings.map((opening) => ({
        ...opening,
        id: entityId<'Opening'>(copied(opening.id)),
        hostElementId: entityId<'Wall'>(copied(opening.hostElementId)),
      })),
      slabs: source.slabs.map((slab) => ({
        ...slab,
        id: entityId<'Slab'>(copied(slab.id)),
        levelId,
      })),
      roofs: source.roofs.map((roof) => ({
        ...roof,
        id: entityId<'RoofPlane'>(copied(roof.id)),
        levelId,
      })),
      roofStructures: (source.roofStructures ?? []).map((roof) => ({
        ...roof,
        id: entityId<'Roof'>(copied(roof.id)),
        levelId,
      })),
      spaces: source.spaces.map((space) => ({
        ...space,
        id: entityId<'Space'>(copied(space.id)),
        levelId,
      })),
      /*
       * Un escalier monte vers l'étage au-dessus de là où la copie se pose.
       *
       * Quand il n'y en a pas — la copie est le dernier niveau — l'escalier
       * ne suit pas. Ce n'est pas une perte : un escalier qui n'arrive nulle
       * part n'est pas un escalier, c'est un trou dans un plafond. Le copier
       * en gardant sa destination d'origine ferait arriver l'escalier du
       * premier étage dans le plafond du rez-de-chaussée.
       */
      stairs:
        topLevelId === undefined
          ? []
          : source.stairs.map((stair) => ({
              ...stair,
              id: entityId<'Stair'>(copied(stair.id)),
              levelId,
              topLevelId: entityId<'Level'>(topLevelId),
            })),
      structure: (source.structure ?? []).map((member) => ({
        ...member,
        id: entityId<'StructuralMember'>(copied(member.id)),
        levelId,
      })),
      components: (source.components ?? []).map((component) => ({
        ...component,
        id: entityId<'ComponentInstance'>(copied(component.id)),
        levelId,
        // What carried it on the original storey carries its copy here. Left
        // as it was, every copied radiator would hang on the walls of the
        // storey below.
        ...(component.hostObjectId === undefined
          ? {}
          : { hostObjectId: copied(component.hostObjectId) }),
        ...(component.spaceId === undefined
          ? {}
          : { spaceId: entityId<'Space'>(copied(component.spaceId)) }),
      })),
      annotations: source.annotations.map((annotation) =>
        isDimension(annotation)
          ? {
              ...annotation,
              id: copied(annotation.id) as typeof annotation.id,
              first: {
                ...annotation.first,
                wallId: entityId<'Wall'>(copied(annotation.first.wallId)),
              },
              second: {
                ...annotation.second,
                wallId: entityId<'Wall'>(copied(annotation.second.wallId)),
              },
            }
          : {
              ...annotation,
              id: copied(annotation.id) as typeof annotation.id,
            },
      ),
    },
    deltaZ,
  );
}
