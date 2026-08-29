/**
 * Ce que « relier ceci à son réseau » propose, mesuré sur la maison de
 * référence.
 *
 * Le défaut n'était pas qu'on ne pouvait pas raccorder un lavabo : c'est que le
 * faire coûtait onze gestes et trois entrées d'historique — poser un nœud
 * (quatre gestes), dériver un tronçon parce qu'aucun des quatre réseaux de la
 * maison n'a **un seul** port libre (deux gestes), puis tracer (cinq gestes) —
 * et que le nœud ainsi posé portait les ports du gabarit de la discipline et
 * non ceux de la fiche. Sur les trente-trois appareils posés, aucun n'était
 * relié à son réseau autrement qu'à la main, et neuf seulement étaient nommés
 * par un nœud.
 *
 * Ces tests comptent ce que le geste propose maintenant, et vérifient surtout
 * les décisions qui le rendent juste : le point d'accroche le plus proche, le
 * genre de port repris du nœud qu'on rejoint, la pente d'une évacuation, le
 * refus nommé quand il n'y a rien à proposer, et l'entrée d'historique unique.
 */
import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import {
  connectPlan,
  connectableNetworks,
  connectionProposal,
  declaredConnections,
  longestSensibleRunMm,
} from './connect-intent.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;

const GROUND = 'ground';
const FIRST = 'first';

/** Le réseau tel qu'il est dans un projet donné, pour lire ce qu'on y a écrit. */
function network(project: Project, networkId: string) {
  return (project.systems ?? []).find(({ id }) => id === networkId)!;
}

/** Vrai quand chaque segment du tracé suit un axe du bâtiment. */
function orthogonalInPlan(path: readonly { x: number; y: number }[]): boolean {
  return path.every((point, index) => {
    if (index === 0) return true;
    const previous = path[index - 1]!;
    return point.x === previous.x || point.y === previous.y;
  });
}

describe('quels réseaux peuvent accueillir un appareil', () => {
  it('rend les deux réseaux d’un lavabo, et ce que chacun raccorde', () => {
    // Un lavabo a une arrivée d'eau **et** une évacuation : rendre l'un des
    // deux serait rendre la moitié de l'appareil.
    const outcome = connectableNetworks(house, 'component-washbasin', GROUND);
    if (outcome.status === 'REFUSED') throw new Error(outcome.message);
    expect(outcome.networks.map(({ networkId }) => networkId)).toEqual([
      'water',
      'wastewater',
    ]);
    expect(
      outcome.networks.map(({ connections }) =>
        connections.map(({ portId }) => portId),
      ),
    ).toEqual([['cold'], ['drain']]);
  });

  it('nomme le raccordement qu’aucun réseau du projet ne dessert', () => {
    // L'eau chaude du lavabo n'a pas de réseau dans cette maison — le réseau
    // d'eau y est en eau froide. Le dire vaut mieux que de faire comme si le
    // lavabo n'en avait pas.
    const outcome = connectableNetworks(house, 'component-washbasin', GROUND);
    if (outcome.status === 'REFUSED') throw new Error(outcome.message);
    expect(outcome.unserved.map(({ portId }) => portId)).toEqual(['hot']);
    expect(outcome.unserved[0]?.message).toMatch(
      /Aucun réseau de plomberie .* créez-le d’abord/,
    );
  });

  it('refuse en nommant l’objet quand sa fiche ne déclare aucun raccordement', () => {
    // Le refus muet est le défaut que ce dépôt combat : un appareil sans port
    // n'est pas un appareil qu'on a mal désigné, c'est une fiche incomplète.
    const stripped = structuredClone(house);
    const definition = (stripped.equipment ?? []).find(
      ({ id }) => id === 'generic-washbasin',
    )!;
    (definition as { ports: readonly unknown[] }).ports = [];
    expect(
      declaredConnections(stripped, 'component-washbasin', GROUND),
    ).toEqual([]);
    const outcome = connectableNetworks(
      stripped,
      'component-washbasin',
      GROUND,
    );
    expect(outcome.status).toBe('REFUSED');
    if (outcome.status !== 'REFUSED') return;
    expect(outcome.message).toMatch(/ne déclare aucun raccordement/);
  });

  it('ne rend rien d’un objet qui n’est pas un appareil posé', () => {
    // Un mur n'a pas de port : l'action ne doit pas même s'afficher sur lui.
    expect(declaredConnections(house, 'wall-south', GROUND)).toEqual([]);
  });
});

