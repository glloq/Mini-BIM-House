import { describe, expect, it } from 'vitest';

import {
  createEditorState,
  type EditorState,
  type EditorTool,
} from './editor-state.js';
import { toolInstruction } from './tool-instruction.js';
import {
  completionModeOf,
  EDITOR_TOOLS,
  isOpenEnded,
  requiredPoints,
} from './tool-registry.js';

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

  it('nomme le geste qui achève, et il n’est jamais Ctrl+Entrée', () => {
    // L'aide annonçait « Entrée : terminer le tracé » pendant que les champs
    // faisaient l'inverse. Une touche ne peut pas vouloir dire deux choses.
    for (const tool of EDITOR_TOOLS) {
      const mode = completionModeOf(tool.id);
      if (mode === undefined) continue;
      const said = toolInstruction(withTool(tool.id, 3)).finish!;
      expect(said, tool.id).toContain('Entrée');
      expect(said, tool.id).not.toContain('Ctrl');
      expect(said, tool.id).toContain(
        mode === 'CLOSE_POLYGON' ? 'Fermer la surface' : 'Terminer le tracé',
      );
    }
  });

  it('propose de recliquer le premier sommet, pour une surface seulement', () => {
    const parcel = toolInstruction(withTool('SITE', 3, [])).next;
    expect(parcel).toContain('premier sommet');
    // Un réseau n'a pas de premier sommet à rejoindre : il s'arrête où l'on
    // cesse de cliquer.
    expect(toolInstruction(withTool('NETWORK_ROUTE', 3)).next).not.toContain(
      'premier sommet',
    );
  });

  it('écrit ce que la surface mesure pendant qu’on la trace', () => {
    const drawn: EditorState = {
      ...base,
      activeTool: 'SITE',
      pendingPoints: [
        { x: 0, y: 0 },
        { x: 30_000, y: 0 },
        { x: 30_000, y: 25_000 },
        { x: 0, y: 25_000 },
      ],
    };
    expect(toolInstruction(drawn).measures).toBe('750,00 m² · 110,00 m');
    // Un chemin n'a pas d'aire, et rien de dégénéré ne s'écrit.
    expect(
      toolInstruction({ ...drawn, activeTool: 'NETWORK_ROUTE' }).measures,
    ).toBe('85,00 m');
    expect(toolInstruction(withTool('SITE', 4)).measures).toBeUndefined();
  });

  it('says what selection does, which is the resting state', () => {
    expect(toolInstruction(withTool('SELECT', 0)).next).toContain('bande');
    expect(toolInstruction(withTool('SELECT', 0, ['wall-1'])).next).toContain(
      'Glissez',
    );
  });
});
