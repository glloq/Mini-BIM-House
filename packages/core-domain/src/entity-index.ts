import type { Level, Project } from './types.js';

/**
 * Every family of object the project gives an identifier to.
 *
 * This list is the reason the file exists. Six parts of the application walk
 * the project looking for objects — validation, selection, the tree, the
 * command palette, scenario paths, deletion — and each of them used to hold
 * its own list of families. A family added to the model reached some of the
 * six and not the others: an object could be drawn and impossible to find, or
 * checked for uniqueness in one place and not in another.
 */
export const ENTITY_FAMILIES = [
  'PROJECT',
  'LEVEL',
  'WALL',
  'OPENING',
  'SPACE',
  'SLAB',
  'ROOF_PLANE',
  'ROOF_STRUCTURE',
  'STAIR',
  'STRUCTURAL_MEMBER',
  'COMPONENT',
  'ANNOTATION',
  'ZONE',
  'SITE_OBSTACLE',
  'MATERIAL',
  'ASSEMBLY',
  'ASSEMBLY_LAYER',
  'EQUIPMENT_DEFINITION',
  'NETWORK',
  'NETWORK_NODE',
  'NETWORK_PORT',
  'NETWORK_EDGE',
  'SCENARIO',
  'DRAWING_VIEW',
  'SHEET',
  'SHEET_VIEWPORT',
] as const;
export type EntityFamily = (typeof ENTITY_FAMILIES)[number];

/**
 * How far an identifier has to be unique.
 *
 * `GLOBAL` is what a click, a scenario path or a dimension addresses: two
 * objects sharing one would make a selection ambiguous and a scenario point at
 * either of them. `LOCAL` is addressed through its parent — an assembly layer
 * is `assemblies/<assembly>/layers/<layer>` — so it only has to be unique
 * inside it, and asking for more would refuse files that read perfectly.
 */
export type EntityScope = 'GLOBAL' | 'LOCAL';

export interface ProjectEntity {
  readonly id: string;
  readonly family: EntityFamily;
  readonly scope: EntityScope;
  /** Where it lives in the file, addressed by identity. */
  readonly path: string;
  /** The storey it belongs to, when it belongs to one. */
  readonly levelId?: string;
  /** What it is called, when it is called anything but its identifier. */
  readonly label?: string;
  /**
   * The object itself, so that whatever asks « what does this hold » does not
   * have to walk the project a second time to find out.
   *
   * The same object, not a copy: nothing here is worth duplicating a project
   * for, and a copy would be a second answer that stops agreeing.
   */
  readonly value: unknown;
}

interface EntityExtra {
  readonly scope?: EntityScope;
  readonly levelId?: string;
  readonly label?: string;
  readonly value?: unknown;
}

/**
 * Every identified object of the project, in one pass.
 *
 * The single source of truth for « what objects does this project hold ». A
 * family missing from here is a family the application cannot check, find,
 * list or address — which is why a test walks the whole project looking for
 * anything carrying an identifier and refuses to let one go unclaimed.
 */
function collect(): {
  readonly entities: ProjectEntity[];
  readonly add: (
    id: string,
    family: EntityFamily,
    path: string,
    extra?: EntityExtra,
  ) => void;
} {
  const entities: ProjectEntity[] = [];
  return {
    entities,
    add: (id, family, path, extra = {}) => {
      entities.push({
        id,
        family,
        scope: extra.scope ?? 'GLOBAL',
        path,
        ...(extra.levelId === undefined ? {} : { levelId: extra.levelId }),
        ...(extra.label === undefined ? {} : { label: extra.label }),
        value: extra.value,
      });
    },
  };
}

/**
 * Every identified object of one storey.
 *
 * Asked on its own by everything that reasons about a single storey — what may
 * host a component, what a plan shows — so that such a question is answered by
 * the same walk as « what does this project hold », and not by a second list
 * that agrees with it until someone adds a family.
 */
