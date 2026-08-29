import { describe, expect, it } from 'vitest';

import { runProjectCalculations } from '../calculations/calculation-runner.js';
import { demoClimateDatasets, loadDemoProject } from '../demo-project.js';
import {
  DEFAULT_NEW_PROJECT_DRAFT,
  projectFromNewDraft,
} from '../project-creation/new-project.js';

/** Une date fixe : un projet neuf porte l'heure de sa création, et un test n'en a pas. */
const NOW = '2024-01-01T00:00:00.000Z';
import { projectChecks } from './checks-model.js';
import { studyFigures, studyLines } from './study-overview.js';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

/** Les lignes telles qu'un utilisateur les voit : après que les calculs ont tourné. */
async function linesAfterCalculation(project = house()) {
  const run = await runProjectCalculations(project, demoClimateDatasets());
  return studyLines(project, projectChecks(project, run), { ran: true });
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

  it('files a finding under the trade it is about', async () => {
    /*
     * Le test qui manquait, et qui aurait tout dit.
     *
     * Le métier se devinait sur l'identifiant du constat —
     * `id.startsWith('heating')` — et un identifiant commence par sa source,
     * `system:heating:…`. Aucun constat n'a jamais correspondu : chaque ligne
     * comptait zéro écart, sur tous les projets, depuis toujours. Les tests
     * passaient parce qu'aucun n'exigeait qu'un écart apparaisse quelque part.
     *
     * La maison de référence a une pièce sans émetteur : un écart, sur la
     * ligne du chauffage.
     *
     * Elle avait aussi cinq raccords de ventilation indéterminés — un
     * indéterminé n'est pas un écart, et les deux vont sur deux lignes
     * différentes. Ils ont disparu le jour où le réseau a déclaré ce que ses
     * ports transportent : ils ne disaient pas « cette ventilation est
     * douteuse », ils disaient « rien ici ne permet d'en juger ».
     *
     * Le test garde ses deux moitiés en se donnant un indéterminé plutôt qu'en
     * renonçant à en vérifier un : on retire son genre à un seul port, et la
     * ligne de la ventilation doit repasser d'elle-même à « pas vérifiable ».
     */
    const lines = await linesAfterCalculation();
    const byDomain = new Map(lines.map((line) => [line.domain, line]));
    expect(byDomain.get('HEATING')).toMatchObject({ state: 'GAP', gaps: 1 });
    expect(byDomain.get('VENTILATION')).toMatchObject({
      state: 'HELD',
      unknowns: 0,
    });

    const blinded = house();
    const doubtful = await linesAfterCalculation({
      ...blinded,
      systems: (blinded.systems ?? []).map((system) =>
        system.id !== 'ventilation'
          ? system
          : {
              ...system,
              ports: system.ports.map((port, index) =>
                index === 0
                  ? Object.fromEntries(
                      Object.entries(port).filter(
                        ([key]) => key !== 'portTypeId',
                      ),
                    )
                  : port,
              ) as typeof system.ports,
            },
      ),
    });
    expect(
      new Map(doubtful.map((line) => [line.domain, line])).get('VENTILATION'),
    ).toMatchObject({ state: 'UNVERIFIED' });
  });

  it('never says a trade is held while it is reporting about it', async () => {
    /*
     * La règle en une phrase. « Tenu » veut dire « rien à signaler » : une
     * ligne qui porte un constat ne peut pas le dire, quel que soit le projet.
     *
     * C'est le cas qui a été trouvé sur un projet **neuf** : quarante-sept
     * constats, tous non vérifiables, et neuf lignes vertes juste au-dessus.
     */
    for (const project of [
      house(),
      projectFromNewDraft(DEFAULT_NEW_PROJECT_DRAFT, NOW).project,
    ])
      for (const line of await linesAfterCalculation(project))
        if (line.state === 'HELD')
          expect({ ...line }).toMatchObject({ gaps: 0, unknowns: 0 });
  });

  it('gives a new project no green line at all', async () => {
    /*
     * Un projet vide ne tient rien : il n'a ni mur, ni pièce, ni réseau, donc
     * aucun métier n'a de quoi être « tenu ». Ce que la page doit dire, c'est
     * qu'il manque tout — pas que tout va bien.
     */
    const lines = await linesAfterCalculation(
      projectFromNewDraft(DEFAULT_NEW_PROJECT_DRAFT, NOW).project,
    );
    expect(lines.filter(({ state }) => state === 'GAP')).toEqual([]);
    expect(
      lines.filter(({ state }) => state === 'UNVERIFIED').length,
    ).toBeGreaterThanOrEqual(7);
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
