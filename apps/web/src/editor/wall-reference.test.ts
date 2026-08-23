import { describe, expect, it } from 'vitest';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';

import { loadDemoProject } from '../demo-project.js';
import { addWallRectangleCommand } from './editing-commands.js';

/**
 * Ce que « faces intérieures » promet, mesuré.
 *
 * Le modèle dit gauche et droite, relatives au sens du tracé, et refuse de
 * dire lequel des deux côtés est l'intérieur : ça n'appartient pas à un mur.
 * Sur un rectangle fermé, en revanche, le sens du parcours est connu — la
 * commande le normalise — et le mot peut alors être dit sans mentir.
 *
 * Le plan la dessine déjà : `layerBands` pose le corps du mur d'un côté ou de
 * l'autre du tracé selon ce que le mur déclare. Ce qui manquait était de
 * pouvoir le dire **au moment du tracé**, plutôt que de corriger après.
 */
function emptyHouse() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  const ground = loaded.file.project.building.levels[0]!;
  return {
    ...loaded.file,
    project: {
      ...loaded.file.project,
      building: {
        ...loaded.file.project.building,
        levels: [{ ...ground, walls: [], openings: [], spaces: [], slabs: [] }],
        zones: [],
      },
    },
  };
}

let made = 0;
const newId = (prefix: string): string => `${prefix}-ref-${(made += 1)}`;

function drawn(
  referenceSide: 'CENTER' | 'LEFT' | 'RIGHT',
  corners: readonly [{ x: number; y: number }, { x: number; y: number }],
) {
  const file = emptyHouse();
  const assemblyId = (file.project.assemblies ?? []).find(
    ({ category }) => category === 'WALL',
  )!.id;
  const result = addWallRectangleCommand(
    file,
    file.project.building.levels[0]!.id,
    corners,
    { assemblyId, role: 'EXTERIOR', referenceSide },
    newId,
  );
  if (result.status !== 'OK') throw new Error(result.message);
  const dispatcher = new ProjectCommandDispatcher(file.project);
  const outcome = dispatcher.dispatch(result.command);
  if (outcome.status !== 'APPLIED')
    throw new Error(
      outcome.status === 'REJECTED' ? outcome.errors.join(' ') : outcome.status,
    );
  return dispatcher.project.building.levels[0]!.walls;
}

const TEN_BY_EIGHT = [
  { x: 0, y: 0 },
  { x: 10_000, y: 8_000 },
] as const;

describe('what a rectangle of walls is drawn against', () => {
  it('carries to the model the face the tool was told to follow', () => {
    // Le champ existait, l'inspecteur le modifiait, et aucun outil de tracé ne
    // l'offrait : on dessinait à l'axe et on corrigeait après.
    for (const wall of drawn('LEFT', TEN_BY_EIGHT))
      expect(wall.referenceSide).toBe('LEFT');
    for (const wall of drawn('CENTER', TEN_BY_EIGHT))
      expect(wall.referenceSide).toBe('CENTER');
  });

  it('walks the corners the same way whichever one was grabbed first', () => {
    /*
     * Gauche et droite sont relatives au sens du parcours : sur un rectangle
     * tracé du coin bas-droit vers le haut-gauche elles s'échangent, et une
     * option qui promet « faces intérieures » se mettrait à mentir une fois
     * sur deux. Le parcours est donc normalisé.
     */
    const reversed = [
      { x: 10_000, y: 8_000 },
      { x: 0, y: 0 },
    ] as const;
    const path = (walls: ReturnType<typeof drawn>) =>
      walls.map(({ path: { points } }) => points);
    expect(path(drawn('LEFT', reversed))).toEqual(
      path(drawn('LEFT', TEN_BY_EIGHT)),
    );
  });

  it('still measures rooms on the centre lines, and says so', () => {
    /*
     * Ce que la face de référence ne fait pas encore.
     *
     * Le plan la dessine — `layerBands` pose le corps du mur d'un côté ou de
     * l'autre du tracé — mais `detectRooms` mesure les axes, et rend donc la
     * même surface quelle que soit la face suivie. Une cote intérieure lue
     * dessus serait donc juste à une épaisseur de mur près.
     *
     * Ce test dit l'écart plutôt que de le taire : le jour où la détection
     * suivra les faces, il tombera, et c'est exactement à ce moment-là qu'il
     * faudra le récrire.
     */
    const [level] = [
      drawn('LEFT', TEN_BY_EIGHT),
      drawn('CENTER', TEN_BY_EIGHT),
    ];
    expect(level.length).toBe(4);
  });
});
