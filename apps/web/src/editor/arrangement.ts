/**
 * Mettre plusieurs objets d'équerre les uns par rapport aux autres.
 *
 * La trame d'accroche dit où un objet tombe ; elle ne dit rien de la relation
 * **entre** les objets. Poser six chaises le long d'une table, aligner trois
 * prises sur la même hauteur, répartir quatre poteaux sur une portée : chacun
 * se posait au jugé, se désignait, se déplaçait au pixel, et on recommençait.
 * Sur la maison de référence, aligner six objets à la main coûte douze gestes
 * — un clic et un glissé par objet, plus le clic qui lit la référence — et en
 * répartir six en coûte seize, dont quatre saisies de nombres qu'il faut
 * d'abord calculer soi-même. Chacun de ces gestes est ici une action.
 *
 * ## Pourquoi ce module ne connaît ni le projet, ni les commandes
 *
 * Il ne reçoit que des boîtes englobantes et une intention, et il ne rend que
 * des **écarts** — un `Point2D` par identifiant. Rien n'est persisté, rien
 * n'est deviné, rien n'est créé. C'est ce qui permet d'écrire l'arithmétique
 * une fois et de la vérifier au millimètre sans monter un projet, un niveau,
 * une session ni React ; et c'est ce qui permet à l'appelant de faire du lot
 * d'écarts **une seule** entrée d'historique, ce que six déplacements
 * successifs ne feraient pas.
 *
 * Les emprises sont demandées à `boundsOf` (voir `object-editors.ts`), qui les
 * tient déjà famille par famille : les réécrire ici aurait fait deux réponses
 * possibles à « où est cet objet ? », et l'une des deux aurait fini fausse.
 *
 * ## Trois intentions, et ce qui les distingue
 *
 * - **Aligner** amène tout le monde sur une même ligne. La référence est
 *   l'objet le plus extrême dans la direction demandée, jamais le premier
 *   désigné : un alignement dont la référence change selon l'ordre de la
 *   sélection est un alignement qu'on refait trois fois avant de comprendre
 *   pourquoi il n'a pas fait deux fois la même chose. Pour les centrages, la
 *   référence est le milieu de l'ensemble — il n'y a pas d'objet « le plus
 *   centré », et prendre celui d'un seul objet déplacerait tous les autres
 *   pour lui plaire.
 * - **Répartir** ne déplace pas les deux extrêmes. C'est exactement ce qui la
 *   distingue d'un alignement : on garde la portée telle qu'elle est et on
 *   régularise ce qu'il y a dedans. En dessous de trois objets il n'y a rien
 *   dedans, et rendre un écart nul serait faire semblant d'avoir travaillé.
 * - **Répéter** ne crée rien. La duplication existe déjà — voir les
 *   `DuplicateProvider` de `object-transform.ts`, qui savent recopier un mur
 *   avec ses ouvertures et un composant sur le support recopié. Ce module ne
 *   fait que dire **où** poser chaque copie.
 *
 * ## Un refus se dit
 *
 * Chaque fonction rend soit les écarts, soit un refus nommé — une phrase
 * française qui dit pourquoi, comme le reste du code le fait. Rendre une carte
 * vide en cas d'impossibilité aurait été un succès silencieux : l'appelant
 * n'aurait rien fait et n'aurait rien eu à afficher, ce qui se lit comme une
 * panne.
 */
import type { Point2D } from '@house-technical-designer/geometry';

/**
 * L'emprise d'un objet sur le plan, telle que les familles la rendent.
 *
 * Déclarée ici par sa forme plutôt qu'importée de `object-editors.ts` : ce
 * module est le fond de la pile et n'importe rien de l'éditeur, ce qui lui
 * évite d'être entraîné dans le cycle des familles. La forme est celle
 * d'`ObjectBounds`, à dessein — un `boundsOf(...)` s'y range sans conversion.
 */
export interface PlanBounds {
  readonly min: Point2D;
  readonly max: Point2D;
}

/** Un objet à ranger : son identifiant, et ce qu'il occupe. */
export interface ArrangedObject {
  readonly objectId: string;
  readonly bounds: PlanBounds;
}

