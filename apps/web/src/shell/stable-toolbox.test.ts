/**
 * Une tuile change ce qu'elle dit, jamais où elle est.
 *
 * Les tuiles étaient triées par ce qu'il restait à faire : recommandées
 * d'abord, inertes en dernier. L'intention était bonne — aider à trouver la
 * suite — et elle se payait sur le geste qu'on fait le plus souvent, qui est
 * de reprendre le même outil qu'il y a deux minutes.
 *
 * Mesuré entre un projet neuf et la maison de référence : **quarante-six
 * tuiles sur deux cent dix-sept changeaient de place**. On trace un mur, et
 * « Porte » n'est plus là où on l'avait prise.
 *
 * Ce test tient l'invariant sur les deux projets qui comptent, et il tient
 * aussi l'autre moitié : l'état, lui, doit continuer de se voir. Une boîte
 * stable où plus rien ne dit ce qui est recommandé aurait perdu ce que le tri
 * apportait.
 */
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { availabilityOf, sectionsOfStage } from '../editor/toolbox.js';
import { ordered } from './toolbox-order.js';
import {
  DEFAULT_NEW_PROJECT_DRAFT,
  projectFromNewDraft,
} from '../project-creation/new-project.js';
import { CREATION_STAGES } from '../ux/creation-stages.js';
import { designStateOf } from '../ux/design-state.js';

const NOW = '2024-01-01T00:00:00.000Z';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

/**
 * L'ordre des tuiles tel que la colonne le rend.
 *
 * Par `ordered`, la fonction même que le composant appelle, et non par une
 * relecture du registre : celle-ci serait stable par construction et ne
 * prouverait rien. Le tri, s'il revenait, reviendrait là.
 */
function shown(
  project: ReturnType<typeof house>,
  levelId?: string,
): ReadonlyMap<string, readonly string[]> {
  const design = designStateOf(project, levelId);
  const order = new Map<string, readonly string[]>();
  for (const stage of CREATION_STAGES)
    for (const section of sectionsOfStage(stage))
      order.set(
        `${stage}/${section.id}`,
        ordered(section, design).map(({ entry }) => entry.id),
      );
  return order;
}

describe('où les tuiles se trouvent', () => {
  it('does not depend on what the project already holds', () => {
    const empty = projectFromNewDraft(DEFAULT_NEW_PROJECT_DRAFT, NOW).project;
    const drawn = house();
    const before = shown(empty);
    const after = shown(drawn, 'ground');
    let tiles = 0;
    for (const [section, ids] of before) {
      tiles += ids.length;
      expect(after.get(section), section).toEqual(ids);
    }
    expect(tiles).toBeGreaterThan(150);
  });

  it('still says which one is the next thing to do', () => {
    /*
     * L'autre moitié de la règle. Le tri disait la recommandation par la
     * place ; la tuile la dit par sa marque. Si plus rien ne la portait, la
     * stabilité aurait coûté ce qu'elle prétend préserver.
     */
    const drawn = house();
    const design = designStateOf(drawn, 'ground');
    const graded = CREATION_STAGES.flatMap((stage) =>
      sectionsOfStage(stage).flatMap((section) =>
        section.entries.map((entry) => availabilityOf(entry, design)),
      ),
    );
    expect(graded.some(({ recommended }) => recommended)).toBe(true);
    expect(graded.some(({ enabled }) => !enabled)).toBe(true);
  });
});
