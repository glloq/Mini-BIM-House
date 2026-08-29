/**
 * Central keyboard shortcut registry.
 *
 * Every binding lives here rather than in the components that react to it, so
 * the set can be listed, documented and checked for conflicts in one place.
 *
 * Deux registres, et non un seul, parce qu'il y a deux sortes d'accords.
 *
 * `SHORTCUTS` tient ceux qui valent **partout** : la coque les écoute sur la
 * fenêtre, la palette de commandes les liste, et chacun d'eux a quelque chose
 * qui l'exécute. `CONTEXT_SHORTCUTS` tient ceux qui n'existent que **pendant
 * un geste** — aujourd'hui les quarts de tour du fantôme qu'on s'apprête à
 * poser. Les seconds ne sont pas des variantes des premiers : hors de leur
 * situation, ils ne sont pas « désactivés », ils ne sont rien, et la touche
 * garde son sens habituel.
 *
 * La séparation n'est pas un rangement, c'est ce qui garde honnête ce que
 * l'écran promet. La palette exécute ce qu'elle affiche en appelant
 * `runShortcut`, qui ne sait dispatcher que les commandes globales ; y faire
 * paraître « quart de tour » donnerait une ligne qui ne fait rien quand on la
 * choisit — exactement le défaut qu'on est en train de réparer, sous une
 * autre forme. Un accord de situation s'annonce donc là où il s'applique :
 * dans la boîte d'orientation qui accompagne la pose, et qui lit son libellé
 * ici plutôt que de le réécrire à la main.
 */
export type ShortcutCommandId =
  | 'tool.select'
  | 'tool.wall'
  | 'tool.wallRun'
  | 'tool.wallRectangle'
  | 'tool.opening'
  | 'tool.roofOpening'
  | 'tool.space'
  | 'tool.slab'
  | 'tool.slabHole'
  | 'tool.component'
  | 'tool.stair'
  | 'tool.roof'
  | 'tool.column'
  | 'tool.beam'
  | 'tool.site'
  | 'tool.siteTree'
  | 'tool.siteHedge'
  | 'tool.siteFence'
  | 'tool.siteGate'
  | 'tool.measure'
  | 'tool.mergeSpaces'
  | 'tool.dimension'
  | 'tool.note'
  | 'tool.network'
  | 'tool.networkRoute'
  | 'tool.networkBranch'
  | 'tool.split'
  | 'tool.rotate'
  | 'tool.mirror'
  | 'tool.offset'
  | 'tool.repeat'
  | 'tool.join'
  | 'tool.trim'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.delete'
  | 'edit.cancel'
  | 'edit.finish'
  | 'edit.duplicate'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.rotate'
  | 'edit.mirror'
  | 'file.save'
  | 'view.zoomFit'
  | 'view.zoomSelection'
  | 'view.reset'
  | 'palette.open';

/**
 * Les commandes qui n'existent que pendant un geste précis.
 *
 * Volontairement hors de `ShortcutCommandId` : ce type-là est le contrat de
 * `runShortcut`, dans la coque, qui sait exécuter chacune de ses valeurs. Une
 * commande de situation n'est exécutable que par le composant qui tient ce
 * geste — la surface de plan, pour la pose — et l'annoncer comme dispatchable
 * par la coque serait promettre un aiguillage qui n'existe pas.
 */
export type ContextCommandId = 'place.turn' | 'place.turnBack';

/** Le geste en cours, quand il change le sens d'une touche. */
export type ShortcutSituationId = 'PLACING_COMPONENT';

/**
 * Ce que l'appelant sait de la situation au moment de la frappe.
 *
 * Un objet et non un identifiant : deux gestes peuvent être vrais en même
 * temps le jour où il y en aura deux, et un champ absent vaut « non ».
 */
export interface ShortcutSituation {
  /** Un composant attend d'être posé sous le curseur. */
  readonly placingComponent?: boolean;
}

