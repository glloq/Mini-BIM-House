/**
 * L'orientation d'un objet **pendant** qu'on le pose, avant le clic.
 *
 * Le fantôme se couche déjà le long du mur qui le portera, et c'est la bonne
 * réponse dans neuf cas sur dix : une prise suit son mur, un radiateur aussi.
 * Elle ne l'est pas toujours. Un lit posé au milieu d'une chambre ne suit
 * rien — le sol n'oriente pas — et le seul recours était de poser d'abord,
 * puis d'ouvrir l'inspecteur et d'y écrire une orientation. Poser un objet
 * mal tourné pour le tourner ensuite est deux gestes là où il y en a un.
 *
 * Ce module tient l'angle qu'on choisit avant de poser, et rien d'autre : il
 * ne sait ni ce qu'on pose ni où. Trois choses seulement le décident, dans un
 * ordre qui est celui de l'autorité :
 *
 * 1. **Ce que le support impose** — l'angle du mur retenu, quand il y en a un.
 * 2. **Les quarts de tour demandés** — `R` fait tourner le fantôme sur place,
 *    et c'est la convention de tous les logiciels de dessin ; le mur reste la
 *    référence, on tourne *par rapport à lui*, si bien qu'un objet à quatre-
 *    vingt-dix degrés d'un mur oblique reste à quatre-vingt-dix degrés de lui
 *    quand on vise un autre mur.
 * 3. **L'angle tapé** — il ne se compose avec rien : une valeur exacte est une
 *    valeur exacte, et l'ajouter à l'angle d'un mur donnerait un nombre que
 *    personne n'a demandé. C'est la même règle que la saisie du tracé, où une
 *    longueur tapée l'emporte sur ce que dit la souris.
 *
 * Rien de tout cela n'est persisté : c'est un état de pose, il vit entre deux
 * mouvements de souris et meurt avec l'outil. Ce qui entre dans le fichier
 * projet est l'angle du composant une fois posé, et lui seul.
 */

/** Un quart de tour, la marche que `R` fait faire au fantôme. */
export const QUARTER_TURN_DEG = 90;

/**
 * Ce que l'utilisateur a demandé de plus que le support.
 *
 * Deux champs qui ne disent pas la même chose : `turnDeg` est un **écart** au
 * support, `typedDeg` un **cap** absolu. Les garder distincts est ce qui
 * permet à un quart de tour de suivre le mur qu'on survole, et à une valeur
 * tapée de ne pas bouger quand on change de mur.
 */
export interface PlacementOrientation {
  /** L'écart demandé par rapport à l'angle du support, en degrés. */
  readonly turnDeg: number;
  /** Le cap tapé, quand il y en a un : il remplace tout le reste. */
  readonly typedDeg?: number;
}

/** Rien de demandé : le fantôme suit son support, comme avant. */
export const FOLLOWS_HOST: PlacementOrientation = { turnDeg: 0 };

/**
 * Le même angle, ramené dans le tour.
 *
 * Trois quarts de tour à droite valent un quart à gauche, et « 270° » se lit
 * mieux que « -90° » sur une étiquette. Un angle qui n'en est pas un — ce que
 * seule une saisie cassée peut produire — vaut zéro plutôt que de propager un
 * `NaN` jusque dans la géométrie du fantôme.
 */
export function normalizedAngleDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

/**
 * L'angle qui sera **posé**, et donc celui que le fantôme doit montrer.
 *
 * Une seule fonction pour les deux, parce que le défaut qu'on répare vient
 * précisément d'en avoir eu deux : `rotationDeg` s'écrivait à zéro dans la
 * commande pendant que l'aperçu se couchait le long du mur. Un aperçu qui
 * promet autre chose que ce qu'on obtient est pire que pas d'aperçu, puisqu'on
 * l'a cru.
 */
export function placementAngleDeg(
  hostAngleDeg: number | undefined,
  orientation: PlacementOrientation,
): number {
  if (orientation.typedDeg !== undefined)
    return normalizedAngleDeg(orientation.typedDeg);
  return normalizedAngleDeg((hostAngleDeg ?? 0) + orientation.turnDeg);
}

/**
 * L'orientation après un appui sur `R`, ou sur `Maj+R` pour tourner à rebours.
 *
 * Les deux touches ne sont pas décidées ici : elles sont déclarées dans
 * `shortcuts.ts` comme accords de la situation « pose en cours »
 * (`place.turn`, `place.turnBack`), et c'est de là que la boîte d'orientation
 * tire aussi la ligne qui les annonce. Ce module ne connaît que des quarts.
 *
 * Un quart de tour tourne ce qu'on voit : si un cap a été tapé, c'est lui qui
 * tourne — sans quoi la touche paraîtrait ne rien faire, l'angle tapé
 * l'emportant sur l'écart. Le cap reste alors un cap, simplement augmenté.
 */
export function turnedPlacement(
  orientation: PlacementOrientation,
  quarters: number,
): PlacementOrientation {
  const step = QUARTER_TURN_DEG * Math.trunc(quarters);
  if (orientation.typedDeg !== undefined)
    return {
      turnDeg: orientation.turnDeg,
      typedDeg: normalizedAngleDeg(orientation.typedDeg + step),
    };
  return { turnDeg: normalizedAngleDeg(orientation.turnDeg + step) };
}

/**
 * L'orientation une fois un cap tapé — ou le champ vidé.
 *
 * Vider le champ ne remet pas le fantôme droit : il le rend au support et aux
 * quarts de tour déjà demandés, c'est-à-dire à l'état d'avant la frappe. Un
 * champ effacé annule ce qu'il contenait, pas ce que les autres gestes ont
 * dit.
 */
export function typedPlacement(
  orientation: PlacementOrientation,
  typedDeg: number | undefined,
): PlacementOrientation {
  if (typedDeg === undefined || !Number.isFinite(typedDeg))
    return { turnDeg: orientation.turnDeg };
  return {
    turnDeg: orientation.turnDeg,
    typedDeg: normalizedAngleDeg(typedDeg),
  };
}

/**
 * Ce qu'il y a à dire de l'orientation, quand il y a quelque chose à en dire.
 *
 * Le fantôme porte déjà une phrase — la taille, le support — et l'allonger
 * d'un « orienté à 0,0° » qui répète ce que le dessin montre serait du bruit.
 * On ne parle donc que d'un angle **demandé** : celui qui ne vient pas du
 * support, et qui est justement celui qu'on peut avoir oublié d'annuler entre
 * deux poses.
 */
export function placementAngleNote(
  hostAngleDeg: number | undefined,
  orientation: PlacementOrientation,
): string | undefined {
  if (orientation.typedDeg === undefined && orientation.turnDeg === 0)
    return undefined;
  const angle = placementAngleDeg(hostAngleDeg, orientation);
  return `tourné à ${angle.toFixed(1)}°`;
}
