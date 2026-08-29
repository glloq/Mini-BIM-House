/**
 * Relier un appareil posé au réseau qui le dessert, par intention.
 *
 * Brancher un lavabo sur l'évacuation se faisait comme on trace un mur :
 * prendre l'outil « Réseau » pour poser un nœud (armer l'outil, choisir le
 * réseau, choisir le type de nœud, cliquer l'endroit — quatre gestes), puis
 * « Dériver » parce qu'aucun port n'est libre (armer, cliquer le tronçon —
 * deux gestes), puis « Tracer un tronçon » (armer, choisir le réseau, cliquer
 * le départ, cliquer le coude, cliquer l'arrivée — cinq gestes). Onze gestes,
 * trois entrées d'historique, et un nœud qui porte les ports du **gabarit de
 * la discipline** et non ceux de la fiche : le WC de la maison de référence y
 * gagnait une évacuation d'eaux usées là où sa fiche déclare des eaux-vannes.
 *
 * L'application sait pourtant déjà tout ce qu'il faut. La fiche dit par quoi
 * l'appareil se raccorde (`ResolvedPlacedEquipment.ports`, et le registre des
 * genres de port derrière), le projet tient ses réseaux, leurs nœuds et leurs
 * tracés, et `editor-core` sait tracer. Ce qui manquait était la phrase :
 * « relie ceci à son réseau ».
 *
 * ## Ce que ce module n'écrit pas
 *
 * Rien de ce qui existe. Le nœud est ajouté par `AddNetworkNodeCommand`, ses
 * ports par `portsOfPlacedEquipment` — écrite pour ça et que personne
 * n'appelait —, la dérivation par `branchCommand`, et le tracé par
 * `routeCommand`, qui tient déjà `routeThrough` et `slopedRoute`. Il n'y a
 * donc **aucune seconde façon de créer un tronçon** ici : ce module choisit où
 * se raccorder et laisse les commandes existantes faire le reste.
 *
 * La proposition est calculée sur le projet **tel qu'il sera** : chaque
 * commande est exécutée à blanc (`execute(project).nextState`, qui est pur) et
 * la suivante est construite sur le résultat. C'est ce qui permet de demander à
 * `routeCommand` un tracé vers un port qui n'existe pas encore, sans lui mentir
 * et sans réécrire ce qu'elle sait faire.
 *
 * ## Le point d'arrivée : trois façons de rejoindre un réseau
 *
 * Mesuré sur la maison de référence, dont les quatre réseaux n'ont **aucun
 * port libre** : sans dérivation, aucun appareil n'est raccordable. Les trois
 * points d'accroche possibles sont donc, dans l'ordre où ils se présentent :
 *
 * - un **port libre** compatible, quand il en reste un ;
 * - un **nœud qui reçoit et distribue** — nourrice, regard, circuit, piquage —
 *   qui gagne un port de plus. Un terminal (point de puisage, luminaire,
 *   bouche) ne dessert qu'une chose et n'en accepte pas une seconde : le
 *   critère est celui que `branchingTemplate` applique déjà ;
 * - un **tronçon existant**, dérivé là où il passe le plus près.
 *
 * Le troisième gagne vingt-cinq fois sur trente sur la maison de référence, et
 * fait tomber la distance médiane au point d'accroche de 6,7 m à 1,4 m : c'est
 * la différence entre « raccorder au collecteur, à l'autre bout de la maison »
 * et « se piquer sur la colonne qui passe derrière ».
 *
 * ## Ce qu'il ne fait pas, et pourquoi
 *
 * Le tracé est orthogonal et tourne une fois — c'est la convention
 * d'`orthogonalRoute`, et un réseau se tire à angle droit. Il n'évite aucun
 * obstacle : s'il traverse un mur, il le traverse, et c'est à l'utilisateur de
 * déplacer les coudes ensuite (les poignées de tracé existent). Un moteur de
 * cheminement est un chantier à lui seul et n'a pas sa place dans un geste.
 *
 * ## Un refus se dit
 *
 * Comme dans `arrangement.ts`, chaque fonction rend soit sa proposition, soit
 * une phrase française qui nomme la cause. « Aucun réseau de chauffage dans ce
 * projet : créez-le d'abord » se lit ; un bouton gris muet se lit comme une
 * panne.
 */
import type {
  NetworkNode,
  NetworkPort,
  Project,
  ResolvedPlacedEquipment,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import {
  placedEquipment,
  portsConnectable,
} from '@house-technical-designer/core-domain';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  AddNetworkNodeCommand,
  AddNetworkPortCommand,
  ConnectNetworkPortsCommand,
  NETWORK_DISCIPLINE_LABELS,
  ProjectTransactionCommand,
  findNetwork,
  nearestPointOnRoute,
  networkNodeTemplates,
  openPorts,
  orthogonalRoute,
  portsOfPlacedEquipment,
  routeFall,
  systemPortType,
} from '@house-technical-designer/editor-core';
import { boundingBox2D } from '@house-technical-designer/geometry';
import type { Point2D, Point3D } from '@house-technical-designer/geometry';
import {
  DATA_DOMAIN_LABELS,
  portType,
} from '@house-technical-designer/technical-types';

import { branchCommand, routeCommand } from './network-model.js';

/* ------------------------------------------------------------------ */
/* Ce que le module rend                                              */
/* ------------------------------------------------------------------ */

/** Un raccordement que la fiche de l'appareil déclare. */
export interface DeclaredConnection {
  /** L'identifiant du port sur la fiche : `drain`, `cold`, `power`. */
  readonly portId: string;
  readonly portTypeId: string;
  /** Ce que le registre en dit : « Évacuation », « Eau froide ». */
  readonly label: string;
}

/** Un réseau du projet capable d'accueillir cet appareil, et ce qu'il raccorde. */
export interface ConnectableNetwork {
  readonly networkId: string;
  /** « Eaux usées », « Électricité » — pour que le refus et l'infobulle parlent. */
  readonly disciplineLabel: string;
  /** Les raccordements de la fiche que ce réseau-là dessert. */
  readonly connections: readonly DeclaredConnection[];
}

/** Un raccordement déclaré qu'aucun réseau du projet ne dessert, et pourquoi. */
export interface UnservedConnection extends DeclaredConnection {
  readonly message: string;
}

/**
 * Ce que « quels réseaux peuvent accueillir cet objet » rend.
 *
 * Deux issues, comme partout ailleurs. Le refus couvre les deux cas où il n'y
 * a rien à proposer : l'objet ne déclare aucun raccordement, ou aucun réseau du
 * projet ne dessert ceux qu'il déclare. Rendre une liste vide aurait été un
 * succès silencieux, et un appelant qui n'affiche rien se lit comme une panne.
 */
