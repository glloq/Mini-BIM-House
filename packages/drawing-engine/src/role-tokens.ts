import type { GraphicStyleRule, SemanticRole } from './scene.js';

/**
 * Every semantic role a scene may carry.
 *
 * Stated once, so a charter that forgets one is rejected when it is written
 * rather than when a drawing happens to contain it.
 */
export const SEMANTIC_ROLES: readonly SemanticRole[] = [
  'SITE',
  'SPACE_FILL',
  'WALL_CUT',
  'WALL_LAYER_STRUCTURE',
  'WALL_LAYER_INSULATION',
  'WALL_LAYER_FINISH',
  'WALL_LAYER_OTHER',
  'WALL_BELOW',
  'OPENING',
  'OPENING_REVEAL',
  'NETWORK',
  'WATER_COLD',
  'WATER_HOT',
  'WATER_RECIRCULATION',
  'WATER_NON_POTABLE',
  'VENT_SUPPLY',
  'VENT_EXHAUST',
  'VENT_TRANSFER',
  'ELECTRICAL_POWER',
  'ELECTRICAL_LIGHTING',
  'ELECTRICAL_CONTROL',
  'ELECTRICAL_PV',
  'SYMBOL',
  'ANNOTATION',
  'DIMENSION',
  'ANALYSIS',
  'ANALYSIS_LOW',
  'ANALYSIS_MEDIUM',
  'ANALYSIS_HIGH',
  'ANALYSIS_UNKNOWN',
];

/**
 * Les rôles graphiques : ce qu'un dessin **est**, quand le rôle sémantique du
 * modèle n'en dit pas assez pour le dessiner.
 *
 * Le modèle ne connaît qu'un rôle `SITE`, et le sol de la parcelle comme sa
 * limite le portent tous les deux. Une charte n'avait donc aucun moyen de dire
 * « le sol est un lavis vert et la limite un trait vert foncé » : les deux
 * arrivaient au même jeton, et la seule façon d'obtenir une couleur était
 * d'en écrire une dans le composant qui affiche le plan — c'est-à-dire hors
 * de la charte, hors de l'impression, et hors de tout ce qui se relit.
 *
 * Un rôle graphique est donc un nom, une **condition** qui le reconnaît dans
 * la scène, et un jeton. Les trois vivent ici, et pas dans une charte : deux
 * chartes dessinent la parcelle différemment, elles ne la renomment pas. Toute
 * charte doit savoir dessiner chacun d'eux — `validateGraphicProfileBundle` le
 * refuse sinon —, ce qui fait qu'un rôle ajouté ici est un rôle qu'aucun
 * dessin ne peut rencontrer sans style.
 */
export const GRAPHIC_ROLES = ['SITE_PARCEL', 'SITE_PARCEL_BOUNDARY'] as const;
export type GraphicRole = (typeof GRAPHIC_ROLES)[number];

export interface GraphicRoleDefinition {
  readonly role: GraphicRole;
  /** Le jeton que toute charte doit savoir dessiner pour ce rôle. */
  readonly token: string;
  /** Ce qui, dans la scène, fait qu'un dessin porte ce rôle. */
  readonly match: GraphicStyleRule['match'];
}

/**
 * Les rôles graphiques que cette version connaît, avec ce qui les reconnaît.
 *
 * `SITE_PARCEL` est le **sol** : la surface de la parcelle, un lavis posé sous
 * tout le reste. La vue le marque `ground` parce qu'il est dessiné à part du
 * contour — la sélection remplit ce qu'elle prend, et une parcelle dont le
 * contour porterait le fond deviendrait un aplat sur toute la feuille.
 *
 * `SITE_PARCEL_BOUNDARY` est la **limite** : ce qui borne le sol. Les emprises
 * — un arbre, une haie, la maison du voisin — la portent aussi, parce que le
 * modèle ne les distingue pas du bornage dans la scène et qu'elles répondent à
 * la même question : jusqu'où va le terrain. Elles étaient déjà dessinées
 * comme lui ; ce qui change est qu'on peut maintenant le dire.
 */
export const GRAPHIC_ROLE_DEFINITIONS: readonly GraphicRoleDefinition[] = [
  {
    role: 'SITE_PARCEL',
    token: 'site-parcel',
    match: { semanticRole: 'SITE', metadata: { ground: true } },
  },
  {
    role: 'SITE_PARCEL_BOUNDARY',
    token: 'site-parcel-boundary',
    match: { semanticRole: 'SITE' },
  },
];

/** Le jeton de chaque rôle graphique, cherché par son nom. */
export const GRAPHIC_ROLE_TOKENS: Readonly<Record<GraphicRole, string>> =
  Object.fromEntries(
    GRAPHIC_ROLE_DEFINITIONS.map(({ role, token }) => [role, token]),
  ) as Record<GraphicRole, string>;

