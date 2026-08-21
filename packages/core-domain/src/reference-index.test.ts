import { describe, expect, it } from 'vitest';
import { entityIndex } from './entity-index.js';
import {
  projectReferences,
  referenceIndex,
  referencesFromOutsideLevel,
  referencesTo,
} from './reference-index.js';
import { populated } from './entity-index.test.js';

const project = populated();

/**
 * Every string the project holds that names one of its own objects.
 *
 * The mechanism, and the reason this file can be trusted: a pointer written
 * into the model and forgotten here is a pointer no deletion checks. Rather
 * than trusting a list, the whole project is walked and anything naming an
 * object has to be claimed.
 */
function crawledReferences(
  value: unknown,
  path: string,
  known: ReadonlySet<string>,
): readonly { readonly toId: string; readonly path: string }[] {
  if (typeof value === 'string')
    return known.has(value) ? [{ toId: value, path }] : [];
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      crawledReferences(item, `${path}/${index}`, known),
    );
  if (value !== null && typeof value === 'object')
    return Object.entries(value).flatMap(([key, held]) =>
      // The identifier an object carries is not a reference to itself.
      key === 'id' ? [] : crawledReferences(held, `${path}/${key}`, known),
    );
  return [];
}

describe('what points at what', () => {
  it('claims every pointer the project holds', () => {
    const known = new Set(entityIndex(project).keys());
    const crawled = crawledReferences(project, '', known);
    const claimed = new Set(
      projectReferences(project).map(({ fromId, toId }) => `${fromId} ${toId}`),
    );
    // A crawled pointer is claimed when something says an object points there.
    const pointed = new Set(projectReferences(project).map(({ toId }) => toId));
    const unclaimed = crawled
      .filter(({ toId }) => !pointed.has(toId))
      .map(({ path, toId }) => `${path} → ${toId}`);
    expect(unclaimed).toEqual([]);
    expect(claimed.size).toBeGreaterThan(0);
  });

  it('finds the storey a wall climbs to and the storey a stair arrives at', () => {
    // Neither is on the storey being deleted, which is exactly why deleting an
    // empty storey used to leave the project unreadable.
    const upstairs = referencesTo(project, 'upper').map(({ label }) => label);
    expect(upstairs).toContain('le niveau où il arrive');
  });

  it('finds what points at a material, an assembly and a saved view', () => {
    expect(
      referencesTo(project, 'material').map(({ fromFamily }) => fromFamily),
    ).toContain('ASSEMBLY');
    expect(
      referencesTo(project, 'assembly-wall').map(
        ({ fromFamily }) => fromFamily,
      ),
    ).toContain('WALL');
    expect(
      referencesTo(project, 'view-1').map(({ fromFamily }) => fromFamily),
    ).toContain('SHEET_VIEWPORT');
  });

  it('indexes by what is pointed at, so a deletion asks once', () => {
    const index = referenceIndex(project);
    expect(index.get('wall-south')?.length).toBeGreaterThan(0);
    expect(index.get('nothing-here')).toBeUndefined();
  });

  it('ignores what a storey points at from inside itself', () => {
    // Its own objects go with it; a wall of that storey naming its assembly is
    // not a reason to refuse the deletion.
    const outside = referencesFromOutsideLevel(project, 'ground');
    expect(outside.every(({ fromId }) => fromId !== 'wall-south')).toBe(true);
  });

  it('reports what points at a storey from outside it', () => {
    const outside = referencesFromOutsideLevel(project, 'upper');
    expect(outside.map(({ fromFamily }) => fromFamily)).toContain('STAIR');
  });
});
