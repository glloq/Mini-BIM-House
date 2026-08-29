/**
 * Ce que la barre contextuelle propose, compté sur la maison de référence.
 *
 * Le défaut mesuré par l'audit n'était pas qu'il manquait des actions : c'est
 * qu'il y en avait six, les mêmes, quel que soit l'objet désigné. « Pivoter
 * 90° », « Miroir » et les quatre alignements sur un mur, sur une gaine, sur
 * une toiture et sur une parcelle — la panoplie du mobilier appliquée à toute
 * la maison. Sur les cent trente-huit objets de la maison de référence, la
 * barre proposait donc huit cent vingt-huit boutons, dont aucun ne parlait de
 * l'objet regardé.
 *
 * Ce test compte ce qu'elle propose maintenant, famille par famille, et
 * vérifie que le compte tient dans la fourchette que l'audit demande — deux à
 * cinq, plus un « … ». Il vérifie surtout que ce sont bien les actions de
 * **cette** famille qui montent en tête : un registre qui replierait les
 * gestes du mur pour montrer les alignements aurait le bon compte et le
 * mauvais contenu.
 */
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import {
  CONTEXT_BAR_LIMIT,
  CONTEXT_BAR_MINIMUM,
  OBJECT_ACTIONS,
  arrangementPlan,
  contextBarActions,
  objectActionsFor,
  type ObjectActionContext,
  type ObjectActionHost,
} from './object-actions.js';
import { inspectObject } from './object-editors.js';

const demo = loadDemoProject();
if (demo.status === 'ERROR') throw new Error(demo.message);
const house = demo.file.project;
const levelId = house.building.levels[0]!.id;

/** Une coque qui note ce qu'on lui a demandé, et ne fait rien d'autre. */
function recorder(): {
  readonly host: ObjectActionHost;
  readonly done: string[];
} {
  const done: string[] = [];
  return {
    done,
    host: {
      transform: (kind) => done.push(`transform:${kind}`),
      duplicate: () => done.push('duplicate'),
      remove: () => done.push('remove'),
      frame: (objectId) => done.push(`frame:${objectId}`),
      selectSimilar: (objectId) => done.push(`similar:${objectId}`),
      startTool: (tool) => done.push(`tool:${tool}`),
      runCommand: (command: ProjectCommand) =>
        done.push(`run:${command.label}`),
    },
  };
}

function on(selection: readonly string[]): ObjectActionContext {
  return { project: house, levelId, selection, host: recorder().host };
}

/** Tout ce que la maison de référence porte, sur le niveau où on le regarde. */
function everything(): readonly (readonly [string, string])[] {
  const pairs: (readonly [string, string])[] = [
    ['site:parcel', levelId] as const,
  ];
  for (const level of house.building.levels) {
    for (const { id } of level.walls) pairs.push([id, level.id]);
    for (const { id } of level.spaces) pairs.push([id, level.id]);
    for (const { id } of level.openings) pairs.push([id, level.id]);
    for (const { id } of level.slabs) pairs.push([id, level.id]);
    for (const { id } of level.roofs) pairs.push([id, level.id]);
    for (const { id } of level.stairs) pairs.push([id, level.id]);
    for (const { id } of level.structure ?? []) pairs.push([id, level.id]);
    for (const { id } of level.components ?? []) pairs.push([id, level.id]);
  }
  for (const network of house.systems ?? []) {
    for (const { id } of network.nodes) pairs.push([id, levelId]);
    for (const { id } of network.edges) pairs.push([id, levelId]);
  }
  return pairs.filter(([id]) => inspectObject(house, id).kind !== 'UNKNOWN');
}

const aWall = house.building.levels[0]!.walls[0]!.id;
const anotherWall = house.building.levels[0]!.walls[1]!.id;
const aRoom = house.building.levels[0]!.spaces[0]!.id;
const anEdge = (house.systems ?? [])[0]!.edges[0]!.id;
/** Trois murs : le plus petit ensemble sur lequel « répartir » veut dire quelque chose. */
const threeWalls = house.building.levels[0]!.walls.slice(0, 3).map(
  ({ id }) => id as string,
);

