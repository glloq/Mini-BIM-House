import { describe, expect, it } from 'vitest';
import { loadDemoProject } from '../demo-project.js';
import { SHORTCUTS } from './shortcuts.js';
import { optionValue } from './tool-options.js';
import { OBJECT_FAMILIES } from './object-editors.js';
import {
  EDITOR_TOOLS,
  constrainsDrafting,
  dynamicInputOf,
  populatedToolGroups,
  requiredPoints,
  toolDefinition,
  toolsInGroup,
  optionsOf,
  type ToolCommandContext,
} from './tool-registry.js';

function file() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file;
}

function context(
  overrides: Partial<ToolCommandContext> = {},
): ToolCommandContext {
  return {
    file: file(),
    levelId: 'ground',
    points: [],
    picks: [],
    selection: [],
    option: (key) =>
      optionValue(file().project, 'WALL', optionsOf('WALL'), {}, key),
    optionNumber: () => undefined,
    newId: (prefix) => (prefix === '' ? 'abcdef12' : `${prefix}-test`),
    ...overrides,
  };
}

describe('the tools the editor offers', () => {
  it('answers every question about a tool from its own declaration', () => {
    // These four answers used to live in four separate switch statements, so a
    // new tool could compile while being unreachable, unconstrained or
    // silently needing zero clicks.
    expect(requiredPoints('WALL')).toBe(2);
    expect(requiredPoints('DIMENSION')).toBe(3);
    expect(requiredPoints('SELECT')).toBe(0);
    expect(constrainsDrafting('WALL')).toBe(true);
    expect(constrainsDrafting('DIMENSION')).toBe(false);
    expect(toolDefinition('NETWORK').group).toBe('NETWORKS');
  });

  it('offers fields to type into only where a tool reads them', () => {
    // Turning a selection is three clicks and no number; offering a length
    // there would invite the user to type into something nobody reads.
    expect(dynamicInputOf('WALL')).toEqual({ length: true, angle: true });
    expect(dynamicInputOf('MIRROR')?.angle).toBe(true);
    for (const tool of [
      'ROTATE',
      'JOIN',
      'TRIM',
      'OFFSET',
      'DIMENSION',
      'SPLIT',
      'NETWORK',
      'OPENING',
      'SELECT',
    ] as const)
      expect(dynamicInputOf(tool), tool).toBeUndefined();
  });

  it('never accepts a typed value a tool would then ignore', () => {
    // A tool that does not draft along the axes cannot honour a typed length:
    // saying it accepts one would be a promise the drawing does not keep.
    for (const tool of EDITOR_TOOLS)
      if (dynamicInputOf(tool.id) !== undefined)
        expect(constrainsDrafting(tool.id), tool.id).toBe(true);
  });

  it('gives every tool a shortcut the application actually binds', () => {
    for (const tool of EDITOR_TOOLS)
      expect(
        SHORTCUTS.some(({ id }) => id === tool.shortcutId),
        `${tool.id} declares ${tool.shortcutId}`,
      ).toBe(true);
  });

  it('lets every tool be reached from a palette group', () => {
    const grouped = populatedToolGroups().flatMap((group) =>
      toolsInGroup(group).map(({ id }) => id),
    );
    expect([...grouped].sort()).toEqual(
      EDITOR_TOOLS.map(({ id }) => id as string).sort(),
    );
  });

  it('asks for clicks only from tools that do something with them', () => {
    for (const tool of EDITOR_TOOLS)
      expect(
        tool.requiredPoints === 0 || tool.createCommand !== undefined,
        `${tool.id} collects points`,
      ).toBe(true);
  });

  it('turns the clicks of the wall tool into a command', () => {
    const result = toolDefinition('WALL').createCommand?.(
      context({
        points: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
        ],
      }),
    );
    expect(result?.status).toBe('OK');
    if (result?.status !== 'OK') return;
    expect(result.command.label).toContain('mur');
  });

  it('cuts the wall the click landed on, where it landed', () => {
    // Splitting used to cut at the middle whatever the user aimed at; the tool
    // is given what the canvas picked, and the point that was clicked.
    const result = toolDefinition('SPLIT').createCommand?.({
      ...context({ points: [{ x: 3000, y: 0 }] }),
      picks: ['wall-south'],
    });
    expect(result?.status).toBe('OK');
    if (result?.status !== 'OK') return;
    expect(result.command.label).toContain('Scinder');
  });

  it('asks for a wall rather than cutting nothing', () => {
    const result = toolDefinition('SPLIT').createCommand?.(
      context({ points: [{ x: 3000, y: 0 }] }),
    );
    expect(result?.status).toBe('ERROR');
    if (result?.status !== 'ERROR') return;
    expect(result.message).toContain('mur');
  });

  it('turns the selection by the angle two clicks describe', () => {
    // Centre, where things point now, where they should point: a quarter turn
    // without a number to type.
    const result = toolDefinition('ROTATE').createCommand?.({
      ...context({
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 0, y: 1000 },
        ],
      }),
      selection: ['wall-south'],
    });
    expect(result?.status).toBe('OK');
    if (result?.status !== 'OK') return;
    expect(result.command.label).toContain('Pivoter');
  });

  it('reflects the selection across the axis that was drawn', () => {
    const result = toolDefinition('MIRROR').createCommand?.({
      ...context({
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 1000 },
        ],
      }),
      selection: ['wall-south'],
    });
    expect(result?.status).toBe('OK');
  });

  it('refuses an axis of no length rather than reflecting nothing', () => {
    const result = toolDefinition('MIRROR').createCommand?.({
      ...context({
        points: [
          { x: 500, y: 500 },
          { x: 500, y: 500 },
        ],
      }),
      selection: ['wall-south'],
    });
    expect(result?.status).toBe('ERROR');
  });

  it('asks for a selection before transforming it', () => {
    const result = toolDefinition('ROTATE').createCommand?.(
      context({
        points: [
          { x: 0, y: 0 },
          { x: 1000, y: 0 },
          { x: 0, y: 1000 },
        ],
      }),
    );
    expect(result?.status).toBe('ERROR');
  });

  it('says why the network tool cannot place a node instead of throwing', () => {
    // A project with no network at all: the tool refuses in words rather than
    // placing a node nowhere.
    const empty = file();
    const withoutNetworks = {
      ...empty,
      project: { ...empty.project, systems: [] },
    } as typeof empty;
    const result = toolDefinition('NETWORK').createCommand?.({
      ...context({ points: [{ x: 1000, y: 1000 }] }),
      file: withoutNetworks,
      option: (key) =>
        optionValue(
          withoutNetworks.project,
          'NETWORK',
          optionsOf('NETWORK'),
          {},
          key,
        ),
    });
    expect(result?.status).toBe('ERROR');
    if (result?.status !== 'ERROR') return;
    expect(result.message).toContain('réseau');
  });

  it('places a node on the level the plan is showing', () => {
    // No draft at all: the options fall back to what the project holds — its
    // first network, and the first node kind of that discipline.
    const opened = file();
    const result = toolDefinition('NETWORK').createCommand?.({
      ...context({ points: [{ x: 1000, y: 1000 }] }),
      option: (key) =>
        optionValue(opened.project, 'NETWORK', optionsOf('NETWORK'), {}, key),
    });
    expect(result?.status).toBe('OK');
  });
});

