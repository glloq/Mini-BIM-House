import { describe, expect, it } from 'vitest';
import type { AddComponentCommand } from '@house-technical-designer/editor-core';
import { loadDemoProject } from '../demo-project.js';
import { placeComponentCommand } from './editing-commands.js';
import { chooseHost, projectEquipment } from './host-choice.js';
import {
  FOLLOWS_HOST,
  QUARTER_TURN_DEG,
  normalizedAngleDeg,
  placementAngleDeg,
  placementAngleNote,
  turnedPlacement,
  typedPlacement,
} from './placement-angle.js';

/* Le mur sud de la maison de référence porte ce qu'on pose contre lui. */
const AGAINST_SOUTH_WALL = { x: 2500, y: 500 };

/** Une prise du catalogue du projet : elle se pose sur un mur, et prend son angle. */
const SOCKET = 'generic-socket';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  const level = loaded.file.project.building.levels[0];
  if (level === undefined)
    throw new Error('la maison de référence a un niveau');
  const fiche = projectEquipment(loaded.file.project, SOCKET);
  if (fiche === undefined) throw new Error(`fiche absente : ${SOCKET}`);
  return { file: loaded.file, level, hosts: fiche.allowedHosts };
}

describe('l’orientation choisie avant de poser', () => {
  it('suit le support tant que personne n’a rien demandé', () => {
    // Le cas d'avant, qui doit rester intact : une prise se couche le long de
    // son mur sans qu'on ait à le dire.
    expect(placementAngleDeg(37.5, FOLLOWS_HOST)).toBeCloseTo(37.5, 9);
    expect(placementAngleDeg(undefined, FOLLOWS_HOST)).toBe(0);
    expect(placementAngleNote(37.5, FOLLOWS_HOST)).toBeUndefined();
  });

  it('tourne par quarts de tour, relativement au support', () => {
    // Un quart de tour d'un mur oblique reste un quart de tour de ce mur :
    // c'est l'écart qu'on demande, pas un cap.
    const turned = turnedPlacement(FOLLOWS_HOST, 1);
    expect(turned.turnDeg).toBe(QUARTER_TURN_DEG);
    expect(placementAngleDeg(37.5, turned)).toBeCloseTo(127.5, 9);
    expect(placementAngleDeg(0, turned)).toBe(90);
  });

  it('tourne à rebours et reste dans le tour', () => {
    const back = turnedPlacement(FOLLOWS_HOST, -1);
    expect(back.turnDeg).toBe(270);
    const round = [1, 2, 3, 4].reduce(
      (current) => turnedPlacement(current, 1),
      FOLLOWS_HOST,
    );
    expect(round.turnDeg).toBe(0);
  });

  it('fait l’emporter la valeur tapée sur le support et sur les quarts', () => {
    // La règle du tracé de mur, appliquée à la pose : ce qui est tapé gagne.
    const typed = typedPlacement(turnedPlacement(FOLLOWS_HOST, 1), 37.5);
    expect(placementAngleDeg(90, typed)).toBeCloseTo(37.5, 9);
    expect(placementAngleDeg(-12.25, typed)).toBeCloseTo(37.5, 9);
    expect(placementAngleNote(90, typed)).toBe('tourné à 37.5°');
  });

  it('rend le fantôme au support quand on vide le champ', () => {
    // Effacer annule ce que le champ contenait, pas les quarts de tour déjà
    // demandés : sinon la touche R paraîtrait s'annuler toute seule.
    const quarter = turnedPlacement(FOLLOWS_HOST, 1);
    const cleared = typedPlacement(typedPlacement(quarter, 37.5), undefined);
    expect(cleared.typedDeg).toBeUndefined();
    expect(placementAngleDeg(0, cleared)).toBe(90);
  });

  it('fait tourner le cap tapé plutôt que de rester immobile', () => {
    const typed = typedPlacement(FOLLOWS_HOST, 37.5);
    expect(placementAngleDeg(0, turnedPlacement(typed, 1))).toBeCloseTo(
      127.5,
      9,
    );
  });

  it('ne propage pas une valeur qui n’est pas un angle', () => {
    expect(normalizedAngleDeg(Number.NaN)).toBe(0);
    expect(typedPlacement(FOLLOWS_HOST, Number.NaN).typedDeg).toBeUndefined();
    expect(normalizedAngleDeg(-450)).toBe(270);
  });
});

describe('l’angle posé est celui du fantôme', () => {
  it('écrit l’angle du support quand personne n’a choisi', () => {
    // Non-régression : la pose sans choix garde exactement le comportement
    // d'avant, et c'est l'aperçu qui l'annonce.
    const { file, level, hosts } = house();
    const announced = chooseHost(level, AGAINST_SOUTH_WALL, undefined, hosts);
    const built = placeComponentCommand(
      file,
      level.id,
      AGAINST_SOUTH_WALL,
      { category: 'ELECTRICAL', definitionId: SOCKET, elevationMm: 1200 },
      'component-socket',
    );
    if (built.status !== 'OK') throw new Error(built.message);
    const draft = (built.command as AddComponentCommand).draft;
    expect(draft.hostObjectId).toBe(announced.hostObjectId);
    expect(draft.rotationDeg).toBe(announced.wallAngleDeg ?? 0);
  });

  it('écrit l’angle choisi, et non celui du mur, quand on a tourné', () => {
    // Le défaut réparé : le fantôme tournait à l'écran et la commande posait
    // l'angle du support. Ce que l'aperçu montre est ce qui est posé.
    const { file, level, hosts } = house();
    const announced = chooseHost(level, AGAINST_SOUTH_WALL, undefined, hosts);
    const chosen = placementAngleDeg(
      announced.wallAngleDeg,
      turnedPlacement(FOLLOWS_HOST, 1),
    );
    const built = placeComponentCommand(
      file,
      level.id,
      AGAINST_SOUTH_WALL,
      {
        category: 'ELECTRICAL',
        definitionId: SOCKET,
        elevationMm: 1200,
        rotationDeg: chosen,
      },
      'component-socket',
    );
    if (built.status !== 'OK') throw new Error(built.message);
    const draft = (built.command as AddComponentCommand).draft;
    expect(draft.rotationDeg).toBeCloseTo(chosen, 9);
    expect(draft.rotationDeg).not.toBe(announced.wallAngleDeg ?? 0);
    // Et le support ne change pas pour autant : tourner l'objet ne le
    // décroche pas du mur qui le porte.
    expect(draft.hostObjectId).toBe(announced.hostObjectId);
  });

  it('pose exactement la valeur tapée', () => {
    const { file, level } = house();
    const built = placeComponentCommand(
      file,
      level.id,
      AGAINST_SOUTH_WALL,
      { category: 'FURNITURE', elevationMm: 0, rotationDeg: 37.5 },
      'component-bed',
    );
    if (built.status !== 'OK') throw new Error(built.message);
    expect((built.command as AddComponentCommand).draft.rotationDeg).toBe(37.5);
  });
});
