import { describe, expect, it, vi } from 'vitest';
import { loadDemoProject } from '../demo-project.js';
import { populatedProject as withEverything } from '../test-support/populated-project.js';
import { inspectObject, listedFamilies } from '../editor/object-editors.js';
import {
  filterEntries,
  objectEntries,
  type PaletteEntry,
} from './palette-model.js';

const entry = (id: string, label: string, group = 'Outils'): PaletteEntry => ({
  id,
  label,
  group,
  run: () => undefined,
});

const ENTRIES: readonly PaletteEntry[] = [
  entry('tool.wall', 'Mur'),
  entry('tool.opening', 'Ouverture'),
  entry('workspace.networks', 'Réseaux', 'Espaces'),
  entry('edit.undo', 'Annuler la dernière commande', 'Commandes'),
  entry('level.ground', 'Rez-de-chaussée', 'Niveaux'),
];

describe('what the palette answers', () => {
  it('offers everything when nothing is typed', () => {
    expect(filterEntries(ENTRIES, '')).toHaveLength(ENTRIES.length);
  });

  it('puts what starts with the query first', () => {
    const found = filterEntries(ENTRIES, 'mur');
    expect(found[0]?.id).toBe('tool.wall');
  });

  it('ignores accents and case, which are not what the user meant', () => {
    expect(filterEntries(ENTRIES, 'reseaux')[0]?.id).toBe('workspace.networks');
    expect(filterEntries(ENTRIES, 'REZ')[0]?.id).toBe('level.ground');
  });

  it('finds a word inside a label before a mere substring', () => {
    const found = filterEntries(ENTRIES, 'commande');
    expect(found[0]?.id).toBe('edit.undo');
  });

  it('falls back to the identifier, which is what the model shows', () => {
    expect(filterEntries(ENTRIES, 'tool.opening')[0]?.id).toBe('tool.opening');
  });

  it('answers nothing rather than everything when nothing matches', () => {
    expect(filterEntries(ENTRIES, 'zzz')).toEqual([]);
  });

  it('never returns more lines than a list can show', () => {
    const many = Array.from({ length: 40 }, (_entry, index) =>
      entry(`tool.${index}`, `Mur ${index}`),
    );
    expect(filterEntries(many, 'mur', 12)).toHaveLength(12);
  });
});

describe('the objects the palette can reach', () => {
  function source(select = vi.fn()) {
    const result = loadDemoProject();
    if (result.status !== 'OK') throw new Error(result.message);
    return {
      project: result.file.project,
      levelId: 'ground',
      describe: (objectId: string) =>
        inspectObject(result.file.project, objectId).title,
      select,
    };
  }

  it('names the objects of the storey being drawn, as the inspector does', () => {
    const entries = objectEntries(source());
    expect(entries.map(({ label }) => label)).toContain('Mur wall-south');
    expect(entries.every(({ group }) => group === 'Objets')).toBe(true);
  });

  it('selects the object it was asked for', () => {
    const select = vi.fn();
    const found = filterEntries(objectEntries(source(select)), 'wall-south');
    found[0]?.run();
    expect(select).toHaveBeenCalledWith('wall-south');
  });

  it('says nothing about a level the project does not hold', () => {
    expect(objectEntries({ ...source(), levelId: 'nowhere' })).toEqual([]);
  });

  it('reaches every family the project holds, not the five listed here', () => {
    // Walls, openings, rooms, slabs and roof planes were listed; stairs,
    // roofs, posts, placed things, pipes and the ground were not. An object
    // nobody can find by name exists only while it is on the screen.
    const populated = withEverything();
    const entries = objectEntries({
      project: populated,
      levelId: 'ground',
      describe: (objectId) => inspectObject(populated, objectId).title,
      select: vi.fn(),
    });
    const found = new Set(entries.map(({ id }) => id));
    for (const objectId of [
      'wall-south',
      'space-living',
      'stair-main',
      'roof-whole',
      'member-column',
      'component-radiator',
      'water:trunk',
      'obstacle-tree',
    ])
      expect(found, objectId).toContain(objectId);
  });

  it('says which family and which storey each object belongs to', () => {
    const populated = withEverything();
    const entries = objectEntries({
      project: populated,
      levelId: 'ground',
      describe: (objectId) => inspectObject(populated, objectId).title,
      select: vi.fn(),
    });
    const stair = entries.find(({ id }) => id === 'stair-main');
    expect(stair?.hint).toContain('Escaliers');
    expect(stair?.hint).toContain('Rez-de-chaussée');
    // A network crosses the storeys: naming one of them would be wrong.
    expect(entries.find(({ id }) => id === 'water:trunk')?.hint).toBe(
      'Réseaux',
    );
  });
});

describe('the families the tree and the palette both read', () => {
  it('are the same families, because there is only one list', () => {
    const populated = withEverything();
    const labels = listedFamilies(populated, 'ground').map(
      ({ label }) => label,
    );
    expect(labels).toEqual([
      'Murs',
      'Ouvertures',
      'Pièces',
      'Dalles',
      'Toitures',
      'Réseaux',
      'Cotes',
      'Annotations',
      'Toitures complètes',
      'Escaliers',
      'Structure',
      'Terrain',
      'Composants',
    ]);
  });

  it('keeps what belongs to the project apart from what belongs to a floor', () => {
    const scopes = new Map(
      listedFamilies(withEverything(), 'ground').map(({ label, scope }) => [
        label,
        scope,
      ]),
    );
    expect(scopes.get('Murs')).toBe('LEVEL');
    expect(scopes.get('Réseaux')).toBe('PROJECT');
    expect(scopes.get('Terrain')).toBe('PROJECT');
  });
});
