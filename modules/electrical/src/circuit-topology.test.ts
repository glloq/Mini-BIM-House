/**
 * Un circuit de maison, tel qu'il est câblé.
 *
 * Le tableau, un câble d'arrivée, puis des dérivations : c'est ainsi qu'un
 * circuit de prises est tiré, et le moteur le refusait — « les câbles doivent
 * former une suite ordonnée et continue ». Ces tests posent les cas qu'un
 * électricien reconnaît : une guirlande, une arborescence, une dérivation en
 * T, un anneau, et un circuit dont un morceau ne remonte à rien.
 *
 * Les nombres se vérifient à la main. Tous les câbles font ici 1 Ω/m et
 * 1 mètre, ce qui rend chaque chute égale à `2 · I` en monophasé : le lecteur
 * peut suivre le courant tronçon par tronçon sans calculette, et une erreur de
 * facteur ou de sous-arbre saute aux yeux.
 *
 * La topologie est **déclarée**, pas déduite du dessin : chaque câble nomme
 * les deux nœuds qu'il relie. Les tracés sont donc tous identiques ici, et
 * cela ne change rien — ce qui est précisément la propriété qu'on veut.
 */
import { describe, expect, it } from 'vitest';
import { resolveCircuitTopology } from './circuit-topology.js';

/**
 * Un câble d'un mètre entre deux nœuds, à un ohm par mètre.
 *
 * La connexion est déclarée — les deux noms de nœuds — et le tracé ne sert
 * qu'à donner la longueur. C'est exactement le partage des rôles du module :
 * un dessin peut dériver, la connexion non.
 */
const wire = (cableId: string, from: string, to: string, metres = 1) => ({
  cableId,
  fromNodeId: from,
  toNodeId: to,
  path: [
    { x: 0, y: 0, z: 0 },
    { x: metres * 1000, y: 0, z: 0 },
  ],
  resistanceOhmPerM: 1,
});

const BOARD = 'board';

describe('une guirlande', () => {
  /*
   * Tableau ─1m─ A ─1m─ B, deux charges de 10 A.
   *
   * Le premier tronçon porte les deux, le second n'en porte qu'une : c'est
   * exactement ce que l'ancienne méthode ne savait pas faire, puisqu'elle
   * faisait passer le courant total du circuit dans les deux.
   */
  const result = resolveCircuitTopology(
    [wire('c1', BOARD, 'a'), wire('c2', 'a', 'b')],
    [
      { loadId: 'A', nodeId: 'a', currentA: 10 },
      { loadId: 'B', nodeId: 'b', currentA: 10 },
    ],
    BOARD,
    2,
  );

  it('se résout', () => {
    expect(result.status).toBe('RESOLVED');
  });

  it('fait porter au premier tronçon ce que les deux appellent', () => {
    if (result.status !== 'RESOLVED') return;
    expect(result.currentByCable.get('c1')).toBeCloseTo(20, 9);
    expect(result.currentByCable.get('c2')).toBeCloseTo(10, 9);
  });

  it('cumule la chute jusqu’à chaque charge', () => {
    if (result.status !== 'RESOLVED') return;
    // A : 2 · 20 · 1 · 1 = 40 V. B : 40 + 2 · 10 · 1 · 1 = 60 V.
    expect(result.dropByLoad.get('A')).toBeCloseTo(40, 9);
    expect(result.dropByLoad.get('B')).toBeCloseTo(60, 9);
  });

  it('rend la pire, et dit laquelle', () => {
    if (result.status !== 'RESOLVED') return;
    expect(result.worstDropV).toBeCloseTo(60, 9);
    expect(result.worstLoadId).toBe('B');
  });

  it('est plus optimiste que l’ancienne somme, et à raison', () => {
    /*
     * L'ancienne méthode faisait passer le courant total — 20 A — dans les
     * deux tronçons : 2 · 20 · 1 · 1 × 2 = 80 V. Or le second tronçon ne
     * porte que la charge B. La différence n'est pas un arrondi : elle est
     * d'un tiers, et elle allait toujours dans le sens du surdimensionnement.
     */
    if (result.status !== 'RESOLVED') return;
    expect(result.worstDropV!).toBeLessThan(80);
  });
});

describe('une arborescence', () => {
  /*
   *                    ┌─1m─ B (10 A)
   *   Tableau ─1m─ A ──┤
   *                    └─1m─ C (30 A)
   *
   * Le tronçon d'arrivée porte 40 A ; chaque dérivation porte la sienne. La
   * pire chute est celle de C, et non la somme de tout.
   */
  const result = resolveCircuitTopology(
    [
      wire('feeder', BOARD, 'junction'),
      wire('to-b', 'junction', 'b'),
      wire('to-c', 'junction', 'c'),
    ],
    [
      { loadId: 'B', nodeId: 'b', currentA: 10 },
      { loadId: 'C', nodeId: 'c', currentA: 30 },
    ],
    BOARD,
    2,
  );

  it('se résout, là où l’ancienne méthode refusait', () => {
    expect(result.status).toBe('RESOLVED');
  });

  it('répartit le courant entre les dérivations', () => {
    if (result.status !== 'RESOLVED') return;
    expect(result.currentByCable.get('feeder')).toBeCloseTo(40, 9);
    expect(result.currentByCable.get('to-b')).toBeCloseTo(10, 9);
    expect(result.currentByCable.get('to-c')).toBeCloseTo(30, 9);
  });

  it('prend la branche la plus défavorisée, pas la somme des deux', () => {
    if (result.status !== 'RESOLVED') return;
    // B : 2·40 + 2·10 = 100. C : 2·40 + 2·30 = 140.
    expect(result.dropByLoad.get('B')).toBeCloseTo(100, 9);
    expect(result.dropByLoad.get('C')).toBeCloseTo(140, 9);
    expect(result.worstLoadId).toBe('C');
    expect(result.worstDropV).toBeCloseTo(140, 9);
  });
});

