import { describe, expect, it } from 'vitest';
import {
  entityId,
  levelEntities,
  type Level,
} from '@house-technical-designer/core-domain';
import {
  LEVEL_FAMILY_POLICIES,
  duplicatedLevel,
  levelContents,
  raisedContents,
} from './level-entities.js';

const ground = entityId<'Level'>('ground');
const assemblyId = 'assembly' as never;

function square(size: number) {
  return {
    outer: [
      { x: 0, y: 0 },
      { x: size, y: 0 },
      { x: size, y: size },
      { x: 0, y: size },
    ],
  };
}

/** A storey holding one object of every family a storey can hold. */
function full(): Level {
  return {
    id: ground,
    name: 'RDC',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls: [
      {
        id: entityId<'Wall'>('wall'),
        type: 'WALL',
        levelId: ground,
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 5000, y: 0 },
          ],
        },
        referenceSide: 'CENTER',
        assemblyId,
        baseOffsetMm: 0,
        heightMode: 'EXPLICIT',
        heightMm: 2500,
        role: 'EXTERIOR',
      },
    ],
    openings: [
      {
        id: entityId<'Opening'>('door'),
        type: 'OPENING',
        openingType: 'DOOR',
        host: { kind: 'WALL', id: entityId<'Wall'>('wall') },
        offsetAlongHostMm: 1000,
        sillHeightMm: 0,
        widthMm: 900,
        heightMm: 2100,
      },
    ],
    slabs: [
      {
        id: entityId<'Slab'>('slab'),
        type: 'SLAB',
        levelId: ground,
        polygon: square(5000),
        assemblyId,
        role: 'FLOOR',
        elevationOffsetMm: 0,
      },
    ],
    roofs: [
      {
        id: entityId<'RoofPlane'>('plane'),
        type: 'ROOF_PLANE',
        levelId: ground,
        footprint: square(5000),
        assemblyId,
        slopeDeg: 30,
        azimuthDeg: 180,
        baseElevationMm: 2500,
      },
    ],
    roofStructures: [
      {
        id: entityId<'Roof'>('roof'),
        type: 'ROOF',
        levelId: ground,
        footprint: square(5000),
        edges: Array.from({ length: 4 }, () => ({
          kind: 'SLOPED' as const,
          slopeDeg: 35,
          overhangMm: 400,
        })),
        assemblyId,
        baseElevationMm: 2500,
      },
    ],
    spaces: [
      {
        id: entityId<'Space'>('room'),
        type: 'SPACE',
        levelId: ground,
        name: 'Séjour',
        category: 'LIVING',
        boundaryMode: 'MANUAL',
        manualPolygon: square(3000),
      },
    ],
    stairs: [
      {
        id: entityId<'Stair'>('stair'),
        type: 'STAIR',
        levelId: ground,
        topLevelId: entityId<'Level'>('upper'),
        stairType: 'STRAIGHT',
        widthMm: 900,
        riserCount: 16,
        treadDepthMm: 270,
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 4050, y: 0 },
          ],
        },
      },
    ],
    structure: [
      {
        id: entityId<'StructuralMember'>('post'),
        type: 'STRUCTURAL_MEMBER',
        levelId: ground,
        kind: 'COLUMN',
        path: [{ x: 2000, y: 2000 }],
        widthMm: 200,
        depthMm: 200,
      },
    ],
    components: [
      {
        id: entityId<'ComponentInstance'>('pump'),
        type: 'COMPONENT_INSTANCE',
        levelId: ground,
        category: 'HEATING',
        position: { x: 1000, y: 1000 },
        elevationMm: 300,
        rotationDeg: 0,
        hostObjectId: 'wall',
        spaceId: entityId<'Space'>('room'),
      },
    ],
    annotations: [
      {
        id: 'note' as never,
        kind: 'TEXT',
        at: { x: 100, y: 100 },
        text: 'À démolir',
      },
    ],
  };
}

describe('what a storey holds, when it moves, is copied or deleted', () => {
  it('has decided what happens to every family a storey can hold', () => {
    // The mechanism: three commands used to keep three lists, and two families
    // added to the model reached one of the three. Adding a family now fails
    // here until somebody has said what becomes of it.
    const held = new Set(levelEntities(full()).map(({ family }) => family));
    const decided = new Set(LEVEL_FAMILY_POLICIES.map(({ family }) => family));
    expect([...held].filter((family) => !decided.has(family))).toEqual([]);
  });

  it('counts a whole roof, a post and an appliance as contents', () => {
    // A storey holding only these counted as empty, so deleting it took all
    // three away without a word.
    const bare: Level = {
      ...full(),
      walls: [],
      openings: [],
      slabs: [],
      roofs: [],
      spaces: [],
      stairs: [],
      annotations: [],
    };
    expect(
      levelContents(bare)
        .map(({ id }) => id)
        .sort(),
    ).toEqual(['post', 'pump', 'roof']);
  });

  it('does not count the storey itself as something it contains', () => {
    const empty: Level = {
      ...full(),
      walls: [],
      openings: [],
      slabs: [],
      roofs: [],
      roofStructures: [],
      spaces: [],
      stairs: [],
      structure: [],
      components: [],
      annotations: [],
    };
    expect(levelContents(empty)).toEqual([]);
  });

  it('raises a whole roof with its storey, as it raises a roof plane', () => {
    const raised = raisedContents(full(), 300);
    expect(raised.roofs[0]!.baseElevationMm).toBe(2800);
    expect(raised.roofStructures![0]!.baseElevationMm).toBe(2800);
  });

  it('leaves alone what is measured from its own floor', () => {
    const raised = raisedContents(full(), 300);
    expect(raised.components![0]!.elevationMm).toBe(300);
    expect(raised.slabs[0]!.elevationOffsetMm).toBe(0);
  });

  it('copies everything a storey holds, roof, post and appliance included', () => {
    const copy = duplicatedLevel(
      full(),
      {
        id: 'upper',
        name: 'Étage',
        elevationMm: 2700,
        defaultStoreyHeightMm: 2500,
      },
      'roof-level',
    );
    expect(copy.roofStructures?.map(({ id }) => id)).toEqual(['roof@upper']);
    expect(copy.structure?.map(({ id }) => id)).toEqual(['post@upper']);
    expect(copy.components?.map(({ id }) => id)).toEqual(['pump@upper']);
  });

  it('re-points what a copy carries at the copy, not at the original', () => {
    const copy = duplicatedLevel(
      full(),
      {
        id: 'upper',
        name: 'Étage',
        elevationMm: 2700,
        defaultStoreyHeightMm: 2500,
      },
      'roof-level',
    );
    const component = copy.components![0]!;
    // Left as they were, every copied radiator would hang on the storey below.
    expect(component.hostObjectId).toBe('wall@upper');
    expect(component.spaceId).toBe('room@upper');
    expect(copy.openings[0]!.host.id).toBe('wall@upper');
    // A stair climbs to whatever storey is above where the copy lands.
    expect(copy.stairs[0]!.topLevelId).toBe('roof-level');
  });

  it('raises the copy by the distance between the two storeys', () => {
    const copy = duplicatedLevel(
      full(),
      {
        id: 'upper',
        name: 'Étage',
        elevationMm: 2700,
        defaultStoreyHeightMm: 2500,
      },
      'roof-level',
    );
    expect(copy.roofs[0]!.baseElevationMm).toBe(5200);
    expect(copy.roofStructures![0]!.baseElevationMm).toBe(5200);
  });
});