export function levelEntities(level: Level): readonly ProjectEntity[] {
  const { entities, add } = collect();
  const at = `building/levels/${level.id}`;
  add(level.id, 'LEVEL', at, { label: level.name, value: level });
  const on = { levelId: level.id };
  for (const wall of level.walls)
    add(wall.id, 'WALL', `${at}/walls/${wall.id}`, { ...on, value: wall });
  for (const opening of level.openings)
    add(opening.id, 'OPENING', `${at}/openings/${opening.id}`, {
      ...on,
      value: opening,
    });
  for (const space of level.spaces)
    add(space.id, 'SPACE', `${at}/spaces/${space.id}`, {
      ...on,
      label: space.name,
      value: space,
    });
  for (const slab of level.slabs)
    add(slab.id, 'SLAB', `${at}/slabs/${slab.id}`, { ...on, value: slab });
  for (const roof of level.roofs)
    add(roof.id, 'ROOF_PLANE', `${at}/roofs/${roof.id}`, {
      ...on,
      value: roof,
    });
  for (const roof of level.roofStructures ?? [])
    add(roof.id, 'ROOF_STRUCTURE', `${at}/roofStructures/${roof.id}`, {
      ...on,
      value: roof,
    });
  for (const stair of level.stairs)
    add(stair.id, 'STAIR', `${at}/stairs/${stair.id}`, { ...on, value: stair });
  for (const member of level.structure ?? [])
    add(member.id, 'STRUCTURAL_MEMBER', `${at}/structure/${member.id}`, {
      ...on,
      value: member,
    });
  for (const component of level.components ?? [])
    add(component.id, 'COMPONENT', `${at}/components/${component.id}`, {
      ...on,
      ...(component.name === undefined ? {} : { label: component.name }),
      value: component,
    });
  for (const annotation of level.annotations)
    add(annotation.id, 'ANNOTATION', `${at}/annotations/${annotation.id}`, {
      ...on,
      value: annotation,
    });
  return entities;
}

export function projectEntities(project: Project): readonly ProjectEntity[] {
  const { entities, add } = collect();

  // The project itself carries an identifier, and a wall called `project`
  // would collide with it exactly as two walls would.
  add(project.id, 'PROJECT', 'id', {
    label: project.metadata.name,
    value: project,
  });

  for (const level of project.building.levels)
    entities.push(...levelEntities(level));
  for (const zone of project.building.zones ?? [])
    add(zone.id, 'ZONE', `building/zones/${zone.id}`, {
      label: zone.name,
      value: zone,
    });
  for (const obstacle of project.site.obstacles ?? [])
    add(obstacle.id, 'SITE_OBSTACLE', `site/obstacles/${obstacle.id}`, {
      ...(obstacle.name === undefined ? {} : { label: obstacle.name }),
      value: obstacle,
    });
  for (const material of project.materialLibrary?.materials ?? [])
    add(material.id, 'MATERIAL', `materialLibrary/materials/${material.id}`, {
      label: material.name,
      value: material,
    });
  for (const assembly of project.assemblies ?? []) {
    add(assembly.id, 'ASSEMBLY', `assemblies/${assembly.id}`, {
      label: assembly.name,
      value: assembly,
    });
    for (const layer of assembly.layers)
      add(
        layer.id,
        'ASSEMBLY_LAYER',
        `assemblies/${assembly.id}/layers/${layer.id}`,
        { scope: 'LOCAL', value: layer },
      );
  }
  for (const definition of project.equipment ?? [])
    add(definition.id, 'EQUIPMENT_DEFINITION', `equipment/${definition.id}`, {
      value: definition,
    });
  for (const network of project.systems ?? []) {
    add(network.id, 'NETWORK', `systems/${network.id}`, { value: network });
    for (const node of network.nodes)
      add(node.id, 'NETWORK_NODE', `systems/${network.id}/nodes/${node.id}`, {
        value: node,
      });
    for (const port of network.ports)
      add(port.id, 'NETWORK_PORT', `systems/${network.id}/ports/${port.id}`, {
        value: port,
      });
    for (const edge of network.edges)
      add(edge.id, 'NETWORK_EDGE', `systems/${network.id}/edges/${edge.id}`, {
        value: edge,
      });
  }
  for (const scenario of project.scenarios ?? [])
    add(scenario.id, 'SCENARIO', `scenarios/${scenario.id}`, {
      label: scenario.name,
      value: scenario,
    });
  for (const view of project.drawingViews ?? [])
    add(view.id, 'DRAWING_VIEW', `drawingViews/${view.id}`, {
      label: view.name,
      value: view,
    });
  for (const sheet of project.sheets ?? []) {
    add(sheet.id, 'SHEET', `sheets/${sheet.id}`, {
      label: sheet.title,
      value: sheet,
    });
    for (const viewport of sheet.viewports)
      add(
        viewport.id,
        'SHEET_VIEWPORT',
        `sheets/${sheet.id}/viewports/${viewport.id}`,
        { scope: 'LOCAL', value: viewport },
      );
  }
  return entities;
}