export type ConnectableOutcome =
  | {
      readonly status: 'OK';
      readonly networks: readonly ConnectableNetwork[];
      /**
       * Ce que le projet ne sait pas encore desservir.
       *
       * Rendu à côté du succès plutôt qu'en travers de lui : la terre d'une
       * prise n'a pas de réseau dans la maison de référence, et refuser
       * d'alimenter la prise pour autant aurait grisé le bouton sur presque
       * tout. L'appelant a de quoi le dire ; il n'a pas à s'y arrêter.
       */
      readonly unserved: readonly UnservedConnection[];
    }
  | { readonly status: 'REFUSED'; readonly message: string };

/** Un tronçon de la proposition : d'un port de l'appareil vers le réseau. */
export interface ProposedRun {
  /** Le port de la fiche d'où l'on part. */
  readonly portId: string;
  /** Le port du réseau qu'on rejoint, une fois la proposition appliquée. */
  readonly toPortId: string;
  /** Ce qu'on rejoint, dit en français : « le tronçon … », « la nourrice … ». */
  readonly arrival: string;
  /** Le tracé effectivement porté par le tronçon créé, coudes compris. */
  readonly path: readonly Point3D[];
  /** Sa longueur développée, en millimètres. */
  readonly lengthMm: number;
  /** Sa pente, quand il en a une — une évacuation gravitaire en a une. */
  readonly slopePercent?: number;
}

/** Le raccordement complet d'un appareil à un réseau, prêt à être exécuté. */
export interface ConnectionProposal {
  readonly status: 'OK';
  readonly networkId: string;
  /** Le nœud qui va représenter l'appareil, là où il se trouve sur le plan. */
  readonly from: Point3D;
  readonly runs: readonly ProposedRun[];
  readonly totalLengthMm: number;
  /**
   * Tout le raccordement en **une seule** entrée d'historique.
   *
   * Poser le nœud, dériver le tronçon, ajouter le port d'arrivée et tracer :
   * quatre écritures pour un geste. Annuler un branchement ne doit pas demander
   * quatre annulations — l'historique dit ce qu'on a demandé, pas comment ça
   * s'est trouvé exécuté.
   */
  readonly command: ProjectCommand;
}

export type ProposalOutcome =
  ConnectionProposal | { readonly status: 'REFUSED'; readonly message: string };

const refused = (message: string): { status: 'REFUSED'; message: string } => ({
  status: 'REFUSED',
  message,
});

/* ------------------------------------------------------------------ */
/* Le français, qui a des élisions                                     */
/* ------------------------------------------------------------------ */

/**
 * « de chauffage », mais « d'évacuation ».
 *
 * Une phrase construite par concaténation sans cette règle donne « Aucun
 * réseau de évacuation », qui dit à qui la lit que personne ne l'a lue.
 */
function of(label: string): string {
  const word = label.toLocaleLowerCase('fr');
  return /^[aeiouyéèêàâîïôûüh]/.test(word) ? `d’${word}` : `de ${word}`;
}

/** Une longueur dite comme une phrase la dit, pas comme le modèle la stocke. */
function metres(millimetres: number): string {
  return `${(millimetres / 1000).toFixed(1).replace('.', ',')} m`;
}

/* ------------------------------------------------------------------ */
/* Ce que la fiche déclare                                             */
/* ------------------------------------------------------------------ */

/** L'appareil posé que cet identifiant désigne, sur le niveau regardé. */
function placedOne(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): ResolvedPlacedEquipment | undefined {
  return placedEquipment(project).find(
    (one) =>
      one.instanceId === objectId &&
      (levelId === undefined || one.levelId === levelId),
  );
}

/**
 * Les raccordements que la fiche déclare, et que le registre reconnaît.
 *
 * Un port sans genre déclaré, ou dont le genre n'est pas au registre, n'est pas
 * un raccordement : rien ne dirait à quoi le relier, et le modèle refuse déjà
 * les liaisons qu'on ne peut pas juger. Il est écarté ici plutôt que proposé
 * puis refusé deux clics plus loin.
 */
function portsDeclaredBy(
  placed: ResolvedPlacedEquipment,
): readonly DeclaredConnection[] {
  return placed.ports.flatMap((port) => {
    if (port.portTypeId === undefined) return [];
    const kind = portType(port.portTypeId);
    if (kind === undefined) return [];
    return [
      { portId: port.id, portTypeId: port.portTypeId, label: kind.label },
    ];
  });
}

/**
 * Les raccordements que cet objet déclare, quand c'est un appareil posé.
 *
 * La question que se pose l'affichage avant toute autre : cette action
 * parle-t-elle de cet objet-là ? Un mur, une pièce, une toiture n'ont pas de
 * port ; un appareil dont la fiche n'en déclare aucun non plus. Rendre une
 * liste vide suffit ici — il n'y a pas de refus à dire tant que personne n'a
 * demandé à raccorder quoi que ce soit.
 */
export function declaredConnections(
  project: Project,
  objectId: string,
  levelId?: string,
): readonly DeclaredConnection[] {
  const placed = placedOne(project, levelId, objectId);
  return placed === undefined ? [] : portsDeclaredBy(placed);
}

/**
 * Où l'appareil offre ce raccordement-là, sur le plan.
 *
 * La fiche donne un décalage depuis l'**origine de l'appareil** — le point que
 * `placed.position` situe, centre de l'emprise en plan et dessous en hauteur —
 * et une lecture est donc une addition : un radiateur part et revient à 480 mm
 * de part et d'autre de son axe, 20 mm au-dessus de son dessous, et un ballon
 * prend son eau froide à 10 mm et la rend à 1 490. Le repère est écrit sur
 * `EquipmentPortDefinition.position`, et vérifié fiche par fiche : rien ici
 * n'a besoin des dimensions de l'appareil pour placer un raccordement.
 *
 * Ce décalage est celui du **modèle**, le même pour les huit exemplaires posés.
 * Il ne peut donc pas savoir comment celui-ci est tourné : `rotationDeg` lui
 * est appliqué ici.
 *
 * La rotation est appliquée, et c'est un choix. Un radiateur retourné contre le
 * mur d'en face a bien son départ à gauche et non plus à droite, et 960 mm
 * séparent les deux hypothèses — soit, sur une évacuation, deux coudes et un
 * mètre de tuyau qui n'existe pas. Elle tourne autour de la verticale, comme
 * partout ailleurs dans ce dépôt (`componentGhostOutline` écrit la même
 * matrice) : la hauteur du raccordement, elle, ne dépend pas de l'orientation.
 *
 * Le résultat est arrondi au millimètre parce que les cotes de ce modèle sont
 * des millimètres entiers : un demi-tour exact vaut cos = −1 et sin = 1,2·10⁻¹⁶,
 * et ce sinus-là s'écrirait tel quel dans le fichier du projet.
 */
