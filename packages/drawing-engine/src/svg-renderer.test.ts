import { describe, expect, it } from 'vitest';
import {
  drawingViewId,
  graphicProfileId,
  type DrawingView,
  type GraphicProfile,
  type SemanticScene,
} from './scene.js';
import {
  renderSemanticSceneToSvg,
  type SvgStyleCatalog,
} from './svg-renderer.js';

const profileId = graphicProfileId('technical');
const view: DrawingView = {
  id: drawingViewId('plan'),
  type: 'PLAN',
  scale: 50,
  viewport: { min: { x: 0, y: 0 }, max: { x: 4000, y: 3000 } },
  visibleDisciplines: ['ARCHITECTURE'],
  graphicProfileId: profileId,
};
const profile: GraphicProfile = {
  id: profileId,
  name: 'Technical',
  roleTokens: { WALL_CUT: 'wall', OPENING: 'opening', SPACE_FILL: 'space' },
};
const styles: SvgStyleCatalog = {
  tokens: {
    wall: { stroke: '#111', fill: '#ddd', strokeWidthPaperMm: 0.5 },
    opening: { stroke: '#222', strokeWidthPaperMm: 0.25 },
    space: { fill: '#fafafa' },
  },
  stateOverrides: { SELECTED: { stroke: '#06f', strokeWidthPaperMm: 0.7 } },
};
const scene: SemanticScene = {
  viewId: view.id,
  primitives: [
    {
      id: 'space',
      semanticRole: 'SPACE_FILL',
      geometry: {
        kind: 'POLYGON',
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
          ],
        },
      },
      layer: 'spaces',
      zIndex: 0,
      discipline: 'ARCHITECTURE',
    },
    {
      id: 'wall',
      sourceObjectId: 'wall<&',
      semanticRole: 'WALL_CUT',
      geometry: {
        kind: 'POLYLINE',
        polyline: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          closed: false,
        },
      },
      layer: 'walls',
      zIndex: 1,
      discipline: 'ARCHITECTURE',
      state: 'SELECTED',
    },
  ],
};

describe('SVG renderer', () => {
  it('renders semantic polygons and wall polylines in model coordinates', () => {
    const svg = renderSemanticSceneToSvg(scene, view, profile, styles);
    expect(svg).toContain('viewBox="0 0 4000 3000"');
    expect(svg).toContain('<path id="space"');
    expect(svg).toContain('<polyline id="wall"');
    expect(svg).toContain('stroke-width:25');
    expect(svg).toContain('data-source-id="wall&lt;&amp;"');
  });
  it('omits interaction styling from stable exports by default', () => {
    expect(
      renderSemanticSceneToSvg(scene, view, profile, styles),
    ).not.toContain('data-state');
    expect(
      renderSemanticSceneToSvg(scene, view, profile, styles, {
        includeInteractionStates: true,
      }),
    ).toContain('data-state="SELECTED"');
  });
  it('escapes text and rejects unsafe style injection', () => {
    const textScene: SemanticScene = {
      viewId: view.id,
      primitives: [
        {
          id: 'label',
          semanticRole: 'OPENING',
          geometry: {
            kind: 'TEXT',
            anchor: { x: 1, y: 2 },
            text: '<room & door>',
          },
          layer: 'labels',
          zIndex: 0,
          discipline: 'ARCHITECTURE',
        },
      ],
    };
    expect(
      renderSemanticSceneToSvg(textScene, view, profile, styles),
    ).toContain('&lt;room &amp; door&gt;');
    expect(() =>
      renderSemanticSceneToSvg(scene, view, profile, {
        tokens: { ...styles.tokens, wall: { stroke: 'red;display:none' } },
      }),
    ).toThrow(TypeError);
  });
  it('rejects missing semantic-role mappings instead of rendering unstyled geometry', () => {
    expect(() =>
      renderSemanticSceneToSvg(
        scene,
        view,
        { ...profile, roleTokens: {} },
        styles,
      ),
    ).toThrow('no token for semantic role');
  });
});

describe('what the charter decides beyond the semantic role', () => {
  const ruled: GraphicProfile = {
    ...profile,
    styleRules: [
      {
        match: { semanticRole: 'WALL_CUT', metadata: { role: 'PARTITION' } },
        token: 'partition',
      },
    ],
  };
  const ruledStyles: SvgStyleCatalog = {
    ...styles,
    tokens: {
      ...styles.tokens,
      partition: { stroke: '#345', fill: '#345', strokeWidthPaperMm: 0.35 },
    },
  };
  const { state: _selected, ...unselectedWall } = scene.primitives[1]!;
  const partitionScene: SemanticScene = {
    viewId: view.id,
    primitives: [{ ...unselectedWall, metadata: { role: 'PARTITION' } }],
  };

  it('draws a partition differently from a party wall without a new role', () => {
    // The wall's role was in the scene already; only the renderer refused to
    // read it, so a plasterboard partition weighed as much as a party wall.
    expect(
      renderSemanticSceneToSvg(partitionScene, view, ruled, ruledStyles),
    ).toContain('stroke-width:17.5');
    expect(
      renderSemanticSceneToSvg(partitionScene, view, profile, ruledStyles),
    ).toContain('stroke-width:25');
  });

  it('still names the role when no rule and no role token answers', () => {
    expect(() =>
      renderSemanticSceneToSvg(
        partitionScene,
        view,
        { ...ruled, roleTokens: {}, styleRules: [] },
        ruledStyles,
      ),
    ).toThrow('no token for semantic role');
  });

  it('rejects a rule pointing at a token the catalog does not hold', () => {
    expect(() =>
      renderSemanticSceneToSvg(partitionScene, view, ruled, styles),
    ).toThrow('Unknown graphic token: partition');
  });

  it('writes the typographic and line-end properties a clean plan needs', () => {
    const labelScene: SemanticScene = {
      viewId: view.id,
      primitives: [
        {
          id: 'label',
          semanticRole: 'SPACE_FILL',
          geometry: { kind: 'TEXT', anchor: { x: 10, y: 20 }, text: 'CH 1' },
          layer: 'labels',
          zIndex: 0,
          discipline: 'ARCHITECTURE',
        },
      ],
    };
    const svg = renderSemanticSceneToSvg(labelScene, view, profile, {
      ...styles,
      tokens: {
        ...styles.tokens,
        space: {
          fill: '#111',
          fontSizePaperMm: 2.8,
          fontWeight: 600,
          textAnchor: 'middle',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
      },
    });
    expect(svg).toContain('font-size:140');
    expect(svg).toContain('font-weight:600');
    expect(svg).toContain('text-anchor:middle');
    expect(svg).toContain('stroke-linecap:round');
    expect(svg).toContain('stroke-linejoin:round');
  });

  it('rejects a font weight no renderer could honour', () => {
    expect(() =>
      renderSemanticSceneToSvg(scene, view, profile, {
        ...styles,
        tokens: { ...styles.tokens, wall: { fontWeight: 5_000 } },
      }),
    ).toThrow('Font weight');
  });
});