/**
 * Les règles qui font exister les rôles graphiques dans une charte.
 *
 * Elles sont les mêmes pour toutes : c'est la définition du rôle, pas un choix
 * de dessin. Ce que chaque charte choisit est le **style** du jeton, et rien
 * d'autre.
 */
export const GRAPHIC_ROLE_RULES: readonly GraphicStyleRule[] =
  GRAPHIC_ROLE_DEFINITIONS.map(({ match, token }) => ({ match, token }));

/**
 * The token each role falls back to when no rule of the charter is more
 * precise. Names are shared across charters on purpose: two profiles style
 * the same `wall-cut` differently, they do not rename it.
 */
export const DEFAULT_ROLE_TOKENS: Readonly<Record<SemanticRole, string>> = {
  // Un dessin de terrain qu'aucune règle ne reconnaît est une limite : c'est
  // ce que le rôle `SITE` veut dire quand il ne dit rien de plus.
  SITE: GRAPHIC_ROLE_TOKENS.SITE_PARCEL_BOUNDARY,
  SPACE_FILL: 'space-fill',
  WALL_CUT: 'wall-cut',
  WALL_LAYER_STRUCTURE: 'wall-layer-structure',
  WALL_LAYER_INSULATION: 'wall-layer-insulation',
  WALL_LAYER_FINISH: 'wall-layer-finish',
  WALL_LAYER_OTHER: 'wall-layer-other',
  WALL_BELOW: 'wall-below',
  OPENING: 'opening',
  OPENING_REVEAL: 'opening-reveal',
  NETWORK: 'network',
  WATER_COLD: 'water-cold',
  WATER_HOT: 'water-hot',
  WATER_RECIRCULATION: 'water-recirculation',
  WATER_NON_POTABLE: 'water-non-potable',
  VENT_SUPPLY: 'vent-supply',
  VENT_EXHAUST: 'vent-exhaust',
  VENT_TRANSFER: 'vent-transfer',
  ELECTRICAL_POWER: 'electrical-power',
  ELECTRICAL_LIGHTING: 'electrical-lighting',
  ELECTRICAL_CONTROL: 'electrical-control',
  ELECTRICAL_PV: 'electrical-pv',
  SYMBOL: 'symbol',
  ANNOTATION: 'annotation',
  DIMENSION: 'dimension',
  ANALYSIS: 'analysis',
  ANALYSIS_LOW: 'analysis-low',
  ANALYSIS_MEDIUM: 'analysis-medium',
  ANALYSIS_HIGH: 'analysis-high',
  ANALYSIS_UNKNOWN: 'analysis-unknown',
};

/**
 * Les espaces de création, vus du moteur graphique.
 *
 * Les mêmes sept que `CreationStageId` dans la coque, écrits une seconde fois
 * exprès : le moteur graphique ne dépend pas de l'application, et il ne le
 * fera pas pour une liste de sept mots. La duplication est tenue par un test
 * qui compare les deux listes — si un huitième espace apparaissait un jour, il
 * échouerait avant que le dessin ne fasse semblant de le connaître.
 */
export const DRAWING_SPACES = [
  'PROJECT',
  'SITE',
  'BUILDING',
  'FITTING',
  'SYSTEMS',
  'CHECKS',
  'DOCUMENTS',
] as const;
export type DrawingSpaceId = (typeof DRAWING_SPACES)[number];

/** Le calque des objets posés : c'est lui qui porte leur catégorie. */
export const PLACED_COMPONENT_LAYER = 'components.placed';

/**
 * L'espace dont relève ce qu'un rôle sémantique dessine.
 *
 * C'est la table de `ux/ownership.ts` regardée depuis le dessin : la parcelle
 * au Terrain, les murs et les pièces au Bâtiment, les réseaux aux Systèmes.
 * Elle existe pour que ce qui **est modifiable ici** et ce qui **se voit
 * comme actif ici** ne puissent pas diverger : ce sont les deux moitiés d'une
 * seule règle, et elles étaient tenues par un seul côté.
 *
 * `undefined` veut dire « partout », exactement comme là-bas. Une cote, une
 * annotation et un résultat d'analyse sont dits **sur** le dessin : les
 * estomper selon l'espace ouvert reviendrait à masquer le constat qu'on est
 * venu lire.
 *
 * `ANALYSIS_MEDIUM` en fait partie alors que la vue s'en sert aussi pour un
 * radiateur : un jeton d'analyse est partagé par les deux, et griser les
 * cartes thermiques pour distinguer un radiateur serait payer très cher une
 * distinction que la catégorie de l'objet posé donne déjà.
 */
export const SPACE_OF_SEMANTIC_ROLE: Readonly<
  Record<SemanticRole, DrawingSpaceId | undefined>
