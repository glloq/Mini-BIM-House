/**
 * Caler une image de fond en cliquant deux points dont on connaît la distance.
 *
 * ## Le geste qui manquait
 *
 * Le calque de papier ne se réglait que par sa largeur : on importait un
 * cadastre, l'application lui donnait vingt mètres au jugé, et il fallait
 * ensuite taper des largeurs à l'aveugle — 18, 22, 21,40 — jusqu'à ce que la
 * façade du plan tombe sur la façade de l'image. Personne ne travaille comme
 * ça. Ce que la personne sait, ce n'est jamais la largeur du cadastre : c'est
 * qu'entre ce coin de mur et cet autre il y a 12,50 m.
 *
 * On désigne donc les deux points sur l'image, on dit la distance réelle qui
 * les sépare, et l'image se met à l'échelle toute seule :
 *
 * ```
 * facteur = distance réelle / distance mesurée entre les deux points
 * ```
 *
 * ## Pourquoi le premier point ne bouge pas
 *
 * Agrandir une image autour de son coin haut-gauche la fait fuir : le repère
 * qu'on venait de désigner part hors de l'écran, et on recommence en cherchant
 * l'image avant de chercher le point. L'homothétie est donc centrée sur le
 * **premier point cliqué** : il reste exactement là où il était, l'image
 * grandit ou rétrécit autour de lui, et le second point vient se poser à la
 * distance qu'on a dite. C'est ce qui fait qu'une calibration se voit se
 * produire au lieu de se subir.
 *
 * Mathématiquement, chaque point P de l'image devient `A + k·(P − A)`. Il
 * suffit d'appliquer cette règle au coin de l'image et de multiplier ses
 * dimensions par `k` : le reste suit, y compris quand l'image est tournée,
 * parce qu'une homothétie et une rotation du même dessin commutent.
 *
 * ## Ce qui n'est pas stocké
 *
 * Pas de facteur d'échelle dans le projet, pas de « pixels par mètre ». Ce qui
 * est écrit reste ce qui était écrit hier : la largeur et la hauteur de
 * l'image en millimètres, et le coin où elle est posée. Le facteur n'existe
 * que le temps du calcul, et la calibration se relit dans les dimensions
 * qu'elle a produites — un fichier plus ancien reste lisible, un fichier écrit
 * aujourd'hui reste lisible par ce qui ne connaît pas la calibration.
 *
 * ## Le verrou
 *
 * Une image calée est un travail : trois minutes de repérage qu'un curseur qui
 * dérape suffit à effacer. Le verrou est ce qui rend la calibration durable —
 * tout ce qui déplace, redimensionne ou tourne l'image est refusé tant qu'il
 * est mis. La transparence, elle, reste libre : la régler ne déplace rien, et
 * c'est justement ce qu'on veut pouvoir faire sans déverrouiller pour regarder
 * dessous.
 *
 * Ce module ne connaît ni React, ni caméra, ni pixels : il prend des points du
 * **modèle**, en millimètres, et rend une image de fond. Le canevas, lui, sait
 * transformer un clic en point du modèle — et c'est tout ce qu'on lui demande.
 */
import type { SiteUnderlay } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

import { underlayAtWidth } from './underlay-file.js';

/**
 * Ce qu'on refuse de faire à une image verrouillée.
 *
 * Le message dit le geste qui débloque : un refus qui n'indique pas la sortie
 * est un refus qu'on relit trois fois.
 */
export const UNDERLAY_LOCKED_MESSAGE =
  'L’image de fond est verrouillée : déverrouillez-la pour la déplacer, la tourner ou la recaler.';

/** Ce qu'une lecture de calibration apprend avant même d'y toucher. */
export interface CalibrationReading {
  /** Ce que les deux points mesurent aujourd'hui, sur l'image telle qu'elle est posée. */
  readonly measuredMm: number;
  /** Ce par quoi l'image doit être multipliée pour que cette distance soit la bonne. */
  readonly factor: number;
}

