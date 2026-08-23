import { describe, expect, it } from 'vitest';

import type { Project } from '@house-technical-designer/core-domain';

import { loadDemoProject } from '../demo-project.js';
import {
  EMPTY_DESIGN_STATE,
  designStateOf,
  type DesignState,
} from './design-state.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;
const ground = house.building.levels[0]!;

describe('what the house is, read rather than remembered', () => {
  it('reads the storey being drawn, not the whole project', () => {
    // On ne pose pas une porte dans un mur d'un autre étage : proposer l'outil
    // parce qu'un mur existe ailleurs, ce serait le proposer pour qu'il échoue.
    const state = designStateOf(house, ground.id);
    expect(state.wallCount).toBe(ground.walls.length);
    expect(state.levelCount).toBe(house.building.levels.length);
    const upper = house.building.levels[1];
    if (upper !== undefined)
      expect(designStateOf(house, upper.id).wallCount).toBe(upper.walls.length);
  });

  it('counts the closed contours, and those without a room', () => {
    const state = designStateOf(house, ground.id);
    expect(state.closedContours.length).toBeGreaterThan(0);
    for (const contour of state.closedContours)
      expect(contour.areaM2).toBeGreaterThan(0);
    // La maison de référence a ses pièces : rien n'attend d'être nommé.
    expect(state.contoursWithoutSpace).toBe(
      state.closedContours.filter(({ spaceId }) => spaceId === undefined)
        .length,
    );
  });

  it('loses the contours with the walls that made them', () => {
    // C'est tout l'intérêt de dériver : un drapeau dirait que quelqu'un a
    // cliqué, et resterait vrai sur une maison qu'on a démolie.
    const razed: Project = {
      ...house,
      building: {
        ...house.building,
        levels: house.building.levels.map((level) => ({ ...level, walls: [] })),
      },
    };
    const state = designStateOf(razed, ground.id);
    expect(state.wallCount).toBe(0);
    expect(state.closedContours).toEqual([]);
    expect(state.contoursWithoutSpace).toBe(0);
  });

  it('answers for a project that has no level at all', () => {
    const bare: Project = {
      ...house,
      building: { ...house.building, levels: [] },
      systems: [],
    };
    expect(designStateOf(bare, undefined)).toEqual(EMPTY_DESIGN_STATE);
  });

  it('falls back to the first storey when none is named', () => {
    expect(designStateOf(house, undefined).wallCount).toBe(ground.walls.length);
    expect(designStateOf(house, 'niveau-qui-n-existe-pas').wallCount).toBe(
      ground.walls.length,
    );
  });

  it('counts what is placed by what it is for', () => {
    const state = designStateOf(house, ground.id);
    const placed = (ground.components ?? []).length;
    const byUse =
      state.sanitaryFixtureCount +
      state.distributionBoardCount +
      state.pvModuleCount;
    expect(placed).toBeGreaterThan(0);
    expect(byUse).toBeLessThanOrEqual(placed);
    expect(state.sanitaryFixtureCount).toBeGreaterThan(0);
  });

  it('counts the networks on the project, which belong to no storey', () => {
    const state = designStateOf(house, ground.id);
    expect(state.networkCount).toBe((house.systems ?? []).length);
    expect(state.networkCount).toBeGreaterThan(0);
  });

  it('names a room without a name, which is a room nobody has decided', () => {
    const anonymous: Project = {
      ...house,
      building: {
        ...house.building,
        levels: house.building.levels.map((level, index) =>
          index === 0
            ? {
                ...level,
                spaces: level.spaces.map((s) => ({ ...s, name: '' })),
              }
            : level,
        ),
      },
    };
    const state = designStateOf(anonymous, ground.id);
    expect(state.unnamedSpaceCount).toBe(state.spaceCount);
    expect(designStateOf(house, ground.id).unnamedSpaceCount).toBe(0);
  });

  it('writes nothing, anywhere', () => {
    // Le test le plus important du module : il lit, et c'est tout.
    const before = JSON.stringify(house);
    const state: DesignState = designStateOf(house, ground.id);
    expect(JSON.stringify(house)).toBe(before);
    expect(Object.isFrozen(state)).toBe(false);
    expect(JSON.stringify(house)).not.toContain('closedContours');
  });
});
