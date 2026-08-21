import { describe, expect, it } from 'vitest';
import type {
  Project,
  ProjectFile,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import {
  AddComponentCommand,
  AddLevelCommand,
  AddSpaceCommand,
  DuplicateLevelCommand,
  ProjectCommandDispatcher,
  RemoveComponentCommand,
  RemoveEquipmentCommand,
  RemoveLevelCommand,
  RemoveSpaceCommand,
  UpdateComponentCommand,
  UpdateLevelCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  validateProjectFile,
} from '@house-technical-designer/project-io';
import { populatedProject } from '../test-support/populated-project.js';

function asFile(project: Project): ProjectFile {
  return {
    format: 'house-technical-designer-project',
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    project,
  };
}

/**
 * The invariant this suite exists for.
 *
 * A command must never be able to produce a project the importer refuses. The
 * application would then be writing files it cannot read back, and the user
 * would discover it on reopening — which is the worst possible moment.
 */
function stillReadable(project: Project): readonly string[] {
  return validateProjectFile(asFile(project)).map(
    ({ path, message }) => `${path} ${message}`,
  );
}

/** Every command worth running against the reference house, and its arguments. */
const COMMANDS: readonly {
  readonly name: string;
  readonly command: (project: Project) => ProjectCommand;
}[] = [
  {
    name: 'ajouter un niveau',
    command: () =>
      new AddLevelCommand({
        id: 'attic',
        name: 'Combles',
        elevationMm: 5400,
        defaultStoreyHeightMm: 2200,
      }),
  },
  {
    name: 'dupliquer un niveau',
    command: () =>
      new DuplicateLevelCommand('ground', {
        id: 'first',
        name: 'R+1',
        elevationMm: 2700,
        defaultStoreyHeightMm: 2500,
      }),
  },
  {
    name: 'déplacer un niveau',
    command: () => new UpdateLevelCommand('ground', { elevationMm: 300 }),
  },
  {
    name: 'poser un composant',
    command: () =>
      new AddComponentCommand('ground', {
        id: 'placed-pump',
        category: 'HEATING',
        position: { x: 1500, y: 1500 },
        elevationMm: 200,
        rotationDeg: 0,
      }),
  },
  {
    name: 'modifier un composant',
    command: () =>
      new UpdateComponentCommand('ground', 'component-radiator', {
        rotationDeg: 90,
      }),
  },
  {
    name: 'retirer un composant',
    command: () => new RemoveComponentCommand('ground', 'component-radiator'),
  },
  {
    name: 'ajouter une pièce',
    command: () =>
      new AddSpaceCommand('ground', {
        id: 'new-room',
        name: 'Cellier',
        category: 'STORAGE',
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 2000, y: 0 },
            { x: 2000, y: 2000 },
            { x: 0, y: 2000 },
          ],
        },
      }),
  },
];

describe('every command leaves a project the importer still reads', () => {
  it('starts from a project the importer accepts', () => {
    expect(stillReadable(populatedProject())).toEqual([]);
  });

  it.each(COMMANDS)('$name', ({ command }) => {
    const commands = new ProjectCommandDispatcher(populatedProject());
    const result = commands.dispatch(command(commands.project));
    // A command may refuse; what it may not do is accept and leave the file
    // unreadable.
    if (result.status !== 'APPLIED') return;
    expect(stillReadable(commands.project)).toEqual([]);
  });

  it('and so does undoing it', () => {
    for (const { command } of COMMANDS) {
      const commands = new ProjectCommandDispatcher(populatedProject());
      if (commands.dispatch(command(commands.project)).status !== 'APPLIED')
        continue;
      commands.undo();
      expect(stillReadable(commands.project)).toEqual([]);
    }
  });

  it('never deletes something another object still names', () => {
    // The four cases the audit named, and the one it did not: a model a placed
    // component stands for.
    const project = populatedProject();
    const commands = new ProjectCommandDispatcher({
      ...project,
      equipment: [
        {
          id: 'radiator-model',
          kind: 'RADIATOR',
          catalogKind: 'GENERIC',
          properties: {},
        },
      ],
      building: {
        ...project.building,
        levels: project.building.levels.map((level) => ({
          ...level,
          components: (level.components ?? []).map((component) => ({
            ...component,
            definitionId: 'radiator-model',
            spaceId: entityId<'Space'>(level.spaces[0]?.id ?? 'none'),
          })),
        })),
      },
    });
    expect(
      commands.dispatch(new RemoveEquipmentCommand('radiator-model')).status,
    ).toBe('REJECTED');
    const room = commands.project.building.levels[0]!.spaces[0]!;
    expect(
      commands.dispatch(new RemoveSpaceCommand('ground', room.id)).status,
    ).toBe('REJECTED');
    expect(commands.dispatch(new RemoveLevelCommand('ground')).status).toBe(
      'REJECTED',
    );
  });
});