describe('la proposition de raccordement', () => {
  it('part de l’appareil, arrive sur le réseau, et tourne à angle droit', () => {
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-washbasin',
      'wastewater',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    expect(proposal.runs).toHaveLength(1);
    const run = proposal.runs[0]!;
    expect(run.path[0]).toEqual(proposal.from);
    // Un réseau se tire à angle droit, pas en diagonale.
    expect(orthogonalInPlan(run.path)).toBe(true);
    // La longueur rendue est celle du tracé porté par le tronçon, pas une
    // seconde mesure : elle se recalcule à la main sur la polyligne.
    const measured = run.path.reduce((total, point, index) => {
      if (index === 0) return total;
      const previous = run.path[index - 1]!;
      return (
        total +
        Math.hypot(
          point.x - previous.x,
          point.y - previous.y,
          point.z - previous.z,
        )
      );
    }, 0);
    expect(run.lengthMm).toBeCloseTo(measured, 6);
  });

  it('fait descendre une évacuation sur toute sa longueur, pas d’un coup à la fin', () => {
    // Un tuyau qui court à plat puis tombe à l'arrivée est un tuyau qui ne
    // s'écoule pas : la chute est répartie par `slopedRoute`, et chaque coude
    // est plus bas que le précédent.
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-washbasin',
      'wastewater',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    const heights = proposal.runs[0]!.path.map(({ z }) => z);
    expect(heights.length).toBeGreaterThan(2);
    for (let index = 1; index < heights.length; index += 1)
      expect(heights[index]!).toBeLessThan(heights[index - 1]!);
    expect(proposal.runs[0]!.slopePercent).toBeGreaterThan(0);
  });

  it('ne donne pas de pente à un réseau sous pression', () => {
    // La question ne se pose que là où elle a une réponse : une eau froide ne
    // s'écoule pas par gravité, et lui inventer une pente serait un chiffre de
    // plus que personne n'a demandé.
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-washbasin',
      'water',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    expect(proposal.runs[0]!.slopePercent).toBeUndefined();
  });

  it('se dérive sur le tronçon qui passe le plus près, plutôt que d’aller à la nourrice', () => {
    /*
     * L'évier de cuisine est à moins d'un mètre du tronçon d'eau qui le longe,
     * et à 6,7 m de la nourrice. Sans la dérivation, la proposition
     * traverserait la maison pour rejoindre un nœud alors qu'un tuyau passe
     * derrière l'évier. C'est ce que la sonde a mesuré sur les trente
     * raccordements de cette maison : la dérivation gagne vingt-cinq fois, et
     * fait tomber la distance médiane au point d'accroche de 6,7 m à 1,4 m.
     */
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-kitchen-sink',
      'water',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    const run = proposal.runs[0]!;
    expect(run.arrival).toMatch(/tronçon/);
    expect(run.lengthMm).toBeLessThan(1000);
  });

  it('reprend le genre de port du nœud qu’il rejoint, et non celui du gabarit', () => {
    /*
     * Le WC évacue des **eaux-vannes** ; le regard de cette maison reçoit en
     * arrivée unitaire, qui les accepte. Le gabarit de la discipline, lui, ne
     * connaît qu'une arrivée d'eaux usées — et un raccordement construit
     * dessus était refusé : « BLACKWATER et GREYWATER ne sont pas le même
     * service ». C'est le nœud qu'on rejoint qui dit ce qu'il reçoit.
     */
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-wc',
      'wastewater',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    const applied = proposal.command.execute(house).nextState;
    const created = network(applied, 'wastewater').ports.find(
      ({ id }) => id === proposal.runs[0]!.toPortId,
    )!;
    expect(created.portTypeId).toBe('WASTEWATER_COMBINED_INLET');
    // Et le port de l'appareil est celui de sa fiche, pas celui du gabarit.
    const mine = network(applied, 'wastewater').ports.find(
      ({ nodeId }) => nodeId === 'wastewater:component-wc',
    )!;
    expect(mine.portTypeId).toBe('SOILWATER');
  });

  it('ne se raccorde pas à ce qu’il vient lui-même de poser', () => {
    /*
     * Le tableau électrique déclare une arrivée et un départ. Le second
     * raccordement se dérivait sur le câble que le premier venait de tirer —
     * un tableau alimenté par lui-même, à zéro millimètre. Un appareil ne
     * s'alimente pas lui-même.
     *
     * Le tableau est ici rapproché du réseau : là où la maison de référence le
     * pose, à neuf mètres du circuit qu'il est censé alimenter, le geste refuse
     * — ce que le dernier test de ce fichier compte.
     */
    const nearby = structuredClone(house);
    const board = (
      nearby.building.levels.find(({ id }) => id === GROUND)!.components ?? []
    ).find(({ id }) => id === 'component-board')!;
    (board as { position: { x: number; y: number } }).position = {
      x: 9500,
      y: 1500,
    };
    const proposal = connectionProposal(
      nearby,
      GROUND,
      'component-board',
      'electrical',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    expect(proposal.runs).toHaveLength(2);
    const arrivals = proposal.runs.map(({ arrival }) => arrival);
    expect(new Set(arrivals).size).toBe(2);
    for (const run of proposal.runs) {
      expect(run.lengthMm).toBeGreaterThan(0);
      expect(run.arrival).not.toMatch(/component-board/);
    }
  });

  it('ne se dérive pas sur le bout d’un tronçon, où la dérivation n’aurait pas lieu', () => {
    /*
     * `branchCommand` coupe le tronçon en deux à l'endroit visé ; visé sur une
     * extrémité, l'une des moitiés est longue de zéro et le modèle refuse le
     * fichier — ce qui arrivait pour l'évier de cuisine, dont le tronçon d'eau
     * le plus proche se termine juste au-dessus de lui. Le geste vise donc le
     * tronçon suivant, et la proposition reste un projet valide.
     */
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-kitchen-sink',
      'water',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    expect(proposal.command.validate(house)).toEqual({ valid: true });
    const applied = proposal.command.execute(house).nextState;
    for (const edge of network(applied, 'water').edges)
      expect(edge.path.length, edge.id).toBeGreaterThan(1);
  });
});

describe('les refus, qui nomment leur cause', () => {
  it('dit qu’il manque un réseau plutôt que de griser en silence', () => {
    // Cette maison n'a pas de réseau de chauffage : ses huit radiateurs sont
    // posés et ne mènent nulle part. Le geste le dit, et dit quoi faire.
    const plan = connectPlan(house, GROUND, 'component-radiator-living');
    expect(plan.status).toBe('REFUSED');
    if (plan.status !== 'REFUSED') return;
    expect(plan.message).toMatch(
      /Aucun réseau de chauffage .* créez-le d’abord/,
    );
  });

  it('dit qu’un appareil déjà raccordé l’est déjà, et par quel nœud', () => {
    // Les huit plafonniers de cette maison sont déjà nommés par un nœud du
    // réseau d'électricité. Reproposer le geste en créerait un second.
    const plan = connectPlan(house, GROUND, 'component-luminaire-living');
    expect(plan.status).toBe('REFUSED');
    if (plan.status !== 'REFUSED') return;
    expect(plan.message).toMatch(/déjà raccordé au réseau d’électricité/);
    expect(plan.message).toContain('electrical:luminaire-living');
  });

  it('refuse un tracé qui traverserait toute la maison, et dit de combien', () => {
    /*
     * Le seuil n'est pas écrit : c'est la diagonale du plan du bâti, 12,8 m
     * sur cette maison. Un tracé plus long repasse forcément par où il vient
     * de passer, et ce n'est plus « le réseau le plus proche ». Le lavabo est
     * ici déplacé à cent mètres, ce que rien n'empêche de faire à la main.
     */
    expect(longestSensibleRunMm(house)).toBeCloseTo(12806.25, 2);
    const moved = structuredClone(house);
    const level = moved.building.levels.find(({ id }) => id === GROUND)!;
    const washbasin = (level.components ?? []).find(
      ({ id }) => id === 'component-washbasin',
    )!;
    (washbasin as { position: { x: number; y: number } }).position = {
      x: 100000,
      y: 100000,
    };
    const proposal = connectionProposal(
      moved,
      GROUND,
      'component-washbasin',
      'wastewater',
    );
    expect(proposal.status).toBe('REFUSED');
    if (proposal.status !== 'REFUSED') return;
    expect(proposal.message).toMatch(/traverserait toute la maison/);
    expect(proposal.message).toMatch(/12,8 m/);
  });

  it('refuse une évacuation qui devrait remonter', () => {
    // Rien ne s'écoule vers le haut. Le regard est ici remonté au-dessus du
    // lavabo du premier étage, ce qu'un plan mal coté produit tout seul.
    const raised = structuredClone(house);
    const collector = network(raised, 'wastewater').nodes.find(
      ({ id }) => id === 'wastewater:collector',
    )!;
    (collector as { position: { z: number } }).position.z = 9000;
    const proposal = connectionProposal(
      raised,
      FIRST,
      'component-washbasin-first',
      'wastewater',
    );
    expect(proposal.status).toBe('REFUSED');
    if (proposal.status !== 'REFUSED') return;
    expect(proposal.message).toMatch(/rien ne s’écoule vers le haut/);
  });
});

describe('ce que le raccordement écrit dans le projet', () => {
  it('lie le nœud créé à l’appareil qu’il représente', () => {
    /*
     * Deux radiateurs du même modèle sont deux objets raccordés à deux
     * endroits : un nœud qui ne nommerait que le modèle ne dirait pas lequel
     * des deux il alimente, et les notes de calcul perdraient le compte. C'est
     * `componentId` qui le dit, et c'est ce que les adaptateurs de calcul
     * lisent déjà.
     */
    const plan = connectPlan(house, GROUND, 'component-washbasin');
    if (plan.status === 'REFUSED') throw new Error(plan.message);
    const applied = plan.command.execute(house).nextState;
    for (const networkId of ['water', 'wastewater']) {
      const node = network(applied, networkId).nodes.find(
        ({ componentId }) => componentId === 'component-washbasin',
      );
      expect(node, networkId).toBeDefined();
      expect(node?.levelId).toBe(GROUND);
      expect(node?.spaceId).toBe('space-bathroom');
    }
  });

  it('raccorde le lavabo à l’eau et à l’évacuation en une seule entrée d’historique', () => {
    /*
     * Annuler un branchement ne doit pas demander cinq annulations :
     * l'historique dit ce qu'on a demandé, pas comment ça s'est trouvé
     * exécuté. Le raccordement complet d'un lavabo pose deux nœuds, ajoute
     * deux ports, dérive un tronçon et en trace deux — et se défait d'un seul
     * pas en arrière.
     */
    const plan = connectPlan(house, GROUND, 'component-washbasin');
    if (plan.status === 'REFUSED') throw new Error(plan.message);
    const before = JSON.stringify(house.systems);
    const execution = plan.command.execute(house);
    const applied = execution.nextState;
    expect(network(applied, 'water').edges.length).toBe(
      network(house, 'water').edges.length + 2,
    );
    expect(network(applied, 'wastewater').edges.length).toBe(
      network(house, 'wastewater').edges.length + 1,
    );
    const undone = execution.inverse.execute(applied).nextState;
    expect(JSON.stringify(undone.systems)).toBe(before);
  });

  it('rend un projet que le modèle accepte, et non un projet qu’il refusera', () => {
    // La validation est celle des commandes elles-mêmes : ce module ne crée
    // aucun tronçon de son côté, il demande aux commandes existantes de le
    // faire et leur laisse le dernier mot.
    for (const objectId of [
      'component-washbasin',
      'component-kitchen-sink',
      'component-wc',
      'component-shower',
      'component-socket-living',
      'component-socket-kitchen',
    ]) {
      const plan = connectPlan(house, GROUND, objectId);
      if (plan.status === 'REFUSED')
        throw new Error(`${objectId} : ${plan.message}`);
      expect(plan.command.validate(house), objectId).toEqual({ valid: true });
    }
  });

  it('propose deux fois la même chose sur le même projet', () => {
    // Une proposition qui dépendrait de l'ordre d'un tri de la machine se
    // relirait autrement au rechargement, et deux plans du même appareil
    // n'auraient pas les mêmes identifiants.
    const first = connectPlan(house, GROUND, 'component-washbasin');
    const second = connectPlan(house, GROUND, 'component-washbasin');
    if (first.status === 'REFUSED' || second.status === 'REFUSED')
      throw new Error('la proposition a refusé');
    expect(JSON.stringify(second.proposals)).toBe(
      JSON.stringify(first.proposals),
    );
    expect(second.command.id).toBe(first.command.id);
  });
});

describe('ce que le geste couvre sur la maison de référence', () => {
  it('raccorde treize des trente-trois appareils posés, et dit pourquoi pour les autres', () => {
    /*
     * Le compte, et ce qu'il dit du projet autant que du geste. Sur
     * trente-trois appareils posés : huit attendent un réseau de chauffage que
     * cette maison n'a pas, huit plafonniers sont déjà nommés par un nœud, la
     * batterie et les panneaux attendent un réseau de stockage et un réseau
     * solaire, et le tableau et son disjoncteur sont posés à neuf mètres du
     * circuit qu'ils alimentent — le geste refuse plutôt que de traverser la
     * maison. Les treize qui restent se raccordent d'un geste : dix-huit
     * tronçons, là où il en fallait onze gestes chacun.
     */
    const counted = { ok: 0, refused: 0, runs: 0 };
    for (const level of house.building.levels)
      for (const { id } of level.components ?? []) {
        const plan = connectPlan(house, level.id, id);
        if (plan.status === 'OK') {
          counted.ok += 1;
          counted.runs += plan.proposals.reduce(
            (total, { runs }) => total + runs.length,
            0,
          );
        } else {
          counted.refused += 1;
          // Aucun refus muet : chacun est une phrase française qui se termine.
          expect(plan.message, id).toMatch(/[.:]$/);
        }
      }
    expect(counted).toEqual({ ok: 13, refused: 20, runs: 18 });
  });
});
