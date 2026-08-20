import { describe, expect, it } from 'vitest';
import { loadDemoProject } from '../demo-project.js';
import { SHORTCUTS } from './shortcuts.js';
import {
  EDITOR_TOOLS,
  constrainsDrafting,
  populatedToolGroups,
  requiredPoints,
  toolDefinition,
  toolsInGroup,
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
    drafts: {
      wallAssemblyId: 'assembly-exterior',
      wallRole: 'EXTERIOR',
      opening: {
        openingType: 'WINDOW',
        widthMm: 1200,
        heightMm: 1350,
        sillHeightMm: 900,
      },
      dimensionType: 'ALIGNED',
      nodeKind: 'FIXTURE',
    },
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
    // No network is active: the tool refuses in words rather than placing a
    // node nowhere.
    const result = toolDefinition('NETWORK').createCommand?.(
      context({ points: [{ x: 1000, y: 1000 }] }),
    );
    expect(result?.status).toBe('ERROR');
    if (result?.status !== 'ERROR') return;
    expect(result.message).toContain('réseau');
  });

  it('places a node on the level the plan is showing', () => {
    const result = toolDefinition('NETWORK').createCommand?.({
      ...context({ points: [{ x: 1000, y: 1000 }] }),
      drafts: { ...context().drafts, networkId: 'water', nodeKind: 'FIXTURE' },
    });
    expect(result?.status).toBe('OK');
  });
});
