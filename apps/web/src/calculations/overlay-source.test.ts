import { describe, expect, it } from 'vitest';
import {
  overlayLegend,
  overlayPrimitives,
} from '@house-technical-designer/view-query';
import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import {
  OVERLAY_OPTIONS,
  buildOverlay,
  overlayOption,
  type OverlayId,
} from './overlay-source.js';
import type { ModuleRun } from './calculation-runner.js';

function run(moduleId: string, outputs: Record<string, unknown>): ModuleRun {
  return {
    moduleId,
    label: moduleId,
    status: 'OK',
    result: {
      moduleId,
      moduleVersion: '1.0.0',
      methodId: 'test',
      precision: 'ENGINEERING',
      status: 'OK',
      outputs: outputs as never,
      warnings: [],
      assumptions: [],
      references: [],
      inputFingerprint: 'test',
    },
    missing: [],
    inputs: {},
  };
}

describe('the analyses the plan can be coloured by', () => {
  it('offers one for every discipline whose engine already exists', () => {
    const modules = new Set(
      OVERLAY_OPTIONS.flatMap((option) => {
        const moduleId = overlayOption(option.id)?.moduleId;
        return moduleId === undefined ? [] : [moduleId];
      }),
    );
    // The engines have been in the repository for a long time; until now only
    // the thermal ones reached the drawing.
    expect([...modules].sort()).toEqual([
      'electrical',
      'thermal',
      'ventilation',
      'wastewater',
      'water',
    ]);
  });

  it('reads the values from the module that produced them', () => {
    const overlay = buildOverlay(
      'water-velocity',
      [
        run('water', {
          segments: [
            { id: 'water:trunk', velocityMs: 1.2 },
            { id: 'water:branch-sink', velocityMs: 0.4 },
          ],
        }),
      ],
      undefined,
    )!;
    expect(overlay.values['water:trunk']).toBe(1.2);
    expect(overlay.unit).toBe('m/s');
    expect(overlay.scale?.maximum).toBe(1.2);
  });

  it('keeps a row with no value unknown rather than worth zero', () => {
    const overlay = buildOverlay(
      'wastewater-slope',
      [
        run('wastewater', {
          segments: [
            { id: 'a', slope: 0.02 },
            { id: 'b', slope: null },
          ],
        }),
      ],
      undefined,
    )!;
    expect(overlay.values.b).toBeNull();
    expect(overlay.states?.b).toBe('UNKNOWN');
    expect(overlayLegend(overlay).unknownCount).toBe(1);
    // A missing slope must never pull the scale down to zero.
    expect(overlay.scale?.minimum).toBe(0.02);
  });

  it('says nothing when the module did not run', () => {
    expect(buildOverlay('water-velocity', [], undefined)).toBeUndefined();
    expect(
      buildOverlay('electrical-voltage-drop', [run('water', {})], undefined),
    ).toBeUndefined();
  });

  it('says nothing when the module produced no row', () => {
    expect(
      buildOverlay(
        'ventilation-velocity',
        [run('ventilation', { segments: [] })],
        undefined,
      ),
    ).toBeUndefined();
  });

  it('names the module each analysis reads', () => {
    for (const option of OVERLAY_OPTIONS)
      if (option.id !== 'none')
        expect(overlayOption(option.id)?.moduleId, option.id).toBeDefined();
  });
});

describe('projecting an analysis onto the drawing', () => {
  const line: ScenePrimitive = {
    id: 'network-edge:water:trunk',
    sourceObjectId: 'water:trunk',
    semanticRole: 'WATER_COLD',
    geometry: {
      kind: 'POLYLINE',
      polyline: {
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        closed: false,
      },
    },
    layer: 'water.pipes',
    zIndex: 40,
    discipline: 'WATER',
  };

  it('colours a pipe, which is a line and not a shape', () => {
    // An overlay that only knew how to colour shapes could report on the
    // envelope and never on the networks.
    const overlay = buildOverlay(
      'water-velocity',
      [run('water', { segments: [{ id: 'water:trunk', velocityMs: 1.2 }] })],
      undefined,
    )!;
    const drawn = overlayPrimitives([line], overlay);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.geometry.kind).toBe('POLYLINE');
  });

  it('colours an appliance, which is a point', () => {
    const point: ScenePrimitive = {
      ...line,
      id: 'network-node:water:sink',
      sourceObjectId: 'water:sink',
      geometry: { kind: 'POINT', point: { x: 0, y: 0 } },
    };
    const overlay = buildOverlay(
      'water-velocity',
      [run('water', { segments: [{ id: 'water:sink', velocityMs: 0.8 }] })],
      undefined,
    )!;
    expect(overlayPrimitives([point], overlay)).toHaveLength(1);
  });

  it('leaves alone an object the analysis says nothing about', () => {
    const overlay = buildOverlay(
      'water-velocity',
      [run('water', { segments: [{ id: 'elsewhere', velocityMs: 1 }] })],
      undefined,
    )!;
    expect(overlayPrimitives([line], overlay)).toEqual([]);
  });
});

describe('the identifiers of the analyses', () => {
  it('keeps every one the interface can be set to', () => {
    const ids: readonly OverlayId[] = OVERLAY_OPTIONS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
