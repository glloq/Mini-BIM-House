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
 * Ce fichier tient donc trois choses : que **chaque accord affiché quelque
 * part est celui que le clavier rend** — c'est la promesse, et « Maj + R »
 * annoncé à côté de « Pivoter la sélection » sans jamais répondre en était la
 * rupture ; qu'**aucun accord n'est déclaré deux fois** — la seule faute que
 * le registre laisse passer en silence ; et que les touches qu'un geste
 * **emprunte** le temps de ce geste — « R » pendant qu'on pose — n'en
 * empruntent pas d'autres que celles qu'on a écrites ici.
 */
import { describe, expect, it } from 'vitest';

import { EDITOR_TOOLS } from './tool-registry.js';
import {
  CONTEXT_SHORTCUTS,
  SHORTCUTS,
  resolveShortcut,
  shortcutLabel,
  situationHint,
  type KeyChord,
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
function chord(binding: KeyChord): string {
  return [
    binding.ctrlOrMeta === true ? 'Ctrl' : '',
    binding.shift === true ? 'Maj' : '',
    binding.key.toLowerCase(),
  ].join('+');
}

/** L'événement clavier que cette déclaration attend, et lui seul. */
function pressOf(binding: KeyChord) {
  return key({
    key: binding.key,
    ctrlKey: binding.ctrlOrMeta === true,
    shiftKey: binding.shift === true,
  });
}

describe('le registre des raccourcis', () => {
  /*
   * Le seul accord que le registre déclare deux fois, et pourquoi il y reste.
   *
   * Écrit noir sur blanc plutôt que passé sous silence, et le test tombe aussi
   * bien s'il disparaît que si un second apparaît : une liste d'exceptions
   * qu'on ne relit jamais finit par tout excuser.
   *
   * **Échap** est délibéré. `tool.select` et `edit.cancel` nomment le même
   * geste vu de deux endroits, et `runShortcut` traite `tool.select` en
   * défaisant l'action en cours : la seconde déclaration existe pour être
   * listée dans l'aide, pas pour être résolue. Ce qu'elle promet, la première
   * le tient — c'est ce qui la distingue d'un vol.
   *
   * **Maj + R** en est sorti. `edit.rotate` — « Pivoter la sélection d'un
   * quart de tour » — avait été déclaré après `tool.networkRoute`, qui répond
   * déjà : la commande était inatteignable au clavier pendant que la barre
   * d'actions et la palette annonçaient « Maj + R » à côté d'elle. Elle a
   * désormais « Maj + Q », un accord libre, et c'est le test suivant qui
   * garde la propriété générale dont ce défaut n'était qu'un cas.
   */
  const COLLISIONS_CONNUES = [
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
     *
     * Les accords de situation entrent dans le même comptage, avec leur
     * situation dans la clé : deux quarts de tour déclarés pour la même pose
     * seraient la même faute, tandis qu'emprunter « R » à l'outil Réseau le
     * temps d'une pose n'en est pas une — c'est le test des emprunts qui en
     * répond, un peu plus bas.
     */
    const seen = new Map<string, string>();
    const stolen: string[] = [];
    const declared = [
      ...SHORTCUTS.map((binding) => ({ binding, scope: 'partout' })),
      ...CONTEXT_SHORTCUTS.map((binding) => ({
        binding,
        scope: binding.onlyWhen,
      })),
    ];
    for (const { binding, scope } of declared) {
      const chordInScope = `${scope}|${chord(binding)}`;
      const already = seen.get(chordInScope);
      if (already === undefined) seen.set(chordInScope, binding.id);
      else
        stolen.push(
          `${shortcutLabel(binding)} : ${binding.id} n’aura jamais lieu, ${already} répond déjà`,
        );
    }
    expect(stolen, stolen.join('\n')).toEqual(COLLISIONS_CONNUES);
  });

  it('rend au clavier chaque accord qu’un écran annonce', () => {
    /*
     * La propriété, et non le cas.
     *
     * Chaque déclaration porte un libellé et un accord, et c'est ce couple que
     * la barre d'actions, la barre d'outils et la palette impriment. Affirmer
     * ici que la touche rend bien la commande à côté de laquelle elle est
     * écrite, c'est interdire d'un coup toute la famille de fautes dont
     * « Maj + R » n'était qu'un membre : un accord affiché qu'on essaie, qui
     * ne fait rien, et dont on conclut qu'on a mal lu.
     *
     * `edit.cancel` est la seule sortie, pour la raison dite plus haut : ce
     * qu'il annonce, `tool.select` le fait.
     */
    const muets = SHORTCUTS.filter(({ id }) => id !== 'edit.cancel').flatMap(
      (binding) =>
        resolveShortcut(pressOf(binding)) === binding.id
          ? []
          : [
              `${shortcutLabel(binding)} annonce « ${binding.label} » (${binding.id}) mais rend ${String(resolveShortcut(pressOf(binding)))}`,
            ],
    );
    expect(muets, muets.join('\n')).toEqual([]);
  });

  it('atteint enfin « Pivoter la sélection », sans rien retirer au réseau', () => {
    // Le défaut réparé, dit dans les deux sens : la commande répond à son
    // accord, et l'outil qui le lui prenait garde le sien.
    expect(resolveShortcut(key({ key: 'q', shiftKey: true }))).toBe(
      'edit.rotate',
    );
    expect(resolveShortcut(key({ key: 'Q', shiftKey: true }))).toBe(
      'edit.rotate',
    );
    expect(resolveShortcut(key({ key: 'r', shiftKey: true }))).toBe(
      'tool.networkRoute',
    );
    // « Q » nu reste Fusionner : un accord modifié ne retombe jamais sur sa
    // touche nue, et la réciproque est vraie aussi.
    expect(resolveShortcut(key({ key: 'q' }))).toBe('tool.mergeSpaces');
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
    // Maj + R reste ce qu'il était : le tracé de tronçon, qui ne le partage
    // plus avec personne depuis que « Pivoter la sélection » a « Maj + Q ».
    expect(resolveShortcut(key({ key: 'r', shiftKey: true }))).toBe(
      'tool.networkRoute',
    );
    // Et « Ctrl + S » enregistre toujours : un accord modifié ne retombe
    // jamais sur sa touche nue.
    expect(resolveShortcut(key({ key: 's', ctrlKey: true }))).toBe('file.save');
    expect(resolveShortcut(key({ key: 's', metaKey: true }))).toBe('file.save');
  });
});

