/**
 * La géométrie d'une toiture quelconque, isolée de tout le reste.
 *
 * Un paquet à part parce que c'est un calcul et non un modèle : il prend un
 * contour et des pentes, il rend des faces et des arêtes. Il ne connaît ni les
 * projets, ni les niveaux, ni les assemblages — ce qui le rend éprouvable sur
 * un rectangle dessiné à la main.
 */
export * from './skeleton.js';
export type * from './types.js';
