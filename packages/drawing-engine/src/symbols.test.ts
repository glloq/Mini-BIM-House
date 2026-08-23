import { describe, expect, it } from 'vitest';

import { graphicProfileId } from './scene.js';
import {
  createSymbolLibrary,
  GENERIC_SYMBOL_FORMAT_VERSION,
  placeSymbol,
  rawGenericSymbolEntries,
  symbolCatalogSources,
  resolveSymbol,
  symbolCatalogIssues,
  SYMBOL_LIBRARY_V1,
  type SymbolDefinition,
} from './symbols.js';

const profile = {
  id: graphicProfileId('generic'),
  name: 'Generic',
  roleTokens: {},
};

describe('symbol library v1', () => {
  it('covers every MVP discipline with safe, versioned definitions', () => {
    const disciplines = new Set(
      Object.values(SYMBOL_LIBRARY_V1.definitions).map(
        (definition) => definition.discipline,
      ),
    );
    expect(SYMBOL_LIBRARY_V1.version).toBe('1.0.0');
    // Coverage, not an inventory: the library gains a discipline whenever the
    // catalogue gains a trade, and a test that pinned the exact set would fail
    // on that rather than on anything being wrong.
    for (const discipline of [
      'ARCHITECTURE',
      'WATER',
      'VENTILATION',
      'ELECTRICAL',
    ])
      expect(disciplines, discipline).toContain(discipline);
  });

  it('uses drawing scale for paper-space symbols and preserves semantics', () => {
    const definition = SYMBOL_LIBRARY_V1.definitions['electrical.light-point'];
    expect(definition).toBeDefined();
    const primitives = placeSymbol(definition!, {
      id: 'light-1',
      symbolId: definition!.id,
      position: { x: 1_000, y: 2_000 },
      drawingScale: 50,
      rotationDeg: 90,
      sourceObjectId: 'fixture-1',
    });
    expect(primitives).toHaveLength(3);
    expect(primitives[0]?.semanticRole).toBe('ELECTRICAL_LIGHTING');
    expect(primitives[0]?.metadata).toEqual({
      semanticType: 'LIGHT_POINT',
      symbolId: 'electrical.light-point',
    });
    const circlePoints =
      primitives[0]?.geometry.kind === 'POLYLINE'
        ? primitives[0].geometry.polyline.points
        : [];
    expect(circlePoints[0]).toEqual({ x: 1_000, y: 2_100 });
  });

  it('resolves a national or company profile override without changing domain data', () => {
    const overridden = resolveSymbol(SYMBOL_LIBRARY_V1, 'electrical.socket', {
      ...profile,
      symbolOverrides: {
        'electrical.socket': 'electrical.switch',
      },
    });
    expect(overridden.semanticType).toBe('SWITCH');
  });

  it('rejects duplicate IDs and unsafe malformed primitives', () => {
    const valid = SYMBOL_LIBRARY_V1.definitions['architecture.room-marker']!;
    expect(() => createSymbolLibrary('custom', '1', [valid, valid])).toThrow(
      'Duplicate symbol ID',
    );
    const malformed: SymbolDefinition = {
      ...valid,
      id: 'custom.bad',
      primitives: [
        {
          kind: 'CIRCLE',
          center: { x: 0, y: 0 },
          radius: Number.NaN,
          role: 'SYMBOL',
        },
      ],
    };
    expect(() => createSymbolLibrary('custom', '1', [malformed])).toThrow(
      'invalid radius',
    );
  });

  it('keeps model-space dimensions independent from drawing scale', () => {
    const modelSymbol: SymbolDefinition = {
      id: 'custom.model-line',
      name: 'Model line',
      semanticType: 'MODEL_LINE',
      discipline: 'ARCHITECTURE',
      viewBox: { min: { x: 0, y: -1 }, max: { x: 100, y: 1 } },
      anchors: [],
      primitives: [
        {
          kind: 'LINE',
          start: { x: 0, y: 0 },
          end: { x: 100, y: 0 },
          role: 'SYMBOL',
        },
      ],
      scaleRules: { space: 'MODEL_SPACE' },
    };
    const [primitive] = placeSymbol(modelSymbol, {
      id: 'model',
      symbolId: modelSymbol.id,
      position: { x: 10, y: 20 },
      drawingScale: 100,
    });
    expect(
      primitive?.geometry.kind === 'POLYLINE'
        ? primitive.geometry.polyline.points
        : [],
    ).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
    ]);
  });

  it('rejects a placement whose semantic symbol ID does not match', () => {
    const definition = SYMBOL_LIBRARY_V1.definitions['electrical.socket']!;
    expect(() =>
      placeSymbol(definition, {
        id: 'socket-1',
        symbolId: 'electrical.switch',
        position: { x: 0, y: 0 },
        drawingScale: 50,
      }),
    ).toThrow('does not match');
  });

  it('rejects non-finite transforms and definitions at the placement boundary', () => {
    const definition = SYMBOL_LIBRARY_V1.definitions['electrical.socket']!;
    expect(() =>
      placeSymbol(definition, {
        id: 'socket',
        symbolId: definition.id,
        position: { x: Number.NaN, y: 0 },
        drawingScale: 50,
      }),
    ).toThrow('finite coordinates');
    expect(() =>
      placeSymbol(definition, {
        id: 'socket',
        symbolId: definition.id,
        position: { x: 0, y: 0 },
        drawingScale: 50,
        rotationDeg: Number.POSITIVE_INFINITY,
      }),
    ).toThrow('rotation');
    expect(() =>
      placeSymbol(
        {
          ...definition,
          scaleRules: { space: 'PAPER_SPACE', nominalSizeMm: Number.NaN },
        },
        {
          id: 'socket',
          symbolId: definition.id,
          position: { x: 0, y: 0 },
          drawingScale: 50,
        },
      ),
    ).toThrow('nominal size');
  });
});