function portPlace(placed: ResolvedPlacedEquipment, portId: string): Point3D {
  const offset = placed.ports.find(({ id }) => id === portId)?.position;
  // Une fiche qui ne situe pas son raccordement ne se voit pas inventer un
  // décalage : l'appareil se raccorde alors là où il se tient, ce qui est
  // exactement ce que le geste faisait pour tout le monde.
  if (offset === undefined) return placed.position;
  const radians = (placed.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: Math.round(placed.position.x + offset.x * cos - offset.y * sin),
    y: Math.round(placed.position.y + offset.x * sin + offset.y * cos),
    z: Math.round(placed.position.z + offset.z),
  };
}

/**
 * Où le nœud de l'appareil se pose sur ce réseau-là.
 *
 * Un nœud porte une position et une seule, et il représente l'appareil sur
 * **un** réseau : c'est donc là où se trouvent les raccordements que ce
 * réseau-là dessert. Quand il n'y en a qu'un — une évacuation, une arrivée
 * d'eau, un fil d'alimentation, c'est le cas courant — le nœud se pose
 * exactement sur ce raccordement. Quand il y en a deux — l'arrivée et le départ
 * d'un tableau, le départ et le retour d'un radiateur — il se pose entre les
 * deux, ce qui redonne le centre de l'appareil quand ils sont symétriques,
 * comme ils le sont sur toutes les fiches de ce catalogue.
 *
 * Un nœud par raccordement aurait dit la vérité de plus près et aurait fait
 * deux nœuds pour un radiateur, que rien ne saurait ensuite recoller en un
 * appareil ; `componentId` ne nomme qu'un objet par nœud.
 */
function nodePlace(
  placed: ResolvedPlacedEquipment,
  connections: readonly DeclaredConnection[],
): Point3D {
  const places = connections.map(({ portId }) => portPlace(placed, portId));
  if (places.length === 0) return placed.position;
  const mean = (of: (place: Point3D) => number): number =>
    Math.round(
      places.reduce((total, place) => total + of(place), 0) / places.length,
    );
  return {
    x: mean(({ x }) => x),
    y: mean(({ y }) => y),
    z: mean(({ z }) => z),
  };
}

/**
 * Le port tel que le réseau le porterait, pour pouvoir le juger avant de le
 * créer.
 *
 * Construit exactement comme `portsOfPlacedEquipment` le construira — même
 * identifiant, même rôle, même sens — pour que ce que la compatibilité répond
 * ici soit ce qu'elle répondra une fois le nœud posé. Deux constructions
 * différentes du même port, c'est une proposition offerte et une liaison
 * refusée.
 */
function portOfObject(
  nodeId: string,
  connection: DeclaredConnection,
): NetworkPort {
  const kind = portType(connection.portTypeId)!;
  return {
    id: `${nodeId}-${connection.portId}`,
    nodeId,
    portTypeId: connection.portTypeId,
    role: kind.service,
    direction: kind.direction,
  };
}

/* ------------------------------------------------------------------ */
/* Où se raccorder                                                     */
/* ------------------------------------------------------------------ */

/**
 * Un nœud qui reçoit **et** distribue : le seul qui accepte un raccordement de
 * plus.
 *
 * Le critère est celui de `branchingTemplate` : une nourrice, un regard, un
 * circuit, un piquage sont faits pour desservir plusieurs choses ; un point de
 * puisage, un luminaire, une bouche d'extraction n'en desservent qu'une, et
 * leur greffer un second port en ferait un appareil qu'aucun catalogue ne
 * vend. Les gabarits le disent déjà, nœud par nœud.
 */
function fittingTemplate(network: TechnicalNetwork, node: NetworkNode) {
  const template = networkNodeTemplates(network.discipline).find(
    ({ kind }) => kind === node.kind,
  );
  if (template === undefined) return undefined;
  const receives = template.ports.some(({ direction }) => direction === 'IN');
  const distributes = template.ports.some(
    ({ direction }) => direction === 'OUT',
  );
  return receives && distributes ? template : undefined;
}

/**
 * Le genre du port qu'un nœud gagnerait de ce côté-là.
 *
 * Repris de ce que le nœud porte **déjà** dans ce sens, et seulement à défaut
 * du gabarit de la discipline. Ce n'était au départ qu'un contournement : la
 * table des genres donnait des eaux usées **séparées** à un réseau unitaire, si
 * bien que l'évacuation du WC — des eaux-vannes — était refusée par le regard
 * qui la reçoit pourtant déjà. Cette table dit maintenant ce qu'un réseau
 * unitaire porte, et les deux sources tombent d'accord sur ce regard-là.
 *
 * L'ordre reste celui-ci, et pour une meilleure raison que celle qui l'avait
 * fait écrire. La table dit ce que l'application **crée** par défaut pour un
 * type de système ; les ports d'un nœud disent ce que ce projet-ci a décidé.
 * Ce ne sont pas les mêmes autorités, et quand elles diffèrent c'est le projet
 * qui a raison :
 *
 * - un réseau unitaire dont la colonne reste séparative jusqu'au regard est un
 *   dessin courant, et c'est exactement ce que porte la maison de référence,
 *   dont les trois nœuds de colonne reçoivent des eaux usées et non de
 *   l'unitaire. En leur imposant le genre du système, on redéclarerait en
 *   silence le réseau de quelqu'un ;
 * - quatre lignes de la table nomment encore les deux faces d'un **appareil**
 *   plutôt que ce qu'un réseau transporte — `EXTRACT` en tête, dont la sortie
 *   est le rejet extérieur d'une VMC et non l'air que la gaine emporte. Sur le
 *   réseau de ventilation de cette maison, la table propose donc un genre qui
 *   ne se raccorde à aucune bouche ; ce que le nœud porte, si.
 *
 * Le gabarit reste le recours quand le nœud ne dit rien de ce côté-là : un nœud
 * qui n'a encore aucun port dans ce sens n'a rien à recopier.
 */
function slotPortType(
  network: TechnicalNetwork,
  node: NetworkNode,
  direction: 'IN' | 'OUT',
): string | undefined {
  const sibling = network.ports.find(
    (port) =>
      port.nodeId === node.id &&
      port.direction === direction &&
      port.portTypeId !== undefined,
  );
  return sibling?.portTypeId ?? systemPortType(network.systemType, direction);
}

/** Un port du réseau tel qu'il serait, pour juger avant de le créer. */
function candidatePort(
  id: string,
  nodeId: string,
  portTypeId: string,
  direction: 'IN' | 'OUT',
): NetworkPort | undefined {
  const kind = portType(portTypeId);
  if (kind === undefined) return undefined;
  return { id, nodeId, portTypeId, role: kind.service, direction };
}