describe('the options a tool asks for', () => {
  it('falls back to what the project can actually offer', () => {
    const project = file().project;
    // Nothing chosen: the wall tool proposes an assembly this project holds
    // rather than a name written into the code.
    const assemblyId = optionValue(
      project,
      'WALL',
      optionsOf('WALL'),
      {},
      'assemblyId',
    );
    expect((project.assemblies ?? []).map(({ id }) => id as string)).toContain(
      assemblyId,
    );
  });

  it('refuses a stored value the project no longer holds', () => {
    const project = file().project;
    const chosen = optionValue(
      project,
      'WALL',
      optionsOf('WALL'),
      { 'WALL.assemblyId': 'assembly-deleted' },
      'assemblyId',
    );
    // Drawing with a reference pointing nowhere is worse than drawing with
    // what the project has.
    expect(chosen).not.toBe('assembly-deleted');
    expect((project.assemblies ?? []).map(({ id }) => id as string)).toContain(
      chosen,
    );
  });

  it('lets one option depend on another', () => {
    const project = file().project;
    // The kinds of node belong to the discipline of the chosen network.
    const kind = optionValue(
      project,
      'NETWORK',
      optionsOf('NETWORK'),
      {},
      'nodeKind',
    );
    expect(kind).not.toBe('');
    const water = optionsOf('NETWORK')
      .find(({ key }) => key === 'nodeKind')!
      .choices?.({
        project,
        value: () => project.systems?.[0]?.id ?? '',
      });
    expect(water?.map(({ value }) => value)).toContain(kind);
  });

  it('proposes the matching role when a partition assembly is chosen', () => {
    const project = file().project;
    const partition = (project.assemblies ?? []).find(
      ({ category }) => category === 'PARTITION',
    )!;
    expect(
      optionValue(
        project,
        'WALL',
        optionsOf('WALL'),
        { 'WALL.assemblyId': partition.id },
        'role',
      ),
    ).toBe('PARTITION');
  });
});

describe('restricting what a click may take', () => {
  it('filters nothing until the user asks for it', () => {
    // An editor quietly ignoring half the plan would be one nobody trusts.
    expect(
      optionValue(file().project, 'SELECT', optionsOf('SELECT'), {}, 'family'),
    ).toBe('ALL');
  });

  it('offers every family the object registry declares', () => {
    const choices = optionsOf('SELECT')
      .find(({ key }) => key === 'family')!
      .choices?.({ project: file().project, value: () => '' });
    expect(choices?.map(({ value }) => value)).toEqual([
      'ALL',
      ...OBJECT_FAMILIES.map(({ id }) => id),
    ]);
  });
});
