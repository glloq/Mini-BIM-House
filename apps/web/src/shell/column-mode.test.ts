import { describe, expect, it } from 'vitest';

import { columnMode, subjectKey } from './column-mode.js';

describe('ce que la colonne de gauche montre', () => {
  it('montre les outils au repos : une application de dessin sert à dessiner', () => {
    expect(columnMode({ subjectKey: '', alwaysProperties: false })).toBe(
      'TOOLS',
    );
  });

  it('passe aux propriétés dès qu’on désigne quelque chose', () => {
    // C'est ce que faisait le panneau de droite en paraissant tout seul :
    // désigner un objet est une question, et elle mérite sa réponse sans qu'on
    // ait à demander deux fois.
    expect(
      columnMode({
        subjectKey: subjectKey(['wall:wall-south'], undefined),
        alwaysProperties: false,
      }),
    ).toBe('PROPERTIES');
  });

  it('montre les propriétés hors du plan, où il n’y a rien à poser', () => {
    expect(columnMode({ subjectKey: '', alwaysProperties: true })).toBe(
      'PROPERTIES',
    );
  });

  it('tient le mode réclamé à la main pour la sélection qu’on avait sous les yeux', () => {
    const subject = subjectKey(['wall:wall-south'], undefined);
    // Sans ça, cliquer « Outils » alors qu'un mur est désigné ne tiendrait pas
    // un rendu : la sélection redirait « propriétés » aussitôt.
    expect(
      columnMode({
        subjectKey: subject,
        alwaysProperties: false,
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
        choice: { mode: 'TOOLS', subjectKey: designated },
      }),
    ).toBe('PROPERTIES');
  });
});