/**
 * Un réseau qui s'écoule par gravité, où la hauteur décide de tout.
 *
 * Deux disciplines, et c'est la discipline qui le dit : ce qui coule dans une
 * évacuation ou une descente d'eaux pluviales n'est poussé par rien.
 */
function gravityFed(network: TechnicalNetwork): boolean {
  return (
    network.discipline === 'WASTEWATER' || network.discipline === 'RAINWATER'
  );
}

/**
 * La pente que ce projet demande à ses évacuations, en fraction.
 *
 * Aucun chiffre écrit ici : c'est `minimumSlope`, le réglage que le module de
 * calcul d'eaux usées porte déjà dans le projet — 0,01 sur la maison de
 * référence, soit un centimètre par mètre — et celui-là même dont ce module de
 * calcul se sert pour signaler les tronçons trop plats. Une seconde valeur
 * proposerait des tracés que la note de calcul refuserait ensuite.
 *
 * Zéro quand le projet ne le dit pas : on ne se donne alors aucune marge, ce
 * qui revient à ne proposer sur une colonne que ce qui descend franchement.
 */
function minimumDrainSlope(project: Project): number {
  const declared =
    project.calculationSettings?.['wastewater']?.settings['minimumSlope'];
  return typeof declared === 'number' &&
    Number.isFinite(declared) &&
    declared > 0
    ? declared
    : 0;
}

/** Les trois façons de rejoindre un réseau, une fois choisie la plus proche. */
type Attachment =
  | {
      readonly kind: 'OPEN_PORT';
      readonly at: Point3D;
      readonly portId: string;
      readonly arrival: string;
    }
  | {
      readonly kind: 'NODE_SLOT';
      readonly at: Point3D;
      readonly arrival: string;
      readonly port: NetworkPort;
    }
  | {
      readonly kind: 'EDGE_BRANCH';
      readonly at: Point3D;
      readonly arrival: string;
      readonly edgeId: string;
      /** De quel côté le piquage neuf regarde, ce que `branchCommand` demande. */
      readonly facing: 'IN' | 'OUT';
    };

/**
 * De combien le tracé s'éloigne pour rejoindre ce point d'accroche.
 *
 * Mesuré en distance de Manhattan et non à vol d'oiseau, parce que c'est
 * exactement la longueur qu'un tracé orthogonal à un coude parcourra : classer
 * les candidats sur une distance que le tracé ne suivra pas ferait choisir le
 * plus proche à l'œil et le plus long à parcourir.
 */
function reach(from: Point3D, to: Point3D): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

/**
 * La longueur développée que le tracé fera jusque-là, montée comprise.
 *
 * C'est sur elle que les points d'accroche se classent, et non sur la seule
 * distance en plan. `routeThrough` ajoute une jambe verticale dès que les deux
 * bouts ne sont pas à la même hauteur : classer sans elle, c'est appeler
 * « le plus proche » un circuit du premier étage 23 mm plus près en plan et
 * 3,6 m plus haut — ce qui est arrivé au ballon d'eau chaude, dont le câble
 * proposé mesurait alors 10,0 m au lieu de 7,5 m.
 *
 * La distance en plan garde son emploi ailleurs : une pente se compte sur le
 * parcours horizontal, et une jambe verticale n'a pas de pente.
 */
function span(from: Point3D, to: Point3D): number {
  return reach(from, to) + Math.abs(to.z - from.z);
}

/**
 * Deux points au même endroit, au millième de millimètre près.
 *
 * La même tolérance que le « déjà rangé » d'`arrangement.ts` : plus fine que
 * tout ce que le modèle porte — les cotes sont en millimètres entiers — et
 * assez large pour absorber l'interpolation qui projette un point sur un
 * segment.
 */
function samePlace(first: Point3D, second: Point3D): boolean {
  return (
    Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z) <
    1e-6
  );
}

/** Le nom de nœud tel qu'on le lit, pour dire ce qu'on rejoint. */
function nodeName(network: TechnicalNetwork, node: NetworkNode): string {
  const template = networkNodeTemplates(network.discipline).find(
    ({ kind }) => kind === node.kind,
  );
  return `${template?.label ?? node.kind} « ${node.id} »`;
}

/**
 * Tous les points d'accroche que ce réseau offre à ce port, du plus proche au
 * plus loin.
 *
 * Rendus triés plutôt que réduits au meilleur : l'appelant enchaîne les
 * raccordements d'un même appareil, et le tronçon qu'il vient de dériver n'est
 * plus le même — c'est le projet **projeté** qu'il interroge à chaque fois.
 * Le tri se fait sur la distance puis sur l'identifiant, pour que deux appels
 * sur le même projet rendent deux fois le même ordre.
 */
