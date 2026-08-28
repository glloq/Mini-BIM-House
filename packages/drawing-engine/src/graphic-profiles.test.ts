import { describe, expect, it } from 'vitest';

import {
  ARCHITECTURAL_CLEAN_SCREEN,
  FR_INITIAL_PRINT,
  FR_INITIAL_SCREEN,
  GENERIC_TECHNICAL_PRINT,
  GENERIC_TECHNICAL_SCREEN,
  GRAPHIC_PROFILE_REGISTRY,
  drawingEmphasisIn,
  graphicProfileBundle,
  graphicProfileForMode,
  graphicProfileForStage,
  graphicProfilesForMode,
  validateGraphicProfileBundle,
} from './graphic-profiles.js';
import {
  GRAPHIC_ROLE_RULES,
  drawingSpaceOf,
  type DrawingSpaceId,
} from './role-tokens.js';
import {
  createSemanticScene,
  drawingViewId,
  graphicProfileId,
  type DrawingView,
  type ScenePrimitive,
} from './scene.js';
import { resolveGraphicToken } from './style-resolver.js';
import { renderSemanticSceneToSvg, type SvgStyle } from './svg-renderer.js';

type Drawn = Pick<ScenePrimitive, 'semanticRole' | 'layer' | 'metadata'>;

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
    // Les chartes techniques n'énoncent aucune règle à elles : les seules
    // qu'elles portent sont celles qui définissent les rôles graphiques, et
    // qui sont les mêmes partout. Tout ce qu'elles dessineraient autrement
    // reste une régression, pas une fonctionnalité.
    for (const entry of [
      GENERIC_TECHNICAL_SCREEN,
      GENERIC_TECHNICAL_PRINT,
      FR_INITIAL_SCREEN,
      FR_INITIAL_PRINT,
    ])
      expect(entry.profile.styleRules ?? []).toEqual([...GRAPHIC_ROLE_RULES]);
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

/*
 * Ce qui suit tient la moitié visible de la règle des espaces : le même objet
 * se dessine autrement selon l'espace ouvert. Ces épreuves échouent si le
 * dégradé disparaît, et pas seulement s'il change de valeurs.
 */
const parcelGround = {
  semanticRole: 'SITE',
  layer: 'site.parcel',
  metadata: { ground: true },
} as const satisfies Drawn;
const parcelBoundary = {
  semanticRole: 'SITE',
  layer: 'site.parcel',
} as const satisfies Drawn;
const outerWall = {
  semanticRole: 'WALL_CUT',
  layer: 'architecture.walls',
  metadata: { role: 'EXTERIOR' },
} as const satisfies Drawn;
const duct = {
  semanticRole: 'VENT_SUPPLY',
  layer: 'ventilation.ducts',
  metadata: { discipline: 'VENTILATION' },
} as const satisfies Drawn;
const bed = {
  semanticRole: 'SYMBOL',
  layer: 'components.placed',
  metadata: { category: 'FURNITURE' },
} as const satisfies Drawn;
const radiator = {
  semanticRole: 'ANALYSIS_MEDIUM',
  layer: 'components.placed',
  metadata: { category: 'HEATING' },
} as const satisfies Drawn;
const roomArea = {
  semanticRole: 'ANNOTATION',
  layer: 'architecture.space-labels',
  metadata: { labelPart: 'AREA' },
} as const satisfies Drawn;

/** Ce avec quoi ce dessin est tracé, dans cet espace. */
const drawnIn = (stage: DrawingSpaceId, subject: Drawn) => {
  const bundle = graphicProfileForStage(ARCHITECTURAL_CLEAN_SCREEN, stage);
  const token = resolveGraphicToken(bundle.profile, subject);
  return { token: token!, style: bundle.styles.tokens[token!]! };
};

/** À quel point un dessin est présent : c'est ce que le dégradé fait varier. */
const presence = (style: SvgStyle): number => style.opacity ?? 1;

