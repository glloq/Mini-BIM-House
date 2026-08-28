/**
 * La frontière d'édition, famille par famille.
 *
 * Ce test lit le propriétaire de chaque objet **de la maison de référence**
 * plutôt que d'une maquette : une table écrite à côté d'une autre table dit
 * seulement que les deux ont été écrites par la même personne. Ici, les
 * identifiants sortent du fichier, et le seul moyen de faire passer le test
 * est que la règle réponde juste sur des objets qui existent.
 */
import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { inspectObject, type ObjectKind } from '../editor/object-editors.js';
import { CREATION_STAGES, type CreationStageId } from './creation-stages.js';
import { canEdit, ownerStageOf, unownedIn } from './ownership.js';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

/** Un identifiant par famille, pris dans le fichier. */
function oneOfEach(): ReadonlyMap<ObjectKind | 'SITE', string> {
  const project = house();
  const ids: string[] = ['site:parcel'];
  for (const level of project.building.levels) {
    ids.push(...level.walls.map(({ id }) => id));
    ids.push(...level.spaces.map(({ id }) => id));
    ids.push(...level.openings.map(({ id }) => id));
    ids.push(...level.slabs.map(({ id }) => id));
    ids.push(...level.roofs.map(({ id }) => id));
    ids.push(...level.stairs.map(({ id }) => id));
    ids.push(...(level.structure ?? []).map(({ id }) => id));
    ids.push(...(level.components ?? []).map(({ id }) => id));
  }
  for (const network of project.systems ?? []) {
    ids.push(...network.nodes.map(({ id }) => id));
    ids.push(...network.edges.map(({ id }) => id));
  }
  const found = new Map<ObjectKind | 'SITE', string>();
  for (const id of ids) {
    const { kind } = inspectObject(project, id);
    if (kind !== 'UNKNOWN' && !found.has(kind)) found.set(kind, id);
  }
  return found;
}

describe('qui a le droit de modifier quoi', () => {
  it('gives the parcel to the site, and to nothing else', () => {
    const project = house();
    expect(ownerStageOf(project, 'site:parcel')).toBe('SITE');
    for (const stage of CREATION_STAGES)
      expect(canEdit(stage, project, 'site:parcel')).toBe(stage === 'SITE');
  });

  it('gives everything the building is made of to the building', () => {
    const project = house();
    const built: readonly ObjectKind[] = [
      'WALL',
      'SPACE',
      'OPENING',
      'SLAB',
      'ROOF',
      'STAIR',
    ];
    const each = oneOfEach();
    for (const kind of built) {
      const id = each.get(kind);
      expect(id, `aucun ${kind} dans la maison de référence`).toBeDefined();
      expect(ownerStageOf(project, id!), kind).toBe('BUILDING');
    }
  });

  it('splits placed objects by what they are, not by their family', () => {
    /*
     * Un lit et une pompe à chaleur sont le même `COMPONENT`. Ce qui les
     * sépare est leur catégorie : ce qu'on installe et qui marche tout seul
     * est de l'aménagement, ce qui est raccordé et dimensionné est des
     * systèmes. Une règle par famille les aurait mis au même endroit.
     */
    const project = house();
    const seen = new Map<CreationStageId, number>();
    for (const level of project.building.levels)
      for (const component of level.components ?? []) {
        const owner = ownerStageOf(project, component.id);
        expect(
          owner === 'FITTING' || owner === 'SYSTEMS',
          `${component.id} (${component.category}) → ${String(owner)}`,
        ).toBe(true);
        seen.set(owner!, (seen.get(owner!) ?? 0) + 1);
      }
    // Les deux côtés sont représentés : sans ça la règle passerait en rangeant
    // tout du même côté.
    expect(seen.get('FITTING') ?? 0).toBeGreaterThan(0);
    expect(seen.get('SYSTEMS') ?? 0).toBeGreaterThan(0);
  });

  it('gives every run and node to the systems', () => {
    const project = house();
    for (const network of project.systems ?? []) {
      for (const node of network.nodes)
        expect(ownerStageOf(project, node.id)).toBe('SYSTEMS');
      for (const edge of network.edges)
        expect(ownerStageOf(project, edge.id)).toBe('SYSTEMS');
    }
  });

  it('lets nothing be edited from the two reading stages', () => {
    /*
     * Études et Documents lisent. Ils désignent n'importe quel objet — c'est
     * ce qui permet à un constat de mener au mur dont il parle — et n'en
     * modifient aucun.
     */
    const project = house();
    for (const id of oneOfEach().values()) {
      expect(canEdit('CHECKS', project, id), id).toBe(false);
      expect(canEdit('DOCUMENTS', project, id), id).toBe(false);
      expect(canEdit('PROJECT', project, id), id).toBe(false);
    }
  });

  it('never traps an object no stage claims', () => {
    /*
     * Une famille ajoutée demain, un identifiant qui ne répond plus : sans
     * propriétaire, l'objet se modifie partout. L'inverse — le refuser
     * partout — en ferait un objet visible que plus rien ne corrige.
     */
    const project = house();
    expect(ownerStageOf(project, 'objet-qui-n-existe-pas')).toBeUndefined();
    for (const stage of CREATION_STAGES)
      expect(canEdit(stage, project, 'objet-qui-n-existe-pas')).toBe(true);
  });

  it('names every object a stage refuses, and not merely that it refuses', () => {
    const project = house();
    const wall = oneOfEach().get('WALL')!;
    expect(unownedIn('BUILDING', project, [wall, 'site:parcel'])).toEqual([
      'site:parcel',
    ]);
    expect(unownedIn('SITE', project, [wall, 'site:parcel'])).toEqual([wall]);
  });
});
