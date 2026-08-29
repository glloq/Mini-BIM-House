import { describe, expect, it } from 'vitest';

import { columnMode, subjectKey } from './column-mode.js';

describe('ce que la colonne de gauche montre', () => {
  it('montre les outils au repos : une application de dessin sert à dessiner', () => {
    expect(
      columnMode({
        subjectKey: '',
        alwaysProperties: false,
        toolInHand: false,
      }),
    ).toBe('TOOLS');
  });

  it('passe aux propriétés dès qu’on désigne quelque chose', () => {
    // C'est ce que faisait le panneau de droite en paraissant tout seul :
    // désigner un objet est une question, et elle mérite sa réponse sans qu'on
    // ait à demander deux fois.
    expect(
      columnMode({
        subjectKey: subjectKey(['wall:wall-south'], undefined),
        alwaysProperties: false,
        toolInHand: false,
      }),
    ).toBe('PROPERTIES');
  });

  it('garde les outils tant qu’un outil est en main', () => {
    /*
     * Poser désigne ce qu'on vient de poser, et c'est juste : on veut voir ce
     * qu'on a fait. Faire basculer la colonne avec, en revanche, remplace la
     * boîte à outils au moment précis où l'on s'en sert — on pose un mur, on
     * veut poser une porte, et le sommaire des sous-parties n'est plus là.
     * Mesuré : un geste de plus par objet posé après le premier.
     *
     * L'outil en main l'emporte donc sur la sélection ; il ne l'efface pas.
     * Ce qu'on vient de poser reste désigné, avec ses poignées et ses actions,
     * et ses propriétés sont à un clic.
     */
    const subject = subjectKey(['wall:wall-south'], undefined);
    expect(
      columnMode({
        subjectKey: subject,
        alwaysProperties: false,
        toolInHand: true,
      }),
    ).toBe('TOOLS');
    // Et l'outil reposé rend la main au sujet, sans qu'on ait rien à demander.
    expect(
      columnMode({
        subjectKey: subject,
        alwaysProperties: false,
        toolInHand: false,
      }),
    ).toBe('PROPERTIES');
    // Ce qu'on a réclamé à la main l'emporte toujours, outil ou non : on peut
    // vouloir lire un mur pendant qu'on en trace un autre.
    expect(
      columnMode({
        subjectKey: subject,
        alwaysProperties: false,
        toolInHand: true,
        choice: { mode: 'PROPERTIES', subjectKey: subject },
      }),
    ).toBe('PROPERTIES');
  });

  it('montre les propriétés hors du plan, où il n’y a rien à poser', () => {
    expect(
      columnMode({ subjectKey: '', alwaysProperties: true, toolInHand: false }),
    ).toBe('PROPERTIES');
  });

  it('tient le mode réclamé à la main pour la sélection qu’on avait sous les yeux', () => {
    const subject = subjectKey(['wall:wall-south'], undefined);
    // Sans ça, cliquer « Outils » alors qu'un mur est désigné ne tiendrait pas
    // un rendu : la sélection redirait « propriétés » aussitôt.
    expect(
      columnMode({
        subjectKey: subject,
        alwaysProperties: false,
        toolInHand: false,
        choice: { mode: 'TOOLS', subjectKey: subject },
      }),
    ).toBe('TOOLS');
  });

  it('périme ce choix dès qu’on désigne autre chose', () => {
    // « Montre-moi les outils » à propos d'un mur ne veut pas dire « ne me
    // montre plus jamais un objet ».
    expect(
      columnMode({
        subjectKey: subjectKey(['wall:wall-north'], undefined),
        alwaysProperties: false,
        toolInHand: false,
        choice: {
          mode: 'TOOLS',
          subjectKey: subjectKey(['wall:wall-south'], undefined),
        },
      }),
    ).toBe('PROPERTIES');
  });

  it('garde les propriétés ouvertes sans rien de désigné quand on l’a demandé', () => {
    // Un objet a des propriétés, une vue aussi : on veut pouvoir lire à quel
    // étage et à quelle échelle on dessine sans avoir à cliquer un mur.
    expect(
      columnMode({
        subjectKey: '',
        alwaysProperties: false,
        toolInHand: false,
        choice: { mode: 'PROPERTIES', subjectKey: '' },
      }),
    ).toBe('PROPERTIES');
  });

  it('distingue une propriété montrée par la recherche d’une simple sélection', () => {
    // La palette mène à une propriété précise d'un objet : c'est un autre
    // sujet que le même objet désigné à la main, et le mode doit repartir des
    // propriétés même si l'on venait de demander les outils pour cet objet.
    const designated = subjectKey(['space:space-living'], undefined);
    const asked = subjectKey(['space:space-living'], 'area');
    expect(designated).not.toBe(asked);
    expect(
      columnMode({
        subjectKey: asked,
        alwaysProperties: false,
        toolInHand: false,
        choice: { mode: 'TOOLS', subjectKey: designated },
      }),
    ).toBe('PROPERTIES');
  });
});