function attachments(
  network: TechnicalNetwork,
  mine: NetworkPort,
  from: Point3D,
  /*
   * Ce que la proposition en cours vient elle-même de poser.
   *
   * Sans cette exclusion, le second raccordement d'un appareil se piquait sur
   * le tronçon que le premier venait de tirer — le tableau électrique de la
   * maison de référence se dérivait sur son propre câble, à zéro millimètre.
   * Un appareil ne s'alimente pas lui-même : ce qu'on vient de créer n'est pas
   * un réseau à rejoindre.
   */
  ours: ReadonlySet<string> = new Set(),
  /*
   * La pente que ce réseau doit tenir, quand il s'écoule par gravité.
   *
   * `undefined` pour un réseau sous pression, où la hauteur du point d'accroche
   * ne décide de rien. Pour une évacuation elle décide de tout : un point
   * d'accroche plus haut que l'appareil n'en est pas un, et sur une colonne —
   * verticale, donc libre en hauteur — c'est elle qui dit à quelle hauteur se
   * piquer.
   */
  fall: number | undefined = undefined,
): readonly Attachment[] {
  const found: {
    readonly attachment: Attachment;
    readonly at: number;
    readonly key: string;
    /*
     * Vrai quand rien ne s'écoulerait vers ce point-là.
     *
     * Il reste candidat, et il passe seulement après tous les autres : c'est ce
     * qui permet au refus « rien ne s'écoule vers le haut » de continuer à se
     * dire quand **aucun** point d'accroche ne descend, plutôt que de devenir un
     * « plus rien n'accepte ce raccordement » qui ne nomme pas la cause.
     */
    readonly uphill: boolean;
  }[] = [];
  // Un réseau sous pression n'a pas de haut ni de bas : tout y est « en
  // descente », c'est-à-dire que la hauteur ne classe rien.
  const uphill = (at: Point3D): boolean => fall !== undefined && at.z >= from.z;
  const nodeAt = (nodeId: string) =>
    network.nodes.find(({ id }) => id === nodeId);
  const isOurs = (nodeId: string | undefined) =>
    nodeId !== undefined && ours.has(nodeId);
  const portNode = (portId: string) =>
    network.ports.find(({ id }) => id === portId)?.nodeId;

  for (const port of openPorts(network)) {
    if (isOurs(port.nodeId)) continue;
    if (!portsConnectable(mine, port)) continue;
    const node = nodeAt(port.nodeId);
    if (node === undefined) continue;
    found.push({
      attachment: {
        kind: 'OPEN_PORT',
        at: node.position,
        portId: port.id,
        arrival: `le raccordement libre de ${nodeName(network, node)}`,
      },
      at: span(from, node.position),
      key: port.id,
      uphill: uphill(node.position),
    });
  }

  for (const node of network.nodes) {
    if (isOurs(node.id)) continue;
    const template = fittingTemplate(network, node);
    if (template === undefined) continue;
    for (const direction of ['IN', 'OUT'] as const) {
      if (!template.ports.some((port) => port.direction === direction))
        continue;
      const portTypeId = slotPortType(network, node, direction);
      if (portTypeId === undefined) continue;
      // L'identifiant nomme le nœud, le sens et le raccordement desservi :
      // deux appareils reliés au même regard n'y écrivent pas le même port.
      const port = candidatePort(
        `${node.id}-${direction.toLowerCase()}-${mine.id}`,
        node.id,
        portTypeId,
        direction,
      );
      if (port === undefined || !portsConnectable(mine, port)) continue;
      found.push({
        attachment: {
          kind: 'NODE_SLOT',
          at: node.position,
          arrival: nodeName(network, node),
          port,
        },
        at: span(from, node.position),
        key: port.id,
        uphill: uphill(node.position),
      });
    }
  }

  /*
   * De quel côté le piquage de la dérivation regarde.
   *
   * `branchCommand` ne savait poser qu'un piquage **sortant** — ce qu'il faut
   * pour alimenter un appareil, et jamais pour recevoir ce qu'il évacue. Les
   * huit évacuations que ce module proposait allaient donc toutes au regard,
   * colonne de chute ou pas : la seule autre façon de rejoindre un réseau leur
   * était fermée. La commande demande maintenant son sens, et on le lui donne.
   *
   * Le piquage regarde à l'inverse du raccordement de l'appareil : ce qui
   * évacue veut une arrivée, ce qui consomme veut un départ. Quand le
   * raccordement de l'appareil ne tranche pas — une eau froide et un courant
   * alternatif sont bidirectionnels, le registre le dit —, on reste sur le
   * départ, qui est ce que le réseau distribue et ce que ce module faisait.
   */
  const facing: 'IN' | 'OUT' = mine.direction === 'OUT' ? 'IN' : 'OUT';
  const spareTypeId = systemPortType(network.systemType, facing);
  const spare =
    spareTypeId === undefined
      ? undefined
      : candidatePort('piquage', 'dérivation', spareTypeId, facing);
  if (spare !== undefined && portsConnectable(mine, spare))
    for (const edge of network.edges) {
      if (isOurs(portNode(edge.fromPortId)) || isOurs(portNode(edge.toPortId)))
        continue;
      /*
       * Où se piquer, et à quelle hauteur quand le tronçon en laisse le choix.
       *
       * En plan, l'endroit est celui du point le plus proche, comme toujours.
       * Un tronçon qui **monte tout droit** — une colonne de chute, une
       * descente d'eaux pluviales — est un point en plan : sa hauteur est alors
       * libre, et `nearestPointOnRoute` répondait l'extrémité par laquelle le
       * tracé a été saisi, c'est-à-dire la tête de colonne pour qui vise le
       * rez-de-chaussée.
       *
       * On lui demande donc la hauteur qu'il faut : celle de l'appareil, moins
       * ce que la pente coûte sur la distance en plan qui les sépare. Le `floor`
       * arrondit vers le bas, du côté où la pente obtenue est au moins celle
       * qu'on demande. Sur un tronçon horizontal la hauteur est imposée par le
       * tracé et cette demande ne change rien.
       */
      const inPlan = nearestPointOnRoute(edge.path, from);
      if (inPlan === undefined) continue;
      const at =
        fall === undefined
          ? inPlan
          : nearestPointOnRoute(
              edge.path,
              from,
              Math.floor(from.z - reach(from, inPlan) * fall),
            );
      if (at === undefined) continue;
      /*
       * Se dériver sur l'extrémité d'un tronçon, c'est ne pas s'y dériver.
       *
       * `branchCommand` coupe le tronçon en deux à l'endroit visé : visé sur
       * une extrémité, l'une des deux moitiés est longue de zéro, et le modèle
       * refuse un tracé qui n'a pas deux points distincts — à juste titre. Ce
       * qui est le plus proche là-bas n'est pas le tuyau, c'est le nœud qui le
       * termine, et il est déjà candidat s'il accepte quelque chose.
       */
      const ends = [edge.path[0], edge.path[edge.path.length - 1]];
      if (ends.some((end) => end !== undefined && samePlace(end, at))) continue;
      found.push({
        attachment: {
          kind: 'EDGE_BRANCH',
          at,
          arrival: `le tronçon « ${edge.id} »`,
          edgeId: edge.id,
          facing,
        },
        at: span(from, at),
        key: edge.id,
        uphill: uphill(at),
      });
    }

  return found
    .sort((first, second) => {
      if (first.uphill !== second.uphill) return first.uphill ? 1 : -1;
      return first.at === second.at
        ? first.key.localeCompare(second.key)
        : first.at - second.at;
    })
    .map(({ attachment }) => attachment);
}

/* ------------------------------------------------------------------ */
/* Quels réseaux peuvent accueillir cet objet                          */
/* ------------------------------------------------------------------ */

/**
 * Quels réseaux du projet peuvent accueillir cet objet, et ce que chacun
 * raccorde.
 *
 * Un lavabo a une arrivée d'eau **et** une évacuation : les deux réseaux sont
 * rendus, chacun avec le port de la fiche qu'il dessert. Un objet sans port
 * déclaré ne rend rien — et le dit.
 *
 * La question posée à chaque réseau n'est pas « est-ce le bon métier ? » mais
 * « existe-t-il là-dedans un endroit où ce port se raccorderait ? ». C'est la
 * seule qui ne se trompe pas : le réseau d'eau de la maison de référence est
 * en eau froide, et l'eau chaude d'un lavabo n'y a pas sa place bien qu'ils
 * soient tous deux de la plomberie.
 */
