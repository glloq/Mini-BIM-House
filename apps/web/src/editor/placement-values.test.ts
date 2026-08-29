import { describe, expect, it } from 'vitest';
import {
  moveMeasures,
  parseOffsetMm,
  resolveMoveDelta,
  rotationAngleDeg,
  rotationTargetPoint,
  withTypedMove,
} from './placement-values.js';

const CENTRE = { x: 1000, y: 1000 };
const FROM = { x: 3000, y: 1000 };

describe('l’angle exact d’une rotation', () => {
  it('rend le point que le troisième clic aurait posé', () => {
    // 37,5° ne se clique pas : à cette échelle, un pixel vaut plus d'un
    // dixième de degré. Tapé, il vaut 37,5° et rien d'autre.
    const target = rotationTargetPoint(CENTRE, FROM, 37.5);
    expect(rotationAngleDeg(CENTRE, FROM, target)).toBeCloseTo(37.5, 9);
  });

  it('garde le rayon de la direction montrée', () => {
    // Le point rendu prolonge le geste : même distance au centre, autre cap.
    const target = rotationTargetPoint(CENTRE, FROM, 90);
    expect(Math.hypot(target.x - CENTRE.x, target.y - CENTRE.y)).toBeCloseTo(
      2000,
      9,
    );
    expect(target.x).toBeCloseTo(1000, 9);
    expect(target.y).toBeCloseTo(3000, 9);
  });

  it('exprime encore l’angle quand la direction montrée est nulle', () => {
    // Centre et direction confondus : le geste est dégénéré, mais l'angle
    // tapé reste un angle, et le rendre nul serait perdre ce qu'on a demandé.
    const target = rotationTargetPoint(CENTRE, CENTRE, 37.5);
    expect(rotationAngleDeg(CENTRE, CENTRE, target)).toBeCloseTo(37.5, 9);
  });

  it('lit à la souris ce que la commande appliquera', () => {
    // La même formule que l'outil Pivoter : le champ affiche pendant le geste
    // le nombre que la commande utilisera à la fin.
    expect(rotationAngleDeg(CENTRE, FROM, { x: 1000, y: 3000 })).toBeCloseTo(
      90,
      9,
    );
  });
});

describe('le déplacement exact', () => {
  it('mesure des quatre façons dont on le dit', () => {
    const measures = moveMeasures({ x: 1200, y: 0 });
    expect(measures.dxMm).toBe(1200);
    expect(measures.dyMm).toBe(0);
    expect(measures.distanceMm).toBe(1200);
    expect(measures.angleDeg).toBe(0);
  });

  it('suit la souris tant que rien n’est tapé', () => {
    expect(resolveMoveDelta({ x: 843, y: -212 }, {})).toEqual({
      x: 843,
      y: -212,
    });
  });

  it('fait l’emporter la valeur tapée sur la souris', () => {
    // Le geste que l'audit demande : 1 200 mm vers l'est, exactement.
    const delta = resolveMoveDelta(
      { x: 843, y: -212 },
      { distanceMm: 1200, angleDeg: 0 },
    );
    expect(delta.x).toBeCloseTo(1200, 9);
    expect(delta.y).toBeCloseTo(0, 9);
  });

  it('laisse la souris remplir le champ qu’on n’a pas tapé', () => {
    // Tirer vers l'est et ne fixer que la distance : la direction reste celle
    // du geste, ce qui est la moitié qu'on n'a pas eu à taper.
    const delta = resolveMoveDelta({ x: 900, y: 0 }, { distanceMm: 1200 });
    expect(delta.x).toBeCloseTo(1200, 9);
    expect(delta.y).toBeCloseTo(0, 9);
    // Et symétriquement : ne fixer que le cap garde la distance parcourue.
    const straightened = resolveMoveDelta({ x: 900, y: 40 }, { angleDeg: 0 });
    expect(straightened.x).toBeCloseTo(Math.hypot(900, 40), 9);
    expect(straightened.y).toBeCloseTo(0, 9);
  });

  it('accepte aussi les deux écarts, chacun de son côté', () => {
    const delta = resolveMoveDelta({ x: 843, y: -212 }, { dxMm: 1200 });
    // ΔX tapé, ΔY laissé à la souris : un champ vide n'est pas un zéro, et
    // écrire zéro à sa place inventerait un déplacement que personne n'a
    // demandé.
    expect(delta).toEqual({ x: 1200, y: -212 });
    expect(
      resolveMoveDelta({ x: 843, y: -212 }, { dxMm: 1200, dyMm: 0 }),
    ).toEqual({ x: 1200, y: 0 });
  });

  it('tranche en faveur du polaire quand les deux familles sont remplies', () => {
    // « Ce sens-là, mais exactement un mètre vingt » est le geste courant ;
    // compléter un ΔX tapé par un angle ne décrirait aucun vecteur.
    const delta = resolveMoveDelta(
      { x: 843, y: -212 },
      { dxMm: 5000, distanceMm: 1200, angleDeg: 0 },
    );
    expect(delta.x).toBeCloseTo(1200, 9);
    expect(delta.y).toBeCloseTo(0, 9);
  });
});

describe('un écart tapé n’est pas une longueur', () => {
  it('accepte le zéro et le sens contraire, dans les mêmes unités', () => {
    // « ΔY = 0 » est la façon exacte de dire « plein est », et « -1,2 m » de
    // dire « vers l'ouest » : ni l'un ni l'autre n'est une longueur valable,
    // et les deux sont des écarts valables.
    expect(parseOffsetMm('0')).toBe(0);
    expect(parseOffsetMm('-0')).toBe(0);
    expect(parseOffsetMm('1200')).toBe(1200);
    expect(parseOffsetMm('-1,2 m')).toBe(-1200);
    expect(parseOffsetMm('120 cm')).toBe(1200);
  });

  it('refuse ce qu’il ne sait pas lire plutôt que de le deviner', () => {
    expect(parseOffsetMm('')).toBeUndefined();
    expect(parseOffsetMm('vers l’est')).toBeUndefined();
    expect(parseOffsetMm('12 pouces')).toBeUndefined();
  });
});

describe('remplir et vider un champ de déplacement', () => {
  it('garde les autres champs et rend le champ vidé à la souris', () => {
    const typed = withTypedMove(
      withTypedMove({}, 'distanceMm', 1200),
      'angleDeg',
      0,
    );
    expect(typed).toEqual({ distanceMm: 1200, angleDeg: 0 });
    const cleared = withTypedMove(typed, 'distanceMm', undefined);
    // Vidé veut dire « la souris décide », et non « zéro » : la clé disparaît
    // au lieu de valoir une valeur que personne n'a tapée.
    expect('distanceMm' in cleared).toBe(false);
    expect(cleared).toEqual({ angleDeg: 0 });
    expect(resolveMoveDelta({ x: 900, y: 40 }, cleared).x).toBeCloseTo(
      Math.hypot(900, 40),
      9,
    );
  });

  it('garde le zéro tapé, qui est une valeur et non un vide', () => {
    const typed = withTypedMove({}, 'dyMm', 0);
    expect(typed).toEqual({ dyMm: 0 });
    expect(resolveMoveDelta({ x: 1200, y: 350 }, typed)).toEqual({
      x: 1200,
      y: 0,
    });
  });
});
