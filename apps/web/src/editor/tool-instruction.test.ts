import { describe, expect, it } from 'vitest';

import {
  createEditorState,
  type EditorState,
  type EditorTool,
} from './editor-state.js';
import { defaultPointPrompt, toolInstruction } from './tool-instruction.js';
import {
  completionModeOf,
  EDITOR_TOOLS,
  interactionOf,
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
    // Trois clics : celui qu'on fait est nommé, et ceux qui restent comptés.
    expect(toolInstruction(withTool('DIMENSION', 1)).next).toContain(
      '2 restant(s)',
    );
    expect(toolInstruction(withTool('DIMENSION', 0)).next).not.toContain(
      'restant',
    );
    // Deux clics : « il en reste un » après le premier n'apprend rien.
    expect(toolInstruction(withTool('WALL', 1)).next).not.toContain('restant');
  });

  it('dit ce que le clic vise, et non son rang, quand l’outil le déclare', () => {
    // Le grief de fond : « premier point / second point » est exact et muet.
    // Décaler demande un mur puis un côté, et ces deux gestes n'ont rien de
    // commun ; les nommer par leur rang le cachait.
    expect(toolInstruction(withTool('OFFSET', 0)).next).toBe(
      'Cliquez le mur à décaler.',
    );
    expect(toolInstruction(withTool('OFFSET', 1)).next).toBe(
      'Cliquez le côté du mur et la distance voulue.',
    );
    expect(toolInstruction(withTool('WALL', 0)).next).toBe(
      'Cliquez le début du mur.',
    );
    expect(toolInstruction(withTool('WALL', 1)).next).toBe(
      'Cliquez son extrémité.',
    );
    // Un outil d'un seul clic aussi : « où poser ouverture » ne disait pas
    // qu'il faut viser un mur, et un clic dans le vide ne perçait rien.
    expect(toolInstruction(withTool('OPENING', 0)).next).toBe(
      'Cliquez le mur qui recevra la porte ou la fenêtre.',
    );
  });

  it('emprunte les mots de l’outil sans lui laisser la phrase entière', () => {
    // L'étape fournit ce que le clic vise ; ce qui est déjà posé, comment on
    // referme et comment on sort restent composés ici. Un outil qui écrirait
    // sa phrase complète serait un outil de plus à ne pas oublier de mettre à
    // jour, et c'est exactement ce qu'on refuse.
    const said = toolInstruction(withTool('SITE', 3));
    expect(said.next).toBe(
      'Cliquez le coin suivant — 3 posé(s), ou recliquez le premier sommet.',
    );
    expect(said.finish).toContain('Fermer la surface');
  });

  it('répète la dernière étape pour un tracé qui n’a pas de dernier clic', () => {
    // Un mur continu n'a pas de trentième coin qui mérite sa propre phrase.
    const steps = interactionOf('WALL_RUN')!;
    const last = steps[steps.length - 1]!.prompt;
    for (const placed of [2, 3, 9]) {
      expect(toolInstruction(withTool('WALL_RUN', placed)).next).toContain(
        last,
      );
    }
  });

  it('décrit par le rang l’outil qui ne déclare rien, exactement comme avant', () => {
    // La promesse faite à tout outil ajouté demain sans étapes : la phrase
    // dérivée du seul nombre de points, mot pour mot celle d'hier. On la
    // vérifie ici plutôt qu'à travers le registre, dont la part d'outils non
    // déclarés a vocation à tomber à zéro.
    expect(defaultPointPrompt(0, 2)).toBe('Cliquez le premier point');
    expect(defaultPointPrompt(1, 2)).toBe('Cliquez le second point');
    expect(defaultPointPrompt(1, 3)).toBe('Cliquez le deuxième point');
    expect(defaultPointPrompt(2, 3)).toBe('Cliquez le troisième point');
    expect(defaultPointPrompt(5, 9)).toBe('Cliquez le 6ᵉ point');
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
