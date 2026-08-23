import { describe, expect, it } from 'vitest';

import {
  graphicProfileId,
  type GraphicProfile,
  type ScenePrimitive,
} from './scene.js';
import {
  graphicStyleRuleSpecificity,
  resolveGraphicToken,
} from './style-resolver.js';

const base: GraphicProfile = {
  id: graphicProfileId('resolver-test'),
  name: 'Resolver test',
  roleTokens: {
    SPACE_FILL: 'space-fill',
    WALL_CUT: 'wall-cut',
    ANNOTATION: 'annotation',
  },
};

type Drawn = Pick<ScenePrimitive, 'semanticRole' | 'layer' | 'metadata'>;

const space = (
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): Drawn => ({
  semanticRole: 'SPACE_FILL',
  layer: 'architecture.spaces',
  ...(metadata === undefined ? {} : { metadata }),
});

describe('the token a charter draws a primitive with', () => {
  it('falls back on the role when the charter states no rule', () => {
    // The four charters that shipped before rules existed must keep drawing
    // exactly what they drew: a profile with no rules is the old behaviour.
    expect(resolveGraphicToken(base, space({ category: 'BEDROOM' }))).toBe(
      'space-fill',
    );
    expect(
      resolveGraphicToken(
        { ...base, styleRules: [] },
        space({ category: 'BEDROOM' }),
      ),
    ).toBe('space-fill');
  });

  it('reads what the scene already said about the object', () => {
    // The category was in the metadata all along; only the renderer was
    // refusing to look at it, so every room came out the same beige.
    const profile: GraphicProfile = {
      ...base,
      styleRules: [
        {
          match: {
            semanticRole: 'SPACE_FILL',
            metadata: { category: 'BEDROOM' },
          },
          token: 'space-bedroom',
        },
        {
          match: {
            semanticRole: 'SPACE_FILL',
            metadata: { category: 'BATHROOM' },
          },
          token: 'space-bathroom',
        },
        {
          match: { semanticRole: 'WALL_CUT', metadata: { role: 'EXTERIOR' } },
          token: 'wall-exterior',
        },
      ],
    };
    expect(resolveGraphicToken(profile, space({ category: 'BEDROOM' }))).toBe(
      'space-bedroom',
    );
    expect(resolveGraphicToken(profile, space({ category: 'BATHROOM' }))).toBe(
      'space-bathroom',
    );
    expect(resolveGraphicToken(profile, space({ category: 'GARAGE' }))).toBe(
      'space-fill',
    );
    expect(
      resolveGraphicToken(profile, {
        semanticRole: 'WALL_CUT',
        layer: 'architecture.walls',
        metadata: { role: 'EXTERIOR', thicknessMm: 300 },
      }),
    ).toBe('wall-exterior');
  });

  it('matches a list of values as one rule', () => {
    const profile: GraphicProfile = {
      ...base,
      styleRules: [
        {
          match: {
            semanticRole: 'WALL_CUT',
            metadata: { role: ['INTERIOR', 'PARTITION'] },
          },
          token: 'wall-interior',
        },
      ],
    };
    for (const role of ['INTERIOR', 'PARTITION'])
      expect(
        resolveGraphicToken(profile, {
          semanticRole: 'WALL_CUT',
          layer: 'architecture.walls',
          metadata: { role },
        }),
      ).toBe('wall-interior');
    expect(
      resolveGraphicToken(profile, {
        semanticRole: 'WALL_CUT',
        layer: 'architecture.walls',
        metadata: { role: 'EXTERIOR' },
      }),
    ).toBe('wall-cut');
  });

  it('lets the more specific rule win however the charter is ordered', () => {
    const specific = {
      match: {
        semanticRole: 'SPACE_FILL',
        layer: 'architecture.spaces',
        metadata: { category: 'BEDROOM' },
      },
      token: 'space-bedroom',
    } as const;
    const general = {
      match: { semanticRole: 'SPACE_FILL' },
      token: 'space-any',
    } as const;
    expect(
      resolveGraphicToken(
        { ...base, styleRules: [specific, general] },
        space({ category: 'BEDROOM' }),
      ),
    ).toBe('space-bedroom');
    expect(
      resolveGraphicToken(
        { ...base, styleRules: [general, specific] },
        space({ category: 'BEDROOM' }),
      ),
    ).toBe('space-bedroom');
  });

  it('obeys a stated priority over the count of criteria', () => {
    const profile: GraphicProfile = {
      ...base,
      styleRules: [
        {
          match: {
            semanticRole: 'SPACE_FILL',
            layer: 'architecture.spaces',
            metadata: { category: 'BEDROOM' },
          },
          token: 'space-bedroom',
        },
        {
          match: { semanticRole: 'SPACE_FILL' },
          token: 'space-override',
          priority: 100,
        },
      ],
    };
    expect(resolveGraphicToken(profile, space({ category: 'BEDROOM' }))).toBe(
      'space-override',
    );
  });

  it('gives an equal tie to the rule written first', () => {
    const profile: GraphicProfile = {
      ...base,
      styleRules: [
        { match: { semanticRole: 'SPACE_FILL' }, token: 'first' },
        { match: { semanticRole: 'SPACE_FILL' }, token: 'second' },
      ],
    };
    expect(resolveGraphicToken(profile, space())).toBe('first');
  });

  it('does not match a key the primitive does not carry', () => {
    // « The room has no category » and « the room's category is nothing » are
    // different statements, and a charter that confuses them paints unnamed
    // rooms with the colour of whatever it listed last.
    const profile: GraphicProfile = {
      ...base,
      styleRules: [
        {
          match: { semanticRole: 'SPACE_FILL', metadata: { category: null } },
          token: 'space-uncategorised',
        },
      ],
    };
    expect(resolveGraphicToken(profile, space())).toBe('space-fill');
    expect(resolveGraphicToken(profile, space({ name: 'Séjour' }))).toBe(
      'space-fill',
    );
    expect(resolveGraphicToken(profile, space({ category: null }))).toBe(
      'space-uncategorised',
    );
  });

  it('separates the same role drawn on two layers', () => {
    const profile: GraphicProfile = {
      ...base,
      styleRules: [
        {
          match: {
            semanticRole: 'ANNOTATION',
            layer: 'architecture.space-labels',
          },
          token: 'space-label',
        },
      ],
    };
    expect(
      resolveGraphicToken(profile, {
        semanticRole: 'ANNOTATION',
        layer: 'architecture.space-labels',
      }),
    ).toBe('space-label');
    expect(
      resolveGraphicToken(profile, {
        semanticRole: 'ANNOTATION',
        layer: 'annotation.notes',
      }),
    ).toBe('annotation');
  });

  it('reports nothing rather than inventing a default', () => {
    expect(
      resolveGraphicToken(base, {
        semanticRole: 'NETWORK',
        layer: 'water.pipes',
      }),
    ).toBeUndefined();
  });

  it('weighs a rule by the number of things it asks about', () => {
    expect(graphicStyleRuleSpecificity({})).toBe(0);
    expect(graphicStyleRuleSpecificity({ semanticRole: 'WALL_CUT' })).toBe(1);
    expect(
      graphicStyleRuleSpecificity({
        semanticRole: 'WALL_CUT',
        layer: 'architecture.walls',
        metadata: { role: 'EXTERIOR', bearing: true },
      }),
    ).toBe(4);
  });
});
