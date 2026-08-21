import { describe, expect, it } from 'vitest';
import {
  buildPlanView,
  defaultVisibility,
} from '@house-technical-designer/view-query';
import { serializeProjectFile } from '@house-technical-designer/project-io';
import { projectChecks } from './checks/checks-model.js';
import { largeHouse } from './large-house.js';

/**
 * The reference house has six walls; a real one has hundreds.
 *
 * Everything the editor does on every pointer move — building the plan view —
 * was only ever measured on six walls, which measures nothing. This is the
 * shape the application has to hold up under, and it is checked for being a
 * project the reader accepts before it is used to measure anything.
 */
describe('a house nobody would call small', () => {
  const house = largeHouse(3, 40);

  it('is a project the reader accepts', () => {
    expect(() =>
      serializeProjectFile({
        format: 'house-technical-designer-project',
        schemaVersion: '1.1.0',
        project: house,
        references: {},
        extensions: {},
      }),
    ).not.toThrow();
  });

  it('holds what a large dwelling holds', () => {
    expect(house.building.levels).toHaveLength(3);
    const walls = house.building.levels.flatMap(({ walls: all }) => all);
    expect(walls.length).toBeGreaterThan(200);
    expect(house.building.levels.flatMap(({ spaces }) => spaces).length).toBe(
      120,
    );
  });

  it('draws one of its storeys without losing anything', () => {
    const level = house.building.levels[0]!;
    const view = buildPlanView(house, {
      levelId: level.id,
      layers: defaultVisibility(),
    });
    // Every wall and every room reaches the drawing: a view that silently
    // dropped half a storey would still look like a plan.
    const drawn = new Set(
      view.primitives.flatMap(({ sourceObjectId }) =>
        sourceObjectId === undefined ? [] : [sourceObjectId],
      ),
    );
    for (const wall of level.walls) expect(drawn.has(wall.id)).toBe(true);
    for (const space of level.spaces) expect(drawn.has(space.id)).toBe(true);
  });

  it('says nothing alarming about a house that is merely large', () => {
    // Size is not a defect. What the checks report here is what they would
    // report on any project of this shape, and it is nothing.
    const failures = projectChecks(house, undefined).filter(
      ({ status }) => status === 'FAIL',
    );
    expect(failures).toEqual([]);
  });
});
