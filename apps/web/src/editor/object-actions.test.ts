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
      align: (edge) => done.push(`align:${edge}`),
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
    // Quatre boutons qui ne diffèrent que par un bord sont un seul geste : ils
    // sont repliés ensemble, plutôt qu'un seul promu par le budget.
    expect(pair.folded.map(({ id }) => id)).toEqual([
      'align.LEFT',
      'align.RIGHT',
      'align.TOP',
      'align.BOTTOM',
    ]);
    expect(pair.shown.map(({ id }) => id)).toEqual([
      'rotate',
      'mirror',
      'duplicate',
      'delete',
    ]);
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
