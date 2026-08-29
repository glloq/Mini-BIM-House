/**
 * L'emprise qu'on ne clique pas sommet par sommet.
 *
 * Ce que ces tests tiennent est une seule chose, dite de plusieurs façons : la
 * cote saisie — un diamètre de houppier, une largeur de haie — sert à
 * **fabriquer** le contour et disparaît ensuite. Le polygone est la vérité du
 * modèle ; c'est lui que l'ombre projette et que les poignées déplacent, et
 * il ne doit exister aucune seconde description de la même emprise qui puisse
 * le contredire.
 */
import { describe, expect, it } from 'vitest';
import { SITE_OBSTACLE_KINDS } from '@house-technical-designer/core-domain';

import {
  CROWN_SIDES,
  SITE_FOOTPRINTS,
  crownFootprint,
  isSurfaceSiteKind,
  outlineRefusal,
  ribbonFootprint,
} from './site-footprints.js';

/** L'aire d'un contour fermé, par la formule du lacet. */
function area(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return Math.abs(total) / 2;
}

describe('la nature d’emprise de chaque chose du terrain', () => {
  it('est écrite pour chacune, sans exception', () => {
    // Une nature d'obstacle sans geste déclaré serait une chose qu'on ne
    // saurait pas dessiner : la table est exhaustive par le type, ce test le
    // vérifie aussi à l'exécution pour le jour où le type se relâcherait.
    for (const kind of SITE_OBSTACLE_KINDS)
      expect(SITE_FOOTPRINTS[kind]?.nature, kind).toBeDefined();
  });

  it('sépare ce qui se referme de ce qui se suit et de ce qui se pose', () => {
    for (const kind of ['BUILDING', 'PARKING', 'TERRACE', 'PATH'] as const)
      expect(isSurfaceSiteKind(kind), kind).toBe(true);
    expect(SITE_FOOTPRINTS.TREE.nature).toBe('POINT');
    expect(SITE_FOOTPRINTS.HEDGE.nature).toBe('AXIS');
    expect(SITE_FOOTPRINTS.FENCE.nature).toBe('AXIS');
    expect(SITE_FOOTPRINTS.GATE.nature).toBe('AXIS');
  });

  it('nomme l’outil à prendre plutôt que de dire seulement non', () => {
    expect(outlineRefusal('TERRACE')).toBeUndefined();
    expect(outlineRefusal('TREE')).toContain('Arbre');
    expect(outlineRefusal('HEDGE')).toContain('Haie');
    expect(outlineRefusal('FENCE')).toContain('Clôture');
    expect(outlineRefusal('GATE')).toContain('Portail');
  });
});

describe('le houppier d’un arbre planté d’un clic', () => {
  it('est rond autour du point cliqué, au diamètre demandé', () => {
    const crown = crownFootprint({ x: 1000, y: -2000 }, 5000)!;
    expect(crown).toHaveLength(CROWN_SIDES);
    for (const point of crown)
      expect(Math.hypot(point.x - 1000, point.y + 2000)).toBeCloseTo(2500, 6);
    // Et il couvre bien ce qu'un cercle de ce diamètre couvre : à seize côtés,
    // le polygone inscrit vaut 97,5 % du disque, ce qui est l'approximation
    // qu'on a choisie et non un hasard.
    expect(area(crown) / (Math.PI * 2500 * 2500)).toBeCloseTo(0.9745, 3);
  });

  it('ne referme pas le contour sur lui-même', () => {
    // Le modèle referme les polygones tout seul : un dernier sommet égal au
    // premier serait un sommet en trop, à déplacer deux fois.
    const crown = crownFootprint({ x: 0, y: 0 }, 4000)!;
    expect(crown[0]).not.toEqual(crown[crown.length - 1]);
  });

  it('ne pousse pas sans diamètre', () => {
    expect(crownFootprint({ x: 0, y: 0 }, 0)).toBeUndefined();
    expect(crownFootprint({ x: 0, y: 0 }, -1)).toBeUndefined();
    expect(crownFootprint({ x: Number.NaN, y: 0 }, 3000)).toBeUndefined();
  });
});