export function connectableNetworks(
  project: Project,
  objectId: string,
  levelId?: string,
): ConnectableOutcome {
  const placed = placedOne(project, levelId, objectId);
  if (placed === undefined)
    return refused(
      `Aucun appareil posé ne porte l’identifiant ${objectId} : il n’y a rien à raccorder.`,
    );
  const declared = portsDeclaredBy(placed);
  if (declared.length === 0)
    return refused(
      `${placed.name ?? objectId} ne déclare aucun raccordement : sa fiche ne dit par quoi il se relie.`,
    );

  const networks = project.systems ?? [];
  const served = new Map<string, DeclaredConnection[]>();
  const unserved: UnservedConnection[] = [];
  for (const connection of declared) {
    let placedSomewhere = false;
    for (const network of networks) {
      const mine = portOfObject(`${network.id}:${objectId}`, connection);
      // La position ne joue aucun rôle ici : on demande s'il **existe** un
      // point d'accroche, pas lequel. Le tri par distance est l'affaire de la
      // proposition, qui sait d'où l'on part.
      if (
        attachments(
          network,
          mine,
          placed.position,
          new Set<string>(),
          gravityFed(network) ? minimumDrainSlope(project) : undefined,
        ).length === 0
      )
        continue;
      placedSomewhere = true;
      const held = served.get(network.id);
      if (held === undefined) served.set(network.id, [connection]);
      else held.push(connection);
    }
    if (!placedSomewhere) {
      const domain = portType(connection.portTypeId)!.domain;
      unserved.push({
        ...connection,
        message: `Aucun réseau ${of(DATA_DOMAIN_LABELS[domain])} n’accueille « ${connection.label} » dans ce projet : créez-le d’abord.`,
      });
    }
  }

  if (served.size === 0)
    return refused(
      unserved[0]?.message ??
        `${placed.name ?? objectId} ne trouve aucun réseau à rejoindre dans ce projet.`,
    );

  return {
    status: 'OK',
    // L'ordre est celui des réseaux du projet, qui est celui du panneau : deux
    // affichages du même appareil listent ses raccordements dans le même ordre.
    networks: networks.flatMap((network) => {
      const connections = served.get(network.id);
      return connections === undefined
        ? []
        : [
            {
              networkId: network.id,
              disciplineLabel: NETWORK_DISCIPLINE_LABELS[network.discipline],
              connections,
            },
          ];
    }),
    unserved,
  };
}

/* ------------------------------------------------------------------ */
/* Jusqu'où un tracé reste une proposition                             */
/* ------------------------------------------------------------------ */

/**
 * Au-delà de quoi le tracé proposé n'est plus un raccordement mais une
 * traversée.
 *
 * Aucun seuil écrit ici : c'est la **diagonale du plan du bâti**, mesurée sur
 * le projet lui-même. Un tracé plus long que la diagonale de la maison repasse
 * forcément par où il vient de passer, et ce n'est plus « le réseau le plus
 * proche ». Une maison de trente mètres de long n'a donc pas à être jugée par
 * la nôtre.
 *
 * Sur la maison de référence, l'emprise fait 10,0 m sur 8,0 m, soit une
 * diagonale de 12,8 m ; les trente raccordements que ce module y propose
 * mesurent au plus 11,6 m et passent donc tous. Sans dérivation ils
 * atteignaient 13,8 m, c'est-à-dire précisément la traversée que le seuil
 * refuse.
 *
 * Un projet sans mur ne donne pas d'emprise : aucune longueur n'est alors
 * refusée, parce qu'un seuil inventé sur un plan vide refuserait le premier
 * tracé de la première maison.
 */
export function longestSensibleRunMm(project: Project): number {
  const corners = project.building.levels.flatMap((level) =>
    level.walls.flatMap(({ path }) => path.points),
  );
  const box = boundingBox2D(corners);
  return box === undefined
    ? Number.POSITIVE_INFINITY
    : Math.hypot(box.max.x - box.min.x, box.max.y - box.min.y);
}

/* ------------------------------------------------------------------ */
/* La proposition                                                      */
/* ------------------------------------------------------------------ */

/**
 * Le gabarit de nœud sous lequel cet appareil entre dans ce réseau.
 *
 * On prend celui que la discipline nomme comme l'appareil quand elle en a un —
 * un luminaire entre en `LUMINAIRE` —, sinon le premier gabarit qui n'est ni
 * une nourrice ni un regard et dont les sens correspondent à ceux de la fiche :
 * un appareil qui n'évacue que se range sous le gabarit qui ne fait qu'évacuer.
 */
function templateForObject(
  network: TechnicalNetwork,
  placed: ResolvedPlacedEquipment,
  connections: readonly DeclaredConnection[],
) {
  const templates = networkNodeTemplates(network.discipline);
  const named = templates.find(({ kind }) => kind === placed.kind);
  if (named !== undefined) return named;
  const facings = new Set(
    connections.map(({ portTypeId }) => portType(portTypeId)!.direction),
  );
  const matching = templates.find(
    (template) =>
      template.ports.length === 1 &&
      facings.has(template.ports[0]!.direction === 'IN' ? 'IN' : 'OUT'),
  );
  return matching ?? templates[templates.length - 1]!;
}

/**
 * La proposition complète : d'où l'on part, où l'on arrive, et par où.
 *
 * ## Où le nœud se pose
 *
 * Là où sont les raccordements que ce réseau dessert — `nodePlace` —, et non au
 * point où l'appareil se tient. La position de l'appareil est absolue (la
 * hauteur y est comptée depuis le sol du projet et non depuis le plancher de
 * l'étage, ce qu'il faut pour comparer deux niveaux) ; ce que la fiche ajoute
 * est le décalage de chaque port, que ce module ne pouvait pas lire.
 *
 * C'est la hauteur qui en dépendait. Un lavabo évacue plus bas qu'il ne se
 * tient : poser le nœud à l'appareil, c'est faire tomber le tuyau de toute
 * cette différence, et les pentes proposées sur cette maison allaient de 12 à
 * 35 % — un tuyau à la verticale — là où une évacuation se pose entre 1 et 3 %.
 *
 * Encore faut-il que la fiche compte depuis le même point que la pose. Elle
 * comptait depuis le centre de sa boîte englobante, personne ne l'ayant jamais
 * écrit : la sortie du WC de cette maison tombait donc 350 mm **sous** la
 * dalle, au radier du regard, et son raccordement était refusé — à juste titre.
 * Les fiches disent maintenant leurs raccordements depuis l'origine de
 * l'appareil, et le WC descend de 50 mm à 1 % sur 1,35 m.
 *
 * Un nœud par appareil et par réseau, donc, et il porte `componentId` : c'est
 * la seule façon pour une note de calcul de savoir **lequel** des trois
 * radiateurs identiques ce nœud alimente.
 */
