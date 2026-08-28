import {
  GENERIC_PLAN_SYMBOL,
  planSymbolFor,
  planSymbolSource,
} from '@house-technical-designer/drawing-engine';

/**
 * Le glyphe avec lequel un plan dessine une chose posée.
 *
 * Un plan de maison montre une baignoire comme une baignoire : une forme que
 * quelqu'un reconnaît, et qui ne rentre pas contre le mur devant lequel on
 * l'a dessinée. Toutes les choses posées étaient le même carré de trois cents
 * millimètres, si bien qu'une salle de bains montrait trois carrés identiques
 * et ne disait rien de la possibilité de s'y tenir debout.
 *
 * ## Ce qui a changé, et pourquoi
 *
 * La correspondance vivait ici, dans une table écrite famille par famille :
 * trente-neuf lignes, qu'il fallait ajouter à la main et que rien ne relisait.
 * Trente-neuf pour une nomenclature de cinq cent vingt-sept familles, dont
 * trois cent quatre-vingts posables. Une table de cette forme est praticable à
 * quarante et fausse à quatre cents — on ne l'étend pas, on l'oublie.
 *
 * Elle est passée dans les **données** : chaque glyphe de la bibliothèque
 * déclare ce dont il tient lieu (`standsFor`), et la fiche de famille déclare
 * le glyphe qu'elle veut (`graphics.planSymbol`). Ajouter une famille dessinée
 * est devenu une ligne de JSON dans deux fichiers que `graphics:coverage`
 * tient d'accord, au lieu d'une ligne de TypeScript que personne ne compte.
 *
 * ## La chaîne
 *
 * Trois maillons, résolus par le moteur de dessin, du plus précis au moins :
 * le glyphe de la **famille**, celui de sa **catégorie**, puis le **glyphe
 * générique nommé**. Ce fichier n'en tient aucun ; il dit seulement quand le
 * plan doit s'en servir.
 */

/**
 * Le glyphe d'une famille, quand la bibliothèque lui en donne un.
 *
 * `undefined` quand la réponse serait le glyphe générique : ce n'est pas une
 * couverture manquante, c'est le partage du travail avec l'appelant. Le
 * générique **est** le carré que `planPrimitives` dessine déjà lui-même, et le
 * rendre ici ferait passer trois cents familles par un second chemin pour
 * obtenir le même carré — à ceci près qu'un glyphe d'espace modèle se laisse
 * étirer à la largeur déclarée par la fiche, et que tous les plans de
 * référence du dépôt changeraient d'un coup. C'est une décision de dessin, pas
 * de câblage, et elle appartient à qui tient ces planches.
 *
 * La **catégorie** est facultative parce que l'appelant ne la donne pas encore.
 * Elle est portée par la copie de la fiche que le projet garde
 * (`EquipmentDefinition.category`), donc à un argument de distance : la passer
 * fait passer trente-trois familles de plus du carré à un dessin — les
 * appareils qu'aucune fiche ne dessine encore mais dont la catégorie, elle,
 * est dessinée. Là encore, c'est le plan de référence qui change, et c'est à
 * lui de décider quand.
 */
export function architecturalFixtureSymbol(
  familyId: string | undefined,
  category?: string | undefined,
): string | undefined {
  const subject = { familyId, category };
  return planSymbolSource(subject) === 'GENERIC'
    ? undefined
    : planSymbolFor(subject);
}

/**
 * Le glyphe nommé qu'une chose posée prend quand rien de plus précis n'existe.
 *
 * Réexporté ici pour que le dernier maillon de la chaîne se lise depuis
 * l'endroit où la chaîne est décrite, et non seulement depuis la bibliothèque
 * qui le publie.
 */
export { GENERIC_PLAN_SYMBOL };