describe('le registre des actions', () => {
  it('mesure la maison entière, pour que le compte veuille dire quelque chose', () => {
    expect(everything().length).toBeGreaterThan(100);
  });

  it('tient la barre entre deux et cinq actions, sur tout ce que la maison porte', () => {
    for (const [objectId, level] of everything()) {
      const { shown } = contextBarActions(
        objectActionsFor({
          project: house,
          levelId: level,
          selection: [objectId],
          host: recorder().host,
        }),
      );
      expect(shown.length, objectId).toBeGreaterThanOrEqual(
        CONTEXT_BAR_MINIMUM,
      );
      expect(shown.length, objectId).toBeLessThanOrEqual(CONTEXT_BAR_LIMIT);
    }
  });

  it('ne perd aucune action en la repliant', () => {
    // Replier n'est pas retirer : le « … » doit rendre exactement ce que la
    // barre n'a pas montré, sans doublon et sans oubli.
    for (const [objectId, level] of everything()) {
      const all = objectActionsFor({
        project: house,
        levelId: level,
        selection: [objectId],
        host: recorder().host,
      });
      const { shown, folded } = contextBarActions(all);
      expect([...shown, ...folded].map(({ id }) => id).sort()).toEqual(
        all.map(({ id }) => id).sort(),
      );
    }
  });

  it('montre au mur ce qu’un mur fait, avant ce que tout objet fait', () => {
    const { shown } = contextBarActions(objectActionsFor(on([aWall])));
    const labels = shown.map(({ id }) => id);
    // Décaler, scinder et basculer la face de référence existaient : les deux
    // premiers dans la boîte à outils, le troisième au clic droit seulement.
    expect(labels.slice(0, 3)).toEqual([
      'wall.offset',
      'wall.split',
      'wall.flipReference',
    ]);
    // Et les six boutons génériques d'hier ne tiennent plus toute la barre.
    expect(labels).not.toContain('align.LEFT');
  });

  it('montre à la pièce le seul geste qu’une pièce ait', () => {
    const { shown } = contextBarActions(objectActionsFor(on([aRoom])));
    expect(shown.map(({ id }) => id)).toContain('space.merge');
    // Une pièce ne bouge pas : ce qui la concerne est en tête, et le reste
    // reste offert mais gris, parce qu'un bouton absent laisserait croire
    // qu'on n'a pas trouvé.
    const rotate = shown.find(({ id }) => id === 'rotate');
    expect(rotate).toBeDefined();
    expect(rotate?.enabled(on([aRoom]))).toBe(false);
  });

  it('montre au réseau ce qu’on fait d’un réseau', () => {
    const { shown } = contextBarActions(objectActionsFor(on([anEdge])));
    const labels = shown.map(({ id }) => id);
    expect(labels).toContain('network.branch');
    expect(labels).toContain('network.route');
    // Un tronçon ne se duplique pas — un nœud que rien n'atteint n'est pas un
    // réseau — et la barre le dit sans attendre le refus.
    const duplicate = objectActionsFor(on([anEdge])).find(
      ({ id }) => id === 'duplicate',
    );
    expect(duplicate?.enabled(on([anEdge]))).toBe(false);
  });

  it('n’offre les alignements qu’à partir de deux objets, et tous ensemble', () => {
    // Aligner un objet sur lui-même n'aligne rien : le bouton gris d'hier
    // promettait un geste qu'aucun clic sur cet objet ne rendait possible.
    const alone = objectActionsFor(on([aWall])).map(({ id }) => id);
    expect(alone.filter((id) => id.startsWith('align.'))).toEqual([]);
    const pair = contextBarActions(objectActionsFor(on([aWall, anotherWall])));
    // Six boutons qui ne diffèrent que par une direction sont un seul geste :
    // ils sont repliés ensemble, plutôt qu'un seul promu par le budget.
    expect(pair.folded.map(({ id }) => id)).toEqual([
      'align.LEFT',
      'align.RIGHT',
      'align.TOP',
      'align.BOTTOM',
      'align.CENTRE_X',
      'align.CENTRE_Y',
    ]);
    expect(pair.shown.map(({ id }) => id)).toEqual([
      'rotate',
      'mirror',
      'duplicate',
      'delete',
    ]);
  });

  it('n’offre la répartition qu’à partir de trois objets', () => {
    // Entre deux objets il n'y a qu'un intervalle, et un seul intervalle est
    // déjà régulier : le geste n'apparaît pas plutôt que d'apparaître gris
    // pour toujours, ce qui ne dirait rien de ce qui manque.
    const pair = objectActionsFor(on([aWall, anotherWall])).map(({ id }) => id);
    expect(pair.filter((id) => id.startsWith('distribute.'))).toEqual([]);
    const trio = objectActionsFor(on(threeWalls)).map(({ id }) => id);
    expect(trio.filter((id) => id.startsWith('distribute.'))).toEqual([
      'distribute.X',
      'distribute.Y',
    ]);
  });

  it('range six objets en une seule entrée d’historique', () => {
    // Annuler l'alignement de six objets doit être un Ctrl+Z, pas six :
    // l'historique dit ce qu'on a demandé, pas comment ça s'est exécuté.
    const { host, done } = recorder();
    const six = (house.building.levels[0]!.components ?? [])
      .slice(0, 6)
      .map(({ id }) => id as string);
    expect(six).toHaveLength(6);
    const context: ObjectActionContext = {
      project: house,
      levelId,
      selection: six,
      host,
    };
    const align = objectActionsFor(context).find(
      ({ id }) => id === 'align.LEFT',
    )!;
    expect(align.enabled(context)).toBe(true);
    align.run(context);
    expect(done).toEqual(['run:Aligner à gauche']);
  });

  it('déplace les objets vers la référence, et vers elle seule', () => {
    // Le rangement passe par les familles : ce que la commande porte est le
    // déplacement que chaque famille a construit pour son propre objet.
    const components = (house.building.levels[0]!.components ?? []).filter(
      ({ category }) => category === 'ELECTRICAL',
    );
    const ids = components.map(({ id }) => id as string);
    const context: ObjectActionContext = {
      project: house,
      levelId,
      selection: ids,
      host: recorder().host,
    };
    const plan = arrangementPlan(
      context,
      { kind: 'ALIGN', intent: 'LEFT' },
      'Aligner à gauche',
    );
    if (plan.status === 'REFUSED') throw new Error(plan.message);
    const applied = plan.command.execute(house).nextState;
    const after = (applied.building.levels[0]!.components ?? [])
      .filter(({ id }) => ids.includes(id as string))
      .map(({ position }) => position.x);
    /*
     * Toutes à la même abscisse, exactement, et c'est celle du plus à gauche.
     *
     * Le chiffre était écrit en dur ; il est demandé à la maquette, parce que
     * ce qui se vérifie ici n'est pas où elles atterrissent mais qu'elles
     * atterrissent **ensemble** et sur la référence, là où la trame de cent
     * millimètres laissait vingt millimètres d'écart.
     */
    const leftmost = Math.min(...components.map(({ position }) => position.x));
    expect(new Set(after)).toEqual(new Set([leftmost]));
  });

  it('refuse de ranger un tronçon, qui n’a pas de position à lui', () => {
    /*
     * Un rangement n'est pas un convoi.
     *
     * Un tronçon de réseau peut emporter ses coins intermédiaires quand ses
     * deux nœuds voyagent avec lui — c'est ce qui garde sa forme à un tracé
     * qu'on déplace en entier. Un rangement, lui, donne à chaque objet son
     * propre écart : les nœuds étaient bien désignés avec le tronçon, mais ils
     * n'allaient pas au même endroit. Les coins partaient d'un côté, les nœuds
     * de l'autre, et le tracé se déchirait sans qu'aucun refus ne soit
     * prononcé — un dessin faux, obtenu par un bouton qui avait l'air d'avoir
     * marché.
     */
    const network = (house.systems ?? [])[0]!;
    const edge = network.edges[0]!;
    const nodeOfPort = new Map(
      network.ports.map((port) => [port.id, port.nodeId]),
    );
    const ends = [
      nodeOfPort.get(edge.fromPortId)!,
      nodeOfPort.get(edge.toPortId)!,
    ];
    /*
     * Un quatrième objet, plus à droite que tout le reste.
     *
     * L'emprise d'un tronçon est exactement celle de ses deux nœuds : à eux
     * trois seuls, le tronçon est toujours à la référence et ne reçoit jamais
     * d'écart. Il en faut un quatrième pour que le rangement demande au
     * tronçon de bouger — et c'est là que les écarts divergent : le tronçon
     * reçoit deux mètres, l'un de ses nœuds neuf.
     */
    const plan = arrangementPlan(
      {
        project: house,
        levelId,
        selection: [edge.id, ...ends, 'component-vmc'],
        host: recorder().host,
      },
      { kind: 'ALIGN', intent: 'RIGHT' },
      'Aligner à droite',
    );
    expect(plan.status).toBe('REFUSED');
    if (plan.status !== 'REFUSED') return;
    expect(plan.message).toContain('n’a pas de position à lui');
  });

  it('dit pourquoi il refuse, plutôt que de griser sans motif', () => {
    // « Répartir » gris sur trois objets peut vouloir dire trois choses ; un
    // bouton qui ne dit pas laquelle se lit comme une panne.
    // Les trois premiers murs de la maison sont déjà régulièrement espacés en
    // y : le bouton est gris, et il dit que c'est parce qu'il n'y a rien à
    // faire — et non parce que le geste n'existe pas.
    const context = on(threeWalls);
    const distribute = objectActionsFor(context).find(
      ({ id }) => id === 'distribute.Y',
    )!;
    expect(distribute.enabled(context)).toBe(false);
    expect(distribute.unavailableReason?.(context)).toMatch(
      /déjà répartis régulièrement/,
    );
    // Une pièce ne se déplace pas, et c'est la pièce qui le dit — pas nous.
    const withRoom: ObjectActionContext = {
      project: house,
      levelId,
      selection: [aWall, anotherWall, aRoom],
      host: recorder().host,
    };
    const align = objectActionsFor(withRoom).find(
      ({ id }) => id === 'align.CENTRE_X',
    )!;
    expect(align.enabled(withRoom)).toBe(false);
    expect(align.unavailableReason?.(withRoom)).toMatch(/pièce/);
  });

  it('donne un motif à chaque rangement gris, et aucun quand il aboutit', () => {
    // L'invariant qui tient les deux champs d'accord : un motif exactement
    // quand le bouton est gris. Deux fonctions séparées finiraient par ne
    // plus répondre la même chose.
    const selections = [
      [aWall, anotherWall],
      threeWalls,
      [aWall, anotherWall, aRoom],
      (house.building.levels[0]!.components ?? [])
        .slice(0, 4)
        .map(({ id }) => id as string),
    ];
    for (const selection of selections) {
      const context: ObjectActionContext = {
        project: house,
        levelId,
        selection,
        host: recorder().host,
      };
      for (const action of objectActionsFor(context)) {
        if (
          !action.id.startsWith('align.') &&
          !action.id.startsWith('distribute.')
        )
          continue;
        const reason = action.unavailableReason?.(context);
        expect(
          reason === undefined,
          `${action.id} · ${selection.join(',')} · ${reason ?? ''}`,
        ).toBe(action.enabled(context));
      }
    }
  });

  it('n’offre le raccordement qu’à un objet qui déclare des raccordements', () => {
    /*
     * Un lavabo se raccorde ; un mur, une pièce, un tronçon ne se raccordent
     * pas. L'action ne s'affiche donc pas sur eux, plutôt que de s'y afficher
     * grise en promettant un geste qu'aucun clic ne rendrait possible — c'est
     * la règle qu'`appliesTo` porte depuis UX-17.
     */
    const offered = (objectId: string, level = levelId) =>
      objectActionsFor({
        project: house,
        levelId: level,
        selection: [objectId],
        host: recorder().host,
      }).map(({ id }) => id);
    expect(offered('component-washbasin')).toContain('network.connect');
    expect(offered(aWall)).not.toContain('network.connect');
    expect(offered(aRoom)).not.toContain('network.connect');
    expect(offered(anEdge)).not.toContain('network.connect');
    // Et jamais sur plusieurs objets : un raccordement se demande appareil par
    // appareil, parce que chacun rejoint son réseau à un endroit différent.
    expect(
      objectActionsFor(
        on(['component-washbasin', 'component-kitchen-sink']),
      ).map(({ id }) => id),
    ).not.toContain('network.connect');
  });

  it('raccorde un lavabo à ses deux réseaux en une seule entrée d’historique', () => {
    /*
     * Un lavabo a une arrivée d'eau et une évacuation : les deux passent par
     * `host.runCommand`, qui traverse la frontière d'édition, et n'y passent
     * qu'une fois. Annuler le branchement ne doit pas demander deux
     * annulations — encore moins six, puisque le raccordement pose deux nœuds,
     * ajoute un port, dérive un tronçon et en trace deux.
     */
    const { host, done } = recorder();
    const context: ObjectActionContext = {
      project: house,
      levelId,
      selection: ['component-washbasin'],
      host,
    };
    const connect = objectActionsFor(context).find(
      ({ id }) => id === 'network.connect',
    )!;
    expect(connect.enabled(context)).toBe(true);
    expect(connect.unavailableReason?.(context)).toBeUndefined();
    connect.run(context);
    expect(done).toEqual(['run:Raccorder aux réseaux']);
  });

  it('dit au radiateur ce qui manque au projet, plutôt que de griser sans motif', () => {
    // Cette maison n'a pas de réseau de chauffage : ses radiateurs sont posés
    // et ne mènent nulle part. Le bouton est là, il est gris, et il dit quoi
    // faire — créer le réseau — au lieu de laisser chercher.
    const context = on(['component-radiator-living']);
    const connect = objectActionsFor(context).find(
      ({ id }) => id === 'network.connect',
    )!;
    expect(connect.enabled(context)).toBe(false);
    expect(connect.unavailableReason?.(context)).toMatch(
      /Aucun réseau de chauffage/,
    );
    // Et un appareil déjà raccordé le dit aussi, avec le nœud qui le nomme.
    const bound = on(['component-luminaire-living']);
    const already = objectActionsFor(bound).find(
      ({ id }) => id === 'network.connect',
    )!;
    expect(already.enabled(bound)).toBe(false);
    expect(already.unavailableReason?.(bound)).toMatch(/déjà raccordé/);
  });

  it('donne un motif à chaque raccordement gris, et aucun quand il aboutit', () => {
    // Le même invariant que pour les rangements : `enabled` et
    // `unavailableReason` sortent d'un seul plan, et ne peuvent donc pas
    // finir par ne plus répondre la même chose.
    for (const level of house.building.levels)
      for (const { id } of level.components ?? []) {
        const context: ObjectActionContext = {
          project: house,
          levelId: level.id,
          selection: [id],
          host: recorder().host,
        };
        const connect = objectActionsFor(context).find(
          ({ id: actionId }) => actionId === 'network.connect',
        );
        expect(connect, id).toBeDefined();
        const reason = connect?.unavailableReason?.(context);
        expect(reason === undefined, `${id} · ${reason ?? ''}`).toBe(
          connect?.enabled(context),
        );
      }
  });

  it('ne propose rien sur une sélection vide', () => {
    expect(objectActionsFor(on([]))).toEqual([]);
  });

  it('fait faire à la coque ce que l’action annonce, et rien de plus', () => {
    const { host, done } = recorder();
    const context: ObjectActionContext = {
      project: house,
      levelId,
      selection: [aWall],
      host,
    };
    const byId = (id: string) =>
      objectActionsFor(context).find((action) => action.id === id)!;
    byId('wall.split').run(context);
    byId('rotate').run(context);
    byId('delete').run(context);
    byId('frame').run(context);
    expect(done).toEqual([
      'tool:SPLIT',
      'transform:ROTATE',
      'remove',
      `frame:${aWall}`,
    ]);
  });

  it('dit de chaque action si elle écrit, parce que la frontière en dépend', () => {
    // Le champ n'est pas décoratif : `stage-editing.ts` s'en sert pour retirer
    // ce qui mènerait à un refus. Une action qui lit et qui se déclarerait
    // écrivante disparaîtrait là où elle est justement utile.
    const reading = OBJECT_ACTIONS.filter(({ writes }) => !writes).map(
      ({ id }) => id,
    );
    expect(reading).toEqual(['frame', 'similar']);
  });
});