export type CalibrationReadingResult =
  | ({ readonly status: 'OK' } & CalibrationReading)
  | { readonly status: 'ERROR'; readonly message: string };

export type UnderlayChange =
  | { readonly status: 'OK'; readonly underlay: SiteUnderlay }
  | { readonly status: 'ERROR'; readonly message: string };

export type UnderlayCalibration =
  | ({
      readonly status: 'OK';
      readonly underlay: SiteUnderlay;
    } & CalibrationReading)
  | { readonly status: 'ERROR'; readonly message: string };

/** Une image verrouillée ne se déplace pas, ne tourne pas, ne se recale pas. */
export function isUnderlayLocked(underlay: SiteUnderlay): boolean {
  return underlay.locked === true;
}

/** La rotation de l'image, en degrés, qu'elle soit écrite ou non. */
export function underlayRotationDeg(underlay: SiteUnderlay): number {
  const turned = underlay.rotationDeg;
  return turned === undefined || !Number.isFinite(turned) ? 0 : turned;
}

/**
 * Ce que deux points et une distance réelle disent, avant d'y toucher.
 *
 * Séparé de l'application pour que le panneau puisse annoncer « mesuré 8,20 m
 * → ×1,52 » pendant qu'on tape le nombre : voir le facteur avant de valider,
 * c'est ce qui permet de repérer qu'on s'est trompé de deux points ou d'unité
 * — un ×15 en dit plus long qu'une image devenue immense.
 */
/**
 * Ce que les deux points mesurent aujourd'hui, sur l'image telle qu'elle est
 * posée. Le panneau l'annonce dès que les deux points existent, avant même
 * qu'une distance réelle soit tapée : c'est déjà une réponse — « l'image dit
 * 8,20 m là où le terrain en fait 12,50 ».
 */
