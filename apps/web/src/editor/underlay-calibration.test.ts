/**
 * Ce qu'on attend d'une calibration : deux points, une distance, et le premier
 * point qui ne bouge pas.
 *
 * Les vérifications ne se contentent pas de relire la largeur écrite : elles
 * refont le trajet de l'image jusqu'à l'écran — le coin, les dimensions, la
 * rotation — et demandent où atterrit le point qu'on avait désigné. C'est la
 * seule question qui compte, parce que c'est celle que la personne pose en
 * regardant son plan.
 */
import { describe, expect, it } from 'vitest';
import type { SiteUnderlay } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import { SetSiteUnderlayCommand } from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import {
  UNDERLAY_LOCKED_MESSAGE,
  calibrateUnderlay,
  isUnderlayLocked,
  measuredBetween,
  readCalibration,
  underlayLocked,
  underlayMoved,
  underlayRotationDeg,
  underlayScaledAbout,
  underlayTurned,
  underlayWidened,
} from './underlay-calibration.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const project = demo.file.project;

/** Un cadastre posé au jugé : vingt mètres de large, comme l'import les donne. */
const cadastre: SiteUnderlay = {
  image: 'data:image/png;base64,iVBORw0KGgo=',
  originMm: { x: -2000, y: -1000 },
  widthMm: 20_000,
  heightMm: 15_000,
  opacity: 0.55,
  name: 'cadastre.png',
};

/**
 * Où tombe, dans le modèle, un point donné par sa place sur l'image.
 *
 * C'est le trajet que fait l'affichage, refait ici à la main : le coin, la
 * taille, puis la rotation autour du centre. Il permet de désigner un point
 * « celui qui est au quart en largeur et au tiers en hauteur » et de demander
 * ensuite où il est passé — ce qu'aucune relecture de `widthMm` ne dirait.
 */
function pointOnImage(
  underlay: SiteUnderlay,
  across: number,
  down: number,
): Point2D {
  const at = {
    x: underlay.originMm.x + underlay.widthMm * across,
    y: underlay.originMm.y + underlay.heightMm * down,
  };
  const centre = {
    x: underlay.originMm.x + underlay.widthMm / 2,
    y: underlay.originMm.y + underlay.heightMm / 2,
  };
  const angle = (underlayRotationDeg(underlay) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: centre.x + (at.x - centre.x) * cos - (at.y - centre.y) * sin,
    y: centre.y + (at.x - centre.x) * sin + (at.y - centre.y) * cos,
  };
}

const close = (point: Point2D, expected: Point2D, tolerance = 1e-6): void => {
  expect(point.x).toBeCloseTo(expected.x, 6);
  expect(point.y).toBeCloseTo(expected.y, 6);
  expect(measuredBetween(point, expected)).toBeLessThan(tolerance);
};

