import { describe, expect, it, vi } from 'vitest';
import {
  entityIndex,
  projectEntities,
  type EntityFamily,
} from '@house-technical-designer/core-domain';
import { populatedProject } from '../test-support/populated-project.js';
import { objectEntries } from '../palette/palette-model.js';
import {
  capabilitiesOf,
  familyOf,
  inspectObject,
  listedFamilies,
  pathOfObject,
  removalCommandFor,
} from './object-editors.js';

/**
 * The families the editor is meant to answer for.
 *
 * A level is not an object of the plan and a sheet is not drawn on it; they
 * are addressed elsewhere and belong to the index all the same. Everything
 * else here is something the user can click, and the point of this suite is
 * that adding one cannot leave it reachable in some of the six places and not
 * the others.
 */
const EDITABLE: readonly EntityFamily[] = [
  'WALL',
  'OPENING',
  'SPACE',
  'SLAB',
  'ROOF_PLANE',
  'ROOF_STRUCTURE',
  'STAIR',
  'STRUCTURAL_MEMBER',
  'COMPONENT',
  'ANNOTATION',
  'SITE_OBSTACLE',
  'NETWORK_NODE',
  'NETWORK_EDGE',
];

const project = populatedProject();
const editable = projectEntities(project).filter(({ family }) =>
  EDITABLE.includes(family),
);
/**
 * The ones the ground storey draws.
 *
 * What a list or a palette offers is what the storey being drawn holds; an
 * object of the storey above is reached by going up there, not by being listed
 * twice.
 */
const onGround = editable.filter(
  ({ levelId }) => levelId === undefined || levelId === 'ground',
);

describe('what the editor can reach, against what the project holds', () => {
  it('holds one object of every family the editor answers for', () => {
    // If the fixture stopped covering a family, the rest of this suite would
    // pass by having nothing to check.
    const covered = new Set(editable.map(({ family }) => family));
    expect([...EDITABLE].filter((family) => !covered.has(family))).toEqual([]);
  });

  it('describes every one of them', () => {
    for (const { id, family } of editable)
      expect(inspectObject(project, id).kind, `${family} ${id}`).not.toBe(
        'UNKNOWN',
      );
  });

  it('gives every one of them a family of the editor', () => {
    for (const { id, family } of editable)
      expect(familyOf(project, id), `${family} ${id}`).toBeDefined();
  });

  it('says of every one of them what may be done to it', () => {
    // Not that everything moves — an opening does not — but that the question
    // is answered by its family rather than falling through to « nothing ».
    for (const { id, family } of editable) {
      const can = capabilitiesOf(project, id);
      expect(Object.keys(can), `${family} ${id}`).toHaveLength(4);
    }
  });

  it('can take every one of them back off the plan', () => {
    for (const { id, family, levelId } of editable)
      expect(
        removalCommandFor(project, levelId ?? 'ground', id),
        `${family} ${id}`,
      ).toBeDefined();
  });

  it('knows where every one of them lives in the file', () => {
    const index = entityIndex(project);
    for (const { id, family } of editable) {
      const path = pathOfObject(project, id);
      expect(path, `${family} ${id}`).toBeDefined();
      // The editor's answer and the index's answer are the same answer.
      expect(path, `${family} ${id}`).toBe(index.get(id)?.path);
    }
  });

  it('lists every one of them, so Ctrl+K finds it', () => {
    const listed = new Set(
      listedFamilies(project, 'ground').flatMap(({ objects }) =>
        objects.map(({ objectId }) => objectId),
      ),
    );
    for (const { id, family } of onGround)
      expect(listed.has(id), `${family} ${id}`).toBe(true);
  });

  it('offers every one of them by name in the palette', () => {
    const found = new Set(
      objectEntries({
        project,
        levelId: 'ground',
        describe: (objectId) => inspectObject(project, objectId).title,
        select: vi.fn(),
      }).map(({ id }) => id),
    );
    for (const { id, family } of onGround)
      expect(found.has(id), `${family} ${id}`).toBe(true);
  });
});