describe('the symbols as data', () => {
  it('lives in a file rather than in the code that draws it', () => {
    // Definitions written out in TypeScript with four helpers to keep them
    // short: it works at twenty-seven and stops at three hundred.
    expect(GENERIC_SYMBOL_FORMAT_VERSION).toBe('1.0.0');
    expect(rawGenericSymbolEntries()).toHaveLength(45);
    expect(Object.keys(SYMBOL_LIBRARY_V1.definitions)).toHaveLength(45);
    expect(SYMBOL_LIBRARY_V1.licence).toBe('AGPL-3.0-only');
  });

  it('adds a second file to the same library rather than a second library', () => {
    // A drawing names a symbol, not a library, and two libraries would make
    // the same name mean two things.
    expect(SYMBOL_LIBRARY_V1.id).toBe('generic-technical-symbols');
    expect(symbolCatalogSources()).toContain(
      'packages/drawing-engine/data/symbols/architecture-fixtures.json',
    );
  });

  it('draws the fixtures of a house at the size they are', () => {
    // A basin drawn six millimetres on the sheet is a dot at 1:50 and a dot at
    // 1:100: it says a basin is here, and nothing about whether it fits.
    const bath = SYMBOL_LIBRARY_V1.definitions['architecture.fixture.bathtub'];
    expect(bath?.scaleRules.space).toBe('MODEL_SPACE');
    expect(bath!.viewBox.max.x - bath!.viewBox.min.x).toBe(1_700);
    expect(bath!.viewBox.max.y - bath!.viewBox.min.y).toBe(700);
  });

  it('versions every glyph and says where it comes from', () => {
    for (const symbol of rawGenericSymbolEntries()) {
      expect(symbol.version).toMatch(/^\d+\.\d+\.\d+$/u);
      expect(symbol.provenance?.reference).not.toBe('');
    }
    expect(symbolCatalogIssues()).toEqual([]);
  });

  it('reports a broken glyph instead of bringing the application down', () => {
    const [first] = rawGenericSymbolEntries();
    const broken = {
      ...first!,
      id: 'symbol-broken',
      viewBox: { min: { x: 3, y: 3 }, max: { x: -3, y: -3 } },
    };
    const { version: _dropped, ...unversioned } = broken;
    expect(symbolCatalogIssues([unversioned]).map(({ path }) => path)).toEqual([
      '',
      'version',
    ]);
  });
});