describe('le dessin dit ce qui est actif, et ce qui est du contexte', () => {
  it('dessine la parcelle telle quelle au Terrain, et en retrait ailleurs', () => {
    // La parcelle appartient au Terrain. Ailleurs elle reste visible — on
    // implante une maison sur un terrain — mais elle cesse d'être le sujet.
    const inSite = drawnIn('SITE', parcelGround);
    expect(inSite.token).toBe('site-parcel');
    expect(inSite.style).toEqual(
      ARCHITECTURAL_CLEAN_SCREEN.styles.tokens['site-parcel'],
    );
    for (const stage of ['BUILDING', 'FITTING', 'SYSTEMS'] as const) {
      const elsewhere = drawnIn(stage, parcelGround);
      expect(elsewhere.token).not.toBe('site-parcel');
      expect(presence(elsewhere.style)).toBeLessThan(presence(inSite.style));
    }
  });

  it('range chaque espace derrière celui qui est ouvert, dans cet ordre', () => {
    // Actif, référence, puis faible : trois niveaux, et l'ordre est la règle.
    // Deux suffiraient à faire disparaître ce qu'on route contre.
    expect(presence(drawnIn('BUILDING', outerWall).style)).toBeGreaterThan(
      presence(drawnIn('SYSTEMS', outerWall).style),
    );
    expect(presence(drawnIn('SYSTEMS', outerWall).style)).toBeGreaterThan(
      presence(drawnIn('SYSTEMS', parcelGround).style),
    );
  });

  it('garde les murs lisibles quand ils ne sont que la référence', () => {
    // Un mur de référence qu'on n'aurait plus vu aurait rendu inutile le fait
    // de l'avoir gardé : on route une gaine contre un mur, pas contre du vide.
    const reference = drawnIn('SYSTEMS', outerWall);
    expect(presence(reference.style)).toBeGreaterThan(0.4);
    expect(reference.style.stroke).not.toBe('none');
    expect(reference.style.strokeWidthPaperMm).toBeGreaterThan(0.2);
  });

  it('décolore ce qui recule au lieu de l’effacer', () => {
    const active = ARCHITECTURAL_CLEAN_SCREEN.styles.tokens['wall-exterior']!;
    const reference = drawnIn('SYSTEMS', outerWall).style;
    const spread = (hex: string): number => {
      const channels = [1, 3, 5].map((index) =>
        Number.parseInt(hex.slice(index, index + 2), 16),
      );
      return Math.max(...channels) - Math.min(...channels);
    };
    expect(reference.stroke).not.toBe(active.stroke);
    expect(spread(reference.stroke!)).toBeLessThan(spread(active.stroke!));
  });

  it('sépare le mobilier des équipements posés, qui se dessinent pareil', () => {
    // Un lit et un radiateur partagent le jeton `symbol` : c'est la charte qui
    // les dessine pareil, pas le modèle qui les confond. Aux Systèmes le
    // radiateur est le sujet, le lit est ce contre quoi on ne passe pas.
    expect(presence(drawnIn('SYSTEMS', radiator).style)).toBeGreaterThan(
      presence(drawnIn('SYSTEMS', bed).style),
    );
    expect(presence(drawnIn('FITTING', bed).style)).toBeGreaterThan(
      presence(drawnIn('FITTING', radiator).style),
    );
  });

  it('n’estompe jamais ce qui est dit sur le dessin', () => {
    // Une cote, une annotation et l'aire d'une pièce ne sont d'aucun espace :
    // les griser reviendrait à masquer le constat qu'on est venu lire.
    for (const stage of ['SITE', 'BUILDING', 'FITTING', 'SYSTEMS'] as const) {
      expect(drawnIn(stage, roomArea).token).toBe('space-label-area');
      expect(
        drawnIn(stage, {
          semanticRole: 'DIMENSION',
          layer: 'annotation.dimensions',
        }).token,
      ).toBe('dimension');
    }
  });

  it('laisse le plan entier aux espaces qui le regardent en entier', () => {
    // Griser la moitié du plan pendant qu'on cherche pourquoi une pièce est
    // trop froide reviendrait à cacher la réponse.
    for (const stage of ['PROJECT', 'CHECKS', 'DOCUMENTS'] as const)
      expect(graphicProfileForStage(ARCHITECTURAL_CLEAN_SCREEN, stage)).toBe(
        ARCHITECTURAL_CLEAN_SCREEN,
      );
  });

  it('ne change pas de charte pour autant', () => {
    // L'espace ouvert est un état d'écran : une vue enregistrée nomme une
    // charte, et le rendu refuse de dessiner si les deux cessent de coïncider.
    for (const stage of ['SITE', 'BUILDING', 'FITTING', 'SYSTEMS'] as const) {
      const derived = graphicProfileForStage(ARCHITECTURAL_CLEAN_SCREEN, stage);
      expect(derived.id).toBe(ARCHITECTURAL_CLEAN_SCREEN.id);
      expect(derived.profile.id).toBe(ARCHITECTURAL_CLEAN_SCREEN.profile.id);
      expect(derived.family).toBe(ARCHITECTURAL_CLEAN_SCREEN.family);
      expect(() => validateGraphicProfileBundle(derived)).not.toThrow();
    }
  });

  it('rend la même charte à la même question', () => {
    // Tout le plan en dépend : une charte reconstruite à chaque frappe
    // redessinerait la maison à chaque frappe.
    expect(graphicProfileForStage(GENERIC_TECHNICAL_SCREEN, 'SITE')).toBe(
      graphicProfileForStage(GENERIC_TECHNICAL_SCREEN, 'SITE'),
    );
  });

  it('dégrade aussi les chartes qui n’énoncent presque aucune règle', () => {
    // Le dégradé passe par les jetons de rôle autant que par les règles :
    // une charte sans spécialisation doit reculer comme les autres.
    const bundle = graphicProfileForStage(GENERIC_TECHNICAL_SCREEN, 'BUILDING');
    const token = resolveGraphicToken(bundle.profile, duct)!;
    expect(token).not.toBe('vent-supply');
    expect(presence(bundle.styles.tokens[token]!)).toBeLessThan(1);
    expect(resolveGraphicToken(bundle.profile, outerWall)).toBe('wall-cut');
  });

  it('reconnaît à qui appartient un dessin, primitive ou règle', () => {
    expect(drawingSpaceOf(parcelBoundary)).toBe('SITE');
    expect(drawingSpaceOf(outerWall)).toBe('BUILDING');
    expect(drawingSpaceOf(bed)).toBe('FITTING');
    expect(drawingSpaceOf(radiator)).toBe('SYSTEMS');
    // Une pièce porte elle aussi une `category` : la lire hors du calque des
    // objets posés rangerait une chambre parmi ce qu'aucun métier ne réclame.
    expect(
      drawingSpaceOf({
        semanticRole: 'SPACE_FILL',
        layer: 'architecture.spaces',
        metadata: { category: 'BEDROOM' },
      }),
    ).toBe('BUILDING');
    // Une règle qui vise à la fois du mobilier et une chaudière ne relève
    // d'aucun espace, et se dessine donc en entier partout.
    expect(
      drawingSpaceOf({
        layer: 'components.placed',
        metadata: { category: ['FURNITURE', 'HEATING'] },
      }),
    ).toBeUndefined();
    expect(drawingEmphasisIn('SYSTEMS', { semanticRole: 'DIMENSION' })).toBe(
      'ACTIVE',
    );
  });
});
