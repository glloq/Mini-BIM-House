import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { areaLabel, roomLabels } from './room-labels.js';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

describe('what the plan writes on a closed contour', () => {
  it('writes a surface the way a plan writes it', () => {
    expect(areaLabel(12.4242)).toBe('12,42 m²');
    expect(areaLabel(8)).toBe('8,00 m²');
  });

  it('names the rooms the house already holds', () => {
    const labels = roomLabels(house(), undefined);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label.areaM2).toBeGreaterThan(0);
    // La maison de référence porte ses pièces : chacune est nommée, et aucune
    // n'attend qu'on la crée.
    expect(labels.every(({ spaceId }) => spaceId !== undefined)).toBe(true);
    expect(labels.some(({ name }) => name !== undefined)).toBe(true);
  });

  it('offers the room a closed contour does not carry yet', () => {
    // Les mêmes murs, sans les pièces : la surface reste lisible, et c'est
    // exactement le moment où le plan doit proposer d'en faire une pièce.
    const project = house();
    const ground = project.building.levels[0]!;
    const roomless = {
      ...project,
      building: {
        ...project.building,
        levels: [{ ...ground, spaces: [] }],
        zones: [],
      },
    };
    const labels = roomLabels(roomless, ground.id);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.spaceId).toBeUndefined();
      expect(label.name).toBeUndefined();
    }
  });

  it('says nothing about a cupboard', () => {
    // Deux mots dans quarante centimètres se lisent moins bien qu'un vide.
    const big = roomLabels(house(), undefined, { minimumAreaM2: 1 }).length;
    expect(roomLabels(house(), undefined, { minimumAreaM2: 1000 })).toEqual([]);
    expect(big).toBeGreaterThan(0);
  });
});