export function connectionProposal(
  project: Project,
  levelId: string | undefined,
  objectId: string,
  networkId: string,
): ProposalOutcome {
  const placed = placedOne(project, levelId, objectId);
  if (placed === undefined)
    return refused(
      `Aucun appareil posé ne porte l’identifiant ${objectId} : il n’y a rien à raccorder.`,
    );
  const network = findNetwork(project, networkId);
  if (network === undefined)
    return refused(`Le réseau ${networkId} est introuvable.`);
  const discipline = NETWORK_DISCIPLINE_LABELS[network.discipline];

  const bound = network.nodes.find(
    ({ componentId }) => componentId === objectId,
  );
  if (bound !== undefined)
    return refused(
      `${placed.name ?? objectId} est déjà raccordé au réseau ${of(discipline)} : le nœud « ${bound.id} » le représente.`,
    );

  const outcome = connectableNetworks(project, objectId, levelId);
  if (outcome.status === 'REFUSED') return outcome;
  const connections =
    outcome.networks.find((one) => one.networkId === networkId)?.connections ??
    [];
  if (connections.length === 0)
    return refused(
      `Aucun raccordement de ${placed.name ?? objectId} ne trouve sa place sur le réseau ${of(discipline)}.`,
    );

  const nodeId = `${networkId}:${objectId}`;
  const ports = portsOfPlacedEquipment(nodeId, {
    // Seuls les raccordements que **ce** réseau dessert : poser sur
    // l'évacuation les ports d'eau du lavabo y ajouterait deux raccordements
    // que rien ne viendrait jamais atteindre, et le panneau les compterait
    // comme un réseau inachevé.
    ports: connections.map(({ portId, portTypeId }) => ({
      id: portId,
      portTypeId,
    })),
  });
  const position: Point3D = nodePlace(placed, connections);
  const node: NetworkNode = {
    id: nodeId,
    kind: templateForObject(network, placed, connections).kind,
    position,
    componentId: placed.instanceId,
    levelId: placed.levelId,
    ...(placed.spaceId === undefined ? {} : { spaceId: placed.spaceId }),
    ...(placed.definitionId === undefined
      ? {}
      : { equipmentId: placed.definitionId }),
  };
  const addNode = new AddNetworkNodeCommand(networkId, node, ports);
  const validation = addNode.validate(project);
  if (!validation.valid) return refused(validation.errors.join(' '));

  /*
   * À partir d'ici, on raisonne sur le projet **tel qu'il sera**.
   *
   * Chaque commande est exécutée à blanc et la suivante est construite sur le
   * résultat, ce qui permet de demander un tracé vers un port qui n'existe pas
   * encore. `execute` est pur — il rend un nouveau projet et ne touche pas
   * celui qu'on lui donne — donc rien n'est écrit avant que l'appelant ne
   * dispatche la transaction.
   */
  let projected = addNode.execute(project).nextState;
  const commands: ProjectCommand[] = [addNode];
  const runs: ProposedRun[] = [];
  const budgetMm = longestSensibleRunMm(project);
  const gravity = gravityFed(network);
  // La pente qu'une évacuation doit tenir, lue une fois : elle sert à choisir
  // où se piquer sur une colonne, puis à juger ce qu'on a obtenu.
  const drainSlope = gravity ? minimumDrainSlope(project) : undefined;
  // Ce que cette proposition a elle-même posé, et qui n'est donc pas un réseau
  // à rejoindre : le nœud de l'appareil, puis chaque pièce de dérivation.
  const ours = new Set<string>([nodeId]);
  let counter = 0;

  for (const connection of connections) {
    const current = findNetwork(projected, networkId)!;
    const mine = portOfObject(nodeId, connection);
    const chosen = attachments(current, mine, position, ours, drainSlope)[0];
    if (chosen === undefined)
      return refused(
        `Rien sur le réseau ${of(discipline)} n’accepte « ${connection.label} » : tous ses raccordements sont pris.`,
      );

    let toPortId: string;
    if (chosen.kind === 'OPEN_PORT') toPortId = chosen.portId;
    else if (chosen.kind === 'NODE_SLOT') {
      const addPort = new AddNetworkPortCommand(networkId, chosen.port);
      commands.push(addPort);
      projected = addPort.execute(projected).nextState;
      toPortId = chosen.port.id;
    } else {
      const fittingId = `${nodeId}:${connection.portId}-derivation`;
      const branch = branchCommand(projected, chosen.edgeId, chosen.at, {
        nodeId: fittingId,
        newId: (prefix) =>
          `${nodeId}:${connection.portId}-${prefix}-${(counter += 1)}`,
        // Ce qui évacue se pique en arrivée, ce qui consomme en départ : le
        // sens a été choisi en même temps que le point d'accroche, parce que
        // c'est lui qui décide si ce tronçon-là est un candidat.
        facing: chosen.facing,
      });
      if (branch.status === 'ERROR') return refused(branch.message);
      commands.push(branch.command);
      projected = branch.command.execute(projected).nextState;
      ours.add(fittingId);
      /*
       * Le piquage neuf est celui que la pièce de dérivation laisse **libre**.
       *
       * `branchCommand` recoud les deux moitiés du tronçon sur son entrée et sa
       * sortie et laisse un troisième port que rien n'atteint : c'est
       * exactement la définition d'`openPorts`, et le lire ainsi vaut mieux que
       * de recopier ici la façon dont la commande nomme ses ports — deux
       * orthographes du même identifiant, dont une fausse le jour où l'autre
       * change.
       */
      const spare = openPorts(findNetwork(projected, networkId)!).find(
        (port) => port.nodeId === fittingId && portsConnectable(mine, port),
      );
      if (spare === undefined)
        return refused(
          `La pièce de dérivation posée sur ${chosen.arrival} n’offre pas de piquage pour « ${connection.label} ».`,
        );
      toPortId = spare.id;
    }

    /*
     * Le nœud d'arrivée est relu sur le projet projeté, et non repris du
     * candidat : une dérivation vient d'en poser un que le candidat ne
     * connaissait pas, et c'est sa position — celle du point le plus proche
     * sur le tronçon — que le tracé doit viser.
     */
    const after = findNetwork(projected, networkId)!;
    const arrivalNode = after.nodes.find(
      ({ id }) =>
        id ===
        after.ports.find(({ id: portId }) => portId === toPortId)?.nodeId,
    );
    if (arrivalNode === undefined)
      return refused('Le point d’arrivée n’appartient à aucun nœud du réseau.');

    /*
     * Le tracé, et la pente qui en découle.
     *
     * Les coudes sont ceux d'`orthogonalRoute` — un réseau se tire à angle
     * droit, et la convention du dessin est écrite là et nulle part ailleurs.
     * `routeCommand` attend les clics d'un tracé et jette le premier et le
     * dernier, qui sont les deux ports : on lui rend donc la polyligne
     * entière, dont elle retire ce qu'elle sait déjà.
     *
     * Pour une évacuation gravitaire, la pente n'est pas un nombre choisi :
     * c'est la conséquence des deux hauteurs que le modèle porte déjà. On
     * demande donc un tracé **plat** — d'où la montée qui compense l'écart —
     * puis `slopedRoute`, appelée par `routeCommand`, répartit la chute sur
     * toute la longueur. Un tuyau qui descendrait d'un coup à l'arrivée et
     * courrait à plat jusque-là est un tuyau qui ne s'écoule pas.
     */
    const corners = orthogonalRoute(position, arrivalNode.position).map(
      ({ x, y }): Point2D => ({ x, y }),
    );
    const runMm = reach(position, arrivalNode.position);
    const fallMm = position.z - arrivalNode.position.z;
    if (gravity && runMm > 0 && fallMm <= 0)
      return refused(
        `Le raccordement ${of(discipline)} le plus proche est plus haut que ${placed.name ?? objectId} : rien ne s’écoule vers le haut.`,
      );
    const draft =
      gravity && runMm > 0
        ? { slopePercent: (fallMm / runMm) * 100, riseMm: fallMm }
        : { slopePercent: 0, riseMm: 0 };
    const drawn = routeCommand(
      projected,
      networkId,
      [mine.id, toPortId],
      corners,
      draft,
      `${nodeId}:${connection.portId}`,
    );
    if (drawn.status === 'ERROR') return refused(drawn.message);
    commands.push(drawn.command);
    projected = drawn.command.execute(projected).nextState;

    // La longueur rendue est celle du tracé **effectivement** porté par le
    // tronçon, relue sur la commande : la recalculer ici ferait une seconde
    // réponse à « quelle longueur fait ce tuyau », et l'une des deux finirait
    // fausse.
    const path =
      drawn.command instanceof ConnectNetworkPortsCommand
        ? drawn.command.edge.path
        : [];
    const lengthMm = pathLength(path);
    if (lengthMm > budgetMm)
      return refused(
        `Le réseau ${of(discipline)} le plus proche est à ${metres(lengthMm)} : le tracé proposé traverserait toute la maison, dont la diagonale mesure ${metres(budgetMm)}.`,
      );
    // La pente rendue est celle du tracé tel qu'il est, relue par `routeFall`
    // sur la polyligne obtenue : la recalculer depuis les deux hauteurs
    // donnerait la pente qu'on a **demandée**, et non celle qu'on a dessinée.
    const { slopePercent } = routeFall(path);
    runs.push({
      portId: connection.portId,
      toPortId,
      arrival: chosen.arrival,
      path,
      lengthMm,
      ...(gravity && slopePercent !== undefined ? { slopePercent } : {}),
    });
  }

  const command = new ProjectTransactionCommand(
    `network:connect:${objectId}:${networkId}`,
    `Raccorder au réseau ${of(discipline)}`,
    commands,
  );
  /*
   * Le modèle a le dernier mot, et on le lui demande avant de proposer.
   *
   * `execute` ne valide pas : il applique. Une proposition peut donc se
   * construire et rester refusée par le contrat que le fichier doit tenir —
   * c'est ce qui arrivait en se dérivant sur l'extrémité d'un tronçon, où l'une
   * des deux moitiés se retrouvait longue de zéro. Un bouton actif dont le clic
   * fait remonter une erreur du modèle est exactement la panne que ce registre
   * refuse : on demande donc ici, où le refus est encore un motif d'infobulle.
   */
  const verdict = command.validate(project);
  if (!verdict.valid)
    return refused(
      `Le modèle refuse ce raccordement : ${verdict.errors.join(' ')}`,
    );

  return {
    status: 'OK',
    networkId,
    from: position,
    runs,
    totalLengthMm: runs.reduce((total, { lengthMm }) => total + lengthMm, 0),
    command,
  };
}

