/**
 * D'où vient l'emprise d'un objet du terrain qu'on ne dessine pas sommet par
 * sommet.
 *
 * Le terrain n'avait qu'un seul geste : trois sommets au moins, et on referme.
 * Le même pour la parcelle, l'allée, le parking, la terrasse, le bâtiment
 * voisin — et aussi pour l'arbre, la haie, la clôture et le portail, qui n'ont
 * pourtant rien d'un polygone qu'on cliquerait. On demandait trois sommets
 * pour planter un arbre : la personne en posait trois, obtenait un triangle,
 * et ce triangle **était** le houppier — pas une approximation, la vérité du
 * modèle. Une clôture se traçait comme une surface fermée, c'est-à-dire qu'il
 * fallait revenir sur ses pas pour lui donner une épaisseur.
 *
 * Ce module dit deux choses, et rien d'autre :
 *
 * 1. **Quelle nature d'emprise** chaque chose du terrain a — une surface qu'on
 *    trace, un axe qu'on suit, un point où l'on plante. La table est
 *    exhaustive par construction : une nature ajoutée à `SITE_OBSTACLE_KINDS`
 *    sans qu'on décide comment elle se dessine ne compile pas.
 * 2. **Comment on dérive le polygone** que le modèle stocke, à partir du geste
 *    réellement fait.
 *
 * ## Qui est la vérité, du polygone ou du diamètre
 *
 * Le modèle ne connaît qu'une chose : `SiteObstacle.boundary`, un polygone.
 * C'est **lui, et lui seul, la vérité** — c'est ce que l'ombre projette, ce
 * que la nomenclature mesure, ce que les poignées déplacent. Le diamètre du
 * houppier et la largeur de la haie sont des **saisies**, pas des données :
 * elles servent à fabriquer le polygone au moment de la pose, et elles ne sont
 * écrites nulle part. Les stocker à côté du contour créerait deux réponses à
 * « quelle est l'emprise de cet arbre », et la seconde deviendrait fausse au
 * premier sommet qu'on déplace à la souris — sans que rien ne le signale.
 *
 * La conséquence est assumée : rouvrir un arbre ne rend pas « 5 m de
 * houppier », il rend seize sommets sur un cercle de 5 m. C'est le prix d'une
 * seule vérité, et c'est moins cher qu'un diamètre qui ment.
 */
import type { SiteObstacleKind } from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

/**
 * La nature du geste qui donne son emprise à une chose du terrain.
 *
 * Ce n'est pas une catégorie décorative : c'est ce qui décide du nombre de
 * clics, de la phrase affichée, et de la façon dont le polygone se fabrique.
 */
export type SiteFootprintNature =
  /** Un contour qu'on referme : la parcelle, la terrasse, le voisin. */
  | 'SURFACE'
  /** Un axe qu'on suit, épaissi ensuite : la haie, la clôture, le portail. */
  | 'AXIS'
  /** Un endroit où l'on pose, l'emprise venant d'une dimension : l'arbre. */
  | 'POINT';

interface SiteFootprintRule {
  readonly nature: SiteFootprintNature;
  /**
   * Le geste, dit à qui s'est trompé d'outil.
   *
   * Un refus qui dit « ce n'est pas une surface » laisse quelqu'un devant un
   * outil qui ne veut pas de lui. Un refus qui nomme l'outil à prendre est le
   * seul qui rende la main.
   */
  readonly gesture: string;
}

/**
 * Comment chacune des choses du terrain se dessine.
 *
 * Écrit en toutes lettres et exhaustif : `Record<SiteObstacleKind, …>` refuse
 * de compiler si une nature d'obstacle apparaît sans qu'on ait dit par quel
 * geste on la pose — c'est-à-dire sans qu'on y ait réfléchi.
 */
export const SITE_FOOTPRINTS: Readonly<
  Record<SiteObstacleKind, SiteFootprintRule>
