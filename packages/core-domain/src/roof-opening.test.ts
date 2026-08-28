/**
 * Ce qu'une fenêtre de toit doit savoir d'elle-même.
 *
 * Les nombres sont vérifiables à la main sur un pan simple : un rectangle de
 * dix mètres sur quatre, en pente à 30° vers le sud, dont l'égout court le
 * long de y = 0. C'est le cas qu'un couvreur trace au cordeau, et c'est
 * pourquoi il est ici : une erreur de cosinus, de signe ou d'égout s'y voit.
 */
import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import { entityId } from './ids.js';
import type { RoofOpening } from './opening.js';
import type { RoofPlane } from './roof-plane.js';
import {
  roofOpeningGeometry,
  roofPlaneFrame,
  validateRoofOpening,
} from './roof-opening.js';

const SLOPE_DEG = 30;
const TANGENT = Math.tan((SLOPE_DEG * Math.PI) / 180);

/**
 * Un pan qui descend vers le sud depuis un faîtage à y = 4000.
 *
 * L'azimut −90 est la direction (0, −1) : le pan regarde vers les y
 * décroissants, donc son égout est le côté y = 0.
 */
const PLANE: RoofPlane = {
  id: entityId<'RoofPlane'>('pan'),
  type: 'ROOF_PLANE',
  levelId: entityId<'Level'>('ground'),
  footprint: {
    outer: [
      { x: 0, y: 0 },
      { x: 10_000, y: 0 },
      { x: 10_000, y: 4000 },
      { x: 0, y: 4000 },
    ],
  },
  assemblyId: assemblyId('assembly-roof'),
  slopeDeg: SLOPE_DEG,
  azimuthDeg: -90,
  baseElevationMm: 2500,
};

function window(
  alongEaveMm: number,
  upSlopeMm: number,
  widthMm = 1000,
  heightMm = 1200,
): RoofOpening {
  return {
    id: entityId<'Opening'>('velux'),
    type: 'OPENING',
    openingType: 'WINDOW',
    host: { kind: 'ROOF', id: PLANE.id },
    placement: { alongEaveMm, upSlopeMm },
    widthMm,
    heightMm,
  };
}

describe('le repère d’un pan', () => {
  it('trouve l’égout au bas de la pente', () => {
    const frame = roofPlaneFrame(PLANE)!;
    expect(frame.eaveStart).toEqual({ x: 0, y: 0 });
    expect(frame.along.x).toBeCloseTo(1, 9);
    expect(frame.along.y).toBeCloseTo(0, 9);
    expect(frame.eaveLengthMm).toBeCloseTo(10_000, 6);
    // On monte vers le faîtage, donc vers les y croissants.
    expect(frame.upSlope.y).toBeCloseTo(1, 9);
  });

  it('suit l’azimut plutôt que l’ordre des sommets', () => {
    // Le même rectangle, mais le pan regarde vers le nord : l'égout est alors
    // l'autre côté, et rien dans l'emprise ne l'annonce.
    const frame = roofPlaneFrame({ ...PLANE, azimuthDeg: 90 })!;
    expect(frame.eaveStart.y).toBeCloseTo(4000, 6);
    expect(frame.upSlope.y).toBeCloseTo(-1, 9);
  });

  it('n’en donne pas à un pan plat', () => {
    // Sans pente il n'y a pas de bas : désigner un égout serait inventer.
    expect(roofPlaneFrame({ ...PLANE, slopeDeg: 0 })).toBeUndefined();
  });
});

