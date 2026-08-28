/**
 * L'interface parle une langue, et une seule.
 *
 * Elle en parlait deux. Un projet neuf — le tout premier écran de quelqu'un qui
 * découvre l'application — ouvrait « Études » sur quarante et un constats, dont
 * **trente-neuf en anglais** :
 *
 *     Set the design indoor temperature in the heating module settings.
 *     No luminaire node is placed on the electrical network.
 *     Declare the household occupancy in the DHW module settings.
 *
 * Ces phrases sont écrites par les modules de calcul, qui sont du code
 * technique, et elles ressortent telles quelles sur un écran en français.
 * Personne ne l'avait vu parce que personne ne regardait un projet **vide** :
 * l'audit de mise en page ouvre la maison de démonstration, où presque rien ne
 * manque, donc presque rien ne parle.
 *
 * Ce test lit ce qu'un utilisateur lit, sur les deux projets qui comptent — la
 * maison de référence, et un projet qui vient d'être créé — et refuse ce qui
 * n'est pas dans sa langue.
 *
 * ## Ce qu'il ne juge pas
 *
 * Le nom d'une méthode et le titre d'une norme ne se traduisent pas : ISO 6946
 * s'appelle ISO 6946, et Darcy–Weisbach est un nom de personne. Ils ne passent
 * pas par ici — ce sont des références, affichées comme telles — et s'ils y
 * passaient un jour, la règle serait à revoir plutôt que la référence.
 */
import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject, demoClimateDatasets } from '../demo-project.js';
import { projectChecks } from '../checks/checks-model.js';
import { runProjectCalculations } from '../calculations/calculation-runner.js';
import {
  DEFAULT_NEW_PROJECT_DRAFT,
  projectFromNewDraft,
} from '../project-creation/new-project.js';

/** Une date fixe : un projet neuf porte l'heure de sa création, et un test n'en a pas. */
const NOW = '2024-01-01T00:00:00.000Z';

/**
 * Reconnaître le français, puis reconnaître l'anglais.
 *
 * Deux filets plutôt qu'un : une phrase sans accent ni mot-outil français
 * n'est pas forcément anglaise — « 3 m² » ne l'est pas — et une phrase qui
 * porte des mots-outils anglais et aucun mot français l'est. Exiger les deux
 * évite de signaler un identifiant, une unité ou un nombre.
 */
const FRENCH =
  /[àâçéèêëîïôùûüœ’]|\b(le|la|les|un|une|des|du|de|et|ne|pas|que|qui|est|sont|dans|sur|pour|avec|sans|aucun|aucune|cette|ce|son|sa|leur)\b/i;
const ENGLISH =
  /\b(the|a|an|is|are|no|not|and|or|of|in|on|for|with|set|must|requires?|declares?|state[sd]?|project|module|settings?|needs?|assumed|only|from|over|per)\b/i;

const notFrench = (messages: readonly string[]): readonly string[] =>
  [...new Set(messages)].filter(
    (message) => !FRENCH.test(message) && ENGLISH.test(message),
  );

function house(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

/** Un projet qui vient d'être créé : le premier écran de quelqu'un. */
function blank(): Project {
  return projectFromNewDraft(DEFAULT_NEW_PROJECT_DRAFT, NOW).project;
}

const CASES: readonly (readonly [string, Project])[] = [
  ['la maison de référence', house()],
  ['un projet neuf', blank()],
];

describe('ce qu’un écran dit, et dans quelle langue', () => {
  it.each(CASES)('les constats de %s sont en français', (_name, project) => {
    const checks = projectChecks(project, undefined);
    expect(
      notFrench(checks.flatMap(({ title, detail }) => [title, detail])),
    ).toEqual([]);
  });

  it.each(CASES)('ce qui manque à %s est dit en français', async (_n, p) => {
    /*
     * Le cas qui comptait le plus : un projet neuf ne peut rien calculer, donc
     * tout ce qu'il affiche est une phrase qui réclame une donnée. Quarante et
     * une phrases, et le premier écran de tout le monde.
     */
    const run = await runProjectCalculations(p, demoClimateDatasets());
    expect(notFrench(run.missing.map(({ message }) => message))).toEqual([]);
  });

  it.each(CASES)('les avertissements de %s sont en français', async (_n, p) => {
    const run = await runProjectCalculations(p, demoClimateDatasets());
    expect(
      notFrench(
        run.runs.flatMap(({ result }) =>
          (result?.warnings ?? []).map(({ message }) => message),
        ),
      ),
    ).toEqual([]);
  });

  it.each(CASES)('les hypothèses de %s le sont aussi', async (_n, p) => {
    // D'où vient une valeur se lit sous le résultat : « réglages de calcul du
    // projet », et non « project calculation settings ».
    const run = await runProjectCalculations(p, demoClimateDatasets());
    expect(
      notFrench(
        run.runs.flatMap(({ result }) =>
          (result?.assumptions ?? []).map(({ source }) => source ?? ''),
        ),
      ),
    ).toEqual([]);
  });

  it('en a assez à lire pour que le test veuille dire quelque chose', () => {
    // Une règle qui ne voit rien passe toujours. Un projet neuf réclame des
    // dizaines de données ; si ce compte s'effondrait, c'est la mesure qui
    // serait cassée, pas l'interface qui serait devenue parfaite.
    expect(projectChecks(house(), undefined).length).toBeGreaterThan(3);
  });
});
