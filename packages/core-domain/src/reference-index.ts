import { isDimension } from './annotation.js';
import {
  levelEntities,
  projectEntities,
  type EntityFamily,
} from './entity-index.js';
import type { Project } from './types.js';

/**
 * One object pointing at another.
 *
 * Deleting is the operation the model is least able to check, because what
 * makes a deletion unsafe is never in the thing being deleted: it is in
 * everything that happens to name it. A storey holding nothing can still be
 * the storey a wall climbs to, the storey a stair arrives at, the storey a
 * network node declares, the storey a saved view draws — and removing it left
 * four dangling references that the importer would then refuse.
 *
 * That refusal is the point: a command must never be able to produce a project
 * the importer will not read back. So the pointers are enumerated once, here,
 * and every deletion asks the same question.
 */
export interface ProjectReference {
  /** The object that points. */
  readonly fromId: string;
  readonly fromFamily: EntityFamily;
  /** The object pointed at. */
  readonly toId: string;
  /** Where the pointer lives in the file, addressed by identity. */
  readonly path: string;
  /** What the pointer means, said the way a user would say it. */
  readonly label: string;
}

interface Collector {
  readonly references: ProjectReference[];
  readonly add: (
    from: { readonly id: string; readonly family: EntityFamily },
    toId: string | undefined,
    path: string,
    label: string,
  ) => void;
}

function collector(): Collector {
  const references: ProjectReference[] = [];
  return {
    references,
    add: (from, toId, path, label) => {
      if (toId === undefined) return;
      references.push({
        fromId: from.id,
        fromFamily: from.family,
        toId,
        path,
        label,
      });
    },
  };
}

/**
 * Every pointer the project holds, in one pass.
 *
 * The single source of truth for « what would break if this object went
 * away ». A pointer missing from here is a pointer no deletion checks, which
 * is why a test walks the whole project looking for any string that names an
 * object and refuses to let one go unclaimed.
 */
export function projectReferences(
  project: Project,
): readonly ProjectReference[] {
  const { references, add } = collector();

  for (const level of project.building.levels) {
    const at = `building/levels/${level.id}`;
    // Everything on a storey names it. These pointers go away with the storey
    // they name, so they never block its deletion — but they are pointers, and
    // an index that did not hold them would be an index somebody could not
    // trust for the ones that do.
    for (const entity of levelEntities(level))
      if (entity.family !== 'LEVEL')
        add(
          { id: entity.id, family: entity.family },
          level.id,
          `${entity.path}/levelId`,
          'le niveau où il se trouve',
        );
    for (const wall of level.walls) {
      const from = { id: wall.id as string, family: 'WALL' as const };
      add(
        from,
        wall.assemblyId,
        `${at}/walls/${wall.id}/assemblyId`,
        'sa paroi',
      );
      if (wall.heightMode === 'TO_LEVEL')
        add(
          from,
          wall.topLevelId,
          `${at}/walls/${wall.id}/topLevelId`,
          'le niveau jusqu’auquel il monte',
        );
    }
    for (const opening of level.openings) {
      const from = { id: opening.id as string, family: 'OPENING' as const };
      add(
        from,
        opening.host.id,
        `${at}/openings/${opening.id}/host`,
        'le mur qu’elle perce',
      );
      add(
        from,
        opening.definitionId,
        `${at}/openings/${opening.id}/definitionId`,
        'son modèle',
      );
    }
    for (const slab of level.slabs)
      add(
        { id: slab.id, family: 'SLAB' },
        slab.assemblyId,
        `${at}/slabs/${slab.id}/assemblyId`,
        'sa composition',
      );
    for (const roof of level.roofs)
      add(
        { id: roof.id, family: 'ROOF_PLANE' },
        roof.assemblyId,
        `${at}/roofs/${roof.id}/assemblyId`,
        'sa composition',
      );
    for (const roof of level.roofStructures ?? [])
      add(
        { id: roof.id, family: 'ROOF_STRUCTURE' },
        roof.assemblyId,
        `${at}/roofStructures/${roof.id}/assemblyId`,
        'sa composition',
      );
    for (const stair of level.stairs)
      add(
        { id: stair.id, family: 'STAIR' },
        stair.topLevelId,
        `${at}/stairs/${stair.id}/topLevelId`,
        'le niveau où il arrive',
      );
    for (const component of level.components ?? []) {
      const from = {
        id: component.id as string,
        family: 'COMPONENT' as const,
      };
      const where = `${at}/components/${component.id}`;
      add(from, component.definitionId, `${where}/definitionId`, 'son modèle');
      add(from, component.hostObjectId, `${where}/hostObjectId`, 'son support');
      add(from, component.spaceId, `${where}/spaceId`, 'la pièce où il est');
    }
    for (const annotation of level.annotations) {
      if (!isDimension(annotation)) continue;
      const from = {
        id: annotation.id as string,
        family: 'ANNOTATION' as const,
      };
      const where = `${at}/annotations/${annotation.id}`;
      add(
        from,
        annotation.first.wallId,
        `${where}/first/wallId`,
        'ce qu’elle mesure',
      );
      add(
        from,
        annotation.second.wallId,
        `${where}/second/wallId`,
        'ce qu’elle mesure',
      );
    }
  }

  for (const zone of project.building.zones ?? [])
    for (const spaceId of zone.spaceIds)
      add(
        { id: zone.id, family: 'ZONE' },
        spaceId,
        `building/zones/${zone.id}/spaceIds`,
        'une pièce qu’elle rassemble',
      );

  for (const assembly of project.assemblies ?? [])
    for (const layer of assembly.layers)
      add(
        { id: assembly.id, family: 'ASSEMBLY' },
        layer.materialId,
        `assemblies/${assembly.id}/layers/${layer.id}/materialId`,
        'le matériau d’une de ses couches',
      );

  for (const network of project.systems ?? []) {
    const where = `systems/${network.id}`;
    for (const node of network.nodes) {
      const from = { id: node.id, family: 'NETWORK_NODE' as const };
      const at = `${where}/nodes/${node.id}`;
      add(from, node.levelId, `${at}/levelId`, 'le niveau où il est');
      add(from, node.spaceId, `${at}/spaceId`, 'la pièce qu’il dessert');
      add(from, node.hostObjectId, `${at}/hostObjectId`, 'son support');
      add(
        from,
        node.equipmentId,
        `${at}/equipmentId`,
        'le modèle qu’il représente',
      );
      add(
        from,
        node.componentId,
        `${at}/componentId`,
        'l’objet posé qu’il représente',
      );
    }
    for (const port of network.ports)
      add(
        { id: port.id, family: 'NETWORK_PORT' },
        port.nodeId,
        `${where}/ports/${port.id}/nodeId`,
        'le nœud qu’il équipe',
      );
    for (const edge of network.edges) {
      const from = { id: edge.id, family: 'NETWORK_EDGE' as const };
      const at = `${where}/edges/${edge.id}`;
      add(from, edge.fromPortId, `${at}/fromPortId`, 'le port dont il part');
      add(from, edge.toPortId, `${at}/toPortId`, 'le port où il arrive');
    }
  }

  for (const view of project.drawingViews ?? [])
    add(
      { id: view.id, family: 'DRAWING_VIEW' },
      view.levelId,
      `drawingViews/${view.id}/levelId`,
      'le niveau qu’elle montre',
    );

  for (const sheet of project.sheets ?? [])
    for (const viewport of sheet.viewports)
      add(
        { id: viewport.id, family: 'SHEET_VIEWPORT' },
        viewport.viewId,
        `sheets/${sheet.id}/viewports/${viewport.id}/viewId`,
        'la vue qu’elle cadre',
      );

  return references;
}

