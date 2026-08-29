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
import { placedEquipment } from '@house-technical-designer/core-domain';
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

  it('reconnaît enfin le réseau de ventilation, qui ne déclarait aucun genre', () => {
    /*
     * Les dix ports du réseau de ventilation de cette maison ne déclaraient
     * aucun `portTypeId`. Le modèle ne juge pas une question à moitié posée —
     * « un raccordement déclare AIR_EXTRACT et l'autre ne déclare pas de
     * genre : rien ne dit si les deux se raccordent » — donc **rien** ne
     * pouvait rejoindre ce réseau : ni une bouche d'extraction, ni le groupe de
     * VMC qu'il dessert pourtant.
     *
     * Une fois les genres déclarés, l'extraction du groupe trouve ce réseau, et
     * ce que le geste répond est le vrai état des choses : ce groupe-là y est
     * déjà, sous le nœud qui porte son identifiant. Un refus qui nomme le nœud
     * vaut mieux qu'un bouton absent.
     */
    const outcome = connectableNetworks(house, 'component-vmc', GROUND);
    if (outcome.status === 'REFUSED') throw new Error(outcome.message);
    const ventilation = outcome.networks.find(
      ({ networkId }) => networkId === 'ventilation',
    );
    expect(ventilation?.connections.map(({ portId }) => portId)).toEqual([
      'extract',
    ]);
    // Le rejet extérieur du groupe n'a pas de nœud dans cette maison : il est
    // dit comme non desservi, et non passé sous silence.
    expect(outcome.unserved.map(({ portId }) => portId)).toContain('exhaust');

    const plan = connectPlan(house, GROUND, 'component-vmc');
    expect(plan.status).toBe('REFUSED');
    if (plan.status !== 'REFUSED') return;
    expect(plan.message).toMatch(/déjà raccordé au réseau de ventilation/);
    expect(plan.message).toContain('ventilation:unit');
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

  it('pose le nœud là où la fiche situe le raccordement, et non à l’appareil', () => {
    /*
     * Le lavabo n'évacue pas là où il se tient : sa fiche le dit, et rien ne le
     * lisait. Le nœud se posait à l'altitude de l'appareil, et tout l'écart
     * entre les deux se retrouvait dans la pente proposée.
     *
     * Le chiffre lu ici dit aussi ce qui reste faux, et ce n'est plus la fiche.
     * `generic-washbasin` déclare une cuve de 850 mm de haut — du sol au bord —
     * qui évacue 25 mm au-dessus de son dessous ; la maison de référence, elle,
     * pose ce lavabo à `elevationMm: 850`, c'est-à-dire son **dessous** au
     * niveau de son bord. L'appareil flotte donc de sa propre hauteur, et son
     * siphon avec lui. Les deux fautes se compensaient exactement — 850 − 400
     * redonnait les 450 mm attendus — et corriger la fiche seule les sépare.
     * La pose est nommée dans le rapport : la descendre à 0 découvre huit
     * chevauchements réels du plan de référence, ce qui est un autre chantier.
     */
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-washbasin',
      'wastewater',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    // 850 mm de pose plus les 25 mm que la fiche déclare au-dessus du dessous.
    expect(proposal.from.z).toBe(875);
    // En plan le siphon est sous le centre de la vasque : la fiche l'y met, et
    // la position lue est bien celle-là et non un décalage inventé.
    expect(proposal.from.x).toBe(7000);
    expect(proposal.from.y).toBe(4600);
  });

  it('tourne le décalage d’un port avec l’appareil qui le porte', () => {
    /*
     * La fiche donne le décalage dans le repère de l'appareil, et c'est le
     * repère du **modèle** : la même fiche sert les huit exemplaires posés, et
     * elle ne peut pas savoir comment celui-ci est tourné. Le ballon d'eau
     * chaude de cette maison est posé à 180°, et son raccordement électrique
     * est à 280 mm d'un côté de son axe : appliquer la rotation le met à
     * 9 220 mm, l'ignorer le mettrait à 9 780 — 560 mm d'écart, soit deux
     * coudes et un demi-mètre de câble qui n'existe pas.
     *
     * Le contrôle est fait sur un port dont le décalage n'est **pas** nul en
     * plan : ceux qui le sont — le siphon d'un lavabo, l'about d'un plafonnier
     * — tournent sans bouger et ne prouveraient rien.
     */
    const tank = placedEquipment(house).find(
      ({ instanceId }) => instanceId === 'component-dhw-tank',
    )!;
    expect(tank.rotationDeg).toBe(180);
    // 280 mm sur le côté, à mi-hauteur d'un ballon de 1 500 : la fiche compte
    // depuis l'origine de l'appareil, donc depuis son dessous.
    expect(tank.ports.find(({ id }) => id === 'power')?.position).toEqual({
      x: 280,
      y: 0,
      z: 750,
    });

    const proposal = connectionProposal(
      house,
      GROUND,
      'component-dhw-tank',
      'electrical',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    expect(proposal.from.x).toBe(tank.position.x - 280);
    expect(proposal.from.y).toBe(tank.position.y);

    // Le même ballon droit met son raccordement de l'autre côté, et c'est la
    // seule chose qui change : la rotation est bien lue, pas subie.
    const straightened = structuredClone(house);
    const placed = (
      straightened.building.levels.find(({ id }) => id === GROUND)!
        .components ?? []
    ).find(({ id }) => id === 'component-dhw-tank')!;
    (placed as { rotationDeg: number }).rotationDeg = 0;
    const other = connectionProposal(
      straightened,
      GROUND,
      'component-dhw-tank',
      'electrical',
    );
    if (other.status === 'REFUSED') throw new Error(other.message);
    expect(other.from.x).toBe(tank.position.x + 280);
  });

  it('rejoint la colonne de chute qui passe derrière, à la pente que le projet demande', () => {
    /*
     * Les deux corrections qui se répondent, mesurées ensemble.
     *
     * La colonne n'avait aucun gabarit, et une évacuation ne savait pas se
     * dériver : le lavabo du rez-de-chaussée marchait donc 5,9 m jusqu'au
     * regard, en tombant de 20,7 % — un tuyau presque vertical présenté comme
     * une pente. La colonne passe à 1,1 m derrière lui.
     *
     * La hauteur du piquage n'est pas choisie au hasard non plus : sur une
     * chute, elle est libre, et c'est `minimumSlope` — le réglage que le module
     * de calcul d'eaux usées porte déjà dans ce projet, 1 % — qui la fixe.
     * Aucune seconde valeur : une pente inventée ici serait refusée par la note
     * de calcul deux écrans plus loin.
     */
    const declared =
      house.calculationSettings?.['wastewater']?.settings['minimumSlope'];
    expect(declared).toBe(0.01);
    const proposal = connectionProposal(
      house,
      GROUND,
      'component-washbasin',
      'wastewater',
    );
    if (proposal.status === 'REFUSED') throw new Error(proposal.message);
    const run = proposal.runs[0]!;
    expect(run.arrival).toContain('wastewater:stack-drop');
    expect(run.lengthMm).toBeLessThan(1200);
    // La pente obtenue est celle qu'on demande, à l'arrondi au millimètre près
    // de la hauteur visée — d'où la borne haute plutôt qu'une égalité.
    expect(run.slopePercent).toBeGreaterThanOrEqual(1);
    expect(run.slopePercent).toBeLessThan(1.1);
  });

  it('se dérive sur le tronçon qui passe le plus près, plutôt que d’aller à la nourrice', () => {
    /*
     * L'évier de cuisine est à moins d'un mètre du tronçon d'eau qui le longe,
     * et à 6,7 m de la nourrice. Sans la dérivation, la proposition
     * traverserait la maison pour rejoindre un nœud alors qu'un tuyau passe
     * derrière l'évier. C'est ce que la sonde a mesuré sur les trente
     * raccordements de cette maison : la dérivation gagne vingt-cinq fois, et
     * fait tomber la distance médiane au point d'accroche de 6,7 m à 1,4 m.
     *
     * Le tuyau mesure une jambe verticale de plus qu'avant, et c'est la fiche
     * remise dans son repère : l'arrivée d'eau de l'évier était comptée 300 mm
     * sous le centre de sa boîte, elle est maintenant à 150 mm au-dessus de son
     * dessous, soit 450 mm plus haut que le tronçon qu'elle rejoint. La
     * comparaison qui compte reste celle-ci : moins d'un mètre cinquante contre
     * les 6,7 m de la nourrice.
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
    expect(run.lengthMm).toBeLessThan(1500);
  });

  it('reçoit des eaux-vannes sur un réseau unitaire, et non des eaux usées', () => {
    /*
     * Le défaut que la table des genres portait, et son coût exact.
     *
     * Un réseau unitaire transporte les eaux usées **et** les eaux-vannes ;
     * `SYSTEM_PORT_TYPES` donnait à `COMBINED_WASTEWATER` des genres d'eaux
     * usées séparées, si bien que tout ce que l'application posait sur ce
     * réseau — le piquage d'une dérivation, le port d'un regard — refusait
     * ensuite l'évacuation d'un WC : « BLACKWATER et GREYWATER ne sont pas le
     * même service ».
     *
     * Le WC de cette maison se raccorde tel qu'il est posé depuis que sa fiche
     * compte depuis l'origine de l'appareil : plus rien à déplacer pour poser
     * la question. Ce que le test regarde est le **genre** du piquage obtenu,
     * et il le regarde sur le plan tel qu'il est.
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
    /*
     * Rien ne s'écoule vers le haut. Tout le réseau d'eaux usées est ici
     * remonté de dix mètres, ce qu'un plan mal coté produit tout seul en
     * saisissant une altitude de niveau au lieu d'une profondeur.
     *
     * Le réseau entier, et non le seul regard : un point d'accroche plus haut
     * que l'appareil passe désormais **après** tous les autres au lieu d'être
     * choisi le premier, de sorte qu'il suffisait de remonter le regard pour
     * que la colonne prenne le relais — ce qui est le comportement voulu. Le
     * refus se dit quand il ne reste vraiment rien qui descende.
     */
    const raised = structuredClone(house);
    for (const node of network(raised, 'wastewater').nodes)
      (node as { position: { z: number } }).position.z += 10000;
    // Les tracés aussi : c'est sur eux qu'une dérivation se pique, et un réseau
    // dont on n'aurait remonté que les nœuds serait un réseau incohérent.
    for (const edge of network(raised, 'wastewater').edges)
      for (const point of edge.path) (point as { z: number }).z += 10000;
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

  it('raccorde le WC de cette maison, dont la fiche disait sa sortie sous la dalle', () => {
    /*
     * Le refus était vrai, et c'est la fiche qui était fausse.
     *
     * `generic-wc` posait son évacuation à `z: -350`, la cuvette étant posée à
     * l'altitude du plancher : la sortie tombait donc à −350 mm, c'est-à-dire
     * exactement au radier du regard qui devait la recevoir, et 150 mm sous le
     * pied de la colonne de chute. Rien de ce réseau n'était plus bas qu'elle,
     * et « rien ne s'écoule vers le haut » était la bonne phrase pour un plan
     * impossible.
     *
     * Ces −350 n'étaient la faute de personne : ils étaient comptés depuis le
     * centre de la boîte, comme 788 des 789 ports positionnés du catalogue, et
     * aucun repère n'avait jamais été énoncé. Comptés depuis l'origine de
     * l'appareil — le point que la pose situe —, ils valent +50, et une cuvette
     * qui évacue 50 mm au-dessus de son plancher descend vers la colonne au
     * lieu de remonter du regard.
     */
    const plan = connectPlan(house, GROUND, 'component-wc');
    if (plan.status === 'REFUSED') throw new Error(plan.message);
    const soil = plan.proposals.find(
      ({ networkId }) => networkId === 'wastewater',
    )!;
    // 800 mm de cuvette, dont la fiche déclare la sortie à 50 : c'est le seul
    // chiffre en jeu, et il vient de la fiche.
    expect(soil.from.z).toBe(50);
    const run = soil.runs[0]!;
    // La pente est celle que le projet demande — `minimumSlope`, 1 % —, à
    // l'arrondi au millimètre près de la hauteur de piquage visée.
    expect(run.slopePercent).toBeGreaterThanOrEqual(1);
    expect(run.slopePercent).toBeLessThan(1.1);
    expect(run.lengthMm).toBeLessThan(1500);
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
    // L'évacuation se dérive maintenant sur la colonne de chute : la
    // dérivation coupe un tronçon en deux et le tracé en ajoute un troisième.
    expect(network(applied, 'wastewater').edges.length).toBe(
      network(house, 'wastewater').edges.length + 2,
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
      'component-shower',
      'component-socket-living',
      'component-socket-kitchen',
      // Le tableau et son disjoncteur, qui sont posés sous le nœud qui les
      // représente depuis que la maison de référence les y a remis.
      'component-board',
      'component-breaker',
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
  it('raccorde quatorze des trente-trois appareils posés, et dit pourquoi pour les autres', () => {
    /*
     * Le compte, et ce qu'il dit du projet autant que du geste. Sur
     * trente-trois appareils posés : huit attendent un réseau de chauffage que
     * cette maison n'a pas, huit plafonniers et le groupe de VMC sont déjà
     * nommés par un nœud, la batterie et les panneaux attendent un réseau de
     * stockage et un réseau solaire. Les quatorze qui restent se raccordent
     * d'un geste : vingt et un tronçons, là où il en fallait onze gestes
     * chacun.
     *
     * Treize, puis quatorze : le WC a rejoint le compte, et c'est la seule
     * chose qui a bougé. Sa fiche déclarait sa sortie 350 mm sous la cuvette —
     * comptée depuis le centre de sa boîte, comme 788 des 789 ports positionnés
     * du catalogue — ce qui la mettait au radier du regard, plus bas que tout
     * ce que son réseau porte ; comptée depuis l'origine de l'appareil, elle
     * est à 50 mm au-dessus du plancher et descend vers la colonne. Les deux
     * tronçons de plus sont les siens : son eau froide et son évacuation.
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
    expect(counted).toEqual({ ok: 14, refused: 19, runs: 21 });
  });
});