> = {
  BUILDING: { nature: 'SURFACE', gesture: 'un contour fermé' },
  EXCLUSION: { nature: 'SURFACE', gesture: 'un contour fermé' },
  PATH: { nature: 'SURFACE', gesture: 'un contour fermé' },
  PARKING: { nature: 'SURFACE', gesture: 'un contour fermé' },
  ROAD: { nature: 'SURFACE', gesture: 'un contour fermé' },
  TERRACE: { nature: 'SURFACE', gesture: 'un contour fermé' },
  OTHER: { nature: 'SURFACE', gesture: 'un contour fermé' },

  TREE: {
    nature: 'POINT',
    gesture: 'un clic à l’endroit où le planter, avec l’outil « Arbre »',
  },
  HEDGE: {
    nature: 'AXIS',
    gesture: 'une polyligne suivie d’une largeur, avec l’outil « Haie »',
  },
  FENCE: {
    nature: 'AXIS',
    gesture: 'une polyligne ouverte, avec l’outil « Clôture »',
  },
  GATE: {
    nature: 'AXIS',
    gesture: 'ses deux montants, avec l’outil « Portail »',
  },
};

/** Ce qui se trace en refermant un contour, et ce qui ne s'en trace pas. */
export function isSurfaceSiteKind(kind: SiteObstacleKind): boolean {
  return SITE_FOOTPRINTS[kind].nature === 'SURFACE';
}

/**
 * Pourquoi cette chose-là ne se trace pas en contour fermé, s'il y a lieu.
 *
 * Rendue depuis ici plutôt qu'écrite dans la commande : c'est la table
 * ci-dessus qui sait quel geste va avec quoi, et une phrase écrite ailleurs
 * vieillirait sans elle.
 */
export function outlineRefusal(kind: SiteObstacleKind): string | undefined {
  const rule = SITE_FOOTPRINTS[kind];
  return rule.nature === 'SURFACE'
    ? undefined
    : `Cela ne se trace pas en contour fermé : c’est ${rule.gesture}.`;
}

/**
 * Le nombre de côtés d'un houppier.
 *
 * Seize : assez pour qu'un cercle de cinq mètres soit rond à quelques
 * centimètres près, assez peu pour que déplacer un sommet à la main reste
 * possible et que le fichier ne gonfle pas. Un arbre n'est pas une pièce
 * d'usinage ; ce qu'on en attend est une ombre juste.
 */
export const CROWN_SIDES = 16;

/** Le houppier par défaut, en millimètres : un arbre de jardin déjà grand. */
export const DEFAULT_CROWN_DIAMETER_MM = 5000;

/** La hauteur par défaut d'un arbre, en millimètres. Elle fait l'ombre. */
export const DEFAULT_TREE_HEIGHT_MM = 8000;

/** L'épaisseur par défaut d'une haie, en millimètres. */
export const DEFAULT_HEDGE_WIDTH_MM = 800;

/** La hauteur par défaut d'une haie, en millimètres. */
export const DEFAULT_HEDGE_HEIGHT_MM = 1800;

/**
 * L'épaisseur d'un trait de clôture ou de portail, en millimètres.
 *
 * Ce n'est pas une option, et c'est délibéré. Une clôture **est** une ligne :
 * ce qu'on en dessine est son axe, et personne ne trace un grillage en pensant
 * « huit centimètres ». Le modèle, lui, ne sait stocker qu'un polygone — il
 * lui faut donc une épaisseur, et la plus petite qui reste visible au trait
 * est la moins mensongère. Elle ne se saisit pas, donc elle ne peut pas
 * contredire l'axe.
 */
export const LINE_FOOTPRINT_WIDTH_MM = 80;

/** La hauteur par défaut d'une clôture, en millimètres. */
export const DEFAULT_FENCE_HEIGHT_MM = 1500;

/**
 * Le houppier d'un arbre planté ici, large de ce diamètre-là.
 *
 * Un polygone régulier, et non un cercle : le modèle ne connaît pas les
 * cercles, et lui en inventer un demanderait de l'apprendre à tout ce qui lit
 * une emprise — l'ombre, les bornes, les poignées, l'export.
 */
export function crownFootprint(
  centre: Point2D,
  diameterMm: number,
): readonly Point2D[] | undefined {
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) return undefined;
  if (!Number.isFinite(centre.x) || !Number.isFinite(centre.y))
    return undefined;
  const radius = diameterMm / 2;
  return Array.from({ length: CROWN_SIDES }, (_unused, index) => {
    const angle = (2 * Math.PI * index) / CROWN_SIDES;
    return {
      x: centre.x + radius * Math.cos(angle),
      y: centre.y + radius * Math.sin(angle),
    };
  });
}

