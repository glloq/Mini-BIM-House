/**
 * La valeur exacte, là où la souris n'en donne qu'une approchée.
 *
 * L'audit demande la même chose pour deux gestes qui n'ont rien en commun
 * sinon d'être des gestes de géométrie :
 *
 *     Pivoter      garder les trois clics, et ajouter  Angle [ 37,5° ]
 *     Déplacer                                         ΔX, ΔY, distance, angle
 *
 * Et il demande de ne pas répondre par un mode. Un « mode numérique » à côté
 * du « mode souris » découperait chaque outil en deux outils qu'il faudrait
 * apprendre séparément, alors que trois personnes différentes veulent le même
 * outil : le débutant le fait à la souris, l'utilisateur précis à la souris
 * puis corrige la valeur, l'expert tape directement. Un champ que la souris
 * remplit et qu'on peut corriger sert les trois ; deux modes n'en servent
 * qu'un à la fois.
 *
 * D'où la règle unique de ce module, la même que celle du tracé de mur : **un
 * champ vide suit la souris, un champ rempli l'emporte**. Rien n'est un mode,
 * rien ne se verrouille, et l'on peut taper une valeur puis bouger la souris
 * pour l'autre.
 *
 * Ce module ne connaît ni React ni les commandes : il convertit ce qu'on a
 * tapé en la géométrie que les outils existants attendent déjà. C'est
 * volontaire, et c'est ce qui permet à Pivoter de garder ses trois clics —
 * l'angle tapé devient le troisième point, celui que le clic aurait donné, et
 * la commande de rotation n'apprend rien de nouveau.
 */
import type { Point2D } from '@house-technical-designer/geometry';
import { parseLengthMm } from './typed-values.js';

/**
 * Ce qu'on a tapé, lu comme un **écart** et non comme une longueur.
 *
 * `parseLengthMm` refuse le zéro et le négatif, et il a raison : un mur de
 * zéro millimètre n'est pas un mur, un mur de moins deux mètres non plus. Un
 * écart obéit à d'autres règles — « ΔY = 0 » est la façon exacte de dire
 * « plein est », et « -1,2 m » de dire « vers l'ouest » — mais il se tape dans
 * les mêmes unités, et les unités n'ont pas à être écrites deux fois : on
 * confie la magnitude au lecteur de longueurs et l'on ne traite ici que ce
 * qu'il refuse à bon droit, le signe et le zéro.
 */
export function parseOffsetMm(text: string): number | undefined {
  const cleaned = text.trim().toLowerCase().replace(',', '.');
  if (cleaned === '') return undefined;
  if (/^-?0+(?:\.0+)?\s*(?:mm|cm|dm|m)?$/u.test(cleaned)) return 0;
  const negative = cleaned.startsWith('-');
  const magnitude = parseLengthMm(negative ? cleaned.slice(1) : cleaned);
  if (magnitude === undefined) return undefined;
  return negative ? -magnitude : magnitude;
}

/**
 * L'angle que la souris décrit pour une rotation à trois points.
 *
 * La même formule que l'outil Pivoter — écart entre le cap de la direction
 * voulue et celui de la direction actuelle, vus du centre. Elle est ici pour
 * que le champ affiche pendant le geste exactement ce que la commande
 * appliquera à la fin ; le test de ce module vérifie l'aller-retour, faute de
 * quoi le nombre lu et le nombre appliqué finiraient par différer.
 */
export function rotationAngleDeg(
  centre: Point2D,
  from: Point2D,
  to: Point2D,
): number {
  const bearing = (point: Point2D): number =>
    Math.atan2(point.y - centre.y, point.x - centre.x);
  return ((bearing(to) - bearing(from)) * 180) / Math.PI;
}

/**
 * Le troisième clic qu'un angle tapé remplace.
 *
 * Pivoter demande un centre, une direction actuelle, une direction voulue.
 * Taper « 37,5 » ne supprime pas le troisième clic : il le **donne**. On rend
 * donc le point que ce clic aurait posé, sur le même rayon que la direction
 * actuelle — un point plus proche ou plus loin décrirait le même angle, mais
 * celui-là est le seul qui se lit comme la continuation du geste.
 *
 * Un rayon nul n'a pas de direction : le centre et la direction actuelle
 * confondus font une rotation que personne ne peut désigner. On garde alors un
 * rayon d'un millimètre, ce qui donne à l'angle tapé un point qui l'exprime au
 * lieu de rendre le centre lui-même, où la commande lirait un angle nul.
 */
export function rotationTargetPoint(
  centre: Point2D,
  from: Point2D,
  angleDeg: number,
): Point2D {
  const radius = Math.hypot(from.x - centre.x, from.y - centre.y) || 1;
  const start = Math.atan2(from.y - centre.y, from.x - centre.x);
  const turned = start + (angleDeg * Math.PI) / 180;
  return {
    x: centre.x + radius * Math.cos(turned),
    y: centre.y + radius * Math.sin(turned),
  };
}

