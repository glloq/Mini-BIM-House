/**
 * Ce qui portera l'objet qu'on s'apprête à poser — et pourquoi, parfois, rien.
 *
 * Poser un composant, c'est répondre à une question que l'application ne
 * posait qu'après coup : « sur quoi ? ». On cliquait, et l'on lisait « Ce
 * modèle se fixe à : Mur ». Le clic était le seul moyen de savoir si le clic
 * était permis, ce qui revient à faire deviner la règle par l'échec.
 *
 * Ce module répond **avant** le clic. Il rejoue le choix que `hostUnder` fait
 * dans `editing-commands` au moment de la commande — le même ordre, la même
 * portée, la même fiche — pour que l'aperçu et la pose ne décrivent jamais
 * deux choses différentes. La duplication est délibérée et surveillée :
 * `host-choice.test.ts` confronte cette fonction à la vraie commande sur les
 * mêmes points, et échoue si l'une des deux dérive.
 *
 * Ce qui décide n'est écrit nulle part ici : c'est `allowedHosts`, que la
 * fiche du **projet** porte parce que la famille du catalogue l'y a recopié.
 * Une famille qui change d'avis demain change la réponse sans qu'on touche à
 * ce fichier — et un projet ouvert dans deux ans garde la règle avec laquelle
 * il a été dessiné, ce qui est exactement pourquoi la copie voyage.
 */
import {
  hostAccepts,
  levelHosts,
  type EquipmentDefinition,
  type HostType,
  type Level,
  type Project,
  type Wall,
} from '@house-technical-designer/core-domain';
import type { Point2D } from '@house-technical-designer/geometry';

import { pointInPolygon } from './editing-commands.js';

/**
 * Jusqu'où l'on accepte de rattacher un objet au mur qu'on visait.
 *
 * La même valeur que la commande, et pour la même raison : on vise une prise
 * sur un mur à un mètre près, pas au millimètre. Elle est ici en double parce
 * que la commande ne l'exporte pas ; le test d'accord entre les deux est ce
 * qui empêche les deux copies de diverger en silence.
 */
export const WALL_REACH_MM = 1500;

/**
 * Comment on nomme un support dans une phrase, article compris.
 *
 * `HOST_TYPE_LABELS` du domaine donne le nom nu — « Mur » — qui va dans une
 * liste mais pas dans une phrase. Une phrase qu'on lit sans s'arrêter vaut
 * mieux qu'une énumération, parce qu'elle est lue au moment où l'on cherche
 * pourquoi le curseur refuse.
 *
 * Le type est exhaustif exprès : un support ajouté au domaine ne compilera pas
 * tant que personne n'aura écrit comment on le dit.
 */
const HOST_PHRASES: Readonly<Record<HostType, string>> = {
  WALL: 'un mur',
  SLAB: 'une dalle',
  CEILING: 'un plafond',
  ROOF: 'une toiture',
  SITE: 'le terrain',
  OPENING: 'une baie',
  DISTRIBUTION_BOARD: 'un tableau',
};

/** Ce que le survol a trouvé sous lui, et ce qu'il faut en dire. */
export interface HostChoice {
  /**
   * L'objet du niveau qui portera la pose.
   *
   * Absent quand rien ne la porte — ce qui est une réponse valable et non une
   * erreur : ce qui se pose sur le terrain n'a pas d'objet pour hôte, le
   * terrain étant partout.
   */
  readonly hostObjectId?: string;
  /**
   * L'orientation que le support impose, en degrés.
   *
   * Présente pour un mur seulement. Le sol n'oriente rien : un lit posé au
   * milieu d'une chambre garde l'orientation qu'il avait, et lui en inventer
   * une serait décider à la place de quelqu'un.
   */
  readonly wallAngleDeg?: number;
  /** Si la pose est possible ici. */
  readonly accepted: boolean;
  /** Ce qu'il y a à lire avant de cliquer, que ce soit accepté ou refusé. */
  readonly sentence: string;
}

/**
 * La fiche telle que **le projet** la tient.
 *
 * Jamais le catalogue global : la copie du projet est celle avec laquelle la
 * maison a été conçue, et c'est déjà la seule que la commande consulte. Aller
 * chercher la nomenclature depuis le premier écran ferait entrer cinq cents
 * familles de JSON dans le paquet que l'on charge pour dessiner un mur.
 */
export function projectEquipment(
  project: Project,
  definitionId: string | undefined,
): EquipmentDefinition | undefined {
  if (definitionId === undefined || definitionId === '') return undefined;
  return (project.equipment ?? []).find(({ id }) => id === definitionId);
}

/** Le point du mur le plus proche, et la direction du mur à cet endroit. */
function nearestOnWall(
  wall: Wall,
  point: Point2D,
): { readonly awayMm: number; readonly angleDeg: number } | undefined {
  let best: { awayMm: number; angleDeg: number } | undefined;
  for (let index = 1; index < wall.path.points.length; index += 1) {
    const start = wall.path.points[index - 1]!;
    const end = wall.path.points[index]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const along = Math.max(
      0,
      Math.min(
        1,
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
      ),
    );
    const awayMm = Math.hypot(
      point.x - (start.x + dx * along),
      point.y - (start.y + dy * along),
    );
    if (best === undefined || awayMm < best.awayMm)
      best = { awayMm, angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI };
  }
  return best;
}

/** La liste des supports admis, dite comme on la lit. */
function admittedPhrase(allowed: readonly HostType[]): string {
  const named = allowed.map((host) => HOST_PHRASES[host]);
  if (named.length <= 1) return named[0] ?? 'rien';
  return `${named.slice(0, -1).join(', ')} ou ${named[named.length - 1]!}`;
}

