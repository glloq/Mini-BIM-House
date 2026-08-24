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

  it('gives the drawing everything the panels do not take', () => {
    // L'inspecteur part fermé : il paraît quand on désigne quelque chose, et
    // au repos sa largeur est au dessin.
    expect(gridColumns(DEFAULT_LAYOUT)).toBe(
      '220px 6px minmax(0, 1fr) 0px 0px',
    );
    expect(gridColumns({ ...DEFAULT_LAYOUT, inspectorShown: true })).toBe(
      '220px 6px minmax(0, 1fr) 6px 280px',
    );
    // A hidden panel takes nothing at all, its edge included, rather than
    // leaving a narrow strip of itself behind.
    expect(
      gridColumns({
        ...DEFAULT_LAYOUT,
        sidebarShown: false,
        inspectorShown: true,
      }),
    ).toBe('0px 0px minmax(0, 1fr) 6px 280px');
  });

  it('finds the same arrangement in the next session', () => {
    const held = storage();
    saveLayout(held, {
      sidebarPx: 300,
      inspectorPx: 200,
      sidebarShown: false,
      inspectorShown: true,
    });
    expect(loadLayout(held)).toEqual({
      sidebarPx: 300,
      inspectorPx: 200,
      sidebarShown: false,
      inspectorShown: true,
    });
  });

  it('falls back rather than leaving a panel of NaN pixels', () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('not json')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('"a string"')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('{"sidebarPx":"large"}')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout('{"sidebarPx":10000}').sidebarPx).toBe(MAXIMUM_PANEL_PX);
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
