import { loadProjectJson } from '@house-technical-designer/project-io';
import {
  domainsPresentIn,
  projectScopeOf,
  validateProjectScope,
} from '@house-technical-designer/core-domain';
import { describe, expect, it } from 'vitest';

import type { NewProjectDraft } from '../ux/new-project-draft.js';
import { initialShapeCommands } from './initial-shape.js';
import {
  addLevel,
  levelStackIssues,
  MAX_LEVELS,
  moveLevel,
  removeLevel,
  stackedLevels,
  updateLevel,
} from './level-stack.js';
import {
  DEFAULT_NEW_PROJECT_DRAFT,
  locatedCoordinates,
  newProjectIssues,
  projectFromNewDraft,
  scopeOf,
  shapeIssues,
  shapeOutline,
} from './new-project.js';

const NOW = '2026-08-19T00:00:00Z';

function draft(over: Partial<NewProjectDraft> = {}): NewProjectDraft {
  return { ...DEFAULT_NEW_PROJECT_DRAFT, ...over };
}

describe('the stack of storeys', () => {
  it('measures from the ground floor, in both directions', () => {
    let stack = DEFAULT_NEW_PROJECT_DRAFT.levels;
    stack = addLevel(stack, 'STOREY');
    stack = addLevel(stack, 'BASEMENT');
    stack = addLevel(stack, 'ATTIC');
    expect(
      stackedLevels(stack).map(({ level, elevationMm }) => [
        level.kind,
        elevationMm,
      ]),
    ).toEqual([
      ['BASEMENT', -2300],
      ['GROUND', 0],
      ['STOREY', 2500],
      ['ATTIC', 5000],
    ]);
  });

  it('says what a count and one height cannot', () => {
    let stack = DEFAULT_NEW_PROJECT_DRAFT.levels;
    stack = addLevel(stack, 'BASEMENT');
    stack = addLevel(stack, 'BASEMENT');
    stack = addLevel(stack, 'MEZZANINE');
    stack = addLevel(stack, 'TECHNICAL');
    expect(stack.filter(({ kind }) => kind === 'BASEMENT')).toHaveLength(2);
    expect(new Set(stack.map(({ name }) => name)).size).toBe(stack.length);
    // Storeys differ; nothing forces one height on all of them.
    const heights = new Set(stack.map(({ heightMm }) => heightMm));
    expect(heights.size).toBeGreaterThan(1);
  });

  it('puts a basement under the house and everything else on top', () => {
    const stack = addLevel(
      addLevel(DEFAULT_NEW_PROJECT_DRAFT.levels, 'STOREY'),
      'BASEMENT',
    );
    expect(stack[0]?.kind).toBe('BASEMENT');
    expect(stack[stack.length - 1]?.kind).toBe('STOREY');
  });

  it('never empties the building', () => {
    const one = DEFAULT_NEW_PROJECT_DRAFT.levels;
    expect(removeLevel(one, one[0]!.id)).toBe(one);
  });

  it('refuses to grow past what a page can hold', () => {
    let stack = DEFAULT_NEW_PROJECT_DRAFT.levels;
    for (let index = 0; index < MAX_LEVELS + 5; index += 1)
      stack = addLevel(stack, 'STOREY');
    expect(stack).toHaveLength(MAX_LEVELS);
    expect(levelStackIssues(stack)).toEqual([]);
  });

  it('moves a storey without losing it', () => {
    const stack = addLevel(DEFAULT_NEW_PROJECT_DRAFT.levels, 'STOREY');
    const moved = moveLevel(stack, stack[1]!.id, -1);
    expect(moved.map(({ id }) => id)).toEqual(
      [...stack].reverse().map(({ id }) => id),
    );
    // Off the end is not a move.
    expect(moveLevel(stack, stack[0]!.id, -1)).toBe(stack);
  });

  it('says what is wrong instead of repairing it', () => {
    const stack = updateLevel(DEFAULT_NEW_PROJECT_DRAFT.levels, 'ground', {
      name: '  ',
    });
    expect(levelStackIssues(stack)).toContain('Un niveau a besoin d’un nom.');
    expect(
      levelStackIssues(
        updateLevel(DEFAULT_NEW_PROJECT_DRAFT.levels, 'ground', {
          heightMm: 0,
        }),
      ).join(' '),
    ).toContain('hauteur');
  });
});