export function measuredBetween(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function readCalibration(
  a: Point2D,
  b: Point2D,
  realDistanceMm: number,
): CalibrationReadingResult {
  if (
    !Number.isFinite(a.x) ||
    !Number.isFinite(a.y) ||
    !Number.isFinite(b.x) ||
    !Number.isFinite(b.y)
  )
    return {
      status: 'ERROR',
      message: 'Les deux points de calibration doivent être mesurables.',
    };
  const measuredMm = measuredBetween(a, b);
  // Deux points confondus ne mesurent rien : la division dirait l'infini, et
  // l'image disparaîtrait sans que personne comprenne pourquoi.
  if (measuredMm <= 0)
    return {
      status: 'ERROR',
      message:
        'Les deux points sont au même endroit : écartez-les pour mesurer une distance.',
    };
  if (!Number.isFinite(realDistanceMm) || realDistanceMm <= 0)
    return {
      status: 'ERROR',
      message: 'La distance réelle doit être une longueur positive.',
    };
  return { status: 'OK', measuredMm, factor: realDistanceMm / measuredMm };
}

/**
 * La même image, agrandie ou rétrécie autour d'un point qui, lui, ne bouge pas.
 *
 * Exporté et non caché dans la calibration : c'est la seule opération qui
 * demande à être vérifiée point par point, et c'est aussi celle qu'un autre
 * geste — une poignée d'échelle, plus tard — réutilisera telle quelle.
 */
export function underlayScaledAbout(
  underlay: SiteUnderlay,
  anchorMm: Point2D,
  factor: number,
): SiteUnderlay {
  return {
    ...underlay,
    // A + k·(coin − A) : le coin s'éloigne du point d'ancrage exactement
    // autant que l'image grandit, ce qui est la définition d'un point fixe.
    originMm: {
      x: anchorMm.x + (underlay.originMm.x - anchorMm.x) * factor,
      y: anchorMm.y + (underlay.originMm.y - anchorMm.y) * factor,
    },
    widthMm: underlay.widthMm * factor,
    heightMm: underlay.heightMm * factor,
  };
}

/**
 * Deux points, une distance réelle : l'image prend son échelle.
 *
 * Le premier point est celui qui reste fixe. Ce n'est pas un détail
 * d'implémentation qu'on pourrait inverser : c'est ce que la personne vient de
 * désigner en premier, donc ce qu'elle regarde, donc ce qui doit encore être
 * là quand l'image a changé de taille.
 */
export function calibrateUnderlay(
  underlay: SiteUnderlay,
  a: Point2D,
  b: Point2D,
  realDistanceMm: number,
): UnderlayCalibration {
  if (isUnderlayLocked(underlay))
    return { status: 'ERROR', message: UNDERLAY_LOCKED_MESSAGE };
  const reading = readCalibration(a, b, realDistanceMm);
  if (reading.status === 'ERROR') return reading;
  return {
    status: 'OK',
    underlay: underlayScaledAbout(underlay, a, reading.factor),
    measuredMm: reading.measuredMm,
    factor: reading.factor,
  };
}

/** L'image posée ailleurs : son coin va où on le dit, sa taille ne change pas. */
export function underlayMoved(
  underlay: SiteUnderlay,
  originMm: Point2D,
): UnderlayChange {
  if (isUnderlayLocked(underlay))
    return { status: 'ERROR', message: UNDERLAY_LOCKED_MESSAGE };
  if (!Number.isFinite(originMm.x) || !Number.isFinite(originMm.y))
    return {
      status: 'ERROR',
      message: 'Le coin de l’image doit être mesurable.',
    };
  return {
    status: 'OK',
    underlay: { ...underlay, originMm: { x: originMm.x, y: originMm.y } },
  };
}

/**
 * L'image tournée. L'angle est celui qu'on lit à l'écran, dans le sens des
 * aiguilles d'une montre, parce que c'est le sens dans lequel on tourne une
 * feuille pour aligner une rue sur un mur.
 *
 * L'angle est ramené dans [0 ; 360[ : 370° et 10° sont la même image, et deux
 * projets identiques doivent s'écrire pareil. Une rotation nulle n'est pas
 * écrite du tout — l'immense majorité des relevés sont droits, et une
 * propriété absente est une propriété qu'aucun ancien fichier ne contredit.
 */
export function underlayTurned(
  underlay: SiteUnderlay,
  rotationDeg: number,
): UnderlayChange {
  if (isUnderlayLocked(underlay))
    return { status: 'ERROR', message: UNDERLAY_LOCKED_MESSAGE };
  if (!Number.isFinite(rotationDeg))
    return {
      status: 'ERROR',
      message: 'L’angle de l’image doit être un nombre de degrés.',
    };
  const turned = ((rotationDeg % 360) + 360) % 360;
  const { rotationDeg: _previous, ...rest } = underlay;
  return {
    status: 'OK',
    underlay: turned === 0 ? rest : { ...rest, rotationDeg: turned },
  };
}

/**
 * Mettre ou ôter le verrou.
 *
 * Toujours permis, y compris sur une image verrouillée : un verrou dont on ne
 * peut plus sortir n'est pas un verrou, c'est une perte. Comme la rotation, il
 * n'est écrit que lorsqu'il est mis.
 */
export function underlayLocked(
  underlay: SiteUnderlay,
  locked: boolean,
): SiteUnderlay {
  const { locked: _previous, ...rest } = underlay;
  return locked ? { ...rest, locked: true } : rest;
}

/**
 * L'image redimensionnée par sa largeur, comme avant la calibration.
 *
 * Ce réglage-là existait déjà et il garde sa place : quand la largeur est
 * connue — un plan de géomètre porte son échelle —, la dire directement est
 * plus court que de désigner deux points. Il passe seulement par le verrou,
 * qui n'existait pas quand il a été écrit.
 */
export function underlayWidened(
  underlay: SiteUnderlay,
  widthMm: number,
): UnderlayChange {
  if (isUnderlayLocked(underlay))
    return { status: 'ERROR', message: UNDERLAY_LOCKED_MESSAGE };
  if (!Number.isFinite(widthMm) || widthMm <= 0)
    return {
      status: 'ERROR',
      message: 'La largeur de l’image doit être une longueur positive.',
    };
  return { status: 'OK', underlay: underlayAtWidth(underlay, widthMm) };
}
