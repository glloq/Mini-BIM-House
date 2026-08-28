/**
 * L'inventaire doit être complet, sinon la règle d'édition a un trou.
 *
 * `changedObjects` est ce qui permet de refuser une commande sans demander à
 * la commande ce qu'elle touche. Sa seule faiblesse est une collection oubliée
 * dans `inventory` : un objet absent de l'inventaire ne « change » jamais,
 * donc rien ne le protège.
 *
 * Ce test confronte la liste à la maison de référence, où chacune de ces
 * collections est peuplée, et vérifie qu'un objet de chacune est vu bouger.
 */
import { describe, expect, it } from 'vitest';

import type { Project } from '@house-technical-designer/core-domain';
import { loadDemoProject } from '../demo-project.js';
import { changedObjects } from './model-diff.js';

function house(): Project {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

/**
 * Chaque collection d'objets, et un identifiant pris dedans.
 *
 * Écrite ici en repartant du type `Level` et du type `Site`, et non de
 * `inventory` : recopier la liste qu'on teste ne teste rien.
 */
function anIdFromEachCollection(project: Project): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  const first = (name: string, ids: readonly string[]): void => {
    const id = ids[0];
    if (id !== undefined && !found.has(name)) found.set(name, id);
  };
  first(
    'site.obstacles',
    (project.site.obstacles ?? []).map(({ id }) => id),
  );
  for (const level of project.building.levels) {
    first(
      'level.walls',
      level.walls.map(({ id }) => id),
    );
    first(
      'level.slabs',
      level.slabs.map(({ id }) => id),
    );
    first(
      'level.roofs',
      level.roofs.map(({ id }) => id),
    );
    first(
      'level.openings',
      level.openings.map(({ id }) => id),
    );
    first(
      'level.stairs',
      level.stairs.map(({ id }) => id),
    );
    first(
      'level.spaces',
      level.spaces.map(({ id }) => id),
    );
    first(
      'level.annotations',
      level.annotations.map(({ id }) => id),
    );
    first(
      'level.components',
      (level.components ?? []).map(({ id }) => id),
    );
    first(
      'level.structure',
      (level.structure ?? []).map(({ id }) => id),
    );
  }
  for (const network of project.systems ?? []) {
    first(
      'network.nodes',
      network.nodes.map(({ id }) => id),
    );
    first(
      'network.edges',
      network.edges.map(({ id }) => id),
    );
    first(
      'network.ports',
      network.ports.map(({ id }) => id),
    );
  }
  return found;
}

describe('ce qu’une commande a réellement changé', () => {
  it('sees nothing when nothing moved', () => {
    expect(changedObjects(house(), house())).toEqual([]);
  });

  it('sees the parcel', () => {
    const before = house();
    // `exactOptionalPropertyTypes` : une parcelle absente est une clé absente,
    // et non une clé qui vaut `undefined`. C'est ce que le fichier contient.
    const { parcelBoundary: _removed, ...site } = before.site;
    const after: Project = { ...before, site };
    expect(changedObjects(before, after)).toEqual(['site:parcel']);
  });

  it('sees an object of every collection the reference house fills', () => {
    /*
     * Le vrai test de ce module : une collection oubliée dans l'inventaire est
     * une famille d'objets que la frontière d'édition ne protège pas.
     *
     * La maison de référence porte au moins un objet de chacune, et chacun est
     * retiré à son tour : ce qui n'apparaît pas dans le résultat n'est pas
     * inventorié.
     */
    const before = house();
    const collections = anIdFromEachCollection(before);
    // Onze : les deux qui manquent — les annotations et la structure — sont
    // vides dans la maison de référence, et sont couvertes juste en dessous.
    expect([...collections.keys()].sort()).toEqual([
      'level.components',
      'level.openings',
      'level.roofs',
      'level.slabs',
      'level.spaces',
      'level.stairs',
      'level.walls',
      'network.edges',
      'network.nodes',
      'network.ports',
      'site.obstacles',
    ]);
    for (const [collection, objectId] of collections) {
      const after = JSON.parse(
        JSON.stringify(before).replaceAll(`"${objectId}"`, '"objet-renommé"'),
      ) as Project;
      expect(changedObjects(before, after), collection).toContain(objectId);
    }
  });

  it('sees the collections the reference house happens to leave empty', () => {
    /*
     * Les annotations, les structures de toiture et les ouvrages structurels
     * n'existent dans aucun fichier livré. Une collection qu'aucun projet
     * d'essai ne remplit est exactement celle qu'on oublie d'inventorier, et
     * personne ne s'en aperçoit : elle est donc peuplée ici, à la main.
     */
    const before = house();
    const level = before.building.levels[0]!;
    for (const [name, planted] of [
      [
        'level.annotations',
        {
          ...level,
          annotations: [
            { id: 'annotation-plantée', kind: 'TEXT', text: 'ici' },
          ],
        },
      ],
      [
        'level.structure',
        { ...level, structure: [{ id: 'poteau-planté', kind: 'COLUMN' }] },
      ],
      [
        'level.roofStructures',
        { ...level, roofStructures: [{ id: 'toiture-plantée' }] },
      ],
    ] as const) {
      const after: Project = {
        ...before,
        building: {
          ...before.building,
          levels: [
            planted as unknown as (typeof before.building.levels)[number],
            ...before.building.levels.slice(1),
          ],
        },
      };
      expect(changedObjects(before, after), name).toEqual([
        name === 'level.annotations'
          ? 'annotation-plantée'
          : name === 'level.structure'
            ? 'poteau-planté'
            : 'toiture-plantée',
      ]);
    }
  });

  it('sees an object that was added, and one that was taken away', () => {
    const before = house();
    const level = before.building.levels[0]!;
    const kept = level.walls.filter(({ id }) => id !== 'wall-east');
    const after: Project = {
      ...before,
      building: {
        ...before.building,
        levels: [{ ...level, walls: kept }, ...before.building.levels.slice(1)],
      },
    };
    expect(changedObjects(before, after)).toEqual(['wall-east']);
    // Et dans l'autre sens : ce qui apparaît compte autant que ce qui part.
    expect(changedObjects(after, before)).toEqual(['wall-east']);
  });
});
