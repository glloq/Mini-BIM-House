import { describe, expect, it } from 'vitest';

import {
  stepCoherenceProblem,
  stepForClick,
  type InteractionStep,
  type StepCoherenceSubject,
} from './interaction-steps.js';

const step = (prompt: string): InteractionStep => ({ kind: 'POINT', prompt });

describe('l’étape que décrit le clic à venir', () => {
  it('donne à chaque clic la sienne, tant qu’il en reste', () => {
    const steps = [step('un'), step('deux'), step('trois')];
    expect(stepForClick(steps, 0)?.prompt).toBe('un');
    expect(stepForClick(steps, 1)?.prompt).toBe('deux');
    expect(stepForClick(steps, 2)?.prompt).toBe('trois');
  });

  it('répète la dernière, parce qu’un tracé ouvert n’a pas de dernier clic', () => {
    // Un mur continu n'a pas de trentième coin qui mérite sa propre phrase :
    // il a un coin suivant, indéfiniment.
    const steps = [step('le départ'), step('le coin suivant')];
    expect(stepForClick(steps, 2)?.prompt).toBe('le coin suivant');
    expect(stepForClick(steps, 30)?.prompt).toBe('le coin suivant');
  });

  it('ne dit rien pour un outil qui ne déclare rien', () => {
    // Le repli — la description par le rang du point — est décidé par
    // l'appelant : ici, ne rien savoir se dit en ne répondant rien.
    expect(stepForClick(undefined, 0)).toBeUndefined();
    expect(stepForClick([], 0)).toBeUndefined();
  });
});

describe('empêcher les étapes de contredire le nombre de points', () => {
  const closed = (
    steps: readonly InteractionStep[],
    requiredPoints: number,
  ): StepCoherenceSubject => ({ requiredPoints, interaction: steps });

  it('refuse une saisie sur une étape qui désigne un objet', () => {
    /*
     * `numericInput` promet un champ, et un champ promet une valeur.
     *
     * Une étape qui demande de montrer un mur n'a pas de nombre à taper :
     * la déclarer saisissable annoncerait une saisie que rien ne peut offrir,
     * et l'aide en parlerait. Les étapes qui portent une mesure — un point,
     * un cap, une distance — restent libres de le déclarer.
     */
    expect(
      stepCoherenceProblem(
        closed(
          [
            {
              kind: 'PICK',
              prompt: 'Montrez le mur à scinder',
              numericInput: true,
            },
            step('deux'),
          ],
          2,
        ),
      ),
    ).toContain('rien ne s’y tape');
    expect(
      stepCoherenceProblem(
        closed(
          [
            {
              kind: 'DIRECTION',
              prompt: 'Cliquez la direction voulue',
              numericInput: true,
            },
            step('deux'),
          ],
          2,
        ),
      ),
    ).toBeUndefined();
  });

  it('laisse passer un outil qui n’en déclare pas', () => {
    // La déclaration est facultative et doit le rester : rien à contredire.
    expect(stepCoherenceProblem({ requiredPoints: 2 })).toBeUndefined();
  });

  it('exige d’un outil fermé autant d’étapes que de clics', () => {
    expect(
      stepCoherenceProblem(closed([step('a'), step('b')], 2)),
    ).toBeUndefined();
    // Le défaut qu'on ferme : un outil passé à trois clics dont les étapes en
    // décrivent deux afficherait « Cliquez son extrémité » pour un clic qui
    // n'est pas celui-là.
    expect(stepCoherenceProblem(closed([step('a'), step('b')], 3))).toContain(
      '2 étape(s) pour 3 clic(s)',
    );
    expect(
      stepCoherenceProblem(closed([step('a'), step('b'), step('c')], 2)),
    ).toContain('3 étape(s) pour 2 clic(s)');
  });

  it('accepte moins d’étapes que de clics pour un tracé ouvert, jamais plus', () => {
    // Là, le nombre de points est un minimum et la dernière étape se répète :
    // une étape suffit à décrire tous les clics à partir d'elle.
    const open = (steps: readonly InteractionStep[]): StepCoherenceSubject => ({
      requiredPoints: 3,
      openEnded: true,
      interaction: steps,
    });
    expect(stepCoherenceProblem(open([step('a')]))).toBeUndefined();
    expect(stepCoherenceProblem(open([step('a'), step('b')]))).toBeUndefined();
    // Quatre phrases pour un tracé sans fin, c'est en promettre une cinquième
    // qui n'existera jamais.
    expect(
      stepCoherenceProblem(open([step('a'), step('b'), step('c'), step('d')])),
    ).toContain('une suite finie ne décrit pas un tracé sans fin');
  });

  it('refuse une déclaration vide, qui ne dit rien de plus que l’absence', () => {
    expect(stepCoherenceProblem(closed([], 2))).toContain('vides');
  });
});