> = {
  SITE: 'SITE',

  SPACE_FILL: 'BUILDING',
  WALL_CUT: 'BUILDING',
  WALL_LAYER_STRUCTURE: 'BUILDING',
  WALL_LAYER_INSULATION: 'BUILDING',
  WALL_LAYER_FINISH: 'BUILDING',
  WALL_LAYER_OTHER: 'BUILDING',
  WALL_BELOW: 'BUILDING',
  OPENING: 'BUILDING',
  OPENING_REVEAL: 'BUILDING',

  NETWORK: 'SYSTEMS',
  WATER_COLD: 'SYSTEMS',
  WATER_HOT: 'SYSTEMS',
  WATER_RECIRCULATION: 'SYSTEMS',
  WATER_NON_POTABLE: 'SYSTEMS',
  VENT_SUPPLY: 'SYSTEMS',
  VENT_EXHAUST: 'SYSTEMS',
  VENT_TRANSFER: 'SYSTEMS',
  ELECTRICAL_POWER: 'SYSTEMS',
  ELECTRICAL_LIGHTING: 'SYSTEMS',
  ELECTRICAL_CONTROL: 'SYSTEMS',
  ELECTRICAL_PV: 'SYSTEMS',

  // Le rôle de repli d'une chose posée qui n'appartient à aucun métier : un
  // lit, un plan de travail, une machine à laver.
  SYMBOL: 'FITTING',

  ANNOTATION: undefined,
  DIMENSION: undefined,
  ANALYSIS: undefined,
  ANALYSIS_LOW: undefined,
  ANALYSIS_MEDIUM: undefined,
  ANALYSIS_HIGH: undefined,
  ANALYSIS_UNKNOWN: undefined,
};

/**
 * L'espace dont relève un objet posé, par ce qu'il est.
 *
 * La même ligne de partage que `ux/ownership.ts` : ce qu'on installe et qui
 * marche tout seul est de l'aménagement, ce qui est raccordé et dimensionné
 * est des systèmes. Elle est refaite ici parce que le rôle sémantique ment sur
 * ce point — un lavabo est dessiné `WATER_COLD` alors qu'il se pose à
 * l'Aménagement — et que c'est la catégorie, pas le rôle, qui tranche.
 */
const SPACE_OF_COMPONENT_CATEGORY: Readonly<
  Record<string, DrawingSpaceId | undefined>
> = {
  FURNITURE: 'FITTING',
  SANITARY: 'FITTING',
  APPLIANCE: 'FITTING',
  OTHER: undefined,

  HEATING: 'SYSTEMS',
  VENTILATION: 'SYSTEMS',
  ELECTRICAL: 'SYSTEMS',
  LIGHTING: 'SYSTEMS',
  PHOTOVOLTAIC: 'SYSTEMS',
};

/** Une valeur ou une liste de valeurs, lues comme une liste. */
function values<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

/**
 * L'espace sur lequel plusieurs valeurs s'accordent, ou aucun.
 *
 * Une règle qui vise à la fois du mobilier et une chaudière ne relève d'aucun
 * espace en particulier, et se dessine donc toujours pleinement : mieux vaut
 * ne rien estomper que d'estomper la moitié qu'on cherchait.
 */
function agreed(
  spaces: readonly (DrawingSpaceId | undefined)[],
): DrawingSpaceId | undefined {
  const [first] = spaces;
  return spaces.length > 0 && spaces.every((space) => space === first)
    ? first
    : undefined;
}

/**
 * L'espace de création dont relève ce dessin, ou `undefined` s'il relève de
 * tous.
 *
 * Prend aussi bien une primitive de la scène que la condition d'une règle de
 * charte : les deux disent la même chose — un rôle, un calque, des métadonnées
 * — et la question « à qui est-ce ? » doit recevoir la même réponse des deux
 * côtés, sans quoi un jeton serait estompé et son dessin non.
 *
 * La catégorie ne parle que sur le calque des objets posés. Une pièce porte
 * elle aussi une `category` — `BEDROOM`, `GARAGE` —, et la lire partout aurait
 * rangé une chambre parmi les objets qu'aucun métier ne revendique.
 */
export function drawingSpaceOf(
  subject: GraphicStyleRule['match'],
): DrawingSpaceId | undefined {
  const layers = values(subject.layer);
  if (
    layers.length > 0 &&
    layers.every((layer) => layer === PLACED_COMPONENT_LAYER)
  ) {
    const categories = values(subject.metadata?.['category']);
    if (categories.length > 0)
      return agreed(
        categories.map((category) =>
          typeof category === 'string'
            ? SPACE_OF_COMPONENT_CATEGORY[category]
            : undefined,
        ),
      );
  }
  return agreed(
    values(subject.semanticRole).map((role) => SPACE_OF_SEMANTIC_ROLE[role]),
  );
}
