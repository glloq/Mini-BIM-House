import { describe, expect, it } from 'vitest';

import {
  ARCHITECTURAL_CLEAN_PRINT,
  ARCHITECTURAL_CLEAN_SCREEN,
  GENERIC_TECHNICAL_SCREEN,
  graphicProfileBundle,
  graphicProfileForMode,
  validateGraphicProfileBundle,
} from './graphic-profiles.js';
import { spaceCategoryToken } from './architectural-profile.js';
import { SPACE_GRAPHIC_CATEGORIES } from './space-categories.js';
import { resolveGraphicToken } from './style-resolver.js';
import type { ScenePrimitive } from './scene.js';

type Drawn = Pick<ScenePrimitive, 'semanticRole' | 'layer' | 'metadata'>;

const wall = (role: string): Drawn => ({
  semanticRole: 'WALL_CUT',
  layer: 'architecture.walls',
  metadata: { role, thicknessMm: 300 },
});
const room = (graphicCategory: string): Drawn => ({
  semanticRole: 'SPACE_FILL',
  layer: 'architecture.spaces',
  metadata: { graphicCategory, name: 'Pièce' },
});

const width = (token: string, bundle = ARCHITECTURAL_CLEAN_SCREEN): number =>
  bundle.styles.tokens[token]?.strokeWidthPaperMm ?? 0;