describe('the project a creation page describes', () => {
  it('opens as a valid file when nothing is answered', () => {
    const file = projectFromNewDraft(draft(), NOW);
    expect(loadProjectJson(JSON.stringify(file))).toMatchObject({
      status: 'OK',
    });
    expect(file.project.building.levels).toHaveLength(1);
    expect(file.project.materialLibrary?.materials.length).toBeGreaterThan(0);
  });

  it('writes the stack it was given, with each storey its own height', () => {
    let levels = DEFAULT_NEW_PROJECT_DRAFT.levels;
    levels = addLevel(levels, 'STOREY');
    levels = addLevel(levels, 'BASEMENT');
    levels = updateLevel(levels, levels[0]!.id, { heightMm: 2700 });
    const file = projectFromNewDraft(
      draft({
        levels,
        metadata: { name: 'Maison des Lilas', author: 'A. M.' },
      }),
      NOW,
    );
    expect(
      file.project.building.levels.map(({ name, elevationMm }) => [
        name,
        elevationMm,
      ]),
    ).toEqual([
      ['Sous-sol', -2700],
      ['Rez-de-chaussée', 0],
      ['Étage', 2500],
    ]);
    expect(file.project.metadata.author).toBe('A. M.');
    expect(loadProjectJson(JSON.stringify(file))).toMatchObject({
      status: 'OK',
    });
  });

  it('leaves an unanswered location unknown rather than choosing one', () => {
    expect(
      projectFromNewDraft(draft(), NOW).project.site.location,
    ).toBeUndefined();
    expect(
      locatedCoordinates(draft({ location: { latitudeDeg: 48.85 } })),
    ).toBeUndefined();
    expect(
      projectFromNewDraft(
        draft({ location: { latitudeDeg: 48.85, longitudeDeg: 2.35 } }),
        NOW,
      ).project.site.location,
    ).toEqual({ latitudeDeg: 48.85, longitudeDeg: 2.35 });
  });

  it('starts the north on screen rather than on a typed angle', () => {
    expect(projectFromNewDraft(draft(), NOW).project.site.northAngleDeg).toBe(
      0,
    );
  });

  it('says what an answer makes impossible instead of correcting it', () => {
    expect(newProjectIssues(draft())).toEqual([]);
    expect(
      newProjectIssues(draft({ metadata: { name: '  ' } })).join(' '),
    ).toContain('nom');
    expect(
      newProjectIssues(draft({ location: { latitudeDeg: 48.85 } })).join(' '),
    ).toContain('latitude sans longitude');
    expect(
      newProjectIssues(
        draft({ location: { latitudeDeg: 120, longitudeDeg: 2 } }),
      ).join(' '),
    ).toContain('−90');
    expect(
      newProjectIssues(draft({ initialShape: { kind: 'RECTANGLE' } })).join(
        ' ',
      ),
    ).toContain('largeur');
    expect(
      newProjectIssues(
        draft({ initialShape: { kind: 'L', widthMm: 8000, depthMm: 6000 } }),
      ).join(' '),
    ).toContain('aile');
  });

  it('writes the scope into the file, architecture included', () => {
    const file = projectFromNewDraft(
      draft({ intent: 'STUDY', enabledDomains: [] }),
      NOW,
    );
    expect(file.project.scope?.intent).toBe('STUDY');
    expect(file.project.scope?.enabledDomains).toEqual(['ARCHITECTURE']);
    expect(validateProjectScope(projectScopeOf(file.project))).toEqual([]);
    expect(scopeOf(draft({ enabledDomains: [] })).enabledDomains).toContain(
      'ARCHITECTURE',
    );
  });

  it('never lets the scope hide what the project holds', () => {
    const file = projectFromNewDraft(
      draft({ intent: 'STUDY', enabledDomains: [] }),
      NOW,
    );
    expect(domainsPresentIn(file.project)).toEqual([]);
  });
});

