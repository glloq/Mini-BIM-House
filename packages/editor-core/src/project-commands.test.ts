import { describe, expect, it } from 'vitest';
import { assemblyId } from '@house-technical-designer/assemblies';
import {
  entityId,
  type Project,
  type TechnicalNetwork,
  type Wall,
} from '@house-technical-designer/core-domain';
import {
  ASSEMBLY_INVALIDATION_DOMAINS,
  ProjectEditorCommand,
  ProjectCommandDispatcher,
  ReplaceProjectCommand,
} from './project-commands.js';
import { AddWallCommand } from './wall-commands.js';

const initial: Project = {
  id: entityId<'Project'>('project'),
  metadata: {
    name: 'Integration',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  site: { northAngleDeg: 0 },
  building: {
    levels: [
      {
        id: entityId<'Level'>('level'),
        name: 'Ground',
        elevationMm: 0,
        defaultStoreyHeightMm: 2500,
        walls: [],
        slabs: [],
        roofs: [],
        openings: [],
        stairs: [],
        spaces: [],
        annotations: [],
      },
    ],
    zones: [],
  },
  assemblies: [],
  systems: [],
};
const wall = (id: string): Wall => ({
  id: entityId<'Wall'>(id),
  type: 'WALL',
  levelId: entityId<'Level'>('level'),
  path: {
    points: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
    ],
  },
  referenceSide: 'CENTER',
  assemblyId: assemblyId('assembly'),
  baseOffsetMm: 0,
  heightMode: 'EXPLICIT',
  heightMm: 2500,
  role: 'EXTERIOR',
});
const network: TechnicalNetwork = {
  id: 'water',
  discipline: 'WATER',
  systemType: 'COLD_WATER',
  nodes: [],
  ports: [],
  edges: [],
};

function replace(
  id: string,
  update: (project: Project) => Project,
  domains: readonly string[],
) {
  return new ReplaceProjectCommand(id, id, update, {
    objectIds: [id],
    domains,
  });
}
function walls(project: Project, values: readonly Wall[]): Project {
  const level = project.building.levels[0]!;
  return {
    ...project,
    building: { ...project.building, levels: [{ ...level, walls: values }] },
  };
}

describe('canonical project commands', () => {
  it('routes existing wall-tool commands through canonical project state', () => {
    const project = {
      ...initial,
      assemblies: [
        {
          id: assemblyId('assembly'),
          name: 'Wall',
          category: 'WALL' as const,
          layers: [],
        },
      ],
    };
    const dispatcher = new ProjectCommandDispatcher(project);
    dispatcher.dispatch(
      new ProjectEditorCommand(
        'add-wall',
        'Add wall',
        'level',
        new AddWallCommand('legacy-add', wall('wall')),
      ),
    );
    expect(dispatcher.project.building.levels[0]?.walls).toHaveLength(1);
    dispatcher.undo();
    expect(dispatcher.project).toEqual(project);
  });
  it('undoes and redoes cross-domain project mutations exactly', () => {
    const dispatcher = new ProjectCommandDispatcher(initial);
    const commands = [
      replace(
        'wall-a',
        (project) =>
          walls(project, [
            ...project.building.levels[0]!.walls,
            wall('wall-a'),
          ]),
        ['geometry'],
      ),
      replace(
        'wall-b',
        (project) =>
          walls(project, [
            ...project.building.levels[0]!.walls,
            wall('wall-b'),
          ]),
        ['geometry'],
      ),
      replace('network', (project) => ({ ...project, systems: [network] }), [
        'water-network',
      ]),
      replace(
        'assembly',
        (project) => ({ ...project, assemblies: [] }),
        ASSEMBLY_INVALIDATION_DOMAINS,
      ),
    ];
    const changes = commands.map((command) => dispatcher.dispatch(command));
    expect(changes[3]).toMatchObject({
      status: 'APPLIED',
      changes: {
        domains: expect.arrayContaining([
          'thermal',
          'energy',
          'drawing-overlays',
        ]),
      },
    });
    expect(
      (changes[3] as { changes: { domains: readonly string[] } }).changes
        .domains,
    ).not.toContain('wastewater-topology');
    const completed = structuredClone(dispatcher.project);
    commands.forEach(() => dispatcher.undo());
    expect(dispatcher.project).toEqual(initial);
    commands.forEach(() => dispatcher.redo());
    expect(dispatcher.project).toEqual(completed);
  });
});