/** Everything that points at each object, by the object pointed at. */
export function referenceIndex(
  project: Project,
): ReadonlyMap<string, readonly ProjectReference[]> {
  const index = new Map<string, ProjectReference[]>();
  for (const reference of projectReferences(project)) {
    const held = index.get(reference.toId);
    if (held === undefined) index.set(reference.toId, [reference]);
    else held.push(reference);
  }
  return index;
}

/** What points at this object, which is what deleting it would break. */
export function referencesTo(
  project: Project,
  id: string,
): readonly ProjectReference[] {
  return projectReferences(project).filter(
    (reference) => reference.toId === id,
  );
}

/**
 * What deleting a whole storey would break, from outside the storey.
 *
 * The objects on the storey go with it, so a wall of that storey pointing at
 * an assembly is not a problem; what matters is a pointer coming from
 * somewhere else, or a pointer at the storey itself.
 */
export function referencesFromOutsideLevel(
  project: Project,
  levelId: string,
): readonly ProjectReference[] {
  const level = project.building.levels.find(({ id }) => id === levelId);
  const inside = new Set<string>(
    level === undefined ? [] : levelEntities(level).map(({ id }) => id),
  );
  const going = new Set<string>([levelId, ...inside]);
  return projectReferences(project).filter(
    (reference) => going.has(reference.toId) && !inside.has(reference.fromId),
  );
}

/**
 * A pointer that names nothing.
 *
 * The importer checked its references one loop at a time: openings against
 * their host wall, nodes against their level, viewports against their view.
 * Every loop was correct and the set of them was never complete — an opening
 * naming a model the file does not carry went in without a word, because
 * nobody had written that particular loop.
 *
 * This is the same question asked once, over every pointer the project holds.
 * The specific rules stay where they are: they say *which* object a pointer
 * may name — the same storey, the right kind of host, the right discipline —
 * and this one says only that the object exists at all.
 */
export interface DanglingReference extends ProjectReference {
  readonly message: string;
}

export function danglingReferences(
  project: Project,
): readonly DanglingReference[] {
  const known = new Set(projectEntities(project).map(({ id }) => id));
  return projectReferences(project)
    .filter((reference) => !known.has(reference.toId))
    .map((reference) => ({
      ...reference,
      message: `${reference.path} nomme ${reference.label} « ${reference.toId} », que le projet ne tient pas.`,
    }));
}