/** La longueur développée d'une polyligne, hauteurs comprises. */
function pathLength(path: readonly Point3D[]): number {
  return path.reduce((total, point, index) => {
    if (index === 0) return total;
    const previous = path[index - 1]!;
    return (
      total +
      Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      )
    );
  }, 0);
}

/* ------------------------------------------------------------------ */
/* Le geste entier                                                     */
/* ------------------------------------------------------------------ */

/** Ce qu'un raccordement complet ferait de cet appareil, sans encore rien faire. */
export type ConnectPlan =
  | {
      readonly status: 'OK';
      readonly command: ProjectCommand;
      readonly proposals: readonly ConnectionProposal[];
      readonly totalLengthMm: number;
    }
  | { readonly status: 'REFUSED'; readonly message: string };

/**
 * Relier cet appareil à **tous** les réseaux qui le desservent, d'un geste.
 *
 * Un lavabo se raccorde à l'eau et à l'évacuation ; le raccorder à l'une et
 * pas à l'autre n'est pas un demi-succès, c'est un appareil qu'on croit
 * raccordé. Le plan aboutit donc quand chacun de ses réseaux aboutit, et il
 * nomme sinon le premier qui refuse — celui-là même dont l'utilisateur a
 * besoin d'entendre parler.
 *
 * Une seule fonction pour les trois usages — « le bouton est-il actif », « que
 * dit-il quand il ne l'est pas », « que fait-il quand on clique » — comme
 * `arrangementPlan` : trois fonctions séparées finissent par ne plus répondre
 * la même chose, et un bouton actif dont le clic ne fait rien est une panne.
 */
export function connectPlan(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): ConnectPlan {
  const outcome = connectableNetworks(project, objectId, levelId);
  if (outcome.status === 'REFUSED') return outcome;
  const proposals: ConnectionProposal[] = [];
  for (const { networkId } of outcome.networks) {
    const proposal = connectionProposal(project, levelId, objectId, networkId);
    if (proposal.status === 'REFUSED') return proposal;
    proposals.push(proposal);
  }
  const first = proposals[0];
  if (first === undefined)
    return refused('Aucun réseau de ce projet ne dessert cet appareil.');
  return {
    status: 'OK',
    proposals,
    totalLengthMm: proposals.reduce(
      (total, { totalLengthMm }) => total + totalLengthMm,
      0,
    ),
    command:
      proposals.length === 1
        ? first.command
        : new ProjectTransactionCommand(
            `network:connect:${objectId}`,
            'Raccorder aux réseaux',
            proposals.map(({ command }) => command),
          ),
  };
}
