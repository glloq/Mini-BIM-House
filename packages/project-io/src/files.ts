/**
 * Ouvrir et enregistrer : le sous-chemin qu'on charge au clic.
 *
 * `@house-technical-designer/project-io` décrit un projet ; ce sous-chemin
 * sait le lire depuis un fichier et l'y réécrire. La séparation n'est pas une
 * question de goût, elle se pèse : le validateur compilé par Ajv fait quatre
 * cent trente-huit kilo-octets, et tant que le barillet du paquet le
 * réexportait, il arrivait au premier écran de tout le monde — y compris de
 * celui qui ne fait qu'ouvrir l'application pour regarder un plan.
 *
 * Deux modules seulement passent par là, et pour la même raison : `file-io`
 * parce qu'il valide contre le schéma, `container` parce qu'il ouvre et écrit
 * l'archive qui porte le fichier. Les deux répondent à un geste — ouvrir,
 * enregistrer, exporter, importer — jamais à un rendu.
 */
export * from './file-io.js';
export * from './container.js';