describe('les touches qui n’existent que pendant un geste', () => {
  /*
   * Ce que la pose emprunte, énuméré une fois pour toutes.
   *
   * Un accord de situation ne peut voler que ce qui porte le même accord :
   * hors de sa situation il n'est rien, et dans sa situation il passe devant.
   * La liste est donc la preuve demandée — « aucun autre raccourci ne devient
   * ambigu » — et elle est calculée, pas récitée : un troisième emprunt, ou
   * un emprunt qui changerait de victime, fait tomber ce test avec le nom de
   * ce qu'il prend.
   */
  const EMPRUNTS_ASSUMÉS = [
    'PLACING_COMPONENT · R : place.turn passe devant tool.network',
    'PLACING_COMPONENT · Maj + R : place.turnBack passe devant tool.networkRoute',
  ];

  it('n’emprunte que les touches qu’on a dit qu’elle emprunterait', () => {
    const emprunts = CONTEXT_SHORTCUTS.flatMap((binding) => {
      const volé = SHORTCUTS.filter(
        (global) => chord(global) === chord(binding),
      );
      return volé.map(
        (global) =>
          `${binding.onlyWhen} · ${shortcutLabel(binding)} : ${binding.id} passe devant ${global.id}`,
      );
    });
    expect(emprunts, emprunts.join('\n')).toEqual(EMPRUNTS_ASSUMÉS);
  });

  it('fait tourner ce qu’on pose, et seulement pendant qu’on pose', () => {
    // Pendant la pose, la touche des logiciels de dessin l'emporte…
    expect(resolveShortcut(key({ key: 'r' }), { placingComponent: true })).toBe(
      'place.turn',
    );
    expect(
      resolveShortcut(key({ key: 'R', shiftKey: true }), {
        placingComponent: true,
      }),
    ).toBe('place.turnBack');
    // …et hors d'elle, la même frappe rend exactement ce qu'elle rendait.
    expect(resolveShortcut(key({ key: 'r' }))).toBe('tool.network');
    expect(resolveShortcut(key({ key: 'r' }), {})).toBe('tool.network');
    expect(
      resolveShortcut(key({ key: 'r' }), { placingComponent: false }),
    ).toBe('tool.network');
    // Une situation ne déborde pas sur les autres touches : la pose n'emprunte
    // que « R », et « W » reste le mur même en posant.
    expect(resolveShortcut(key({ key: 'w' }), { placingComponent: true })).toBe(
      'tool.wall',
    );
    // Ni sur les accords modifiés qu'elle n'a pas demandés.
    expect(
      resolveShortcut(key({ key: 'r', ctrlKey: true }), {
        placingComponent: true,
      }),
    ).toBeUndefined();
  });

  it('écrit la ligne d’aide avec les touches qu’elle déclare', () => {
    /*
     * La boîte d'orientation disait « R : quart de tour », recopié à la main :
     * elle taisait la marche arrière et n'aurait pas suivi un changement de
     * touche. La phrase vient maintenant du registre, donc l'écran ne peut
     * plus annoncer autre chose que ce que le clavier fait.
     */
    expect(situationHint('PLACING_COMPONENT')).toBe(
      'R : quart de tour · Maj + R : à rebours',
    );
  });
});
