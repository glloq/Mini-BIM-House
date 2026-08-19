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
