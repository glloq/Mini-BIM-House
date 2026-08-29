import { describe, expect, it } from 'vitest';
import {
  carriedGeometry,
  componentGhostOutline,
  footprintLabel,
} from './ghost-geometry.js';

const delta = { x: 100, y: -50 };

describe('the shape a dragged object would have once dropped', () => {
  it('carries the holes of an outline with it', () => {
    // A stairwell left behind by the ghost and carried by the edit would be a
    // drawing nobody can trust.
    const moved = carriedGeometry(
      {
        kind: 'POLYGON',
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 1000, y: 0 },
            { x: 1000, y: 1000 },
          ],
          holes: [
            [
              { x: 200, y: 200 },
              { x: 400, y: 200 },
              { x: 400, y: 400 },
            ],
          ],
        },
      },
      delta,
    );
    expect(moved.kind).toBe('POLYGON');
    if (moved.kind !== 'POLYGON') return;
    expect(moved.polygon.outer[0]).toEqual({ x: 100, y: -50 });
    expect(moved.polygon.holes?.[0]?.[0]).toEqual({ x: 300, y: 150 });
    // Every ring travels the same distance, or the hole would move inside its
    // own outline.
    expect(moved.polygon.holes?.[0]?.[2]).toEqual({ x: 500, y: 350 });
  });

  it('leaves an outline without holes without one', () => {
    const moved = carriedGeometry(
      { kind: 'POLYGON', polygon: { outer: [{ x: 0, y: 0 }] } },
      delta,
    );
    if (moved.kind !== 'POLYGON') return;
    expect(moved.polygon.holes).toBeUndefined();
  });

  it('carries the other kinds of geometry as well', () => {
    const line = carriedGeometry(
      {
        kind: 'POLYLINE',
        polyline: {
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
          closed: false,
        },
      },
      delta,
    );
    if (line.kind !== 'POLYLINE') return;
    expect(line.polyline.points[1]).toEqual({ x: 110, y: -40 });

    const label = carriedGeometry(
      { kind: 'TEXT', anchor: { x: 5, y: 5 }, text: 'Séjour' },
      delta,
    );
    if (label.kind !== 'TEXT') return;
    expect(label.anchor).toEqual({ x: 105, y: -45 });

    const dot = carriedGeometry(
      { kind: 'POINT', point: { x: 1, y: 2 } },
      delta,
    );
    if (dot.kind !== 'POINT') return;
    expect(dot.point).toEqual({ x: 101, y: -48 });
  });
});

describe('l’emprise que l’objet occupera, avant qu’on clique', () => {
  it('fait la taille que la fiche déclare, et pas une taille de convention', () => {
    // Un lit fait deux mètres sur un mètre quarante. Un carré de convention
    // dirait « quelque chose est ici » et rien de ce qu'on cherche à savoir :
    // est-ce que ça passe entre la porte et la fenêtre.
    const outline = componentGhostOutline(
      { x: 1000, y: 500 },
      { widthMm: 2000, depthMm: 1400 },
      0,
    );
    expect(outline).toBeDefined();
    if (outline === undefined) return;
    const xs = outline.outer.map(({ x }) => x);
    const ys = outline.outer.map(({ y }) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2000, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1400, 6);
    // Centrée sur le curseur : c'est le point qu'on regarde en visant.
    expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(1000, 6);
    expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(500, 6);
  });

  it('couche sa largeur le long du mur quand un mur l’oriente', () => {
    // Un radiateur contre un mur vertical le longe : c'est sa largeur qui
    // court le long du mur, et sa profondeur qui s'en écarte. L'inverse le
    // ferait traverser la cloison.
    const outline = componentGhostOutline(
      { x: 0, y: 0 },
      { widthMm: 1000, depthMm: 100 },
      90,
    );
    if (outline === undefined) throw new Error('une emprise était attendue');
    const xs = outline.outer.map(({ x }) => x);
    const ys = outline.outer.map(({ y }) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1000, 6);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
  });

  it('ne dessine rien plutôt que d’inventer une dimension manquante', () => {
    // Compléter la profondeur par la largeur donnerait un chiffre que le
    // projet ne soutient pas — et un fantôme qu'on aurait cru.
    for (const dimensions of [
      undefined,
      {},
      { widthMm: 600 },
      { depthMm: 600 },
      { widthMm: 600, depthMm: 0 },
      { widthMm: -600, depthMm: 600 },
      { widthMm: Number.NaN, depthMm: 600 },
    ])
      expect(
        componentGhostOutline({ x: 0, y: 0 }, dimensions, 0),
      ).toBeUndefined();
  });

  it('écrit la taille comme le reste du dessin l’écrit', () => {
    expect(footprintLabel(2000, 1400)).toBe('2.00 × 1.40 m');
    expect(footprintLabel(80, 40)).toBe('0.08 × 0.04 m');
  });
});
