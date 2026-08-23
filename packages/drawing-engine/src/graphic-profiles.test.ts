import { describe, expect, it } from 'vitest';

import {
  FR_INITIAL_PRINT,
  FR_INITIAL_SCREEN,
  GENERIC_TECHNICAL_PRINT,
  GENERIC_TECHNICAL_SCREEN,
  GRAPHIC_PROFILE_REGISTRY,
  graphicProfileBundle,
  graphicProfileForMode,
  graphicProfilesForMode,
  validateGraphicProfileBundle,
} from './graphic-profiles.js';
import {
  createSemanticScene,
  drawingViewId,
  graphicProfileId,
  type DrawingView,
} from './scene.js';
import { renderSemanticSceneToSvg } from './svg-renderer.js';

describe('graphic profiles v1', () => {
  it.each([
    GENERIC_TECHNICAL_SCREEN,
    GENERIC_TECHNICAL_PRINT,
    FR_INITIAL_SCREEN,
    FR_INITIAL_PRINT,
  ])('resolves every semantic role in $id', (bundle) => {
    expect(() => validateGraphicProfileBundle(bundle)).not.toThrow();
    expect(bundle.version).toBe('1.0.0');
  });

  it('keeps discipline colors on screen and adds line distinctions', () => {
    expect(GENERIC_TECHNICAL_SCREEN.styles.tokens['water-cold']).toMatchObject({
      stroke: '#1769aa',
      strokeWidthPaperMm: 0.25,
    });
    expect(
      GENERIC_TECHNICAL_SCREEN.styles.tokens['water-non-potable']?.dashPaperMm,
    ).toEqual([4, 1]);
  });

  it('uses monochrome print styles without relying on color alone', () => {
    expect(GENERIC_TECHNICAL_PRINT.styles.tokens['water-cold']?.stroke).toBe(
      '#111111',
    );
    expect(
      GENERIC_TECHNICAL_PRINT.styles.tokens['water-recirculation']?.dashPaperMm,
    ).toEqual([3, 1]);
    expect(
      GENERIC_TECHNICAL_PRINT.styles.tokens['vent-transfer']?.dashPaperMm,
    ).toEqual([2, 1]);
  });

  it('renders paper widths at the drawing scale deterministically', () => {
    const view: DrawingView = {
      id: drawingViewId('profile-test'),
      type: 'PLAN',
      scale: 50,
      viewport: { min: { x: 0, y: 0 }, max: { x: 1_000, y: 1_000 } },
      visibleDisciplines: ['ARCHITECTURE'],
      graphicProfileId: GENERIC_TECHNICAL_PRINT.profile.id,
    };
    const scene = createSemanticScene(view, [
      {
        id: 'wall',
        semanticRole: 'WALL_CUT',
        geometry: {
          kind: 'POLYLINE',
          polyline: {
            points: [
              { x: 0, y: 100 },
              { x: 1_000, y: 100 },
            ],
            closed: false,
          },
        },
        layer: 'ARCH_WALL',
        zIndex: 1,
        discipline: 'ARCHITECTURE',
      },
    ]);
    const svg = renderSemanticSceneToSvg(
      scene,
      view,
      GENERIC_TECHNICAL_PRINT.profile,
      GENERIC_TECHNICAL_PRINT.styles,
    );
    expect(svg).toContain('stroke-width:25');
  });

  it('rejects incomplete bundles instead of silently applying defaults', () => {
    expect(() =>
      validateGraphicProfileBundle({
        id: 'incomplete',
        family: 'incomplete',
        version: '1',
        mode: 'PRINT',
        profile: {
          id: graphicProfileId('incomplete'),
          name: 'Incomplete',
          roleTokens: {},
        },
        styles: { tokens: {} },
        designReferences: [],
      }),
    ).toThrow('no style for semantic role SITE');
  });

  it('rejects invalid optional style values before rendering', () => {
    expect(() =>
      validateGraphicProfileBundle({
        ...GENERIC_TECHNICAL_PRINT,
        styles: {
          ...GENERIC_TECHNICAL_PRINT.styles,
          tokens: {
            ...GENERIC_TECHNICAL_PRINT.styles.tokens,
            dimension: {
              ...GENERIC_TECHNICAL_PRINT.styles.tokens.dimension,
              dashPaperMm: [2, Number.NaN],
            },
          },
        },
      }),
    ).toThrow('dash pattern');
  });
});

