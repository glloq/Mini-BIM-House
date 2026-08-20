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