/**
 * Sur quoi les objets viennent se poser.
 *
 * Les quatre bords s'écrivent comme l'`AlignEdge` que `editing-commands.ts`
 * connaît déjà, et ce n'est pas un hasard : deux orthographes pour le même
 * bord auraient fait deux vocabulaires à tenir d'accord. Les deux centrages
 * s'ajoutent, parce qu'un bord n'a jamais permis de centrer quoi que ce soit.
 */
export type AlignIntent =
  'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM' | 'CENTRE_X' | 'CENTRE_Y';

/**
 * Ce que chaque intention fait, dit à l'utilisateur.
 *
 * « Centrer horizontalement » veut dire que les centres viennent sur une même
 * verticale ; c'est la convention de tous les logiciels de dessin, et c'est
 * aussi celle qui se trompe le plus souvent de lecture. L'infobulle le dit en
 * toutes lettres plutôt que de compter dessus.
 */
export const ALIGN_INTENT_LABELS: Readonly<Record<AlignIntent, string>> = {
  LEFT: 'Aligner à gauche',
  RIGHT: 'Aligner à droite',
  TOP: 'Aligner en haut',
  BOTTOM: 'Aligner en bas',
  CENTRE_X: 'Centrer horizontalement',
  CENTRE_Y: 'Centrer verticalement',
};

export const ALIGN_INTENT_HINTS: Readonly<Record<AlignIntent, string>> = {
  LEFT: 'Amener chaque objet sur le bord gauche du plus à gauche',
  RIGHT: 'Amener chaque objet sur le bord droit du plus à droite',
  TOP: 'Amener chaque objet sur le bord haut du plus haut',
  BOTTOM: 'Amener chaque objet sur le bord bas du plus bas',
  CENTRE_X:
    'Amener les centres sur une même verticale, au milieu de la sélection',
  CENTRE_Y:
    'Amener les centres sur une même horizontale, au milieu de la sélection',
};

/** L'axe le long duquel on espace. */
export type DistributeAxis = 'X' | 'Y';

export const DISTRIBUTE_LABELS: Readonly<Record<DistributeAxis, string>> = {
  X: 'Répartir horizontalement',
  Y: 'Répartir verticalement',
};

export const DISTRIBUTE_HINTS: Readonly<Record<DistributeAxis, string>> = {
  X: 'Espacer régulièrement de gauche à droite, sans bouger les deux extrêmes',
  Y: 'Espacer régulièrement de haut en bas, sans bouger les deux extrêmes',
};

/**
 * Un refus, quel que soit le rangement qui le prononce.
 *
 * Écrit une fois plutôt que recopié dans chaque issue : aligner, répartir et
 * répéter refusent pour des raisons différentes, mais un refus se lit
 * toujours de la même façon — un état nommé et une phrase. L'appelant peut
 * ainsi traiter les trois d'un seul `if`.
 */
export interface ArrangementRefusal {
  readonly status: 'REFUSED';
  readonly message: string;
}

/**
 * Ce qu'un rangement rend : des écarts, ou une phrase qui dit pourquoi non.
 *
 * Deux issues et pas trois : ce module n'a pas de cas « ce n'est pas à moi »,
 * puisqu'il ne reçoit que ce qu'on lui donne. La forme suit celle de
 * `TransformOutcome` (`object-transform.ts`), pour que l'appelant traite un
 * refus de rangement comme il traite déjà un refus de famille.
 */
export type ArrangementOutcome =
  | {
      readonly status: 'OK';
      /**
       * Ce que chaque objet a à parcourir, et rien pour ceux qui ne bougent
       * pas : un écart nul dans la carte ferait une commande de plus dans la
       * transaction, et une ligne d'historique qui promet un déplacement que
       * personne ne verrait.
       */
      readonly deltas: ReadonlyMap<string, Point2D>;
    }
  | ArrangementRefusal;

/**
 * En deçà de quoi deux positions sont la même position.
 *
 * Un millième de millimètre : c'est plus fin que tout ce que le modèle porte
 * — les cotes sont en millimètres entiers — et assez large pour absorber les
 * divisions en virgule flottante d'une répartition en huit intervalles. La
 * même valeur sert de seuil au « déjà aligné » d'`editing-commands.ts`.
 */
const SAME_PLACE_MM = 1e-6;

/** Le milieu d'une emprise, qui est ce que « centrer » veut dire. */
export function centreOf(bounds: PlanBounds): Point2D {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
  };
}

