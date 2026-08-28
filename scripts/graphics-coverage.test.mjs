/**
 * Ce que le plan doit continuer de savoir dessiner.
 *
 * `npm run graphics:coverage -- --check` pose la question à la barrière ; ce
 * test la pose à la suite, en quelques millisecondes, sur les mêmes données.
 * La différence compte : une régression graphique ne casse aucun test —
 * une famille qui perd son glyphe retombe sur celui de sa catégorie, puis sur
 * le carré générique, et le plan continue de sortir. Elle est simplement moins
 * précise, et personne ne s'en aperçoit avant d'imprimer.
 *
 * Le test ne recopie pas les seuils : il lit ceux du script, sans quoi il y
 * aurait deux décisions au lieu d'une et la barrière et la suite pourraient se
 * contredire. Ce qu'il vérifie, c'est que la mesure veut dire quelque chose et
 * qu'elle est tenue.
 */
import { describe, expect, it } from 'vitest';
import {
  SEUILS,
  couverture,
  desaccords,
  famillesPosables,
  manquements,
  symboleGenerique,
  symbolesEmbarques,
} from './audit-graphics-coverage.mjs';

const resultat = couverture();

describe('la couverture graphique de la nomenclature', () => {
  it('mesure la vraie nomenclature, et pas trois familles de test', () => {
    // Une couverture calculée sur un échantillon serait toujours excellente.
    // Le dépôt en compte plusieurs centaines de posables ; si ce nombre tombe,
    // c'est que le script a cessé de trouver les fichiers, pas que la
    // nomenclature a maigri.
    expect(resultat.totaux.posables).toBeGreaterThan(300);
    expect(famillesPosables().length).toBe(resultat.totaux.posables);
  });

  it('range chaque famille posable dans un maillon et un seul', () => {
    const { totaux } = resultat;
    expect(
      totaux.specifique + totaux.categorie + totaux.generique + totaux.aucun,
    ).toBe(totaux.posables);
  });

  it('laisse toujours un dernier recours nommé', () => {
    // « Sans représentation » n'est pas un cas rare : c'est un cas impossible
    // tant que le glyphe générique est publié. S'il disparaît, tout le reste
    // du rapport ment, donc c'est cela qu'on vérifie et pas le zéro.
    expect(
      symbolesEmbarques().some(({ id }) => id === symboleGenerique()),
    ).toBe(true);
    expect(resultat.totaux.aucun).toBe(0);
  });

  it('ne nomme que des glyphes que la bibliothèque contient', () => {
    expect(resultat.introuvables).toEqual([]);
  });

  it('fait dire la même chose à la nomenclature et à la planche', () => {
    // La déclaration est écrite des deux côtés — la fiche de famille dit quel
    // glyphe elle veut, le glyphe dit de quelles familles il tient lieu —
    // parce que le moteur de plan ne peut pas atteindre la nomenclature. Dix
    // familles se contredisaient déjà avant que quiconque pose la question.
    expect(desaccords()).toEqual([]);
  });

  it('ne renvoie jamais vers un glyphe que la bibliothèque n’a pas', () => {
    // Un renvoi mort ne casse rien : le plan cherche un identifiant, ne le
    // trouve pas, et dessine le carré — comme avant, sans que personne ne
    // l'apprenne. C'est la panne muette qu'un catalogue refuse.
    expect(resultat.renvoisMorts).toEqual([]);
  });

  it('tient les seuils décidés dans le script', () => {
    expect(manquements(resultat)).toEqual([]);
  });

  it('tient un seuil qui a été décidé, et non recopié de la mesure', () => {
    // Un plafond posé au-dessus du total possible ne refuserait jamais rien,
    // et un plancher à zéro non plus.
    expect(SEUILS.symboleSpecifiqueMinimum).toBeGreaterThan(0);
    expect(SEUILS.repliCategorieMinimum).toBeGreaterThan(0);
    expect(SEUILS.repliGeneriqueMaximum).toBeLessThan(resultat.totaux.posables);
  });
});