describe('où une fenêtre de toit se pose', () => {
  it('raccourcit la montée de la pente, en plan', () => {
    // Deux mètres sur le rampant à 30° avancent de 2 · cos 30 = 1,732 m au sol.
    const geometry = roofOpeningGeometry(window(3000, 2000), PLANE)!;
    const [first] = geometry.footprint.outer;
    expect(first!.x).toBeCloseTo(3000, 6);
    expect(first!.y).toBeCloseTo(2000 * Math.cos(Math.PI / 6), 6);
  });

  it('donne un rectangle de la bonne taille au sol', () => {
    const geometry = roofOpeningGeometry(window(3000, 2000), PLANE)!;
    const [a, b, , d] = geometry.footprint.outer;
    // Sa largeur court le long de l'égout, donc en vraie grandeur.
    expect(b!.x - a!.x).toBeCloseTo(1000, 6);
    // Sa hauteur monte le rampant, donc raccourcie au sol.
    expect(d!.y - a!.y).toBeCloseTo(1200 * Math.cos(Math.PI / 6), 6);
  });

  it('monte de ce que la pente donne', () => {
    const geometry = roofOpeningGeometry(window(3000, 2000), PLANE)!;
    // Deux mètres de rampant à 30° montent de 1 m ; l'égout est à 2,50 m.
    expect(geometry.lowerEdgeElevationMm).toBeCloseTo(
      2500 + 2000 * Math.sin(Math.PI / 6),
      6,
    );
    expect(geometry.upperEdgeElevationMm).toBeCloseTo(
      2500 + 3200 * Math.sin(Math.PI / 6),
      6,
    );
  });

  it('compte sa surface vraie, et non sa projection', () => {
    // Une fenêtre de toit se vend au mètre carré de menuiserie, pas d'ombre.
    const geometry = roofOpeningGeometry(window(3000, 2000), PLANE)!;
    expect(geometry.areaMm2).toBeCloseTo(1000 * 1200, 6);
  });

  it('reste au même endroit du rampant quand la pente change', () => {
    /*
     * C'est ce que garder la longueur vraie achète. Un pan plus raide couvre
     * moins de sol, et une fenêtre repérée en projection y glisserait vers le
     * faîtage sans que personne ne l'ait déplacée.
     */
    const steeper = { ...PLANE, slopeDeg: 45 };
    const gentle = roofOpeningGeometry(window(3000, 2000), PLANE)!;
    const steep = roofOpeningGeometry(window(3000, 2000), steeper)!;
    expect(steep.lowerEdgeElevationMm - 2500).toBeCloseTo(
      2000 * Math.sin(Math.PI / 4),
      6,
    );
    expect(gentle.lowerEdgeElevationMm - 2500).toBeCloseTo(
      2000 * Math.sin(Math.PI / 6),
      6,
    );
    // Et dans les deux cas, deux mètres de rampant depuis l'égout.
    expect(steep.footprint.outer[0]!.y).toBeCloseTo(
      2000 * Math.cos(Math.PI / 4),
      6,
    );
  });
});

describe('ce qu’une fenêtre de toit doit respecter', () => {
  it('accepte une fenêtre posée dans son pan', () => {
    expect(validateRoofOpening(window(3000, 1000), PLANE)).toEqual([]);
  });

  it('refuse une fenêtre qui passe le faîtage', () => {
    // Le pan fait quatre mètres au sol, donc 4 / cos 30 = 4,62 m de rampant.
    const beyond = validateRoofOpening(window(3000, 4500), PLANE);
    expect(beyond.map(({ path }) => path)).toContain('placement');
  });

  it('refuse une fenêtre qui déborde en largeur', () => {
    const past = validateRoofOpening(window(9500, 1000), PLANE);
    expect(past.map(({ path }) => path)).toContain('placement');
  });

  it('refuse un pan qui n’est pas le sien', () => {
    const other: RoofPlane = { ...PLANE, id: entityId<'RoofPlane'>('autre') };
    expect(validateRoofOpening(window(3000, 1000), other)[0]?.path).toBe(
      'host',
    );
  });

  it('refuse des nombres qui n’en sont pas', () => {
    const broken = validateRoofOpening(window(-1, Number.NaN, 0), PLANE);
    expect(broken.map(({ path }) => path).sort()).toEqual([
      'placement.alongEaveMm',
      'placement.upSlopeMm',
      'widthMm',
    ]);
  });

  it('dit qu’un pan plat ne porte pas de fenêtre de toit', () => {
    const flat = validateRoofOpening(window(3000, 1000), {
      ...PLANE,
      slopeDeg: 0,
    });
    expect(flat[0]?.message).toContain('rampant');
  });

  it('accepte une fenêtre juste à l’aplomb de l’égout', () => {
    // Zéro sur le rampant : ses deux coins bas sont exactement sur le bord, et
    // un test strict les mettrait dehors pour un arrondi.
    expect(validateRoofOpening(window(3000, 0), PLANE)).toEqual([]);
  });

  it('la hauteur du faîtage se retrouve au bord haut', () => {
    // Le rampant complet vaut 4000 / cos 30 ; une fenêtre qui y arrive juste
    // atteint le faîtage, soit 4000 · tan 30 au-dessus de l'égout.
    const full = 4000 / Math.cos(Math.PI / 6);
    const geometry = roofOpeningGeometry(window(3000, full, 1000, 1), PLANE)!;
    expect(geometry.lowerEdgeElevationMm).toBeCloseTo(2500 + 4000 * TANGENT, 3);
  });
});
