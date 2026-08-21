import { describe, expect, it } from 'vitest';
import { entityId } from '@house-technical-designer/core-domain';
import type { Project, Stair } from '@house-technical-designer/core-domain';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import { loadDemoProject } from '../demo-project.js';
import { projectChecks } from './checks-model.js';

function demo(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function stairOf(lengthMm: number, landings?: Stair['landings']): Stair {
  return {
    id: entityId<'Stair'>('stair-main'),
    type: 'STAIR',
    levelId: entityId<'Level'>('ground'),
    topLevelId: entityId<'Level'>('upper'),
    stairType: 'STRAIGHT',
    widthMm: 900,
    riserCount: 16,
    treadDepthMm: 270,
    path: {
      points: [
        { x: 0, y: 0 },
        { x: lengthMm, y: 0 },
      ],
    },
    ...(landings === undefined ? {} : { landings }),
  };
}

/** The reference house with a storey above it, and one stair between them. */
function withStair(stair: Stair): Project {
  const base = demo();
  const ground = base.building.levels[0]!;
  return {
    ...base,
    building: {
      ...base.building,
      levels: [
        { ...ground, stairs: [stair] },
        {
          ...ground,
          id: entityId<'Level'>('upper'),
          name: 'Étage',
          elevationMm: 2700,
          walls: [],
          slabs: [],
          roofs: [],
          openings: [],
          spaces: [],
          annotations: [],
          stairs: [],
        },
      ],
    },
  };
}

function stairFindings(project: Project): readonly string[] {
  return projectChecks(project, undefined)
    .filter(({ id }) => id.includes('stair-path'))
    .map(({ detail }) => detail);
}

describe('a stair whose drawing and dimensions disagree', () => {
  it('says nothing when the line carries exactly its marches', () => {
    expect(stairFindings(withStair(stairOf(15 * 270)))).toEqual([]);
  });

  it('says nothing about a difference smaller than a centimetre', () => {
    expect(stairFindings(withStair(stairOf(15 * 270 + 4)))).toEqual([]);
  });

  it('reports a line too short to carry the marches, with both lengths', () => {
    const [detail] = stairFindings(withStair(stairOf(3000)));
    expect(detail).toContain('4050');
    expect(detail).toContain('3000');
    expect(detail).toContain('1050');
    expect(detail).toContain('toutes les marches');
  });

  it('reports a line longer than the flight it carries', () => {
    const [detail] = stairFindings(withStair(stairOf(5000)));
    expect(detail).toContain('sans marche');
  });

  it('counts the landings as floor the flight occupies', () => {
    // A landing of 900 mm added to fifteen treads needs 4950 mm, so the line
    // that was exactly right without it is now nine hundred short.
    const landed = withStair(
      stairOf(15 * 270, [{ afterRiser: 8, depthMm: 900 }]),
    );
    expect(stairFindings(landed)[0]).toContain('4950');
  });
});

describe('the treads a plan draws', () => {
  function treadCount(stair: Stair): number {
    const view = buildPlanView(withStair(stair), {
      levelId: 'ground',
      layers: defaultVisibility(),
    });
    return view.primitives.filter(({ id }) => id.startsWith('stair-tread:'))
      .length;
  }

  it('draws one nosing per tread when the line is long enough', () => {
    expect(treadCount(stairOf(15 * 270))).toBe(15);
  });

  it('stops at the end of the line rather than squeezing the marches in', () => {
    // Half the floor the flight needs holds half its marches. Spreading them
    // evenly would draw a stair that fits where it does not.
    expect(treadCount(stairOf(2025))).toBe(7);
  });

  it('spaces the nosings at the tread depth the stair states', () => {
    const view = buildPlanView(withStair(stairOf(15 * 270)), {
      levelId: 'ground',
      layers: defaultVisibility(),
    });
    const first = view.primitives.find(
      ({ id }) => id === 'stair-tread:stair-main:1',
    );
    const second = view.primitives.find(
      ({ id }) => id === 'stair-tread:stair-main:2',
    );
    const at = (primitive: typeof first): number => {
      if (primitive?.geometry.kind !== 'POLYLINE')
        throw new Error('a nosing is drawn as a line');
      return primitive.geometry.polyline.points[0]!.x;
    };
    expect(at(second) - at(first)).toBeCloseTo(270, 6);
  });
});