describe('caler une image de fond par deux points', () => {
  it('met l’image à l’échelle de la distance qu’on lui donne', () => {
    // Deux repères de l'image : le mur de gauche et le mur de droite d'une
    // façade. L'image, telle qu'elle est posée, les met à 10 m l'un de l'autre ;
    // la façade en fait 12,50.
    const a = pointOnImage(cadastre, 0.25, 0.5);
    const b = pointOnImage(cadastre, 0.75, 0.5);
    expect(measuredBetween(a, b)).toBe(10_000);

    const result = calibrateUnderlay(cadastre, a, b, 12_500);
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.measuredMm).toBe(10_000);
    expect(result.factor).toBeCloseTo(1.25, 12);
    expect(result.underlay.widthMm).toBeCloseTo(25_000, 9);
    // Le rapport de l'image ne se discute pas : une image étirée n'est plus un
    // relevé, c'est un dessin faux.
    expect(result.underlay.heightMm / result.underlay.widthMm).toBeCloseTo(
      cadastre.heightMm / cadastre.widthMm,
      12,
    );
  });

  it('laisse le premier point exactement où il était', () => {
    /*
     * Le point du milieu de l'affaire. Sans lui, l'image saute à chaque
     * calibration : le repère qu'on venait de désigner part hors de l'écran et
     * on recommence en cherchant l'image avant de chercher le point.
     */
    const a = pointOnImage(cadastre, 0.25, 0.5);
    const b = pointOnImage(cadastre, 0.75, 0.5);
    const result = calibrateUnderlay(cadastre, a, b, 12_500);
    if (result.status !== 'OK') throw new Error('la calibration a été refusée');

    // Le même endroit de l'image — un quart en largeur, la moitié en hauteur —
    // tombe encore sur le même point du modèle.
    close(pointOnImage(result.underlay, 0.25, 0.5), a);
    // Et le second est venu se poser à la distance qu'on a dite.
    const moved = pointOnImage(result.underlay, 0.75, 0.5);
    expect(measuredBetween(a, moved)).toBeCloseTo(12_500, 6);
  });

  it('rétrécit aussi bien qu’elle agrandit, sans lâcher le premier point', () => {
    // Une photo aérienne importée trop grande : la distance réelle est plus
    // courte que ce que l'image prétend.
    const a = pointOnImage(cadastre, 0.1, 0.9);
    const b = pointOnImage(cadastre, 0.9, 0.2);
    const result = calibrateUnderlay(cadastre, a, b, 4_000);
    if (result.status !== 'OK') throw new Error('la calibration a été refusée');
    expect(result.factor).toBeLessThan(1);
    expect(result.underlay.widthMm).toBeLessThan(cadastre.widthMm);
    close(pointOnImage(result.underlay, 0.1, 0.9), a);
    expect(
      measuredBetween(a, pointOnImage(result.underlay, 0.9, 0.2)),
    ).toBeCloseTo(4_000, 6);
  });

  it('tient encore quand l’image est tournée', () => {
    // Une esquisse redressée de 30° reste calibrable : mettre à l'échelle
    // autour d'un point fixe et tourner le même dessin se font dans n'importe
    // quel ordre.
    const turned = underlayTurned(cadastre, 30);
    if (turned.status !== 'OK') throw new Error('la rotation a été refusée');
    const a = pointOnImage(turned.underlay, 0.2, 0.3);
    const b = pointOnImage(turned.underlay, 0.8, 0.7);
    const result = calibrateUnderlay(turned.underlay, a, b, 30_000);
    if (result.status !== 'OK') throw new Error('la calibration a été refusée');
    expect(result.underlay.rotationDeg).toBe(30);
    close(pointOnImage(result.underlay, 0.2, 0.3), a);
    expect(
      measuredBetween(a, pointOnImage(result.underlay, 0.8, 0.7)),
    ).toBeCloseTo(30_000, 6);
  });

  it('annonce le facteur avant qu’on applique quoi que ce soit', () => {
    // Voir « ×1,25 » avant de valider, c'est pouvoir repérer qu'on s'est
    // trompé de points ou d'unité : un ×15 se corrige, une image devenue
    // immense se subit.
    const reading = readCalibration({ x: 0, y: 0 }, { x: 8_000, y: 0 }, 10_000);
    expect(reading).toEqual({ status: 'OK', measuredMm: 8_000, factor: 1.25 });
  });

  it('refuse deux points confondus plutôt que de faire disparaître l’image', () => {
    const nowhere = readCalibration({ x: 12, y: 34 }, { x: 12, y: 34 }, 5_000);
    expect(nowhere.status).toBe('ERROR');
    if (nowhere.status !== 'ERROR') return;
    expect(nowhere.message).toContain('même endroit');
    // L'image, elle, n'a pas bougé d'un millimètre.
    const refused = calibrateUnderlay(
      cadastre,
      { x: 12, y: 34 },
      { x: 12, y: 34 },
      5_000,
    );
    expect(refused.status).toBe('ERROR');
  });

  it('refuse une distance réelle qui n’en est pas une', () => {
    for (const said of [0, -3_000, Number.NaN]) {
      const refused = calibrateUnderlay(
        cadastre,
        { x: 0, y: 0 },
        { x: 1_000, y: 0 },
        said,
      );
      expect(refused.status).toBe('ERROR');
      if (refused.status !== 'ERROR') continue;
      expect(refused.message).toContain('positive');
    }
  });

  it('agrandit autour de n’importe quel point, y compris le coin', () => {
    // `underlayScaledAbout` est la brique : ancrée sur le coin de l'image, elle
    // se réduit au redimensionnement d'avant, ce qui dit qu'elle ne fait rien
    // de plus que ce qu'on croit.
    const doubled = underlayScaledAbout(cadastre, cadastre.originMm, 2);
    expect(doubled.originMm).toEqual(cadastre.originMm);
    expect(doubled.widthMm).toBe(40_000);
    expect(doubled.heightMm).toBe(30_000);
  });
});

