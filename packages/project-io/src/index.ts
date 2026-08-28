/**
 * Ce que lire et écrire un projet demande — sans navigateur.
 *
 * `autosave.ts` n'est plus réexporté ici : il parle à IndexedDB, donc au
 * navigateur, et un paquet nommé « entrées-sorties de projet » que Node ne
 * peut pas compiler est un paquet qui ment sur ce qu'il est. La sauvegarde
 * locale s'importe depuis `@house-technical-designer/project-io/browser`,
 * ce qui fait de la traversée de frontière un geste écrit plutôt qu'un effet
 * de bord d'un `export *`.
 *
 * `file-io.ts` et `container.ts` n'y sont pas non plus, et pour une raison
 * qui se mesure : ils portent le validateur compilé par Ajv, quatre cent
 * trente-huit kilo-octets qui n'ont rien à faire au premier écran de
 * quelqu'un qui n'a pas encore ouvert de fichier. Ils vivent derrière
 * `@house-technical-designer/project-io/files`, que l'application charge au
 * moment du clic. Ce qui reste ici — le modèle, les migrations, les
 * variantes, le zip — ne coûte rien à porter.
 */
export * from './project-io.js';
export * from './migrations.js';
export * from './scenarios.js';
export * from './zip.js';