/** Vrai quand une emprise est faite de nombres qu'on peut soustraire. */
function measurable({ min, max }: PlanBounds): boolean {
  return [min.x, min.y, max.x, max.y].every((value) => Number.isFinite(value));
}

/**
 * La coordonnée qu'une intention lit sur un objet, et celle qu'elle vise.
 *
 * Un bord se lit sur l'emprise, un centrage sur le milieu de l'emprise : c'est
 * la seule différence entre les six intentions, et l'écrire une fois évite les
 * six branches recopiées où l'une finit par lire le mauvais bord.
 */
function readAt(intent: AlignIntent, bounds: PlanBounds): number {
  switch (intent) {
    case 'LEFT':
      return bounds.min.x;
    case 'RIGHT':
      return bounds.max.x;
    case 'TOP':
      return bounds.min.y;
    case 'BOTTOM':
      return bounds.max.y;
    case 'CENTRE_X':
      return centreOf(bounds).x;
    case 'CENTRE_Y':
      return centreOf(bounds).y;
  }
}

/** Si l'intention range en largeur (les objets se déplacent en x) ou en hauteur. */
function movesAlongX(intent: AlignIntent): boolean {
  return intent === 'LEFT' || intent === 'RIGHT' || intent === 'CENTRE_X';
}

/** Un écart porté par le seul axe que l'intention déplace. */
function deltaAlong(alongX: boolean, distance: number): Point2D {
  return alongX ? { x: distance, y: 0 } : { x: 0, y: distance };
}

const refused = (message: string): ArrangementRefusal => ({
  status: 'REFUSED',
  message,
});

/**
 * Ce que chaque objet a à parcourir pour venir sur la ligne demandée.
 *
 * Chacun parcourt la distance qui amène **son propre** bord sur le bord
 * extrême : aligner c'est déplacer, et un objet qui finirait plus court ne
 * serait pas aligné, il serait redessiné. Aucune emprise n'est déformée ici,
 * et l'appelant n'en a pas le moyen non plus, puisqu'il ne reçoit qu'un écart.
 *
 * La référence pour les quatre bords est l'objet le plus extrême dans la
 * direction demandée ; pour les deux centrages, c'est le milieu de l'étendue
 * de l'ensemble. Dans les deux cas elle ne dépend pas de l'ordre de la
 * sélection : demander deux fois le même alignement donne deux fois le même
 * résultat, ce qui est le minimum qu'on attende d'un alignement.
 */
export function alignDeltas(
  objects: readonly ArrangedObject[],
  intent: AlignIntent,
): ArrangementOutcome {
  const measured = objects.filter(({ bounds }) => measurable(bounds));
  if (measured.length < 2)
    return refused(
      objects.length < 2
        ? 'Aligner demande au moins deux objets : un objet seul est déjà aligné sur lui-même.'
        : 'Ces objets ne se mesurent pas sur le plan : il en faut au moins deux qui aient une emprise.',
    );
  const readings = measured.map(({ bounds }) => readAt(intent, bounds));
  /*
   * Le centrage vise le milieu de l'étendue, pas la moyenne des centres.
   *
   * La moyenne se laisse tirer par le nombre d'objets : cinq chaises serrées à
   * gauche et une table à droite centreraient tout le monde sur les chaises,
   * ce qui n'est pas « au milieu » pour l'œil qui regarde. Le milieu de
   * l'étendue est le même quel que soit le nombre d'objets qu'il y a dedans.
   */
  const target =
    intent === 'CENTRE_X' || intent === 'CENTRE_Y'
      ? (Math.min(...readings) + Math.max(...readings)) / 2
      : intent === 'LEFT' || intent === 'TOP'
        ? Math.min(...readings)
        : Math.max(...readings);
  const alongX = movesAlongX(intent);
  const deltas = new Map<string, Point2D>();
  measured.forEach(({ objectId }, index) => {
    const distance = target - readings[index]!;
    // Un objet déjà sur la ligne est laissé où il est plutôt que déplacé de
    // zéro : la transaction porte alors ce qui bouge, et rien d'autre.
    if (Math.abs(distance) < SAME_PLACE_MM) return;
    deltas.set(objectId, deltaAlong(alongX, distance));
  });
  if (deltas.size === 0)
    return refused('Ces objets sont déjà alignés : rien à déplacer.');
  return { status: 'OK', deltas };
}

