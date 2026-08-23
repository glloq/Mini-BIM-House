import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { projectChecks } from './checks-model.js';
import { studyFigures, studyLines } from './study-overview.js';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

describe('what the building drawn gives, in one page', () => {
  it('gives a line to every trade the project makes live, and to no other', () => {
    // Un projet sans photovoltaïque n'affiche pas « Photovoltaïque — vide » :
    // il n'affiche rien. C'est la même règle que partout ailleurs.
    const project = house();
    const lines = studyLines(project, projectChecks(project, undefined));
    expect(lines.length).toBeGreaterThan(0);
    expect(new Set(lines.map(({ domain }) => domain)).size).toBe(lines.length);
    for (const line of lines) expect(line.label).not.toBe(line.domain);
  });

  it('says a calculation is available until it has run', () => {
    /*
     * Trois états, et « calcul disponible » n'est pas un défaut : c'est un
     * travail qui attend. Le confondre avec un écart ferait lire une maison
     * saine comme une maison en faute.
     */
    const project = house();
    const checks = projectChecks(project, undefined);
    const before = studyLines(project, checks);
    const after = studyLines(project, checks, { ran: true });
    expect(before.some(({ state }) => state === 'AVAILABLE')).toBe(true);
    expect(after.some(({ state }) => state === 'AVAILABLE')).toBe(false);
    // Ce qui était un écart le reste : un calcul qui tourne ne répare rien.
    expect(before.filter(({ state }) => state === 'GAP').length).toBe(
      after.filter(({ state }) => state === 'GAP').length,
    );
  });

  it('reads the two surfaces one cites about a house', () => {
    const figures = studyFigures(house());
    expect(figures.footprintM2).toBeGreaterThan(0);
    /*
     * L'habitable est la somme des pièces de tous les niveaux ; l'emprise, ce
     * que le rez-de-chaussée prend au sol. La maison de référence a deux
     * niveaux habités : la première dépasse donc la seconde, et c'est
     * exactement ce que ces deux mots veulent dire.
     */
    expect(figures.livingAreaM2).toBeGreaterThan(figures.footprintM2);
  });

  it('counts nothing when the house is empty', () => {
    const project = house();
    const ground = project.building.levels[0]!;
    const bare = {
      ...project,
      building: {
        ...project.building,
        levels: [{ ...ground, spaces: [], slabs: [] }],
        zones: [],
      },
    };
    expect(studyFigures(bare)).toEqual({ livingAreaM2: 0, footprintM2: 0 });
  });
});
