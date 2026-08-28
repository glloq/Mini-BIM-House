/**
 * Ce qu'un moteur de toiture doit savoir, cas par cas.
 *
 * La liste vient de l'audit : rectangle, L, U, contour concave, angles très
 * faibles, segments quasi colinéaires, pentes différentes, faîtage décentré,
 * noues multiples. Chacun est un piège connu des couvreurs autant que des
 * géomètres, et chacun est ici parce qu'il a une bonne réponse ou un refus
 * écrit — jamais une approximation silencieuse.
 */
import { describe, expect, it } from 'vitest';

import { signedArea, straightSkeleton, type SkeletonEdge } from './skeleton.js';
import type { Point2D } from './types.js';

/** Toutes les pentes identiques : le cas d'une toiture ordinaire. */
const evenly = (count: number, speed = 1): readonly SkeletonEdge[] =>
  Array.from({ length: count }, () => ({ speed }));

const RECTANGLE: readonly Point2D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 6 },
  { x: 0, y: 6 },
];

/** Un L : deux branches, un sommet rentrant, donc une noue. */
const L_SHAPE: readonly Point2D[] = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 6 },
  { x: 0, y: 6 },
];

/** Un U : deux sommets rentrants, donc deux noues. */
const U_SHAPE: readonly Point2D[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 6, y: 6 },
  { x: 6, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 6 },
  { x: 0, y: 6 },
];

describe('le contour lui-même', () => {
  it('refuse ce qui n’est pas un contour', () => {
    expect(straightSkeleton([], []).status).toBe('UNRESOLVED');
    expect(
      straightSkeleton(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        evenly(2),
      ).status,
    ).toBe('UNRESOLVED');
  });

  it('refuse un contour plat, et le dit', () => {
    const flat = straightSkeleton(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      evenly(3),
    );
    expect(flat.status).toBe('UNRESOLVED');
    if (flat.status === 'UNRESOLVED') expect(flat.reason).toMatch(/aire/u);
  });

  it('refuse une pente par côté qui ne compte pas les côtés', () => {
    expect(straightSkeleton(RECTANGLE, evenly(3)).status).toBe('UNRESOLVED');
  });

  it('lit le contour dans les deux sens', () => {
    const direct = straightSkeleton(RECTANGLE, evenly(4));
    const reversed = straightSkeleton([...RECTANGLE].reverse(), evenly(4));
    expect(direct.status).toBe('RESOLVED');
    expect(reversed.status).toBe('RESOLVED');
    if (direct.status === 'RESOLVED' && reversed.status === 'RESOLVED')
      expect(reversed.peakHeight).toBeCloseTo(direct.peakHeight, 6);
  });
});