describe('the charters this version ships', () => {
  it('finds every one of them by the identifier a file carries', () => {
    // Four profiles existed and one was findable: everything else a saved view
    // named came back as « une charte que cette version ne connaît pas ».
    for (const entry of GRAPHIC_PROFILE_REGISTRY)
      expect(graphicProfileBundle(entry.id)).toBe(entry);
    expect(graphicProfileBundle('charte-agence')).toBeUndefined();
  });

  it('separates what is drawn on a screen from what is printed', () => {
    expect(
      graphicProfilesForMode('PRINT').every(({ mode }) => mode === 'PRINT'),
    ).toBe(true);
    expect(graphicProfilesForMode('SCREEN')).toHaveLength(
      GRAPHIC_PROFILE_REGISTRY.length - graphicProfilesForMode('PRINT').length,
    );
  });

  it('prints a screen charter with its own printed counterpart', () => {
    // Colour that separates five networks on a screen becomes five
    // indistinguishable greys on paper; the pair is stated, not guessed.
    expect(graphicProfileForMode(FR_INITIAL_SCREEN.id, 'PRINT')).toBe(
      FR_INITIAL_PRINT,
    );
    expect(graphicProfileForMode(FR_INITIAL_PRINT.id, 'PRINT')).toBe(
      FR_INITIAL_PRINT,
    );
    expect(graphicProfileForMode('charte-agence', 'PRINT')).toBeUndefined();
  });

  it('holds nothing it could not render', () => {
    for (const entry of GRAPHIC_PROFILE_REGISTRY)
      expect(() => validateGraphicProfileBundle(entry)).not.toThrow();
  });
});

describe('specialisations a charter may state', () => {
  it('leaves the four technical charters exactly as they were', () => {
    // The technical charters state no rule: anything they draw differently
    // after the resolver exists is a regression, not a feature.
    for (const entry of [
      GENERIC_TECHNICAL_SCREEN,
      GENERIC_TECHNICAL_PRINT,
      FR_INITIAL_SCREEN,
      FR_INITIAL_PRINT,
    ])
      expect(entry.profile.styleRules ?? []).toEqual([]);
  });

  it('refuses a rule that would replace every role at once', () => {
    expect(() =>
      validateGraphicProfileBundle({
        ...GENERIC_TECHNICAL_SCREEN,
        profile: {
          ...GENERIC_TECHNICAL_SCREEN.profile,
          styleRules: [{ match: {}, token: 'wall-cut' }],
        },
      }),
    ).toThrow('states no condition');
  });

  it('refuses a rule naming a token the charter cannot draw', () => {
    expect(() =>
      validateGraphicProfileBundle({
        ...GENERIC_TECHNICAL_SCREEN,
        profile: {
          ...GENERIC_TECHNICAL_SCREEN.profile,
          styleRules: [
            {
              match: {
                semanticRole: 'SPACE_FILL',
                metadata: { category: 'BEDROOM' },
              },
              token: 'space-bedroom',
            },
          ],
        },
      }),
    ).toThrow('no style for token space-bedroom');
  });

  it('refuses a font weight no renderer could honour', () => {
    expect(() =>
      validateGraphicProfileBundle({
        ...GENERIC_TECHNICAL_SCREEN,
        styles: {
          ...GENERIC_TECHNICAL_SCREEN.styles,
          tokens: {
            ...GENERIC_TECHNICAL_SCREEN.styles.tokens,
            annotation: {
              ...GENERIC_TECHNICAL_SCREEN.styles.tokens.annotation,
              fontWeight: 0,
            },
          },
        },
      }),
    ).toThrow('invalid font weight');
  });
});
