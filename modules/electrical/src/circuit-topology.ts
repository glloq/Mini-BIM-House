/**
 * La chute de tension sur un circuit qui se ramifie.
 *
 * Un circuit de maison n'est pas une guirlande. Six prises alimentées depuis
 * un tableau forment un **arbre** : le câble d'arrivée porte tout, chaque
 * dérivation porte ce qui est derrière elle, et le dernier tronçon ne porte
 * qu'une prise. Le moteur savait faire une seule chose — additionner les
 * chutes d'une suite ordonnée de câbles en faisant passer dans chacun le
 * courant total du circuit — et refusait tout le reste :
 *
 *     Cable inputs must form one ordered continuous series path;
 *     branched paths require a per-branch calculation.
 *
 * Ce refus était honnête et complet : la maison de démonstration elle-même
 * n'obtenait aucune chute de tension. Il était aussi trop sévère sur les
 * circuits qu'il acceptait, parce qu'un tronçon situé après une charge ne
 * porte plus le courant de cette charge — la somme surestimait.
 *
 * ## Ce qui est calculé
 *
 * L'arbre se lit sur ce que le réseau **déclare** : chaque câble relie deux
 * nœuds, et la racine est le tableau. Il a d'abord été lu sur la géométrie —
 * les extrémités qui se rejoignent — et c'était une erreur : la maison de
 * démonstration a quatre câbles dont le tracé part d'un point situé à un mètre
 * du nœud dont ils déclarent partir, et le circuit devenait « déconnecté »
 * alors que le modèle disait exactement à quoi il était relié. Un dessin peut
 * dériver ; la connexion, non. La géométrie ne sert donc plus qu'à ce pour
 * quoi elle est juste : la longueur.
 *
 * Pour chaque tronçon, le courant est la somme des courants d'emploi des
 * charges qu'il alimente — celles de son sous-arbre. Pour chaque charge, la
 * chute est la somme le long du chemin qui la relie à la racine. Celle du
 * circuit est **la pire**, parce que c'est elle qui décide si la section
 * convient : une moyenne dirait que tout va bien pendant que la prise du fond
 * du jardin est hors tolérance.
 *
 * ## Ce qu'il refuse encore
 *
 * Un circuit dont les câbles ne se rejoignent pas, ou qui referme une boucle.
 * Une boucle n'est pas une faute de saisie — c'est un anneau, qui se calcule
 * autrement parce que le courant s'y partage entre deux chemins — et la traiter
 * comme un arbre donnerait une chute plausible et fausse.
 */
import type { Point3D } from '@house-technical-designer/geometry';

/** Un tronçon de l'arbre : ce qu'il relie, ce qu'il pèse. */
export interface TopologyCable {
  readonly cableId: string;
  /** Les deux nœuds qu'il relie, tels que le réseau les déclare. */
  readonly fromNodeId: string;
  readonly toNodeId: string;
  /** Son tracé, dont seule la longueur est lue. */
  readonly path: readonly Point3D[];
  /** Ohms par mètre de conducteur, quand la section et le métal sont dits. */
  readonly resistanceOhmPerM?: number;
}

/** Une charge, sur le nœud qui la porte et ce qu'elle appelle. */
export interface TopologyLoad {
  readonly loadId: string;
  readonly nodeId: string;
  /** Son courant d'emploi, quand tout ce qu'il faut pour le calculer est dit. */
  readonly currentA?: number;
}

export type TopologyFailure =
  /** Un morceau de câble que rien ne relie au tableau. */
  | 'DISCONNECTED'
  /** Un anneau : le courant s'y partage, ce n'est pas un arbre. */
  | 'LOOP'
  /** Une charge posée sur un nœud qu'aucun câble du circuit n'atteint. */
  | 'LOAD_OFF_PATH';

export type CircuitTopologyResult =
  | {
      readonly status: 'RESOLVED';
      /** Le courant qui traverse chaque tronçon, par identifiant de câble. */
      readonly currentByCable: ReadonlyMap<string, number>;
      /** La chute cumulée jusqu'à chaque charge, quand elle est calculable. */
      readonly dropByLoad: ReadonlyMap<string, number>;
      /** La pire des chutes, celle qui décide de la section. */
      readonly worstDropV: number | undefined;
      /** La charge qui la subit. */
      readonly worstLoadId: string | undefined;
    }
  | { readonly status: 'UNRESOLVED'; readonly reason: TopologyFailure };

/** La longueur d'un tracé, en mètres. */
function lengthM(path: readonly Point3D[]): number {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const first = path[index - 1]!;
    const second = path[index]!;
    total += Math.hypot(
      second.x - first.x,
      second.y - first.y,
      second.z - first.z,
    );
  }
  return total / 1000;
}