/** Deux points confondus ne font pas un segment : on les fond. */
function withoutRepeats(points: readonly Point2D[]): readonly Point2D[] {
  const kept: Point2D[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
    const last = kept[kept.length - 1];
    if (last !== undefined && last.x === point.x && last.y === point.y)
      continue;
    kept.push({ ...point });
  }
  return kept;
}

/**
 * Jusqu'où la pointe d'un angle a le droit de s'allonger, en demi-largeurs.
 *
 * Un virage en épingle fait diverger l'onglet : à un degré près de zéro, la
 * pointe part à cinquante mètres pour une haie de quatre-vingts centimètres.
 * Quatre demi-largeurs couvrent tous les angles jusqu'à vingt-neuf degrés,
 * c'est-à-dire tous ceux qu'on trace vraiment ; au-delà la pointe est coupée,
 * ce qui se voit à peine et ne fabrique pas d'aiguille.
 */
const MITER_LIMIT = 4;

/** La normale unitaire à gauche d'un segment, ou rien s'il est nul. */
function leftNormal(from: Point2D, to: Point2D): Point2D | undefined {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? undefined : { x: -dy / length, y: dx / length };
}

/**
 * Le ruban qu'un axe laisse derrière lui, large de `widthMm`.
 *
 * On décale chaque sommet d'une demi-largeur de part et d'autre, puis on
 * remonte l'autre côté : le contour se referme de lui-même. Aux angles, le
 * sommet décalé est l'**onglet** — l'intersection des deux bords — de sorte
 * qu'une haie garde sa largeur jusque dans ses virages : la moyenne des deux
 * normales, elle, la pinçait d'un tiers sur un angle droit. L'onglet s'allonge
 * indéfiniment quand l'axe revient sur lui-même ; il est donc borné, ce qui
 * coupe la pointe au lieu de fabriquer une aiguille de dix mètres. **L'axe
 * reste ce qu'on a cliqué** dans les deux cas.
 *
 * Rien n'est rendu pour un axe qui n'a pas deux points distincts : un ruban
 * sans direction n'a pas de côtés, et le modèle refuserait de toute façon un
 * contour de moins de trois sommets.
 */
export function ribbonFootprint(
  axis: readonly Point2D[],
  widthMm: number,
): readonly Point2D[] | undefined {
  if (!Number.isFinite(widthMm) || widthMm <= 0) return undefined;
  const spine = withoutRepeats(axis);
  if (spine.length < 2) return undefined;
  const half = widthMm / 2;

  const offsets = spine.map((point, index) => {
    const before =
      index === 0 ? undefined : leftNormal(spine[index - 1]!, point);
    const after =
      index === spine.length - 1
        ? undefined
        : leftNormal(point, spine[index + 1]!);
    if (before === undefined) return after!;
    if (after === undefined) return before;
    const sum = { x: before.x + after.x, y: before.y + after.y };
    const length = Math.hypot(sum.x, sum.y);
    // Un axe qui revient exactement sur lui-même annule ses deux normales : on
    // garde alors celle du segment entrant, faute de côté à choisir.
    if (length === 0) return before;
    const direction = { x: sum.x / length, y: sum.y / length };
    // L'onglet : le bord décalé du segment entrant et celui du sortant se
    // coupent à cette distance-là, et nulle part ailleurs.
    const cosine = direction.x * before.x + direction.y * before.y;
    const stretch = Math.min(
      cosine === 0 ? MITER_LIMIT : 1 / cosine,
      MITER_LIMIT,
    );
    return { x: direction.x * stretch, y: direction.y * stretch };
  });

  const left = spine.map((point, index) => ({
    x: point.x + offsets[index]!.x * half,
    y: point.y + offsets[index]!.y * half,
  }));
  const right = spine.map((point, index) => ({
    x: point.x - offsets[index]!.x * half,
    y: point.y - offsets[index]!.y * half,
  }));
  return [...left, ...right.reverse()];
}