describe('le ruban qu’une polyligne laisse derrière elle', () => {
  it('donne un rectangle à un tracé droit, exactement large de sa largeur', () => {
    const ribbon = ribbonFootprint(
      [
        { x: 0, y: 0 },
        { x: 10_000, y: 0 },
      ],
      1000,
    )!;
    expect(ribbon).toHaveLength(4);
    expect(area(ribbon)).toBeCloseTo(10_000 * 1000, 6);
  });

  it('suit chaque sommet du tracé, deux côtés pour un axe', () => {
    // Trois clics de haie, six sommets d'emprise : personne n'a eu à revenir
    // sur ses pas pour lui donner une épaisseur.
    const ribbon = ribbonFootprint(
      [
        { x: 0, y: 0 },
        { x: 6000, y: 0 },
        { x: 6000, y: 6000 },
      ],
      800,
    )!;
    expect(ribbon).toHaveLength(6);
    /*
     * Et la haie garde sa largeur dans le virage.
     *
     * Un ruban à onglet mesure exactement sa largeur fois la longueur de son
     * axe : ce qu'il perd à l'intérieur du coude, il le regagne à l'extérieur.
     * C'est le contrôle qui attrape le pincement — une normale moyennée, sans
     * onglet, rendait ici 8,19 m² au lieu de 9,60 m², soit une haie amaigrie
     * d'un septième dans chacun de ses angles droits.
     */
    expect(area(ribbon)).toBeCloseTo((6000 + 6000) * 800, 6);
  });

  it('garde l’axe au milieu du ruban', () => {
    // Ce qui a été cliqué reste ce qui a été cliqué : les deux côtés sont
    // symétriques autour de chaque point de l'axe.
    const axis = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
    ];
    const ribbon = ribbonFootprint(axis, 600)!;
    const first = ribbon[0]!;
    const mirrored = ribbon[ribbon.length - 1]!;
    expect((first.x + mirrored.x) / 2).toBeCloseTo(axis[0]!.x, 6);
    expect((first.y + mirrored.y) / 2).toBeCloseTo(axis[0]!.y, 6);
  });

  it('coupe la pointe d’un virage en épingle au lieu d’y planter une aiguille', () => {
    // Un angle très fermé fait diverger l'onglet : sans borne, la pointe d'une
    // haie de 800 mm partirait à plusieurs dizaines de mètres du tracé, et
    // l'ombre projetée avec elle.
    const ribbon = ribbonFootprint(
      [
        { x: 0, y: 0 },
        { x: 10_000, y: 0 },
        { x: 0, y: 300 },
      ],
      800,
    )!;
    for (const point of ribbon) {
      expect(point.x).toBeLessThan(12_000);
      expect(Math.abs(point.y)).toBeLessThan(2000);
    }
  });

  it('ne fabrique rien sans direction ni sans largeur', () => {
    expect(ribbonFootprint([{ x: 0, y: 0 }], 500)).toBeUndefined();
    expect(
      ribbonFootprint(
        [
          { x: 3, y: 3 },
          { x: 3, y: 3 },
        ],
        500,
      ),
    ).toBeUndefined();
    expect(
      ribbonFootprint(
        [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
        0,
      ),
    ).toBeUndefined();
  });

  it('fond les clics répétés au même endroit plutôt que d’en faire un ruban plié', () => {
    // Cliquer deux fois le même poteau arrive ; ce qui ne doit pas arriver est
    // qu'un sommet sans direction fabrique une normale au hasard.
    const ribbon = ribbonFootprint(
      [
        { x: 0, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 0 },
        { x: 4000, y: 0 },
      ],
      400,
    )!;
    expect(ribbon).toHaveLength(6);
    expect(area(ribbon)).toBeCloseTo(4000 * 400, 6);
  });
});
