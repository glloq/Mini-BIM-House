import { describe, expect, it } from 'vitest';

import { graphicProfileId } from './scene.js';
import {
  createSymbolLibrary,
  placeSymbol,
  resolveSymbol,
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
    expect(disciplines).toEqual(
      new Set(['ARCHITECTURE', 'WATER', 'VENTILATION', 'ELECTRICAL']),
    );
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