/**
 * Sous quel titre ce support-ci porte cet objet-là.
 *
 * Une dalle est deux supports à la fois — un plancher vue de dessus, un
 * plafond vue de dessous — et la nommer « dalle » quand la fiche demandait un
 * plafond ferait dire à la phrase autre chose que ce qui a été décidé. On
 * nomme donc le premier titre que la fiche réclame et que l'objet porte.
 */
function heldAs(
  hosted: ReadonlySet<HostType> | undefined,
  allowed: readonly HostType[] | undefined,
): HostType | undefined {
  if (hosted === undefined) return undefined;
  if (allowed !== undefined && allowed.length > 0)
    return allowed.find((host) => hosted.has(host));
  // Fiche muette : c'est l'objet qui se nomme, et l'ordre du domaine tranche
  // pour que deux survols du même mur ne donnent pas deux phrases.
  return (Object.keys(HOST_PHRASES) as HostType[]).find((host) =>
    hosted.has(host),
  );
}

/**
 * Ce qui portera l'objet posé ici, et ce qu'il faut en dire.
 *
 * L'ordre est celui de la commande, et il n'est pas arbitraire :
 *
 * 1. **Ce que le curseur touche**, si la fiche l'accepte : c'est le plus
 *    explicite, et c'est ce que la personne croit avoir désigné.
 * 2. **Le mur le plus proche**, quand la fiche veut un mur — poser une prise,
 *    c'est viser un mur, et l'on vise à un mètre près.
 * 3. **La toiture, puis la dalle** sous le point : poser un lit, c'est viser
 *    le milieu d'une chambre et non la ligne du sol.
 * 4. **Le mur en dernier recours**, pour ce qui n'a ni toit ni dalle dessous.
 *
 * Une fiche qui ne déclare aucun support accepte ce qu'on lui donne : c'est le
 * composant générique, celui qu'on pose quand le catalogue ne nomme pas la
 * chose. Refuser à sa place serait inventer une règle que personne n'a écrite.
 */
export function chooseHost(
  level: Level,
  point: Point2D,
  picked: string | undefined,
  allowedHosts: readonly HostType[] | undefined,
): HostChoice {
  const hosts = levelHosts(level);
  const allowed =
    allowedHosts === undefined || allowedHosts.length === 0
      ? undefined
      : allowedHosts;
  const fits = (id: string): boolean =>
    allowed === undefined || hostAccepts(allowed, hosts.get(id));

  const nearestWall = ():
    { readonly id: string; readonly angleDeg: number } | undefined =>
    level.walls
      .flatMap((candidate) => {
        const near = nearestOnWall(candidate, point);
        return near === undefined || near.awayMm > WALL_REACH_MM
          ? []
          : [{ id: candidate.id, ...near }];
      })
      .sort((first, second) => first.awayMm - second.awayMm)[0];

  const chosen = ((): string | undefined => {
    if (picked !== undefined && hosts.has(picked) && fits(picked))
      return picked;
    if (allowed?.includes('WALL') === true) {
      const wall = nearestWall();
      if (wall !== undefined && fits(wall.id)) return wall.id;
    }
    const roof = level.roofs.find((candidate) =>
      pointInPolygon(point, candidate.footprint.outer),
    );
    if (roof !== undefined && fits(roof.id)) return roof.id;
    const slab = level.slabs.find(
      (candidate) =>
        pointInPolygon(point, candidate.polygon.outer) &&
        !(candidate.polygon.holes ?? []).some((hole) =>
          pointInPolygon(point, hole),
        ),
    );
    if (slab !== undefined && fits(slab.id)) return slab.id;
    const wall = nearestWall();
    return wall !== undefined && fits(wall.id) ? wall.id : undefined;
  })();

  /*
   * Rien n'a été trouvé : la pose ne passe que si la fiche accepte le terrain.
   *
   * C'est la règle du modèle et non une invention de l'aperçu — le terrain
   * n'est pas un objet du niveau, donc ce qui s'y pose se pose sans hôte, et
   * ce qui réclame un mur sans en trouver un est refusé.
   */
  if (chosen === undefined) {
    if (allowed === undefined)
      return {
        accepted: true,
        sentence: 'Posé ici : cette fiche ne réclame aucun support.',
      };
    if (allowed.includes('SITE'))
      return { accepted: true, sentence: 'Posé sur le terrain.' };
    return {
      accepted: false,
      sentence: `Rien ici ne peut porter ce modèle : il se pose sur ${admittedPhrase(allowed)}.`,
    };
  }

  // Le mur retenu oriente le fantôme ; les autres supports le laissent tel
  // qu'il est. On ne redemande la géométrie qu'au mur effectivement choisi,
  // pour que l'angle affiché soit celui du mur qui portera et pas d'un voisin.
  const wall = level.walls.find(({ id }) => id === chosen);
  const angle = wall === undefined ? undefined : nearestOnWall(wall, point);
  const title = heldAs(hosts.get(chosen), allowed);
  return {
    hostObjectId: chosen,
    ...(angle === undefined ? {} : { wallAngleDeg: angle.angleDeg }),
    accepted: true,
    sentence:
      title === undefined
        ? 'Posé ici.'
        : wall === undefined
          ? `Posé sur ${HOST_PHRASES[title]}.`
          : `Posé sur ${HOST_PHRASES[title]}, orienté comme lui.`,
  };
}
