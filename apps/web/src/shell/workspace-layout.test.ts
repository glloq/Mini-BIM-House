import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  MAXIMUM_PANEL_PX,
  MINIMUM_PANEL_PX,
  boundedWidth,
  gridColumns,
  loadLayout,
  parseLayout,
  saveLayout,
} from './workspace-layout.js';

function storage(): Storage {
  const held = new Map<string, string>();
  return {
    get length() {
      return held.size;
    },
    clear: () => held.clear(),
    getItem: (key) => held.get(key) ?? null,
    key: (index) => [...held.keys()][index] ?? null,
    removeItem: (key) => held.delete(key),
    setItem: (key, value) => void held.set(key, value),
  };
}

describe('the arrangement of the workspace', () => {
  it('keeps a panel between what is readable and what is reasonable', () => {
    expect(boundedWidth(10)).toBe(MINIMUM_PANEL_PX);
    expect(boundedWidth(9000)).toBe(MAXIMUM_PANEL_PX);
    expect(boundedWidth(Number.NaN)).toBe(DEFAULT_LAYOUT.sidebarPx);
    expect(boundedWidth(260.4)).toBe(260);
  });

  it('donne au dessin tout ce que la colonne ne prend pas, et rien à droite', () => {
    /*
     * Trois pistes, pas cinq.
     *
     * La grille en portait cinq : colonne, bord, dessin, bord, inspecteur. Les
     * deux dernières valaient `0px` au repos — mais une piste de zéro pixel
     * garde sa gouttière, et la grille en dépensait deux, soit seize pixels de
     * dessin pour deux colonnes vides. Il n'y a plus de colonne à droite,
     * donc plus de piste, donc plus de gouttière.
     */
    expect(gridColumns(DEFAULT_LAYOUT)).toBe('220px 6px minmax(0, 1fr)');
    // Une colonne repliée ne prend rien du tout, son bord compris, plutôt que
    // de laisser une bande étroite d'elle-même.
    expect(gridColumns({ ...DEFAULT_LAYOUT, sidebarShown: false })).toBe(
      '0px 0px minmax(0, 1fr)',
    );
  });

  it('finds the same arrangement in the next session', () => {
    const held = storage();
    saveLayout(held, { sidebarPx: 300, sidebarShown: false });
    expect(loadLayout(held)).toEqual({ sidebarPx: 300, sidebarShown: false });
  });

  it('falls back rather than leaving a panel of NaN pixels', () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('not json')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('"a string"')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('{"sidebarPx":"large"}')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('{"sidebarPx":10000}').sidebarPx).toBe(MAXIMUM_PANEL_PX);
  });

  it('lit une préférence écrite du temps des deux colonnes', () => {
    // Un enregistrement d'avant la colonne unique porte encore la largeur et
    // l'épingle de l'inspecteur : elles décrivent une colonne qui n'existe
    // plus. Les ignorer vaut mieux que de rendre à la personne la largeur par
    // défaut alors qu'elle en avait réglé une.
    expect(
      parseLayout(
        '{"sidebarPx":300,"inspectorPx":280,"sidebarShown":true,"inspectorShown":true}',
      ),
    ).toEqual({ sidebarPx: 300, sidebarShown: true });
  });

  it('costs the preference and nothing else when storage refuses', () => {
    const refusing = {
      getItem: () => {
        throw new Error('private window');
      },
      setItem: () => {
        throw new Error('private window');
      },
    } as unknown as Storage;
    expect(loadLayout(refusing)).toEqual(DEFAULT_LAYOUT);
    expect(() => saveLayout(refusing, DEFAULT_LAYOUT)).not.toThrow();
    expect(loadLayout(undefined)).toEqual(DEFAULT_LAYOUT);
  });
});