/** The entity one identifier names, whichever family it belongs to. */
export function entityIndex(
  project: Project,
): ReadonlyMap<string, ProjectEntity> {
  const index = new Map<string, ProjectEntity>();
  for (const entity of projectEntities(project))
    if (entity.scope === 'GLOBAL' && !index.has(entity.id))
      index.set(entity.id, entity);
  return index;
}

export interface EntityCollision {
  readonly id: string;
  readonly entities: readonly ProjectEntity[];
}

/**
 * Identifiers two objects share, whichever families they belong to.
 *
 * A collision between two walls and a collision between a wall and a saved
 * view are the same defect: the application addresses objects by identifier
 * alone, so one click, one dimension or one scenario would reach either of
 * them. The families are reported because « the identifier X is used twice »
 * is not enough to go and fix it.
 */
export function entityCollisions(project: Project): readonly EntityCollision[] {
  const byId = new Map<string, ProjectEntity[]>();
  for (const entity of projectEntities(project)) {
    if (entity.scope !== 'GLOBAL') continue;
    const found = byId.get(entity.id);
    if (found === undefined) byId.set(entity.id, [entity]);
    else found.push(entity);
  }
  return [...byId]
    .filter(([, entities]) => entities.length > 1)
    .map(([id, entities]) => ({ id, entities }));
}

/**
 * Identifiers a local family repeats inside the same parent.
 *
 * An assembly layer is addressed through its assembly, so two assemblies may
 * both hold a layer called `insulation`; the same assembly holding two is a
 * path that reaches either of them.
 */
/**
 * Which families a variant is compared on.
 *
 * A scenario changes the house, not the file it is stored in: a wall, a room,
 * a placed appliance and a run are all things somebody can see change on the
 * plan. A saved view or a sheet is the drawing of that change, and reporting
 * one as « changed » would say the variant altered something it did not.
 *
 * Declared per family, so that adding one to the model fails the test that
 * checks this table until somebody has said which side it falls on.
 */
export const SCENARIO_DIFFABLE: Readonly<Record<EntityFamily, boolean>> = {
  PROJECT: false,
  LEVEL: true,
  WALL: true,
  OPENING: true,
  SPACE: true,
  SLAB: true,
  ROOF_PLANE: true,
  ROOF_STRUCTURE: true,
  STAIR: true,
  STRUCTURAL_MEMBER: true,
  COMPONENT: true,
  ANNOTATION: true,
  ZONE: true,
  SITE_OBSTACLE: true,
  MATERIAL: true,
  ASSEMBLY: true,
  // Addressed through its assembly, which is already compared as a whole.
  ASSEMBLY_LAYER: false,
  EQUIPMENT_DEFINITION: true,
  NETWORK: false,
  NETWORK_NODE: true,
  NETWORK_PORT: true,
  NETWORK_EDGE: true,
  // A variant is not a variant of the variants.
  SCENARIO: false,
  // The drawing of a change, not the change.
  DRAWING_VIEW: false,
  SHEET: false,
  SHEET_VIEWPORT: false,
};

export function localCollisions(project: Project): readonly EntityCollision[] {
  const byParent = new Map<string, ProjectEntity[]>();
  for (const entity of projectEntities(project)) {
    if (entity.scope !== 'LOCAL') continue;
    const parent = entity.path.slice(0, entity.path.lastIndexOf('/'));
    const key = `${parent} ${entity.id}`;
    const found = byParent.get(key);
    if (found === undefined) byParent.set(key, [entity]);
    else found.push(entity);
  }
  return [...byParent]
    .filter(([, entities]) => entities.length > 1)
    .map(([key, entities]) => ({
      id: key.slice(key.indexOf(' ') + 1),
      entities,
    }));
}