/**
 * Ce que chaque objet intermédiaire a à parcourir pour que les intervalles
 * soient égaux.
 *
 * Les deux extrêmes ne bougent pas. C'est la définition du geste : la portée
 * est celle que l'utilisateur a posée, et ce qu'on régularise est ce qu'il y a
 * entre. Un « répartir » qui déplacerait aussi les extrêmes serait un
 * alignement déguisé, et il faudrait replacer les bouts après coup.
 *
 * Les intervalles sont mesurés **entre les centres**, et non entre les bords.
 * Entre les bords, six objets de largeurs différentes donnent des vides égaux
 * et des centres irréguliers : c'est ce qu'on veut pour des livres sur une
 * étagère, et jamais pour six chaises le long d'une table, quatre poteaux sur
 * une portée ou trois prises sur un mur — les objets de cette maquette-ci.
 *
 * L'ordre est celui où les objets se trouvent **sur le plan**, jamais celui de
 * la sélection : on ne désigne pas quatre poteaux de gauche à droite, on les
 * désigne à la bande ou au hasard des clics, et une répartition qui suivrait
 * cet ordre-là les échangerait de place au lieu de les espacer.
 */
export function distributeDeltas(
  objects: readonly ArrangedObject[],
  axis: DistributeAxis,
): ArrangementOutcome {
  const measured = objects.filter(({ bounds }) => measurable(bounds));
  if (objects.length < 3)
    return refused(
      'Répartir demande au moins trois objets : entre deux objets il n’y a qu’un intervalle, et un seul intervalle est déjà régulier.',
    );
  if (measured.length < 3)
    return refused(
      'Ces objets ne se mesurent pas sur le plan : il en faut au moins trois qui aient une emprise.',
    );
  const alongX = axis === 'X';
  const placed = measured
    .map((object) => {
      const centre = centreOf(object.bounds);
      return { objectId: object.objectId, at: alongX ? centre.x : centre.y };
    })
    // Deux objets exactement au même endroit ne se départagent pas par leur
    // position ; l'identifiant tranche, pour que deux appels rendent deux fois
    // la même chose plutôt qu'un ordre tiré du tri de la machine.
    .sort((first, second) =>
      first.at === second.at
        ? first.objectId.localeCompare(second.objectId)
        : first.at - second.at,
    );
  const first = placed[0]!;
  const last = placed[placed.length - 1]!;
  const span = last.at - first.at;
  if (Math.abs(span) < SAME_PLACE_MM)
    return refused(
      axis === 'X'
        ? 'Ces objets sont tous à la même abscisse : il n’y a pas de portée à répartir.'
        : 'Ces objets sont tous à la même ordonnée : il n’y a pas de portée à répartir.',
    );
  // Autant d'intervalles que d'espaces entre les objets : n objets, n-1 pas.
  const step = span / (placed.length - 1);
  const deltas = new Map<string, Point2D>();
  placed.forEach(({ objectId, at }, index) => {
    // Les deux extrêmes tiennent la portée : ils sont à leur place par
    // définition, et les recalculer les ferait dériver d'un arrondi.
    if (index === 0 || index === placed.length - 1) return;
    const distance = first.at + step * index - at;
    if (Math.abs(distance) < SAME_PLACE_MM) return;
    deltas.set(objectId, deltaAlong(alongX, distance));
  });
  if (deltas.size === 0)
    return refused('Ces objets sont déjà répartis régulièrement.');
  return { status: 'OK', deltas };
}

/**
 * Une copie à venir : son rang, son écart à l'original, et l'emprise qu'elle
 * occupera là où elle se pose.
 *
 * Les trois ne font pas double emploi. Le rang nomme la copie — « la
 * troisième » — pour l'écran qui compte et pour l'identifiant de commande qui
 * ne doit pas se répéter. L'écart est ce que la duplication attend, et rien
 * d'autre. L'emprise est ce qu'on **montre avant de faire** : les fantômes
 * sous le curseur, et la réponse à « la sixième copie sort-elle de la
 * parcelle ? », qu'il faut pouvoir donner alors qu'aucune des six n'existe
 * encore. La calculer ici plutôt que chez l'appelant évite qu'un fantôme soit
 * dessiné à un endroit et la copie posée à un autre.
 */
