import { describe, expect, it } from 'vitest';

import { GENERIC_TECHNICAL_PRINT } from './graphic-profiles.js';
import {
  createSemanticScene,
  drawingViewId,
  type DrawingView,
  type ScenePrimitive,
} from './scene.js';
import { exportSemanticSceneToSvg } from './svg-export.js';

const view: DrawingView = {
  id: drawingViewId('ground-floor'),
  type: 'PLAN',
  scale: 50,
  viewport: { min: { x: 0, y: 0 }, max: { x: 1_000, y: 700 } },
  visibleDisciplines: ['ARCHITECTURE', 'WATER'],
  graphicProfileId: GENERIC_TECHNICAL_PRINT.profile.id,
};

const primitives: readonly ScenePrimitive[] = [
  {
    id: 'wall-1',
    sourceObjectId: 'domain-wall-1',
    semanticRole: 'WALL_CUT',
    geometry: {
      kind: 'POLYLINE',
      polyline: {
        points: [
          { x: 10, y: 10 },
          { x: 900, y: 10 },
        ],
        closed: false,
      },
    },
    layer: 'A-WALL-CUT',
    zIndex: 1,
    discipline: 'ARCHITECTURE',
  },
  {
    id: 'pipe-1',
    semanticRole: 'WATER_COLD',
    geometry: {
      kind: 'POLYLINE',
      polyline: {
        points: [
          { x: 20, y: 100 },
          { x: 800, y: 100 },
        ],
        closed: false,
      },
    },
    layer: 'P-COLD-WATER',
    zIndex: 2,
    discipline: 'WATER',
  },
];

describe('clean SVG export', () => {
  it('exports deterministic vector content with metadata and semantic groups', () => {
    const request = {
      scene: createSemanticScene(view, primitives),
      view,
      profile: GENERIC_TECHNICAL_PRINT.profile,
      styles: GENERIC_TECHNICAL_PRINT.styles,
      fileName: 'Plan RDC',
      metadata: {
        title: 'Plan <RDC>',
        projectId: 'house-1',
        revision: 'A',
      },
    } as const;
    const first = exportSemanticSceneToSvg(request);
    const second = exportSemanticSceneToSvg(request);
    expect(first).toEqual(second);
    expect(first.fileName).toBe('Plan RDC.svg');
    expect(first.mediaType).toBe('image/svg+xml');
    expect(first.byteLength).toBe(
      new TextEncoder().encode(first.content).length,
    );
    expect(first.fingerprint).toMatch(/^[0-9a-f]{8}$/u);
    expect(
      first.content.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
    ).toBe(true);
    expect(first.content).toContain('&lt;RDC&gt;');
    expect(first.content).toContain(
      'data-discipline="ARCHITECTURE" data-layer="A-WALL-CUT"',
    );
    expect(first.content).toContain('data-source-id="domain-wall-1"');
    expect(first.content.indexOf('wall-1')).toBeLessThan(
      first.content.indexOf('pipe-1'),
    );
  });

  it('canonicalizes metadata independently of caller property order', () => {
    const scene = createSemanticScene(view, primitives);
    const base = {
      scene,
      view,
      profile: GENERIC_TECHNICAL_PRINT.profile,
      styles: GENERIC_TECHNICAL_PRINT.styles,
      fileName: 'plan.svg',
    };
    const first = exportSemanticSceneToSvg({
      ...base,
      metadata: { title: 'Plan', creator: 'Alice', revision: 'B' },
    });
    const second = exportSemanticSceneToSvg({
      ...base,
      metadata: { revision: 'B', creator: 'Alice', title: 'Plan' },
    });
    expect(first.content).toBe(second.content);
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it('does not include interaction state in a technical export', () => {
    const selected = [{ ...primitives[0]!, state: 'SELECTED' as const }];
    const artifact = exportSemanticSceneToSvg({
      scene: createSemanticScene(view, selected),
      view,
      profile: GENERIC_TECHNICAL_PRINT.profile,
      styles: GENERIC_TECHNICAL_PRINT.styles,
      fileName: 'selected',
      metadata: { title: 'Selected' },
    });
    expect(artifact.content).not.toContain('data-state');
    expect(artifact.content).not.toContain('#1976d2');
  });

  it('rejects paths, unsupported names, empty titles, and invalid dates', () => {
    const valid = {
      scene: createSemanticScene(view, primitives),
      view,
      profile: GENERIC_TECHNICAL_PRINT.profile,
      styles: GENERIC_TECHNICAL_PRINT.styles,
      fileName: 'plan',
      metadata: { title: 'Plan' },
    };
    expect(() =>
      exportSemanticSceneToSvg({ ...valid, fileName: '../plan' }),
    ).toThrow('path');
    expect(() =>
      exportSemanticSceneToSvg({ ...valid, fileName: 'plan?.svg' }),
    ).toThrow('unsupported');
    expect(() =>
      exportSemanticSceneToSvg({ ...valid, metadata: { title: ' ' } }),
    ).toThrow('title');
    expect(() =>
      exportSemanticSceneToSvg({
        ...valid,
        metadata: { title: 'Plan', createdAt: 'tomorrow' },
      }),
    ).toThrow('ISO');
  });
});