/** L'accord lui-même, sans ce qu'il déclenche : de quoi l'écrire et le comparer. */
export interface KeyChord {
  /** Physical key, matched against KeyboardEvent.key, case-insensitively. */
  readonly key: string;
  readonly ctrlOrMeta?: boolean;
  readonly shift?: boolean;
}

export type ShortcutGroup = 'Outils' | 'Édition' | 'Vue' | 'Fichier' | 'Pose';

export interface ShortcutBinding extends KeyChord {
  readonly id: ShortcutCommandId;
  readonly label: string;
  readonly group: ShortcutGroup;
}

/**
 * Un accord qui n'a de sens que pendant un geste, et qui alors l'emporte.
 *
 * `onlyWhen` est obligatoire : c'est la seule chose qui distingue ces
 * déclarations des globales, et une déclaration qui l'oublierait volerait sa
 * touche à tout le monde au lieu de l'emprunter le temps d'une pose.
 */
export interface ContextShortcutBinding extends KeyChord {
  readonly id: ContextCommandId;
  readonly label: string;
  readonly group: ShortcutGroup;
  readonly onlyWhen: ShortcutSituationId;
}

export const SHORTCUTS: readonly ShortcutBinding[] = [
  { id: 'tool.select', label: 'Sélection', key: 'Escape', group: 'Outils' },
  { id: 'tool.wall', label: 'Mur', key: 'w', group: 'Outils' },
  { id: 'tool.wallRun', label: 'Mur continu', key: 'c', group: 'Outils' },
  {
    id: 'tool.wallRectangle',
    label: 'Murs rectangle',
    key: 'w',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.opening', label: 'Ouverture', key: 'o', group: 'Outils' },
  // Une ouverture, mais dans un pan : la même lettre avec Maj, comme les murs
  // rectangle sont sous « Maj + W ».
  {
    id: 'tool.roofOpening',
    label: 'Fenêtre de toit',
    key: 'o',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.space', label: 'Pièce', key: 'i', group: 'Outils' },
  { id: 'tool.slab', label: 'Dalle', key: 'l', group: 'Outils' },
  {
    id: 'tool.slabHole',
    label: 'Trémie',
    key: 'l',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.stair', label: 'Escalier', key: 'a', group: 'Outils' },
  { id: 'tool.roof', label: 'Toiture', key: 'y', group: 'Outils' },
  { id: 'tool.column', label: 'Poteau', key: 'u', group: 'Outils' },
  {
    id: 'tool.beam',
    label: 'Poutre',
    key: 'u',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.site', label: 'Terrain', key: 'g', group: 'Outils' },
  /*
   * Ce qui pousse et ce qui clôt sur le terrain a sa propre touche.
   *
   * Ces quatre-là ne sont pas des réglages de l'outil Terrain : ce sont
   * d'autres gestes — un clic pour un arbre, une polyligne pour une haie — et
   * un geste qu'on ne peut pas atteindre au clavier est un geste qu'on ne fait
   * qu'à la souris. L'initiale de chacun était prise (« a » l'escalier, « h »
   * la mesure, « c » le mur continu, « p » pivoter), d'où la majuscule : c'est
   * déjà la convention des variantes ici — Maj + W pour les murs rectangle,
   * Maj + O pour la fenêtre de toit.
   */
  {
    id: 'tool.siteTree',
    label: 'Arbre',
    key: 'a',
    shift: true,
    group: 'Outils',
  },
  {
    id: 'tool.siteHedge',
    label: 'Haie',
    key: 'h',
    shift: true,
    group: 'Outils',
  },
  {
    id: 'tool.siteFence',
    label: 'Clôture',
    key: 'c',
    shift: true,
    group: 'Outils',
  },
  {
    id: 'tool.siteGate',
    label: 'Portail',
    key: 'p',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.component', label: 'Composant', key: 'k', group: 'Outils' },
  // « h » comme « combien » : les lettres évidentes étaient prises, et une
  // mesure se prend assez souvent pour mériter la sienne.
  { id: 'tool.measure', label: 'Mesurer', key: 'h', group: 'Outils' },
  { id: 'tool.mergeSpaces', label: 'Fusionner', key: 'q', group: 'Outils' },
  { id: 'tool.dimension', label: 'Cotation', key: 'd', group: 'Outils' },
  { id: 'tool.note', label: 'Annotation', key: 'n', group: 'Outils' },
  { id: 'tool.network', label: 'Réseau', key: 'r', group: 'Outils' },
  {
    id: 'tool.networkRoute',
    label: 'Tracer un tronçon',
    key: 'r',
    shift: true,
    group: 'Outils',
  },
  { id: 'tool.networkBranch', label: 'Dériver', key: 'b', group: 'Outils' },
  { id: 'tool.split', label: 'Scinder un mur', key: 'x', group: 'Outils' },
  { id: 'tool.rotate', label: 'Pivoter', key: 'p', group: 'Outils' },
  { id: 'tool.mirror', label: 'Miroir', key: 'm', group: 'Outils' },
  { id: 'tool.offset', label: 'Décaler', key: 'e', group: 'Outils' },
  /*
   * « S » comme série : l'initiale de « Répéter » n'était pas libre.
   *
   * « R » est le réseau, et « Maj + R » le tracé de tronçon. Redéclarer l'un
   * des deux n'aurait pas fait un conflit visible : `resolveShortcut` rend le
   * **premier candidat déclaré**, donc la seconde déclaration serait restée
   * muette, et c'est l'outil le plus récent qui aurait paru cassé — c'est
   * exactement ce qui était arrivé à « Pivoter la sélection », resté deux
   * versions sous « Maj + R » sans jamais répondre. « S » seul ne prend
   * rien : « Ctrl + S » enregistre, et un accord modifié ne retombe jamais
   * sur sa touche nue.
   */
  { id: 'tool.repeat', label: 'Répéter', key: 's', group: 'Outils' },
  { id: 'tool.join', label: 'Joindre', key: 'j', group: 'Outils' },
  { id: 'tool.trim', label: 'Ajuster', key: 't', group: 'Outils' },
  {
    id: 'edit.undo',
    label: 'Annuler',
    key: 'z',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.redo',
    label: 'Rétablir',
    key: 'z',
    ctrlOrMeta: true,
    shift: true,
    group: 'Édition',
  },
  { id: 'edit.delete', label: 'Supprimer', key: 'Delete', group: 'Édition' },
  {
    // Un seul mot pour un geste : « terminer » couvre le chemin qu'on arrête
    // et la surface qu'on referme, et l'écran nomme lequel des deux selon
    // l'outil. Ce qui ne varie pas, c'est que la touche est Entrée.
    id: 'edit.finish',
    label: 'Terminer ou fermer le tracé',
    key: 'Enter',
    group: 'Édition',
  },
  {
    id: 'edit.duplicate',
    label: 'Dupliquer la sélection',
    key: 'd',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.copy',
    label: 'Copier la sélection',
    key: 'c',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  {
    id: 'edit.paste',
    label: 'Coller sur le niveau affiché',
    key: 'v',
    ctrlOrMeta: true,
    group: 'Édition',
  },
  /*
   * « Maj + Q » comme quart de tour, parce que ni « P » ni « R » n'étaient à
   * prendre.
   *
   * Cette commande était déclarée sous « Maj + R », après `tool.networkRoute`
   * qui porte le même accord : elle n'a donc jamais répondu, alors que la
   * barre d'actions et la palette écrivaient « Maj + R » à côté d'elle. Un
   * accord affiché qui ne répond pas est pire que pas d'accord du tout : on
   * l'essaie, il ne se passe rien, et l'on croit avoir mal lu — puis on cesse
   * d'essayer les autres.
   *
   * Le choix de la lettre est contraint. « P » est l'outil Pivoter et
   * « Maj + P » le portail du terrain ; « R » le réseau et « Maj + R » le
   * tracé de tronçon. Restait à prendre l'initiale de ce que la commande
   * **fait** plutôt que de son verbe : un **q**uart de tour, mot que le
   * libellé dit déjà, sous une touche qu'aucun accord modifié n'occupait —
   * « Q » nu est Fusionner, et un accord modifié ne retombe jamais sur sa
   * touche nue. Voir `shortcuts.test.ts`, qui vérifie que chaque accord
   * affiché quelque part est bien celui que le clavier rend.
   */
  {
    id: 'edit.rotate',
    label: 'Pivoter la sélection d’un quart de tour',
    key: 'q',
    shift: true,
    group: 'Édition',
  },
  {
    id: 'edit.mirror',
    label: 'Retourner la sélection de gauche à droite',
    key: 'm',
    shift: true,
    group: 'Édition',
  },
  {
    id: 'edit.cancel',
    label: 'Annuler l’action',
    key: 'Escape',
    group: 'Édition',
  },
  {
    id: 'file.save',
    label: 'Enregistrer',
    key: 's',
    ctrlOrMeta: true,
    group: 'Fichier',
  },
  { id: 'view.zoomFit', label: 'Zoom étendu', key: 'f', group: 'Vue' },
  {
    id: 'view.zoomSelection',
    label: 'Zoom sélection',
    key: 'f',
    shift: true,
    group: 'Vue',
  },
  { id: 'view.reset', label: 'Réinitialiser la vue', key: '0', group: 'Vue' },
  {
    id: 'palette.open',
    label: 'Palette de commandes',
    key: 'k',
    ctrlOrMeta: true,
    group: 'Édition',
  },
];

/*
 * Les touches de la pose, déclarées là où l'on déclare les touches.
 *
 * `R` fait tourner d'un quart de tour ce qu'on s'apprête à poser, `Maj + R`
 * à rebours : c'est la convention de tous les logiciels de dessin, et la
 * changer serait demander à qui la connaît de la désapprendre. Elle était
 * captée dans `PlanCanvas`, écrite en dur, et n'était donc annoncée nulle
 * part sinon par une chaîne recopiée à côté du champ d'orientation. Une
 * touche qui répond sans être affichée et un accord affiché qui ne répond pas
 * sont le même défaut, pris par ses deux bouts.
 *
 * Ce qu'elle emprunte, elle l'emprunte en le disant : pendant la pose, et
 * pendant elle seule, « R » ne choisit plus l'outil Réseau et « Maj + R » ne
 * trace plus de tronçon. C'est le comportement qu'avait déjà l'écouteur en
 * capture — on ne change donc rien à ce que fait le clavier, on le rend
 * lisible — et c'est le bon arbitrage : un objet attend sous le curseur, la
 * question qu'on se pose est « et si je le tournais ? », pas « et si je
 * traçais un réseau ? ». `shortcuts.test.ts` énumère ces deux emprunts et
 * échoue si un troisième apparaît.
 *
 * Les libellés sont courts parce qu'ils sont écrits pour le seul endroit qui
 * les montre : la ligne d'aide de la boîte d'orientation, large de quelques
 * centimètres, où ils se lisent l'un derrière l'autre.
 */
export const CONTEXT_SHORTCUTS: readonly ContextShortcutBinding[] = [
  {
    id: 'place.turn',
    label: 'quart de tour',
    key: 'r',
    onlyWhen: 'PLACING_COMPONENT',
    group: 'Pose',
  },
  {
    id: 'place.turnBack',
    label: 'à rebours',
    key: 'r',
    shift: true,
    onlyWhen: 'PLACING_COMPONENT',
    group: 'Pose',
  },
];

/**
 * Ce qui rend une situation vraie, une ligne par situation.
 *
 * Une table plutôt qu'une suite de `if` : le jour où un second geste emprunte
 * une touche, il s'ajoute ici et `resolveShortcut` n'a pas à changer.
 */
const SITUATION_HOLDS: Record<
  ShortcutSituationId,
  (situation: ShortcutSituation) => boolean
> = {
  PLACING_COMPONENT: (situation) => situation.placingComponent === true,
};

export interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

function matches(binding: KeyChord, event: KeyEventLike): boolean {
  if (event.altKey) return false;
  if (binding.key.toLowerCase() !== event.key.toLowerCase()) return false;
  const ctrlOrMeta = event.ctrlKey || event.metaKey;
  if ((binding.ctrlOrMeta ?? false) !== ctrlOrMeta) return false;
  return (binding.shift ?? false) === event.shiftKey;
}

/**
 * Resolves a key event to a command.
 *
 * More specific bindings win: `Ctrl+Shift+Z` never resolves to `Ctrl+Z`, and a
 * bare `Escape` cancels the action in progress before it changes tool.
 *
 * Le geste en cours passe avant tout le reste, quand l'appelant en connaît un.
 * C'est la même règle que celle des modificateurs, d'un cran plus haut : le
 * plus précis l'emporte, et rien n'est plus précis qu'un accord qui n'existe
 * que pendant qu'on pose un objet. L'appelant qui ne dit rien — la coque, qui
 * écoute la fenêtre entière et ne sait pas ce que fait la surface de plan —
 * reçoit exactement ce qu'il recevait avant : les deux signatures le disent,
 * et c'est ce qui garantit qu'aucune commande de situation ne remonte à un
 * aiguillage qui ne saurait pas l'exécuter.
 */
export function resolveShortcut(
  event: KeyEventLike,
): ShortcutCommandId | undefined;
export function resolveShortcut(
  event: KeyEventLike,
  situation: ShortcutSituation,
): ShortcutCommandId | ContextCommandId | undefined;
export function resolveShortcut(
  event: KeyEventLike,
  situation: ShortcutSituation = {},
): ShortcutCommandId | ContextCommandId | undefined {
  const borrowed = CONTEXT_SHORTCUTS.find(
    (binding) =>
      SITUATION_HOLDS[binding.onlyWhen](situation) && matches(binding, event),
  );
  if (borrowed !== undefined) return borrowed.id;
  const candidates = SHORTCUTS.filter((binding) => matches(binding, event));
  if (candidates.length === 0) return undefined;
  const shifted = candidates.find(({ shift }) => shift === true);
  if (shifted !== undefined) return shifted.id;
  return candidates[0]!.id;
}

/**
 * Ce qu'une situation ajoute au clavier, écrit pour être affiché.
 *
 * La ligne d'aide de la pose se lisait « R : quart de tour », recopiée à la
 * main dans la surface de plan : elle taisait la marche arrière et n'aurait
 * pas suivi un changement de touche. Elle se compose désormais du registre,
 * donc l'écran ne peut plus annoncer autre chose que ce que le clavier fait.
 */
export function situationHint(situation: ShortcutSituationId): string {
  return CONTEXT_SHORTCUTS.filter(({ onlyWhen }) => onlyWhen === situation)
    .map((binding) => `${shortcutLabel(binding)} : ${binding.label}`)
    .join(' · ');
}

/** Human-readable form of a binding, for menus and the help panel. */
export function shortcutLabel(binding: KeyChord): string {
  const parts: string[] = [];
  if (binding.ctrlOrMeta === true) parts.push('Ctrl');
  if (binding.shift === true) parts.push('Maj');
  parts.push(
    binding.key === 'Escape'
      ? 'Échap'
      : binding.key === 'Delete'
        ? 'Suppr'
        : binding.key.toUpperCase(),
  );
  return parts.join(' + ');
}

/**
 * A keystroke typed inside a form control belongs to that control, except for
 * the application-wide chords that keep working everywhere.
 */
export function shouldIgnoreTarget(
  tagName: string | undefined,
  event: KeyEventLike,
): boolean {
  const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName ?? '');
  if (!editable) return false;
  return !(event.ctrlKey || event.metaKey);
}
