/**
 * Ce que lire et écrire un projet demande — sans navigateur.
 *
 * `autosave.ts` n'est plus réexporté ici : il parle à IndexedDB, donc au
 * navigateur, et un paquet nommé « entrées-sorties de projet » que Node ne
 * peut pas compiler est un paquet qui ment sur ce qu'il est. La sauvegarde
 * locale s'importe depuis `@house-technical-designer/project-io/browser`,
 * ce qui fait de la traversée de frontière un geste écrit plutôt qu'un effet
 * de bord d'un `export *`.
 */
export * from './project-io.js';
export * from './migrations.js';
export * from './scenarios.js';
export * from './zip.js';
export * from './container.js';