export interface RepeatPlacement {
  /** Le rang de la copie : 1 pour la première, celle qu'on a cliquée. */
  readonly rank: number;
  /** Ce qui sépare cette copie de l'original, et que la duplication porte. */
  readonly offsetMm: Point2D;
  readonly bounds: PlanBounds;
}

/** Ce qu'une répétition rend : des copies à venir, ou pourquoi non. */
export type RepeatOutcome =
  | { readonly status: 'OK'; readonly placements: readonly RepeatPlacement[] }
  | ArrangementRefusal;

/**
 * Où se posent les copies d'un objet répété d'un pas constant.
 *
 * **Rien n'est créé ici, et c'est le point.** Recopier un mur et l'ouverture
 * qu'il porte, c'est mettre l'ouverture dans le mur copié ; recopier un
 * composant, c'est le reposer sur le support copié quand il y en a un ;
 * recopier une parcelle, c'est refuser, parce qu'un terrain n'en a qu'une.
 * Ces règles-là sont écrites, une par famille, dans les `DuplicateProvider`
 * d'`object-transform.ts`. Les redire ici ferait une **seconde** duplication,
 * plus jeune et moins complète, qui divergerait de la première au premier
 * champ ajouté au modèle — et c'est exactement la sorte de double vérité que
 * ce dépôt refuse ailleurs. Cette fonction ne répond donc qu'à « où ? », et
 * l'appelant demande « quoi ? » à qui le sait déjà.
 *
 * Le pas est un vecteur et non une distance et un angle : il se lit sur le
 * plan comme la différence entre l'objet désigné et l'endroit où l'on pose la
 * première copie. Un pas qu'on taperait en aveugle serait un pas qu'on a
 * calculé soi-même, ce qui est précisément le travail dont on cherche à
 * dispenser.
 *
 * Le rang multiplie le pas : la copie `k` est à `k × pas` de l'original, et
 * non à un pas de la copie `k-1`. La différence ne se voit pas sur trois
 * copies et se voit sur douze — additionner douze fois un nombre à virgule
 * accumule douze arrondis, alors qu'une multiplication n'en fait qu'un.
 */
export function repeatPlacements(
  source: ArrangedObject,
  stepMm: Point2D,
  count: number,
): RepeatOutcome {
  if (!measurable(source.bounds))
    return refused(
      'Cet objet ne se mesure pas sur le plan : sans emprise, on ne peut ni montrer les copies avant de les poser, ni dire si l’une d’elles sort de la parcelle.',
    );
  if (!Number.isFinite(stepMm.x) || !Number.isFinite(stepMm.y))
    return refused(
      'Le pas n’est pas mesurable : désignez l’objet, puis cliquez où se pose la première copie.',
    );
  if (!Number.isInteger(count) || count < 1)
    return refused(
      `Le nombre de copies doit être un entier positif : ${count} n’en est pas un.`,
    );
  /*
   * Un pas nul empilerait les copies sur l'original.
   *
   * On mesure la longueur du pas et non chacune de ses composantes : répéter
   * verticalement a un pas dont l'abscisse est nulle, et ce pas-là est bon.
   * Le seuil est celui du module — un millième de millimètre, plus fin que
   * tout ce que le modèle porte — parce que deux clics au même pixel donnent
   * un pas nul à la virgule près, jamais un zéro exact.
   */
  if (Math.hypot(stepMm.x, stepMm.y) < SAME_PLACE_MM)
    return refused(
      'Un pas nul poserait toutes les copies sur l’original : cliquez où se pose la première copie, à distance de l’objet répété.',
    );
  const placements = Array.from({ length: count }, (_unused, index) => {
    const rank = index + 1;
    const offsetMm = { x: stepMm.x * rank, y: stepMm.y * rank };
    return {
      rank,
      offsetMm,
      bounds: {
        min: {
          x: source.bounds.min.x + offsetMm.x,
          y: source.bounds.min.y + offsetMm.y,
        },
        max: {
          x: source.bounds.max.x + offsetMm.x,
          y: source.bounds.max.y + offsetMm.y,
        },
      },
    };
  });
  return { status: 'OK', placements };
}
