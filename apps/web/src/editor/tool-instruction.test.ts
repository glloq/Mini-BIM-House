import { describe, expect, it } from 'vitest';

import {
  createEditorState,
  type EditorState,
  type EditorTool,
} from './editor-state.js';
import { toolInstruction } from './tool-instruction.js';
import { EDITOR_TOOLS, isOpenEnded, requiredPoints } from './tool-registry.js';

const base = createEditorState({ widthPx: 800, heightPx: 600 });

const withTool = (
  tool: EditorTool,
  points: number,
  selection: readonly string[] = [],
): EditorState => ({
  ...base,
  activeTool: tool,
  selection,
  pendingPoints: Array.from({ length: points }, () => ({ x: 0, y: 0 })),
});

describe('what the active tool says it expects', () => {
  it('answers for every tool of the registry, at every stage of its draft', () => {
    // Un outil sans phrase est un outil qu'on découvre en se trompant. Aucun
    // ne l'écrit lui-même : elle est dérivée, donc aucun ne peut l'oublier.
    for (const tool of EDITOR_TOOLS) {
      const wanted = requiredPoints(tool.id);
      for (let placed = 0; placed <= wanted; placed += 1) {
        const said = toolInstruction(withTool(tool.id, placed));
        expect(said.next.length, `${tool.id} @${placed}`).toBeGreaterThan(0);
        expect(said.next.endsWith('.'), `${tool.id} @${placed}`).toBe(true);
      }
    }
  });

  it('says how to end a draft that does not end on its own', () => {
    // « Entrée termine » n'était écrit nulle part, et un mur continu ne
    // s'arrête pas tout seul.
    for (const tool of EDITOR_TOOLS) {
      if (!isOpenEnded(tool.id)) continue;
      expect(toolInstruction(withTool(tool.id, 2)).finish).toContain('Entrée');
    }
  });

  it('offers a way out as soon as something is drafted', () => {
    for (const tool of EDITOR_TOOLS) {
      if (tool.id === 'SELECT') continue;
      expect(toolInstruction(withTool(tool.id, 1)).finish, tool.id).toContain(
        'Échap',
      );
      // Rien à abandonner tant que rien n'est posé.
      expect(toolInstruction(withTool(tool.id, 0)).finish).toBeUndefined();
    }
  });

  it('counts what is left rather than what is asked', () => {
    const wall = withTool('WALL', 1);
    expect(toolInstruction(wall).next).toBe('Cliquez le second point.');
    expect(toolInstruction(withTool('WALL', 0)).next).toBe(
      'Cliquez le premier point.',
    );
    // Un outil d'un seul point dit ce qu'il pose, parce que « le premier
    // point » d'un composant ne veut rien dire.
    expect(toolInstruction(withTool('COMPONENT', 0)).next).toContain('poser');
  });

  it('says what selection does, which is the resting state', () => {
    expect(toolInstruction(withTool('SELECT', 0)).next).toContain('bande');
    expect(toolInstruction(withTool('SELECT', 0, ['wall-1'])).next).toContain(
      'Glissez',
    );
  });
});
