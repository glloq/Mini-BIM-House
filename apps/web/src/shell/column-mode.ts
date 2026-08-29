/**
 * Ce que la colonne de gauche montre : ce qu'on pose, ou ce qu'on a désigné.
 *
 * La coque avait cinq colonnes logiques et deux panneaux — les outils à
 * gauche, les propriétés à droite. Le second coûtait 294 px de dessin dès
 * qu'on cliquait un objet, c'est-à-dire en permanence, et il les coûtait du
 * côté où le regard finit une phrase. Il n'y a plus qu'une colonne, et elle
 * fait les deux métiers l'un après l'autre.
 *
 * Deux modes plutôt qu'un empilement, et c'est une décision : la colonne fait
 * 220 px de large et porte déjà les destinations, les niveaux, le nombre
 * d'étages et le sommaire des sous-parties. Poser les propriétés en dessous de
 * tout cela les faisait paraître à cinq cents pixels du haut, sous la ligne de
 * flottaison, pour un objet qu'on venait de cliquer. Ce qu'on regarde doit
 * être en haut ; c'est la seule place qui vaille dans une colonne étroite.
 *
 * Le mode n'est pas un réglage qu'on garde : il **suit ce qu'on fait**.
 * Désigner un objet, c'est demander ce qu'il est ; le mode passe donc aux
 * propriétés tout seul, comme le panneau de droite paraissait tout seul. Ce
 * qu'on choisit à la main vaut pour la sélection qu'on avait sous les yeux en
 * le choisissant — dire « montre-moi les outils » à propos d'un mur ne veut
 * pas dire « ne me montre plus jamais un objet ».
 *
 * Rien de tout cela n'est enregistré : c'est un état d'écran, dérivé de la
 * sélection, et il n'entre ni dans le fichier projet ni dans le navigateur.
 */

export type ColumnMode = 'TOOLS' | 'PROPERTIES';

/** Le mode demandé à la main, et à propos de quoi il l'a été. */
export interface ColumnChoice {
  readonly mode: ColumnMode;
  readonly subjectKey: string;
}

/**
 * Ce dont la colonne parlerait si elle montrait les propriétés.
 *
 * Une chaîne plutôt qu'un booléen : elle sert aussi à savoir que le sujet a
 * changé — passer d'un mur à un autre est un nouveau sujet, et un choix fait
 * pour le premier n'engage pas le second.
 */
export function subjectKey(
  selection: readonly string[],
  inspectedProperty: string | undefined,
): string {
  const designated = selection.join(' ');
  return inspectedProperty === undefined
    ? designated
    : `${designated}#${inspectedProperty}`;
}

export interface ColumnModeInput {
  /** Le sujet du moment : sélection, ou propriété montrée par la recherche. */
  readonly subjectKey: string;
  /**
   * Vrai quand la colonne aurait quelque chose d'utile à dire des propriétés
   * même sans sélection — hors du plan, l'espace ouvert **est** le sujet.
   */
  readonly alwaysProperties: boolean;
  /**
   * Vrai quand un outil est en main, c'est-à-dire qu'on est en train de poser.
   *
   * C'est la nuance qui manquait quand poser s'est mis à désigner ce qu'on
   * pose. Désigner est juste — on veut voir ce qu'on vient de faire, ses
   * poignées, ses actions — mais faire basculer la colonne avec, c'est
   * remplacer la boîte à outils au moment précis où l'on s'en sert : on pose
   * un mur, on veut poser une porte, et le sommaire des sous-parties n'est
   * plus là. Mesuré : un geste de plus pour chaque objet posé après le
   * premier, sur un écran où poser est ce qu'on fait tout le temps.
   *
   * L'outil en main l'emporte donc sur la sélection. Ce n'est pas une
   * exception : c'est la phrase de l'en-tête prise au mot — au repos, une
   * application de dessin sert à régler ce qu'on a dessiné ; outil en main,
   * elle sert à dessiner. Ce qu'on vient de poser reste désigné, avec ses
   * poignées sur le plan et ses actions dans la barre ; ses propriétés sont à
   * un clic, comme elles l'ont toujours été.
   */
  readonly toolInHand: boolean;
  readonly choice?: ColumnChoice;
}

/**
 * Le mode que la colonne montre, dérivé et jamais mémorisé.
 *
 * L'ordre des questions est celui de l'intention : ce qu'on a demandé pour ce
 * sujet-ci l'emporte, puis ce que le sujet impose, puis les outils — parce
 * qu'au repos, une application de dessin sert à dessiner.
 */
export function columnMode({
  subjectKey: subject,
  alwaysProperties,
  toolInHand,
  choice,
}: ColumnModeInput): ColumnMode {
  if (choice !== undefined && choice.subjectKey === subject) return choice.mode;
  // Hors du plan, l'espace ouvert est le sujet et il n'y a pas d'outil : la
  // question ne se pose pas.
  if (alwaysProperties) return 'PROPERTIES';
  if (toolInHand) return 'TOOLS';
  return subject === '' ? 'TOOLS' : 'PROPERTIES';
}
