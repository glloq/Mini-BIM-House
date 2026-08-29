/**
 * Ce qu'une touche fait, et la preuve qu'elle ne le fait qu'une fois.
 *
 * `resolveShortcut` rend **le premier candidat déclaré** parmi ceux qui
 * correspondent — c'est ce qui permet à `Maj + Z` de ne jamais retomber sur
 * `Z`. Le revers est qu'un accord déclaré deux fois ne fait pas d'erreur : la
 * seconde déclaration reste muette, et c'est l'outil le plus récent qui paraît
 * cassé, sans que rien ne le dise. L'alphabet étant à peu près plein, la
 * prochaine touche donnée sera donnée près d'une touche prise.
 *
 * Ce fichier tient donc deux choses : que les accords documentés répondent, et
 * qu'**aucun accord n'est déclaré deux fois** — ce qu'aucun test ne vérifiait
 * jusqu'ici, alors que c'est la seule faute que le registre laisse passer en
 * silence.
 */
import { describe, expect, it } from 'vitest';

import { EDITOR_TOOLS } from './tool-registry.js';
import {
  SHORTCUTS,
  resolveShortcut,
  shortcutLabel,
  type ShortcutBinding,
} from './shortcuts.js';

function key(
  init: Partial<Parameters<typeof resolveShortcut>[0]> & { key: string },
) {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  };
}

/** L'accord d'une déclaration, écrit comme une seule chaîne comparable. */
function chord(binding: ShortcutBinding): string {
  return [
    binding.ctrlOrMeta === true ? 'Ctrl' : '',
    binding.shift === true ? 'Maj' : '',
    binding.key.toLowerCase(),
  ].join('+');
}

describe('le registre des raccourcis', () => {
  /*
   * Les deux accords que le registre déclare déjà deux fois.
   *
   * Écrits noir sur blanc plutôt que passés sous silence, et le test tombe
   * aussi bien si l'un disparaît que si un troisième apparaît : une liste
   * d'exceptions qu'on ne relit jamais finit par tout excuser.
   *
   * - **Échap** est délibéré. `tool.select` et `edit.cancel` nomment le même
   *   geste vu de deux endroits, et `runShortcut` traite `tool.select` en
   *   défaisant l'action en cours : la seconde déclaration existe pour être
   *   listée dans l'aide, pas pour être résolue.
   * - **Maj + R** ne l'est pas. `edit.rotate` — « Pivoter la sélection d'un
   *   quart de tour » — a été déclaré après `tool.networkRoute`, qui répond
   *   déjà : la commande est donc inatteignable au clavier, et le menu
   *   d'objet annonce pourtant « Maj + R » à côté d'elle. Le défaut est
   *   antérieur à l'outil « Répéter » et se corrige en donnant à `edit.rotate`
   *   un accord libre ; il est nommé ici pour qu'on cesse de ne pas le voir.
   */
  const COLLISIONS_CONNUES = [
    'Maj + R : edit.rotate n’aura jamais lieu, tool.networkRoute répond déjà',
    'Échap : edit.cancel n’aura jamais lieu, tool.select répond déjà',
  ];

  it('ne déclare pas un accord de plus qu’on ne l’a écrit', () => {
    /*
     * La faute que rien n'attrapait.
     *
     * Deux déclarations du même accord ne lèvent aucune erreur : la première
     * gagne, la seconde ne se produit jamais. On liste donc les doublons
     * plutôt que d'affirmer une longueur, pour que le message dise lequel a
     * été volé et par qui.
     */
    const seen = new Map<string, string>();
    const stolen: string[] = [];
    for (const binding of SHORTCUTS) {
      const already = seen.get(chord(binding));
      if (already === undefined) seen.set(chord(binding), binding.id);
      else
        stolen.push(
          `${shortcutLabel(binding)} : ${binding.id} n’aura jamais lieu, ${already} répond déjà`,
        );
    }
    expect(stolen, stolen.join('\n')).toEqual(COLLISIONS_CONNUES);
  });

  it('donne un accord distinct à chaque outil du registre', () => {
    // Deux outils qui déclarent le même raccourci sont un outil qu'on ne peut
    // plus atteindre au clavier : `runShortcut` prend le premier des deux.
    const perTool = EDITOR_TOOLS.map(({ shortcutId }) => shortcutId);
    expect(new Set(perTool).size).toBe(perTool.length);
  });

  it('mène de chaque outil à une touche que l’application lit vraiment', () => {
    for (const tool of EDITOR_TOOLS) {
      const binding = SHORTCUTS.find(({ id }) => id === tool.shortcutId);
      expect(binding, tool.id).toBeDefined();
      expect(
        resolveShortcut(
          key({
            key: binding!.key,
            ctrlKey: binding!.ctrlOrMeta === true,
            shiftKey: binding!.shift === true,
          }),
        ),
        `${tool.id} → ${shortcutLabel(binding!)}`,
      ).toBe(tool.shortcutId);
    }
  });

  it('arme « Répéter » sur S, sans rien prendre à personne', () => {
    // « R » est le réseau et « Maj + R » le tracé de tronçon : l'un et
    // l'autre répondent encore, exactement comme avant.
    expect(resolveShortcut(key({ key: 's' }))).toBe('tool.repeat');
    expect(resolveShortcut(key({ key: 'S' }))).toBe('tool.repeat');
    expect(resolveShortcut(key({ key: 'r' }))).toBe('tool.network');
    // Maj + R reste ce qu'il était — le tracé de tronçon, qui le prend
    // depuis toujours à « Pivoter la sélection » : voir COLLISIONS_CONNUES.
    expect(resolveShortcut(key({ key: 'r', shiftKey: true }))).toBe(
      'tool.networkRoute',
    );
    // Et « Ctrl + S » enregistre toujours : un accord modifié ne retombe
    // jamais sur sa touche nue.
    expect(resolveShortcut(key({ key: 's', ctrlKey: true }))).toBe('file.save');
    expect(resolveShortcut(key({ key: 's', metaKey: true }))).toBe('file.save');
  });
});
