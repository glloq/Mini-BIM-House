import { describe, expect, it, vi } from 'vitest';
import { loadDemoProject } from '../demo-project.js';
import { inspectObject } from '../editor/object-editors.js';
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
});