describe('déplacer, tourner et verrouiller une image de fond', () => {
  it('ramène l’angle dans un tour et n’écrit pas une image droite', () => {
    // 370° et 10° sont la même image : deux projets identiques doivent
    // s'écrire pareil, sinon la comparaison de deux fichiers ment.
    const beyond = underlayTurned(cadastre, 370);
    if (beyond.status !== 'OK') throw new Error('la rotation a été refusée');
    expect(beyond.underlay.rotationDeg).toBe(10);

    const backwards = underlayTurned(cadastre, -90);
    if (backwards.status !== 'OK') throw new Error('la rotation a été refusée');
    expect(backwards.underlay.rotationDeg).toBe(270);

    // Remise droite, la propriété disparaît : un fichier écrit aujourd'hui
    // reste celui qu'attend tout ce qui ne connaît pas la rotation.
    const straight = underlayTurned(beyond.underlay, 360);
    if (straight.status !== 'OK') throw new Error('la rotation a été refusée');
    expect('rotationDeg' in straight.underlay).toBe(false);
    expect(underlayRotationDeg(straight.underlay)).toBe(0);
  });

  it('empêche une image verrouillée de bouger, par quelque geste que ce soit', () => {
    /*
     * Le verrou est ce qui rend la calibration durable. Caler un relevé prend
     * trois minutes de repérage qu'un curseur qui dérape efface, et une image
     * qu'on doit recaler à chaque séance n'est jamais calée.
     */
    const held = underlayLocked(cadastre, true);
    expect(isUnderlayLocked(held)).toBe(true);

    const refusals = [
      underlayMoved(held, { x: 0, y: 0 }),
      underlayTurned(held, 45),
      underlayWidened(held, 30_000),
      calibrateUnderlay(held, { x: 0, y: 0 }, { x: 1_000, y: 0 }, 2_000),
    ];
    for (const refused of refusals) {
      expect(refused.status).toBe('ERROR');
      if (refused.status !== 'ERROR') continue;
      expect(refused.message).toBe(UNDERLAY_LOCKED_MESSAGE);
    }
  });

  it('se déverrouille toujours, et ne laisse pas de trace une fois ôté', () => {
    // Un verrou dont on ne peut pas sortir n'est pas un verrou, c'est une
    // perte ; et une image libre s'écrit comme elle s'écrivait hier.
    const held = underlayLocked(cadastre, true);
    const freed = underlayLocked(held, false);
    expect(isUnderlayLocked(freed)).toBe(false);
    expect('locked' in freed).toBe(false);
    expect(freed).toEqual(cadastre);
    const moved = underlayMoved(freed, { x: 500, y: 500 });
    expect(moved.status).toBe('OK');
  });

  it('laisse la transparence libre : elle ne déplace rien', () => {
    // Regarder ce qu'il y a dessous ne demande pas de déverrouiller — le
    // module ne s'en mêle pas, et l'opacité traverse la calibration intacte.
    const a = pointOnImage(cadastre, 0.25, 0.5);
    const b = pointOnImage(cadastre, 0.75, 0.5);
    const result = calibrateUnderlay(cadastre, a, b, 12_500);
    if (result.status !== 'OK') throw new Error('la calibration a été refusée');
    expect(result.underlay.opacity).toBe(cadastre.opacity);
    expect(result.underlay.name).toBe(cadastre.name);
    expect(result.underlay.image).toBe(cadastre.image);
  });

  it('refuse un coin ou une largeur qui ne se mesure pas', () => {
    const nowhere = underlayMoved(cadastre, { x: Number.NaN, y: 0 });
    expect(nowhere.status).toBe('ERROR');
    const flat = underlayWidened(cadastre, 0);
    expect(flat.status).toBe('ERROR');
  });
});

describe('ce que le projet accepte d’écrire', () => {
  it('garde une image calée, tournée et verrouillée', () => {
    const a = pointOnImage(cadastre, 0.25, 0.5);
    const b = pointOnImage(cadastre, 0.75, 0.5);
    const calibrated = calibrateUnderlay(cadastre, a, b, 12_500);
    if (calibrated.status !== 'OK') throw new Error('calibration refusée');
    const turned = underlayTurned(calibrated.underlay, 42.5);
    if (turned.status !== 'OK') throw new Error('rotation refusée');
    const held = underlayLocked(turned.underlay, true);

    const commands = new ProjectCommandDispatcher(project);
    expect(commands.dispatch(new SetSiteUnderlayCommand(held)).status).toBe(
      'APPLIED',
    );
    expect(commands.project.site.underlay).toEqual(held);
    // Un calque de papier n'est toujours pas un objet du modèle : le poser
    // n'a rien changé au bâtiment.
    expect(commands.project.building).toEqual(project.building);
  });

  it('refuse un angle qui sort du tour', () => {
    // La commande est la dernière porte avant le fichier : le schéma dit
    // « de 0 à 360 exclu », et rien ne doit pouvoir écrire autre chose.
    const commands = new ProjectCommandDispatcher(project);
    const refused = commands.dispatch(
      new SetSiteUnderlayCommand({ ...cadastre, rotationDeg: 400 }),
    );
    expect(refused.status).toBe('REJECTED');
    if (refused.status !== 'REJECTED') return;
    expect(refused.errors.join(' ')).toContain('angle');
  });
});
