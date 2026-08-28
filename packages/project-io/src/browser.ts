/**
 * La moitié de ce paquet qui a besoin d'un navigateur.
 *
 * IndexedDB, `localStorage`, et la reprise après un onglet fermé. Rien de
 * tout cela n'existe dans Node, et rien de tout cela n'est nécessaire pour
 * lire, écrire, valider ou migrer un fichier de projet — ce que fait le point
 * d'entrée principal, et ce qu'un script en ligne de commande demande.
 *
 * Le sous-chemin est la frontière : l'importer est une décision, et elle se
 * lit dans la ligne d'import.
 */
export * from './autosave.js';