describe('the clean architectural charter', () => {
  it.each([ARCHITECTURAL_CLEAN_SCREEN, ARCHITECTURAL_CLEAN_PRINT])(
    'draws every semantic role and every rule it states in $id',
    (bundle) => {
      expect(() => validateGraphicProfileBundle(bundle)).not.toThrow();
      expect(graphicProfileBundle(bundle.id)).toBe(bundle);
    },
  );

  it('leaves the technical charter alone rather than bending it', () => {
    // A drawing whose reader is looking for a duct and a drawing whose reader
    // is looking at where they would live are two drawings.
    expect(GENERIC_TECHNICAL_SCREEN.profile.styleRules ?? []).toEqual([]);
    expect(GENERIC_TECHNICAL_SCREEN.styles.tokens['wall-cut']?.fill).toBe(
      '#111111',
    );
  });

  it('prints itself with its own printed charter, not the other French one', () => {
    // Both are written in French, which is why pairing by locale answered
    // « la charte technique FR » when asked to print an architectural plan.
    expect(graphicProfileForMode(ARCHITECTURAL_CLEAN_SCREEN.id, 'PRINT')).toBe(
      ARCHITECTURAL_CLEAN_PRINT,
    );
    expect(graphicProfileForMode(ARCHITECTURAL_CLEAN_PRINT.id, 'SCREEN')).toBe(
      ARCHITECTURAL_CLEAN_SCREEN,
    );
  });

  it('makes an outer wall carry the building and a partition not', () => {
    const profile = ARCHITECTURAL_CLEAN_SCREEN.profile;
    expect(resolveGraphicToken(profile, wall('EXTERIOR'))).toBe(
      'wall-exterior',
    );
    expect(resolveGraphicToken(profile, wall('INTERIOR'))).toBe(
      'wall-interior',
    );
    expect(resolveGraphicToken(profile, wall('PARTITION'))).toBe(
      'wall-partition',
    );
    // A role the charter does not name still draws a wall.
    expect(resolveGraphicToken(profile, wall('OTHER'))).toBe('wall-cut');
    expect(width('wall-exterior')).toBeGreaterThan(width('wall-interior'));
    expect(width('wall-interior')).toBeGreaterThan(width('wall-partition'));
  });

  it('keeps that hierarchy on paper, where colour cannot be relied on', () => {
    expect(width('wall-exterior', ARCHITECTURAL_CLEAN_PRINT)).toBeGreaterThan(
      width('wall-partition', ARCHITECTURAL_CLEAN_PRINT),
    );
    // Grey, not colour: the same sheet goes out on a monochrome plotter.
    for (const token of [
      'wall-exterior',
      'wall-interior',
      'wall-partition',
      'opening',
      'symbol',
    ]) {
      const stroke = ARCHITECTURAL_CLEAN_PRINT.styles.tokens[token]?.stroke;
      expect(stroke).toMatch(/^#[0-9a-f]{6}$/iu);
      const channels = [1, 3, 5].map((index) =>
        stroke!.slice(index, index + 2).toLowerCase(),
      );
      expect(new Set(channels).size).toBe(1);
    }
  });

  it('gives every graphic category of room a wash of its own', () => {
    const profile = ARCHITECTURAL_CLEAN_SCREEN.profile;
    for (const category of SPACE_GRAPHIC_CATEGORIES) {
      const token = spaceCategoryToken(category);
      expect(resolveGraphicToken(profile, room(category))).toBe(token);
      expect(ARCHITECTURAL_CLEAN_SCREEN.styles.tokens[token]).toBeDefined();
    }
    // A room the plan could not categorise is still drawn.
    expect(
      resolveGraphicToken(profile, {
        semanticRole: 'SPACE_FILL',
        layer: 'architecture.spaces',
      }),
    ).toBe('space-fill');
  });

  it('keeps the rooms lighter than the walls that enclose them', () => {
    const luminance = (hex: string): number => {
      const value = hex.replace('#', '');
      const channel = (index: number): number =>
        Number.parseInt(value.slice(index * 2, index * 2 + 2), 16) / 255;
      return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    };
    const wallInk = luminance(
      ARCHITECTURAL_CLEAN_SCREEN.styles.tokens['wall-exterior']!.fill!,
    );
    for (const category of SPACE_GRAPHIC_CATEGORIES)
      expect(
        luminance(
          ARCHITECTURAL_CLEAN_SCREEN.styles.tokens[
            spaceCategoryToken(category)
          ]!.fill!,
        ),
      ).toBeGreaterThan(wallInk + 0.4);
  });

  it('keeps fixtures and dimensions behind the building', () => {
    // A basin is furniture in a plan of a building; a dimension describes the
    // building without competing with it.
    expect(width('symbol')).toBeLessThan(width('wall-partition'));
    expect(width('dimension')).toBeLessThan(width('opening'));
    expect(ARCHITECTURAL_CLEAN_SCREEN.styles.tokens.symbol?.fill).toBe('none');
  });

  it('sets a room name and its area in two levels, not one', () => {
    const profile = ARCHITECTURAL_CLEAN_SCREEN.profile;
    const label = (labelPart: string): Drawn => ({
      semanticRole: 'ANNOTATION',
      layer: 'architecture.space-labels',
      metadata: { labelPart },
    });
    expect(resolveGraphicToken(profile, label('NAME'))).toBe(
      'space-label-name',
    );
    expect(resolveGraphicToken(profile, label('AREA'))).toBe(
      'space-label-area',
    );
    const name = ARCHITECTURAL_CLEAN_SCREEN.styles.tokens['space-label-name']!;
    const area = ARCHITECTURAL_CLEAN_SCREEN.styles.tokens['space-label-area']!;
    expect(name.fontSizePaperMm!).toBeGreaterThan(area.fontSizePaperMm!);
    expect(name.fontWeight).toBe(600);
    expect(name.textAnchor).toBe('middle');
    expect(area.textAnchor).toBe('middle');
    // A note that is not a room label keeps the plain annotation style.
    expect(
      resolveGraphicToken(profile, {
        semanticRole: 'ANNOTATION',
        layer: 'annotation.notes',
      }),
    ).toBe('annotation');
  });

  it('tells a window pane from the wall it sits in', () => {
    expect(
      resolveGraphicToken(ARCHITECTURAL_CLEAN_SCREEN.profile, {
        semanticRole: 'OPENING',
        layer: 'architecture.openings',
        metadata: { openingType: 'WINDOW', part: 'GLAZING' },
      }),
    ).toBe('opening-glazing');
    expect(
      resolveGraphicToken(ARCHITECTURAL_CLEAN_SCREEN.profile, {
        semanticRole: 'OPENING',
        layer: 'architecture.openings',
        metadata: { openingType: 'DOOR', part: 'SWING' },
      }),
    ).toBe('opening');
  });
});
