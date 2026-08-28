/**
 * Ce que le premier écran n'a pas le droit d'emporter.
 *
 * Deux fois cette semaine, du code annoncé comme chargé à la demande s'est
 * révélé arriver au premier téléchargement de tout le monde : le validateur
 * compilé par Ajv, puis les dix-sept moteurs de calcul. Les deux ont été
 * trouvés par accident, en cherchant autre chose. Les deux pesaient plus de
 * vingt-cinq kilo-octets compressés — plus que ce que la plupart des
 * optimisations d'interface économisent.
 *
 * Le budget de bundle voyait le poids et pas la cause : il disait « ça a
 * grossi », jamais « les moteurs sont revenus ». Ce test dit la seconde chose,
 * en marchant sur le graphe d'importations statiques depuis `main.tsx` — donc
 * sans build, en quelques millisecondes, à chaque exécution de la suite.
 */
import { describe, expect, it } from 'vitest';
import { ownerOf, reachedFromFirstScreen } from './audit-first-screen.mjs';

const reached = reachedFromFirstScreen();
const owners = new Set([...reached.keys()].map((file) => ownerOf(file)));

/**
 * Les seize moteurs qui n'ont rien à faire là.
 *
 * Le dix-septième, le thermique, y est **à bon droit** : cliquer sur un mur
 * montre la résistance et le U de sa composition, et c'est le moteur qui les
 * calcule. Le distinguer des seize autres est tout l'intérêt de cette liste —
 * une règle qui les interdirait tous serait fausse et finirait contournée.
 */
const ON_DEMAND_ENGINES = [
  'acoustics',
  'battery',
  'cost',
  'dhw',
  'electrical',
  'energy-balance',
  'environmental',
  'heating',
  'hygrothermal',
  'iaq',
  'lighting',
  'photovoltaic',
  'rainwater',
  'ventilation',
  'wastewater',
  'water',
];

describe('ce que le premier écran emporte', () => {
  it('atteint assez de choses pour que le test veuille dire quelque chose', () => {
    // Si la marche cassait — un chemin qui ne se résout plus, une extension
    // inconnue — elle rendrait un graphe minuscule et tous les tests
    // passeraient en ne vérifiant rien.
    expect(reached.size).toBeGreaterThan(150);
  });

  it('n’emporte aucun des seize moteurs chargés à la demande', () => {
    const arrived = ON_DEMAND_ENGINES.filter((engine) =>
      owners.has(`@house-technical-designer/${engine}`),
    );
    expect(arrived).toEqual([]);
  });

  it('emporte le thermique, et c’est voulu', () => {
    // L'inverse du test précédent. Sans lui, la liste des seize passerait
    // aussi bien si la marche avait cessé de trouver quoi que ce soit.
    expect(owners.has('@house-technical-designer/thermal')).toBe(true);
  });

  it('n’emporte pas le validateur compilé du format', () => {
    // La première dette du même genre, et la plus lourde : quatre cent
    // trente-huit kilo-octets de règles de schéma pour ouvrir un plan.
    const validator = [...reached.keys()].filter((file) =>
      file.includes('generated-project-validator'),
    );
    expect(validator).toEqual([]);
  });

  it('n’emporte des adaptateurs de calcul que leur registre', () => {
    /*
     * `module-registry.ts` ne contient que des noms — identifiant, libellé,
     * méthode, version — et c'est tout ce dont la coque a besoin pour nommer
     * un module. Le barillet, lui, emporte les dix-sept moteurs.
     */
    const files = [...reached.keys()].filter(
      (file) =>
        ownerOf(file) === '@house-technical-designer/calculation-adapters',
    );
    expect(files.map((file) => file.split('/').at(-1))).toEqual([
      'module-registry.ts',
    ]);
  });

  it('n’emporte pas la maison de démonstration', () => {
    // Cent kilo-octets de JSON derrière un bouton : quelqu'un qui ouvre son
    // propre projet n'a aucune raison de les télécharger.
    expect(
      [...reached.keys()].filter((file) => file.includes('demo-project')),
    ).toEqual([]);
  });
});
