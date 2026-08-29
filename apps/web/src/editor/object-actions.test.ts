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
    // Le plus à gauche de ces prises est à x = 600 ; toutes y sont, à zéro
    // près, là où la trame de 100 mm en laissait vingt.
    expect(new Set(after)).toEqual(new Set([600]));
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