/** Ce qu'un déplacement mesure, dit des quatre façons dont on le dit. */
export interface MoveMeasures {
  readonly dxMm: number;
  readonly dyMm: number;
  readonly distanceMm: number;
  readonly angleDeg: number;
}

/**
 * Le déplacement en cours, lu en cartésien et en polaire à la fois.
 *
 * Les quatre ensemble parce que les deux façons de dire servent à deux
 * questions réelles : « deux mètres vers l'est » se dit en ΔX, « un mètre
 * vingt dans l'axe du mur » se dit en distance et angle. Obliger à convertir
 * l'une en l'autre de tête est exactement ce que l'outil est censé éviter.
 */
export function moveMeasures(delta: Point2D): MoveMeasures {
  return {
    dxMm: delta.x,
    dyMm: delta.y,
    distanceMm: Math.hypot(delta.x, delta.y),
    angleDeg: (Math.atan2(delta.y, delta.x) * 180) / Math.PI,
  };
}

/** Ce qui a été tapé dans les champs, chacun pouvant rester vide. */
export interface TypedMove {
  readonly dxMm?: number;
  readonly dyMm?: number;
  readonly distanceMm?: number;
  readonly angleDeg?: number;
}

/**
 * Les quatre champs, nommés une seule fois.
 *
 * L'écran les affiche, l'état les range, la résolution les lit : trois
 * endroits pour la même liste, et une faute de frappe dans l'un d'eux ferait
 * un champ qu'on remplit sans effet. Ils sont donc nommés ici, et le
 * compilateur refuse tout autre nom.
 */
export const MOVE_FIELDS = ['dxMm', 'dyMm', 'distanceMm', 'angleDeg'] as const;
export type MoveFieldId = (typeof MOVE_FIELDS)[number];

/**
 * Ce qui est tapé après qu'on a rempli — ou vidé — l'un des champs.
 *
 * Vider rend le champ à la souris au lieu de le mettre à zéro, et c'est la
 * raison d'être de cette fonction : un objet où l'on écrirait `undefined`
 * dirait « on a tapé rien », ce qui n'est pas « on n'a rien tapé ». La
 * distinction est exactement celle que le dépôt tient partout — une valeur
 * inconnue reste inconnue et ne devient pas zéro.
 */
export function withTypedMove(
  current: TypedMove,
  id: MoveFieldId,
  value: number | undefined,
): TypedMove {
  const merged: Record<MoveFieldId, number | undefined> = {
    dxMm: current.dxMm,
    dyMm: current.dyMm,
    distanceMm: current.distanceMm,
    angleDeg: current.angleDeg,
  };
  merged[id] = value;
  return {
    ...(merged.dxMm === undefined ? {} : { dxMm: merged.dxMm }),
    ...(merged.dyMm === undefined ? {} : { dyMm: merged.dyMm }),
    ...(merged.distanceMm === undefined
      ? {}
      : { distanceMm: merged.distanceMm }),
    ...(merged.angleDeg === undefined ? {} : { angleDeg: merged.angleDeg }),
  };
}

/**
 * Le déplacement qui sera appliqué : ce qu'on a tapé, complété par la souris.
 *
 * Deux familles de champs décrivent le même vecteur, et il faut trancher
 * laquelle gagne quand les deux sont remplies. C'est le polaire : taper une
 * distance en tirant vaguement vers l'est est le geste courant — « ce sens-là,
 * mais exactement un mètre vingt » — alors que compléter un ΔX tapé par un ΔY
 * polaire ne veut rien dire. Dans chaque famille, un champ vide continue de
 * suivre la souris, si bien qu'on peut ne fixer que la distance, ou que
 * l'angle, ou les deux.
 *
 * Aucune valeur n'est inventée : un champ vide n'est pas zéro. Écrire zéro à
 * la place de ce que la souris dit ferait un déplacement que personne n'a
 * demandé, ce qui est la faute que ce dépôt refuse partout ailleurs.
 */
export function resolveMoveDelta(pointer: Point2D, typed: TypedMove): Point2D {
  const measured = moveMeasures(pointer);
  if (typed.distanceMm !== undefined || typed.angleDeg !== undefined) {
    const distanceMm = typed.distanceMm ?? measured.distanceMm;
    const angleDeg = typed.angleDeg ?? measured.angleDeg;
    const radians = (angleDeg * Math.PI) / 180;
    return {
      x: distanceMm * Math.cos(radians),
      y: distanceMm * Math.sin(radians),
    };
  }
  return {
    x: typed.dxMm ?? measured.dxMm,
    y: typed.dyMm ?? measured.dyMm,
  };
}