/**
 * L'arbre d'un circuit, et ce qui coule dedans.
 *
 * `rootNodeId` est le nœud d'où le circuit part — le tableau, ou le nœud du
 * circuit lui-même quand la protection y est. Sans lui, une guirlande a deux
 * extrémités libres et rien ne dit laquelle est le départ ; le sens du courant
 * en dépend entièrement, donc il est demandé plutôt que deviné.
 */
export function resolveCircuitTopology(
  cables: readonly TopologyCable[],
  loads: readonly TopologyLoad[],
  rootNodeId: string,
  /** Deux pour du monophasé — l'aller et le retour — √3 ou 1 en triphasé. */
  pathFactor: number,
): CircuitTopologyResult {
  if (cables.length === 0)
    return { status: 'UNRESOLVED', reason: 'DISCONNECTED' };

  /*
   * Un parcours en largeur depuis la racine, qui oriente chaque tronçon.
   *
   * Rencontrer deux fois le même nœud est un anneau, et un anneau n'est pas un
   * arbre : le courant s'y partage entre deux chemins, ce que cette méthode ne
   * sait pas faire. Elle le dit plutôt que de choisir un chemin au hasard.
   */
  const parentCable = new Map<string, TopologyCable>();
  const parentNode = new Map<string, string>();
  const seen = new Set<string>([rootNodeId]);
  const queue = [rootNodeId];
  const used = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const cable of cables) {
      if (used.has(cable.cableId)) continue;
      const other =
        cable.fromNodeId === node
          ? cable.toNodeId
          : cable.toNodeId === node
            ? cable.fromNodeId
            : undefined;
      if (other === undefined) continue;
      if (seen.has(other)) return { status: 'UNRESOLVED', reason: 'LOOP' };
      seen.add(other);
      used.add(cable.cableId);
      parentCable.set(other, cable);
      parentNode.set(other, node);
      queue.push(other);
    }
  }
  if (used.size !== cables.length)
    return { status: 'UNRESOLVED', reason: 'DISCONNECTED' };
  if (loads.some(({ nodeId }) => !seen.has(nodeId)))
    return { status: 'UNRESOLVED', reason: 'LOAD_OFF_PATH' };

  /*
   * Le courant d'un tronçon est celui des charges qu'il alimente.
   *
   * Obtenu en remontant : chaque charge ajoute son courant à tous les tronçons
   * du chemin qui la relie à la racine. C'est la définition même, et elle évite
   * d'avoir à construire les sous-arbres.
   */
  const currentByCable = new Map<string, number>();
  for (const cable of cables) currentByCable.set(cable.cableId, 0);
  for (const load of loads) {
    if (load.currentA === undefined) continue;
    let node = load.nodeId;
    while (node !== rootNodeId) {
      const cable = parentCable.get(node)!;
      currentByCable.set(
        cable.cableId,
        (currentByCable.get(cable.cableId) ?? 0) + load.currentA,
      );
      node = parentNode.get(node)!;
    }
  }

  // Et la chute jusqu'à chaque charge, une fois les courants connus.
  const dropByLoad = new Map<string, number>();
  let worstDropV: number | undefined;
  let worstLoadId: string | undefined;
  for (const load of loads) {
    let node = load.nodeId;
    let drop = 0;
    let known = true;
    while (node !== rootNodeId) {
      const cable = parentCable.get(node)!;
      if (cable.resistanceOhmPerM === undefined) {
        known = false;
        break;
      }
      drop +=
        pathFactor *
        (currentByCable.get(cable.cableId) ?? 0) *
        cable.resistanceOhmPerM *
        lengthM(cable.path);
      node = parentNode.get(node)!;
    }
    if (!known) continue;
    dropByLoad.set(load.loadId, drop);
    if (worstDropV === undefined || drop > worstDropV) {
      worstDropV = drop;
      worstLoadId = load.loadId;
    }
  }
  /*
   * Une chute n'est rendue que si **toutes** les charges en ont une. La pire de
   * trois quand il y en a cinq n'est pas la pire : c'est un nombre plus petit
   * que la vérité, et il passerait pour une installation conforme.
   */
  const complete =
    loads.length > 0 && loads.every(({ loadId }) => dropByLoad.has(loadId));
  return {
    status: 'RESOLVED',
    currentByCable,
    dropByLoad,
    ...(complete
      ? { worstDropV, worstLoadId }
      : { worstDropV: undefined, worstLoadId: undefined }),
  };
}