describe('the footprint a shape describes', () => {
  it('draws nothing when nothing was chosen', () => {
    expect(shapeOutline({ kind: 'NONE' })).toEqual([]);
    const file = projectFromNewDraft(draft(), NOW);
    expect(initialShapeCommands(file, { kind: 'NONE' }, (p) => p)).toEqual({
      status: 'NONE',
    });
  });

  it('closes every outline it draws', () => {
    for (const kind of ['RECTANGLE', 'L', 'T', 'U'] as const) {
      const outline = shapeOutline({
        kind,
        widthMm: 10000,
        depthMm: 8000,
        wingMm: 4000,
      });
      expect(outline.length).toBeGreaterThanOrEqual(4);
      // A corner repeated is a corner that draws a wall of no length.
      const seen = new Set(outline.map(({ x, y }) => `${x};${y}`));
      expect(seen.size).toBe(outline.length);
    }
  });

  it('produces ordinary walls and an ordinary slab', () => {
    const file = projectFromNewDraft(draft(), NOW);
    let counter = 0;
    const built = initialShapeCommands(
      file,
      { kind: 'RECTANGLE', widthMm: 10000, depthMm: 8000 },
      (prefix) => `${prefix}-${(counter += 1)}`,
    );
    expect(built.status).toBe('OK');
    if (built.status !== 'OK') return;
    // One command, not two: the walls and the slab arrive together or not at
    // all, and « annuler l'emprise » is one press.
    expect(built.command.label).toBe('Poser l’emprise de départ');
  });

  it('refuses a shape that would fold back on itself, before drawing it', () => {
    const file = projectFromNewDraft(draft(), NOW);
    // Two arms of 6 m in a 10 m width would cross through each other.
    const crossing = initialShapeCommands(
      file,
      { kind: 'U', widthMm: 10000, depthMm: 8000, wingMm: 6000 },
      (prefix) => prefix,
    );
    expect(crossing.status).toBe('ERROR');
    if (crossing.status !== 'ERROR') return;
    expect(crossing.message).toContain('croiseraient');
  });
});

describe('what the creation page asked for and used to throw away', () => {
  it('keeps the address, without pretending it is a latitude', () => {
    const file = projectFromNewDraft(
      draft({ location: { address: 'Quimper, France' } }),
      NOW,
    );
    expect(file.project.site.locationLabel).toBe('Quimper, France');
    // An address is not a position: the sun still cannot be computed, and the
    // modules that need coordinates still say so.
    expect(file.project.site.location).toBeUndefined();
  });

  it('states the country it is going to apply', () => {
    // The field showed « FR » as a placeholder and the constructor applied FR
    // anyway, so an empty-looking field produced a French project.
    expect(DEFAULT_NEW_PROJECT_DRAFT.location.countryCode).toBe('FR');
    expect(
      projectFromNewDraft(draft(), NOW).project.regulatoryContext?.country,
    ).toBe('FR');
  });

  it('refuses a wing that does not fit the box it is cut from', () => {
    const wrong = (shape: Parameters<typeof shapeIssues>[0]) =>
      shapeIssues(shape).join(' ');
    expect(
      wrong({ kind: 'U', widthMm: 10000, depthMm: 8000, wingMm: 6000 }),
    ).toContain('croiseraient');
    expect(
      wrong({ kind: 'L', widthMm: 8000, depthMm: 6000, wingMm: 6000 }),
    ).toContain('plus courte');
    expect(
      wrong({ kind: 'T', widthMm: 8000, depthMm: 6000, wingMm: 9000 }),
    ).toContain('plus étroit');
    // And accepts the ones that do fit.
    expect(
      shapeIssues({ kind: 'U', widthMm: 12000, depthMm: 8000, wingMm: 3000 }),
    ).toEqual([]);
    expect(shapeIssues({ kind: 'NONE' })).toEqual([]);
    expect(shapeIssues(undefined)).toEqual([]);
  });
});