describe('ce qu’un arbre ne peut pas être', () => {
  it('refuse un anneau plutôt que d’en choisir un côté', () => {
    /*
     * Un anneau se câble pour de bon — c'est le ring final britannique — et
     * il ne se calcule pas comme un arbre : le courant s'y partage entre deux
     * chemins selon leurs impédances. Le traiter comme un arbre donnerait une
     * chute plausible et fausse.
     */
    const result = resolveCircuitTopology(
      [
        wire('a', BOARD, 'one'),
        wire('b', 'one', 'two'),
        wire('c', 'two', BOARD),
      ],
      [{ loadId: 'X', nodeId: 'two', currentA: 10 }],
      BOARD,
      2,
    );
    expect(result.status).toBe('UNRESOLVED');
    if (result.status === 'UNRESOLVED') expect(result.reason).toBe('LOOP');
  });

  it('refuse un tronçon qui ne remonte à rien', () => {
    const result = resolveCircuitTopology(
      [wire('attached', BOARD, 'a'), wire('floating', 'far', 'farther')],
      [{ loadId: 'X', nodeId: 'a', currentA: 10 }],
      BOARD,
      2,
    );
    expect(result.status).toBe('UNRESOLVED');
    if (result.status === 'UNRESOLVED')
      expect(result.reason).toBe('DISCONNECTED');
  });

  it('refuse une charge posée à côté des câbles', () => {
    // Une prise à trois mètres du bout du câble n'est pas alimentée par lui,
    // et la rattacher au plus proche inventerait une liaison.
    const result = resolveCircuitTopology(
      [wire('c1', BOARD, 'a')],
      [{ loadId: 'X', nodeId: 'elsewhere', currentA: 10 }],
      BOARD,
      2,
    );
    expect(result.status).toBe('UNRESOLVED');
    if (result.status === 'UNRESOLVED')
      expect(result.reason).toBe('LOAD_OFF_PATH');
  });

  it('refuse un circuit sans câble', () => {
    const result = resolveCircuitTopology([], [], BOARD, 2);
    expect(result.status).toBe('UNRESOLVED');
  });
});

describe('ce qui manque plutôt que ce qui est faux', () => {
  it('ne rend aucune pire chute quand une seule résistance manque', () => {
    /*
     * La pire de deux quand il y en a trois n'est pas la pire : c'est un
     * nombre plus petit que la vérité, et il passerait pour une installation
     * conforme. Ce qui est calculable est rendu ; le verdict, non.
     */
    const result = resolveCircuitTopology(
      [
        wire('c1', BOARD, 'a'),
        // Une section ou un métal que le projet ne dit pas : le câble existe,
        // sa résistance non.
        {
          cableId: 'c2',
          fromNodeId: 'a',
          toNodeId: 'b',
          path: [
            { x: 0, y: 0, z: 0 },
            { x: 1000, y: 0, z: 0 },
          ],
        },
      ],
      [
        { loadId: 'A', nodeId: 'a', currentA: 10 },
        { loadId: 'B', nodeId: 'b', currentA: 10 },
      ],
      BOARD,
      2,
    );
    expect(result.status).toBe('RESOLVED');
    if (result.status !== 'RESOLVED') return;
    expect(result.dropByLoad.get('A')).toBeCloseTo(40, 9);
    expect(result.dropByLoad.has('B')).toBe(false);
    expect(result.worstDropV).toBeUndefined();
  });

  it('compte zéro dans un tronçon qui n’alimente rien', () => {
    // Une attente tirée jusqu'à un point où rien n'est encore posé : elle a
    // une longueur et pas de courant, ce qui est un fait et non un manque.
    const result = resolveCircuitTopology(
      [wire('c1', BOARD, 'a'), wire('spare', 'a', 'nowhere')],
      [{ loadId: 'A', nodeId: 'a', currentA: 10 }],
      BOARD,
      2,
    );
    if (result.status !== 'RESOLVED') return;
    expect(result.currentByCable.get('spare')).toBe(0);
    expect(result.worstDropV).toBeCloseTo(20, 9);
  });

  it('lit le triphasé au facteur qu’on lui donne', () => {
    // √3 entre phases : le même circuit, la même charge, une chute divisée
    // par 2/√3 par rapport au monophasé.
    const result = resolveCircuitTopology(
      [wire('c1', BOARD, 'a')],
      [{ loadId: 'A', nodeId: 'a', currentA: 10 }],
      BOARD,
      Math.sqrt(3),
    );
    if (result.status !== 'RESOLVED') return;
    expect(result.worstDropV).toBeCloseTo(Math.sqrt(3) * 10, 9);
  });
});
