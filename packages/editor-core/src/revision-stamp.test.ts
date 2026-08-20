import { describe, expect, it } from 'vitest';
import { entityId, type Project } from '@house-technical-designer/core-domain';
import {
  ProjectCommandDispatcher,
  ReplaceProjectCommand,
} from './project-commands.js';
import {
  AddScenarioCommand,
  RebaseScenarioCommand,
  projectScenarios,
} from './scenario-commands.js';
import { UpdateProjectMetadataCommand } from './project-settings-commands.js';

function project(revision?: string): Project {
  return {
    id: entityId<'Project'>('project'),
    metadata: {
      name: 'Révisions',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      ...(revision === undefined ? {} : { projectRevision: revision }),
    },
    site: { northAngleDeg: 0 },
    building: { levels: [], zones: [] },
    systems: [],
  };
}

function clock(): () => string {
  let tick = 0;
  return () => `2026-03-0${++tick}T00:00:00.000Z`;
}

function rename(name: string): ReplaceProjectCommand {
  return new ReplaceProjectCommand(
    `rename:${name}`,
    'Renommer',
    (current) => ({ ...current, metadata: { ...current.metadata, name } }),
    { objectIds: [], domains: ['metadata'] },
  );
}

function dispatcher(revision?: string): ProjectCommandDispatcher {
  return new ProjectCommandDispatcher(project(revision), 100, clock());
}

describe('revision and updatedAt stamping', () => {
  it('numbers each applied command and dates it', () => {
    const commands = dispatcher();
    commands.dispatch(rename('A'));
    expect(commands.project.metadata.projectRevision).toBe('1');
    expect(commands.project.metadata.updatedAt).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    commands.dispatch(rename('B'));
    expect(commands.project.metadata.projectRevision).toBe('2');
    expect(commands.project.metadata.updatedAt).toBe(
      '2026-03-02T00:00:00.000Z',
    );
  });

  it('continues from the revision the opened project carries', () => {
    const commands = dispatcher('7');
    commands.dispatch(rename('A'));
    expect(commands.project.metadata.projectRevision).toBe('8');
  });

  it('moves forward on undo and redo rather than back', () => {
    const commands = dispatcher();
    commands.dispatch(rename('A'));
    commands.dispatch(rename('B'));
    commands.undo();
    expect(commands.project.metadata.name).toBe('A');
    expect(commands.project.metadata.projectRevision).toBe('3');
    commands.redo();
    expect(commands.project.metadata.name).toBe('B');
    expect(commands.project.metadata.projectRevision).toBe('4');
  });

  it('leaves the revision alone when a command is rejected', () => {
    const commands = dispatcher();
    commands.dispatch(rename('A'));
    const rejected = commands.dispatch(
      new UpdateProjectMetadataCommand({ name: '   ' }),
    );
    expect(rejected.status).toBe('REJECTED');
    expect(commands.project.metadata.projectRevision).toBe('1');
    expect(commands.project.metadata.updatedAt).toBe(
      '2026-03-01T00:00:00.000Z',
    );
  });

  it('ignores a revision a command tries to write itself', () => {
    const commands = dispatcher();
    commands.dispatch(
      new ReplaceProjectCommand(
        'forge',
        'Forger une révision',
        (current) => ({
          ...current,
          metadata: { ...current.metadata, projectRevision: '999' },
        }),
        { objectIds: [], domains: ['metadata'] },
      ),
    );
    expect(commands.project.metadata.projectRevision).toBe('1');
  });
});

describe('scenarios against the project revision', () => {
  it('records the revision the creating command produces', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddScenarioCommand({
        id: 'scenario-a',
        name: 'Isolation renforcée',
        baseProjectRevision: '',
        overrides: [],
      }),
    );
    // The revision recorded is the one the project ends up at, so the scenario
    // is not stale the instant it is created.
    expect(projectScenarios(commands.project)[0]?.baseProjectRevision).toBe(
      commands.project.metadata.projectRevision,
    );
    expect(commands.project.metadata.projectRevision).toBe('1');
  });

  it('falls behind the project once it moves, and catches up when rebased', () => {
    const commands = dispatcher();
    commands.dispatch(
      new AddScenarioCommand({
        id: 'scenario-a',
        name: 'Isolation renforcée',
        baseProjectRevision: '',
        overrides: [],
      }),
    );
    commands.dispatch(rename('Projet renommé'));
    expect(projectScenarios(commands.project)[0]?.baseProjectRevision).not.toBe(
      commands.project.metadata.projectRevision,
    );
    commands.dispatch(new RebaseScenarioCommand('scenario-a'));
    expect(projectScenarios(commands.project)[0]?.baseProjectRevision).toBe(
      commands.project.metadata.projectRevision,
    );
  });
});
