/**
 * Ce que coûte un ajout, pour chaque famille d'objets.
 *
 * `entry-placement.test.ts` répond « est-ce que ça pose », et `audit:entries`
 * répond « qu'est-ce qui manque ». Reste la troisième question, celle qu'on ne
 * pose jamais parce qu'elle n'a pas de nombre : **est-ce simple ?**
 *
 * Elle en a trois, en fait, et ce sont ceux-ci :
 *
 * - **combien de gestes** — prendre l'entrée, puis cliquer. Un outil qui en
 *   demande cinq n'est pas un outil qu'on prend, c'est un outil qu'on subit ;
 * - **est-ce que l'écran dit quoi faire** — à chaque étape du tracé, et non
 *   seulement au début ;
 * - **est-ce qu'un bouton inerte mène quelque part** — une raison écrite vaut
 *   mieux qu'un bouton gris, et un geste vaut mieux qu'une raison.
 *
 * Les trois sont lus du registre et de l'état, jamais écrits ici : ce test ne
 * décrit pas ce qu'on aimerait, il refuse ce qu'on ne veut plus.
 */
import { describe, expect, it } from 'vitest';

import { createBlankProject } from '../project-workspace.js';
import { loadDemoProject } from '../demo-project.js';
import { designStateOf } from '../ux/design-state.js';
import { entryCreates } from './entry-kinds.js';
import { toolInstruction } from './tool-instruction.js';
import {
  completionModeOf,
  isOpenEnded,
  requiredPoints,
  toolById,
} from './tool-registry.js';
import { allToolboxEntries, availabilityOf } from './toolbox.js';
import type { EditorState } from './editor-state.js';

const blank = createBlankProject('2026-01-01T00:00:00.000Z').project;
const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;

const entries = allToolboxEntries();

/**
 * Ce qu'une entrée coûte, en gestes, une fois l'espace ouvert.
 *
 * Un pour la prendre, puis ses clics. Un tracé qui ne s'arrête pas tout seul
 * en coûte un de plus : celui qui l'achève.
 */
function gestures(toolId: string): number {
  if (isOpenEnded(toolId as never))
    // Trois sommets pour une surface, deux points pour un chemin, et le geste
    // qui achève : c'est le minimum de ce genre d'outil, pas sa moyenne.
    return (
      1 + (completionModeOf(toolId as never) === 'CLOSE_POLYGON' ? 3 : 2) + 1
    );
  return 1 + requiredPoints(toolId as never);
}

describe('ce que coûte un ajout', () => {
  it('tient en cinq gestes pour chaque entrée', () => {
    /*
     * Cinq : prendre l'entrée, poser trois sommets, fermer. C'est une parcelle,
     * et c'est le plus cher de ce que la boîte à outils propose. Un outil plus
     * cher que dessiner une parcelle serait un outil à repenser, pas un seuil
     * à relever.
     */
    const dear = entries
      .map((entry) => [entry.id, gestures(entry.toolId)] as const)
      .filter(([, cost]) => cost > 5);
    expect(dear).toEqual([]);
  });

  it('dit quoi faire à chaque étape, et pas seulement au début', () => {
    /*
     * Un outil qui n'annonce pas ce qu'il attend se découvre en essayant,
     * c'est-à-dire en se trompant. La phrase est dérivée du registre, donc
     * aucun outil ne peut oublier de l'écrire — ce test est ce qui empêche
     * qu'un outil nouveau échappe à la dérivation.
     */
    const rest: EditorState = {
      activeTool: 'SELECT',
      selection: [],
      pendingPoints: [],
      pendingPicks: [],
    } as unknown as EditorState;
    for (const toolId of new Set(entries.map(({ toolId }) => toolId))) {
      const start = toolInstruction({
        ...rest,
        activeTool: toolId,
      } as EditorState);
      expect(start.next.length, `${toolId} au repos`).toBeGreaterThan(10);
      // Et à mi-parcours : un outil qui ne parle qu'au premier clic laisse
      // seul celui qui en a déjà posé deux.
      const midway = toolInstruction({
        ...rest,
        activeTool: toolId,
        pendingPoints: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
        ],
      } as EditorState);
      expect(midway.next.length, `${toolId} en cours`).toBeGreaterThan(10);
      // Un tracé qui ne s'arrête pas tout seul dit comment on l'arrête.
      if (isOpenEnded(toolId as never))
        expect(midway.finish, `${toolId} n’a pas de fin écrite`).toBeTruthy();
    }
  });

  it('mène quelque part quand un bouton ne sert pas encore', () => {
    /*
     * Vingt et une tuiles disaient « créez d'abord un réseau dans Réseaux » ou
     * « ajoutez un étage » sans pouvoir y mener : la raison était juste et la
     * personne restait devant un bouton gris qui la renvoyait à un écran
     * qu'elle devait trouver seule.
     *
     * Une tuile inerte porte donc **un geste** : l'outil qui débloque quand
     * c'en est un, l'écran qui débloque quand ce n'en est pas un.
     */
    for (const project of [blank, house]) {
      const state = designStateOf(
        project,
        project.building.levels[0]?.id ?? '',
      );
      for (const entry of entries) {
        const available = availabilityOf(entry, state);
        if (available.enabled) continue;
        const requirement = available.requirement;
        expect(requirement?.reason, entry.id).toBeTruthy();
        expect(
          requirement?.entryId !== undefined ||
            requirement?.target !== undefined,
          `${entry.id} ne mène nulle part : « ${requirement?.reason ?? ''} »`,
        ).toBe(true);
      }
    }
  });

  it('nomme un outil du registre, et ce qu’il laisse derrière lui', () => {
    /*
     * Une entrée dont l'outil n'existe pas est un bouton qui ne peut rien
     * faire ; une entrée qui ne pose rien est un bouton qui ne fait rien —
     * sauf les quatre qui ne posent rien exprès.
     *
     * Sélectionner et mesurer lisent ; pivoter et retourner reprennent ce qui
     * est déjà là. Les nommer ici est une décision écrite : sans cette liste,
     * un outil nouveau qui oublierait de déclarer ce qu'il pose passerait pour
     * l'un d'eux.
     */
    const READS_OR_REWORKS = ['SELECT', 'MEASURE', 'ROTATE', 'MIRROR'];
    const idle = new Set<string>();
    for (const entry of entries) {
      expect(toolById(entry.toolId), entry.id).toBeDefined();
      if (entryCreates(entry).length === 0) idle.add(entry.toolId);
    }
    expect([...idle].sort()).toEqual([...READS_OR_REWORKS].sort());
  });
});