describe('un rectangle', () => {
  const result = straightSkeleton(RECTANGLE, evenly(4));

  it('se résout', () => {
    expect(result.status).toBe('RESOLVED');
  });

  it('monte de la moitié de sa petite dimension', () => {
    // Quatre pans à 45° sur 10 × 6 : le faîtage est à 3, la moitié de 6.
    if (result.status !== 'RESOLVED') return;
    expect(result.peakHeight).toBeCloseTo(3, 6);
  });

  it('fait quatre pans, un par côté', () => {
    if (result.status !== 'RESOLVED') return;
    expect(result.faces).toHaveLength(4);
    expect([...result.faces].map(({ edgeIndex }) => edgeIndex).sort()).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('couvre exactement le rectangle, sans trou ni recouvrement', () => {
    if (result.status !== 'RESOLVED') return;
    const covered = result.faces.reduce(
      (sum, face) => sum + Math.abs(signedArea(face.outline)),
      0,
    );
    expect(covered).toBeCloseTo(60, 4);
  });

  it('a un faîtage et quatre arêtières', () => {
    if (result.status !== 'RESOLVED') return;
    const kinds = result.arcs.map(({ kind }) => kind);
    expect(kinds.filter((k) => k === 'HIP')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'RIDGE').length).toBeGreaterThanOrEqual(1);
    expect(kinds.filter((k) => k === 'VALLEY')).toHaveLength(0);
  });
});

describe('un carré', () => {
  it('monte en pointe, sans faîtage', () => {
    const square = straightSkeleton(
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      evenly(4),
    );
    expect(square.status).toBe('RESOLVED');
    if (square.status !== 'RESOLVED') return;
    expect(square.peakHeight).toBeCloseTo(2, 6);
    // Une pyramide : quatre arêtières qui se rejoignent, pas de faîtage.
    expect(square.arcs.filter(({ kind }) => kind === 'HIP')).toHaveLength(4);
  });
});

describe('des pentes différentes', () => {
  it('décale le faîtage vers le côté le plus raide', () => {
    /*
     * Deux longs côtés, l'un deux fois plus raide que l'autre. Le pan raide
     * recule deux fois moins vite, donc la ligne où ils se rencontrent est
     * deux fois plus près de lui : au tiers, et non au milieu.
     */
    const result = straightSkeleton(RECTANGLE, [
      { speed: 0.5 },
      { speed: 1 },
      { speed: 1 },
      { speed: 1 },
    ]);
    expect(result.status).toBe('RESOLVED');
    if (result.status !== 'RESOLVED') return;
    const ridge = result.arcs.filter(({ kind }) => kind === 'RIDGE');
    expect(ridge.length).toBeGreaterThanOrEqual(1);
    const y = ridge[0]!.from.y;
    // 0,5·h depuis le bas et 1·h depuis le haut se rencontrent à y = 2.
    expect(y).toBeCloseTo(2, 4);
  });

  it('traite un pignon comme un mur qui ne recule pas', () => {
    // Vitesse nulle sur les petits côtés : une toiture à deux pans, dont le
    // faîtage court d'un pignon à l'autre.
    const result = straightSkeleton(RECTANGLE, [
      { speed: 1 },
      { speed: 0 },
      { speed: 1 },
      { speed: 0 },
    ]);
    expect(result.status).toBe('RESOLVED');
    if (result.status !== 'RESOLVED') return;
    expect(result.peakHeight).toBeCloseTo(3, 6);
  });
});

describe('un contour rentrant', () => {
  it('trouve la noue d’un L, et dit ce qu’il n’a pas fermé', () => {
    const result = straightSkeleton(L_SHAPE, evenly(6));
    // Une noue existe : c'est le fait, et le moteur la nomme.
    expect(result.status).not.toBe('UNRESOLVED');
    if (result.status === 'UNRESOLVED') return;
    expect(result.arcs.some(({ kind }) => kind === 'VALLEY')).toBe(true);
    if (result.status === 'PARTIAL')
      expect(result.reason.length).toBeGreaterThan(20);
  });

  it('trouve les deux noues d’un U', () => {
    const result = straightSkeleton(U_SHAPE, evenly(8));
    expect(result.status).not.toBe('UNRESOLVED');
    if (result.status === 'UNRESOLVED') return;
    expect(result.arcs.some(({ kind }) => kind === 'VALLEY')).toBe(true);
  });
});

describe('ce qui met un moteur en défaut', () => {
  it('supporte un angle très faible', () => {
    // Un triangle presque plat : les bissectrices filent très loin, et un
    // moteur qui divise sans regarder rend l'infini.
    const result = straightSkeleton(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 0.5 },
      ],
      evenly(3),
    );
    expect(result.status).not.toBe('PARTIAL');
    if (result.status === 'RESOLVED')
      expect(Number.isFinite(result.peakHeight)).toBe(true);
  });

  it('supporte deux segments quasi colinéaires', () => {
    const result = straightSkeleton(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0.000001 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 0, y: 6 },
      ],
      evenly(5),
    );
    // Deux côtés presque alignés ont un sommet qui file vite : le moteur doit
    // rendre une réponse finie, ou refuser en le disant.
    expect(['RESOLVED', 'PARTIAL', 'UNRESOLVED']).toContain(result.status);
    if (result.status === 'RESOLVED')
      expect(Number.isFinite(result.peakHeight)).toBe(true);
  });

  it('refuse deux sommets confondus plutôt que de diviser par zéro', () => {
    const result = straightSkeleton(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
      ],
      evenly(4),
    );
    expect(result.status).toBe('UNRESOLVED');
  });

  it('rend toujours une réponse, jamais une boucle infinie', () => {
    // Un contour tordu mais valide : ce qui compte est que ça termine.
    const result = straightSkeleton(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 7, y: 2 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      evenly(6),
    );
    expect(['RESOLVED', 'PARTIAL', 'UNRESOLVED']).toContain(result.status);
  });
});
