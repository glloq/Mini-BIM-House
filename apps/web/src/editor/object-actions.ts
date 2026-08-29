/**
 * Ce qu'on peut faire d'une sélection, décrit une fois et interrogé par tous.
 *
 * Les actions d'un objet étaient dispersées : la barre contextuelle en tenait
 * six, le menu du clic droit huit, le panneau des propriétés ses champs, la
 * palette ses commandes, et chacun décidait dans son coin de ce qu'il offrait
 * et de ce qu'il grisait. Ajouter un geste demandait de le poser à trois
 * endroits ; en oublier un donnait un geste qui existe au clavier et nulle
 * part à l'écran.
 *
 * ## Les six boutons de trop
 *
 * Le vrai défaut n'était pas la dispersion mais la généricité. Quel que soit
 * l'objet désigné — un mur, une gaine, une toiture, une parcelle —, la barre
 * proposait « Pivoter 90° », « Miroir », et les quatre alignements. C'est la
 * panoplie du mobilier, appliquée à toute la maison : sur un mur, aucune de
 * ces six actions n'est celle qu'on vient chercher, et celles qu'on vient
 * chercher — décaler, scinder, inverser la face de référence — n'étaient nulle
 * part. Un affichage qui montre toujours la même chose ne dit rien de ce qu'on
 * regarde.
 *
 * Ici une action se déclare avec :
 *
 * - `appliesTo` — est-ce que cette action **parle de cet objet-là** ? Un
 *   alignement sur un objet seul n'aligne rien : il ne s'affiche pas, plutôt
 *   que de s'afficher gris en promettant ce qu'aucun clic ne rendra possible.
 * - `enabled` — est-ce qu'elle **aboutirait maintenant** ? Une pièce ne pivote
 *   pas : le bouton est là et il est gris, parce qu'un refus après coup se lit
 *   comme une panne alors qu'un bouton visiblement indisponible se lit comme
 *   une propriété de l'objet. C'est la règle que le menu contextuel suit déjà.
 * - `importance` — ce qui compte d'abord pour **cette famille**. La barre en
 *   montre deux à cinq et replie le reste derrière un « … » ; l'ordre ne vient
 *   pas de l'affichage, qui n'a aucun moyen de le connaître.
 * - `writes` — est-ce que l'action écrit dans le projet ? C'est ce qui la fait
 *   passer, ou non, par la frontière d'édition. Voir `stage-editing.ts` :
 *   ce module-ci ne connaît pas les espaces et n'a pas à les connaître.
 *
 * ## Pourquoi `writes` plutôt qu'une liste d'exceptions
 *
 * Une action qui écrit et qui est offerte depuis un espace qui ne possède pas
 * l'objet mène à un refus, c'est-à-dire à une phrase en bas de l'écran après
 * un clic. Plutôt que de laisser chaque action interroger `ownership.ts` —
 * ce qui ferait autant d'occasions de l'oublier —, chacune déclare seulement
 * si elle écrit, et un seul endroit tranche. Une action ajoutée demain sans y
 * penser déclare `writes` parce que le type l'y oblige.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  ProjectTransactionCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

import {
  ALIGN_INTENT_HINTS,
  ALIGN_INTENT_LABELS,
  DISTRIBUTE_HINTS,
  DISTRIBUTE_LABELS,
  alignDeltas,
  distributeDeltas,
  type AlignIntent,
  type ArrangedObject,
  type ArrangementOutcome,
  type DistributeAxis,
} from './arrangement.js';
import {
  boundsOf,
  contextActionsFor,
  inspectObject,
  selectionCapabilities,
  similarTo,
  transformCommandsFor,
  type ObjectKind,
} from './object-editors.js';
import { straightWallOf } from './object-facts.js';
import type { ObjectCapabilities } from './object-transform.js';
import { toolDefinition, type EditorTool } from './tool-registry.js';
import {
  connectPlan,
  declaredConnections,
  type ConnectPlan,
} from '../networks/connect-intent.js';

/**
 * Ce que la coque sait faire, vu de l'action.
 *
 * Une action ne construit pas de commande quand l'application en a déjà une :
 * dupliquer, supprimer, transformer et cadrer sont écrits une fois dans la
 * coque, avec leur historique, leurs messages et leur re-sélection. Le registre
 * les **nomme** et dit quand les offrir ; il ne les réécrit pas.
 *
 * Rendu explicite plutôt que capturé : une action est ainsi une valeur qu'un
 * test peut faire tourner avec une coque de mensonge, sans monter React.
 */
export interface ObjectActionHost {
  /** Pivoter d'un quart de tour ou retourner, autour du centre de la sélection. */
  readonly transform: (kind: 'ROTATE' | 'MIRROR') => void;
  /** Copier la sélection un peu à côté, et désigner les copies. */
  readonly duplicate: () => void;
  /** Retirer la sélection du projet. */
  readonly remove: () => void;
  /** Amener le dessin sur cet objet. */
  readonly frame: (objectId: string) => void;
  /** Désigner tout ce qui, dans sa famille, est bâti comme lui. */
  readonly selectSimilar: (objectId: string) => void;
  /**
   * Prendre un outil, pour les gestes qui demandent un point.
   *
   * Décaler, scinder, dériver ne se font pas d'un clic sur un bouton : il faut
   * dire où. L'action ne fait donc pas le geste, elle l'arme — et c'est déjà
   * tout ce qui manquait, puisque ces outils existaient et qu'on ne les
   * trouvait qu'en fouillant la boîte à outils.
   */
  readonly startTool: (tool: EditorTool) => void;
  /** Exécuter une commande que la famille de l'objet a construite elle-même. */
  readonly runCommand: (command: ProjectCommand) => void;
}

/**
 * Tout ce qu'une action a besoin de savoir pour dire si elle s'applique.
 *
 * Quatre choses, et pas une de plus : le projet, l'étage regardé, ce qui est
 * désigné, et ce que l'application sait faire. L'espace actif n'y est
 * volontairement pas — voir l'en-tête.
 */
export interface ObjectActionContext {
  readonly project: Project;
  readonly levelId: string | undefined;
  readonly selection: readonly string[];
  readonly host: ObjectActionHost;
}

/**
 * Ce qui compte d'abord, ce qui compte, et ce qui est là si on le cherche.
 *
 * Trois rangs plutôt qu'un nombre : un nombre se discute action par action et
 * se retrouve à trente-sept valeurs distinctes dont personne ne sait plus
 * l'ordre. Trois rangs se décident famille par famille et se lisent.
 */
export type ObjectActionImportance = 'PRIMARY' | 'SECONDARY' | 'ADVANCED';

/** Une action offerte sur une sélection, décrite une fois pour tous. */
export interface ObjectAction {
  readonly id: string;
  readonly label: string;
  /** Ce que l'action fait, en une phrase, pour l'infobulle. */
  readonly hint: string;
  /**
   * Le raccourci qui fait la même chose, quand il en existe un.
   *
   * Nommé et non écrit : la touche est décidée dans `shortcuts.ts`, et une
   * barre qui l'écrirait elle-même finirait par annoncer une touche qui ne
   * fait plus rien. L'affichage va la chercher là où elle est décidée.
   */
  readonly shortcutId?: string;
  readonly importance: ObjectActionImportance;
  /**
   * Si l'action écrit dans le projet.
   *
   * Arme un outil qui écrira compte comme écrire : offrir « Scinder » depuis
   * un espace qui ne possède pas le mur mènerait au même refus, deux clics
   * plus loin.
   */
  readonly writes: boolean;
  /** Si l'action parle de cette sélection-là. */
  readonly appliesTo: (context: ObjectActionContext) => boolean;
  /** Si elle aboutirait maintenant, sur cette sélection-là. */
  readonly enabled: (context: ObjectActionContext) => boolean;
  /**
   * Pourquoi elle n'aboutirait pas, quand elle n'aboutit pas.
   *
   * L'en-tête dit qu'un bouton visiblement indisponible se lit comme une
   * propriété de l'objet — mais seulement si l'objet dit laquelle. « Répartir »
   * gris sur trois objets peut vouloir dire trois choses différentes : ils sont
   * déjà répartis, ils sont tous à la même abscisse, ou l'un d'eux est une
   * pièce qui ne se déplace pas. Un bouton gris qui ne dit pas laquelle des
   * trois se lit comme une panne, ce que ce dépôt refuse.
   *
   * Facultatif, et non pas obligatoire : les gestes qui existaient avant ce
   * champ restent gris sans motif jusqu'à ce que chacun dise le sien, et un
   * champ obligatoire aurait fait inventer huit phrases d'un coup, dont sept
   * approximatives. Rendu `undefined` quand l'action aboutit.
   */
  readonly unavailableReason?: (
    context: ObjectActionContext,
  ) => string | undefined;
  readonly run: (context: ObjectActionContext) => void;
}

/** Le seul objet désigné, quand il n'y en a qu'un. */
function only(context: ObjectActionContext): string | undefined {
  return context.selection.length === 1 ? context.selection[0] : undefined;
}

/** Ce que la famille du seul objet désigné dit qu'il est. */
function kindOf(context: ObjectActionContext): ObjectKind | 'UNKNOWN' {
  const objectId = only(context);
  return objectId === undefined
    ? 'UNKNOWN'
    : inspectObject(context.project, objectId).kind;
}

/** Ce que toute la sélection accepte : ce que chacun de ses objets accepte. */
function allows(context: ObjectActionContext): ObjectCapabilities {
  return selectionCapabilities(context.project, context.selection);
}

/**
 * Le mur droit désigné, quand c'en est un.
 *
 * Décaler et scinder demandent tous deux un mur à deux points, et le refusent
 * autrement. Le dire ici évite d'offrir un geste que la commande rejettera.
 */
function straightWall(context: ObjectActionContext) {
  const objectId = only(context);
  if (objectId === undefined || context.levelId === undefined) return undefined;
  return straightWallOf(context.project, context.levelId, objectId);
}

/**
 * Une action qui arme un outil du registre.
 *
 * L'étiquette et l'infobulle viennent de l'outil lui-même : « Décaler » est
 * écrit une fois, dans le registre des outils, et renommer l'outil renomme
 * l'action. Deux libellés pour un geste, c'est deux gestes pour qui lit.
 */
function toolAction(
  id: string,
  tool: EditorTool,
  applies: (context: ObjectActionContext) => boolean,
): ObjectAction {
  const definition = toolDefinition(tool);
  return {
    id,
    label: definition.label,
    hint: definition.hint,
    shortcutId: definition.shortcutId,
    importance: 'PRIMARY',
    writes: true,
    appliesTo: applies,
    // Rien à griser : si l'outil s'applique à cet objet, il s'arme.
    enabled: () => true,
    run: (context) => context.host.startTool(tool),
  };
}

/**
 * Mettre plusieurs objets d'équerre les uns par rapport aux autres.
 *
 * Le calcul est ailleurs — `arrangement.ts` ne connaît que des boîtes et des
 * écarts, et se vérifie au millimètre sans projet ni React. Ce qui suit est le
 * seul chemin entre ce calcul et le projet : lire les emprises que les
 * familles déclarent, demander aux familles de porter chaque écart, et n'en
 * faire qu'une entrée d'historique.
 *
 * ## Pourquoi ce n'est pas `transformObjectsCommand`
 *
 * `moveObjectsCommand` et `transformObjectsCommand` déplacent **toute** la
 * sélection du **même** écart, et c'est précisément ce qu'un rangement ne fait
 * pas : aligner six chaises, c'est six écarts différents. Ce qui est réutilisé
 * ici est donc l'étage d'en dessous — `transformCommandsFor`, où chaque
 * famille dit comment elle suit une translation, avec ses ouvertures portées
 * et ses azimuts corrigés — et non l'étage d'au-dessus, qui suppose un écart
 * unique. Rien du déplacement n'est réécrit ; seule la boucle change.
 *
 * ## Une seule entrée d'historique
 *
 * Les commandes de toutes les familles sont réunies dans une seule
 * `ProjectTransactionCommand`. Annuler l'alignement de six chaises est un
 * `Ctrl+Z`, pas six : l'historique doit dire ce que l'utilisateur a demandé,
 * pas comment ça s'est trouvé exécuté. C'est déjà la règle que l'alignement
 * d'`editing-commands.ts` suit, et il n'y a aucune raison qu'un centrage ou
 * une répartition la suive moins bien.
 */

/** Ce qu'on demande à une sélection de devenir. */
export type ArrangementIntent =
  | { readonly kind: 'ALIGN'; readonly intent: AlignIntent }
  | { readonly kind: 'DISTRIBUTE'; readonly axis: DistributeAxis };

/** La sélection, avec l'emprise que chaque famille donne à ses objets. */
function arrangedSelection(
  context: ObjectActionContext,
): readonly ArrangedObject[] {
  const { project, levelId, selection } = context;
  if (levelId === undefined) return [];
  return selection.flatMap((objectId) => {
    const bounds = boundsOf(project, levelId, objectId);
    // Une famille qui ne mesure pas ses objets ne les range pas. Toutes les
    // familles que la maison de référence porte déclarent une emprise — les
    // cent quarante objets de son plan se mesurent — sauf la cote, qui n'en
    // déclare pas et qui suit de toute façon ce qu'elle mesure.
    return bounds === undefined ? [] : [{ objectId, bounds }];
  });
}

/** Les écarts que cette intention demande, ou le refus qui les remplace. */
function arrangementOutcome(
  context: ObjectActionContext,
  intent: ArrangementIntent,
): ArrangementOutcome {
  const objects = arrangedSelection(context);
  return intent.kind === 'ALIGN'
    ? alignDeltas(objects, intent.intent)
    : distributeDeltas(objects, intent.axis);
}

/** Une action de rangement aboutie : sa commande, prête à être dispatchée. */
export type ArrangementPlan =
  | { readonly status: 'OK'; readonly command: ProjectCommand }
  | { readonly status: 'REFUSED'; readonly message: string };

/**
 * Ce qu'un rangement ferait de cette sélection, sans encore rien faire.
 *
 * Une seule fonction pour les trois usages — « le bouton est-il actif », « que
 * dit-il quand il ne l'est pas », « que fait-il quand on clique » — parce que
 * trois fonctions séparées finissent par ne plus répondre la même chose, et
 * qu'un bouton actif dont le clic ne fait rien est le défaut que ce dépôt
 * appelle une panne.
 */
export function arrangementPlan(
  context: ObjectActionContext,
  intent: ArrangementIntent,
  label: string,
): ArrangementPlan {
  const { project, levelId, selection } = context;
  if (levelId === undefined)
    return {
      status: 'REFUSED',
      message: 'Aucun niveau n’est regardé : un rangement se fait sur un plan.',
    };
  const outcome = arrangementOutcome(context, intent);
  if (outcome.status === 'REFUSED') return outcome;
  const travelling = new Set(selection);
  const commands: ProjectCommand[] = [];
  for (const [objectId, deltaMm] of outcome.deltas) {
    const carried = transformCommandsFor(
      project,
      levelId,
      objectId,
      { kind: 'TRANSLATE', deltaMm },
      travelling,
    );
    if (carried === undefined)
      return {
        status: 'REFUSED',
        message: `Cet objet n’appartient pas au niveau regardé : ${objectId}.`,
      };
    // La famille refuse et dit pourquoi ; le refus remonte tel quel, parce
    // que sa phrase vaut mieux que la nôtre.
    if (carried.status === 'REFUSED') return carried;
    commands.push(...carried.commands);
  }
  if (commands.length === 0)
    return {
      status: 'REFUSED',
      message: 'Ces objets n’ont rien à parcourir : ils sont déjà rangés.',
    };
  return {
    status: 'OK',
    command: new ProjectTransactionCommand(
      // L'identifiant nomme le geste et ce sur quoi il porte : deux
      // alignements de suite sur deux sélections différentes sont deux
      // entrées, et non deux fois la même à un rang près.
      `arrange:${intent.kind === 'ALIGN' ? intent.intent : `DISTRIBUTE_${intent.axis}`}:${selection.join(',')}`,
      label,
      commands,
    ),
  };
}

/**
 * Les rangements offerts, dans l'ordre où ils se lisent.
 *
 * Ils restent ensemble et restent en `ADVANCED`. Huit boutons qui ne diffèrent
 * que par une direction sont un seul geste à huit issues : les faire concourir
 * un par un avec « Pivoter » ferait remonter « Aligner à gauche » tout seul, et
 * un alignement sur huit affiché est pire que huit repliés. Derrière le « … »,
 * ils sont huit et ils se lisent — les six alignements d'abord, parce qu'on
 * aligne dix fois pour une fois qu'on répartit.
 *
 * Les quatre premiers gardent l'identifiant `align.LEFT`… qu'ils avaient : ce
 * sont les mêmes gestes, et changer leur nom aurait cassé ce qui les désigne
 * ailleurs sans rien apporter à personne.
 */
const ARRANGEMENTS: readonly {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  /** Combien d'objets il faut pour que le geste veuille dire quelque chose. */
  readonly needs: number;
  readonly intent: ArrangementIntent;
}[] = [
  ...(
    [
      'LEFT',
      'RIGHT',
      'TOP',
      'BOTTOM',
      'CENTRE_X',
      'CENTRE_Y',
    ] as const satisfies readonly AlignIntent[]
  ).map((intent) => ({
    id: `align.${intent}`,
    label: ALIGN_INTENT_LABELS[intent],
    hint: ALIGN_INTENT_HINTS[intent],
    // Aligner un objet sur lui-même n'aligne rien.
    needs: 2,
    intent: { kind: 'ALIGN', intent } as const,
  })),
  ...(['X', 'Y'] as const satisfies readonly DistributeAxis[]).map((axis) => ({
    id: `distribute.${axis}`,
    label: DISTRIBUTE_LABELS[axis],
    hint: DISTRIBUTE_HINTS[axis],
    // Entre deux objets il n'y a qu'un intervalle, et il est déjà régulier :
    // le geste n'apparaît pas plutôt que d'apparaître gris pour toujours.
    needs: 3,
    intent: { kind: 'DISTRIBUTE', axis } as const,
  })),
];

/** Les actions de rangement, telles que le registre les porte. */
const ARRANGEMENT_ACTIONS: readonly ObjectAction[] = ARRANGEMENTS.map(
  ({ id, label, hint, needs, intent }): ObjectAction => ({
    id,
    label,
    hint,
    importance: 'ADVANCED',
    writes: true,
    appliesTo: (context) => context.selection.length >= needs,
    enabled: (context) =>
      arrangementPlan(context, intent, label).status === 'OK',
    unavailableReason: (context) => {
      const plan = arrangementPlan(context, intent, label);
      return plan.status === 'REFUSED' ? plan.message : undefined;
    },
    run: (context) => {
      const plan = arrangementPlan(context, intent, label);
      // Le bouton est gris quand le plan refuse : on n'arrive ici qu'avec un
      // plan qui aboutit. La garde est là pour que le raccourci clavier de
      // demain, qui ne regarde aucun bouton, ne fasse pas pire.
      if (plan.status === 'OK') context.host.runCommand(plan.command);
    },
  }),
);

/**
 * Relier un appareil posé au réseau qui le dessert.
 *
 * Le calcul est ailleurs — `networks/connect-intent.ts` ne connaît ni React ni
 * la coque, choisit le point d'accroche, réutilise `branchCommand` et
 * `routeCommand`, et rend **une** commande. Ce qui suit est le seul chemin
 * entre ce calcul et la barre, et il est écrit comme `arrangementPlan` juste
 * au-dessus : une seule fonction sert à `enabled`, à `unavailableReason` et à
 * `run`, pour qu'ils ne puissent pas diverger. Trois fonctions séparées
 * finissent par ne plus répondre la même chose, et un bouton actif dont le clic
 * ne fait rien est ce que ce dépôt appelle une panne.
 *
 * Le plan relie l'appareil à **tous** ses réseaux d'un coup — un lavabo a une
 * arrivée d'eau et une évacuation — et n'en fait qu'une entrée d'historique.
 * Raccorder l'un et pas l'autre en silence serait pire qu'un refus : ce serait
 * un appareil qu'on croit raccordé.
 */
function connectOutcome(context: ObjectActionContext): ConnectPlan {
  const objectId = only(context);
  if (objectId === undefined)
    return {
      status: 'REFUSED',
      message: 'Un raccordement se demande sur un seul appareil à la fois.',
    };
  return connectPlan(context.project, context.levelId, objectId);
}

/**
 * Les actions que l'éditeur connaît, dans l'ordre où elles se disputent la
 * barre.
 *
 * L'ordre compte à rang égal : deux actions `PRIMARY` s'affichent dans l'ordre
 * où elles sont écrites ici. Les gestes propres à une famille sont donc en
 * tête — c'est tout l'objet d'UX-17 — et les gestes communs derrière.
 */
export const OBJECT_ACTIONS: readonly ObjectAction[] = [
  /*
   * Ce qu'un mur fait et qu'un lit ne fait pas.
   *
   * Les trois outils existaient et vivaient dans la boîte à outils, sous
   * « Modification », entre « Joindre » et « Ajuster » : on désignait un mur,
   * et pour le décaler il fallait le lâcher, aller chercher l'outil, et le
   * redésigner. La barre les met là où le mur est déjà désigné.
   */
  toolAction(
    'wall.offset',
    'OFFSET',
    (context) => straightWall(context) !== undefined,
  ),
  toolAction(
    'wall.split',
    'SPLIT',
    (context) => straightWall(context) !== undefined,
  ),
  /*
   * Réunir deux pièces retire ce qui les sépare : c'est une modification de ce
   * qui est là, et c'est le seul geste propre qu'une pièce ait. Sans lui, une
   * pièce désignée n'offrait que des boutons gris, puisqu'elle ne bouge, ne
   * pivote et ne se retourne pas.
   */
  toolAction(
    'space.merge',
    'MERGE_SPACES',
    (context) => kindOf(context) === 'SPACE',
  ),
  /*
   * Un réseau se dérive et se prolonge ; il ne se duplique pas, et le pivoter
   * n'est presque jamais ce qu'on veut. Ce sont pourtant les seules actions
   * qu'on lui proposait.
   */
  toolAction(
    'network.branch',
    'NETWORK_BRANCH',
    (context) => kindOf(context) === 'NETWORK_EDGE',
  ),
  toolAction('network.route', 'NETWORK_ROUTE', (context) => {
    const kind = kindOf(context);
    return kind === 'NETWORK_NODE' || kind === 'NETWORK_EDGE';
  }),
  {
    /*
     * Ce qu'un lavabo fait et qu'un mur ne fait pas.
     *
     * L'action ne paraît que sur un objet dont la fiche déclare par quoi il se
     * raccorde : sur un mur, sur une pièce, sur une chaise, elle n'a rien à
     * dire et ne s'affiche pas. Quand elle est là et qu'elle n'aboutit pas,
     * elle dit pourquoi — « Aucun réseau de chauffage dans ce projet »,
     * « déjà raccordé », « le tracé traverserait toute la maison » —, parce
     * qu'un bouton gris muet se lit comme une panne et qu'un bouton gris qui
     * nomme sa cause se lit comme une propriété du projet.
     */
    id: 'network.connect',
    label: 'Raccorder au réseau',
    hint: 'Relier cet appareil aux réseaux qui le desservent, d’un seul geste',
    importance: 'PRIMARY',
    writes: true,
    appliesTo: (context) => {
      const objectId = only(context);
      return (
        objectId !== undefined &&
        declaredConnections(context.project, objectId, context.levelId).length >
          0
      );
    },
    enabled: (context) => connectOutcome(context).status === 'OK',
    unavailableReason: (context) => {
      const plan = connectOutcome(context);
      return plan.status === 'REFUSED' ? plan.message : undefined;
    },
    run: (context) => {
      const plan = connectOutcome(context);
      // Le bouton est gris quand le plan refuse : on n'arrive ici qu'avec un
      // plan qui aboutit. La garde est là pour le raccourci clavier de demain,
      // qui ne regardera aucun bouton.
      if (plan.status === 'OK') context.host.runCommand(plan.command);
    },
  },

  /*
   * Les gestes communs. Ils s'affichent toujours et se grisent quand la
   * famille les refuse : c'est la règle du menu contextuel, et elle vaut ici
   * pour la même raison — une action visiblement indisponible dit ce que
   * l'objet est, une action absente laisse croire qu'on n'a pas trouvé.
   */
  {
    id: 'rotate',
    shortcutId: 'edit.rotate',
    label: 'Pivoter 90°',
    hint: 'Pivoter la sélection d’un quart de tour autour de son centre',
    importance: 'SECONDARY',
    writes: true,
    appliesTo: (context) => context.selection.length > 0,
    enabled: (context) => allows(context).rotatable,
    run: (context) => context.host.transform('ROTATE'),
  },
  {
    id: 'mirror',
    shortcutId: 'edit.mirror',
    label: 'Miroir gauche-droite',
    hint: 'Retourner la sélection de gauche à droite',
    importance: 'SECONDARY',
    writes: true,
    appliesTo: (context) => context.selection.length > 0,
    enabled: (context) => allows(context).mirrorable,
    run: (context) => context.host.transform('MIRROR'),
  },
  {
    id: 'duplicate',
    shortcutId: 'edit.duplicate',
    label: 'Dupliquer',
    hint: 'Copier la sélection un peu à côté, et désigner les copies',
    importance: 'SECONDARY',
    writes: true,
    appliesTo: (context) => context.selection.length > 0,
    enabled: (context) => allows(context).duplicable,
    run: (context) => context.host.duplicate(),
  },
  {
    /*
     * La seule action que toute famille possède.
     *
     * Elle n'était ni dans la barre ni ailleurs qu'au clavier et au clic
     * droit ; une trémie désignée n'offrait donc rien du tout, puisqu'elle ne
     * bouge pas. Elle est aussi ce qui rend la frontière d'édition visible :
     * elle disparaît de la barre dans un espace qui ne possède pas l'objet, et
     * c'est là qu'on comprend qu'on regarde de l'extérieur.
     */
    id: 'delete',
    shortcutId: 'edit.delete',
    label: 'Supprimer',
    hint: 'Retirer la sélection du projet ; l’historique la rend',
    importance: 'SECONDARY',
    writes: true,
    appliesTo: (context) => context.selection.length > 0,
    enabled: () => true,
    run: (context) => context.host.remove(),
  },
  /*
   * Aligner, centrer et répartir.
   *
   * Ils n'apparaissent qu'à partir de deux objets — trois pour répartir —,
   * parce qu'un alignement sur soi-même n'aligne rien : le bouton gris d'hier
   * promettait un geste qu'aucun clic sur cet objet ne rendait possible.
   */
  ...ARRANGEMENT_ACTIONS,
  {
    /*
     * Cadrer et désigner les semblables lisent le dessin sans y écrire : ce
     * sont les deux seules actions qui restent offertes depuis un espace qui
     * ne possède pas l'objet, et c'est exactement ce qu'on veut y faire.
     */
    id: 'frame',
    label: 'Cadrer sur cet objet',
    hint: 'Amener le dessin sur cet objet',
    importance: 'ADVANCED',
    writes: false,
    appliesTo: (context) => only(context) !== undefined,
    enabled: () => true,
    run: (context) => {
      const objectId = only(context);
      if (objectId !== undefined) context.host.frame(objectId);
    },
  },
  {
    id: 'similar',
    label: 'Sélectionner les objets semblables',
    hint: 'Désigner tout ce qui, dans sa famille, est bâti comme lui',
    importance: 'ADVANCED',
    writes: false,
    appliesTo: (context) => only(context) !== undefined,
    enabled: (context) => {
      const objectId = only(context);
      if (objectId === undefined || context.levelId === undefined) return false;
      return similarTo(context.project, context.levelId, objectId).length > 0;
    },
    run: (context) => {
      const objectId = only(context);
      if (objectId !== undefined) context.host.selectSimilar(objectId);
    },
  },
];

/**
 * Les gestes qu'une famille déclare elle-même, rendus comme des actions.
 *
 * `OBJECT_EDITORS` porte déjà `contextActions` — c'est de là que vient
 * « Basculer la face de référence » d'un mur —, et ces gestes n'étaient offerts
 * que par le clic droit. Les adapter plutôt que les redéclarer garde une seule
 * source : une famille qui gagne un geste demain le gagne dans la barre, dans
 * le menu et partout ailleurs, sans qu'on y revienne.
 *
 * Ils passent en tête, en `PRIMARY` : ce sont, par construction, les actions
 * que cette famille est seule à offrir.
 */
function declaredByFamily(
  context: ObjectActionContext,
): readonly ObjectAction[] {
  const objectId = only(context);
  if (objectId === undefined || context.levelId === undefined) return [];
  return contextActionsFor(context.project, context.levelId, objectId).map(
    (action): ObjectAction => ({
      id: action.id,
      label: action.label,
      hint: action.label,
      importance: 'PRIMARY',
      writes: true,
      appliesTo: () => true,
      // Une famille peut nommer un geste et le refuser sur cet objet-là : un
      // mur dont la référence est sur l'axe n'a pas de face à basculer.
      enabled: () => action.command() !== undefined,
      run: (inner) => {
        const command = action.command();
        if (command !== undefined) inner.host.runCommand(command);
      },
    }),
  );
}

/**
 * Toutes les actions qui parlent de cette sélection, tous rangs confondus.
 *
 * Sans filtre d'espace : c'est `stage-editing.ts` qui tient la frontière
 * d'édition, et lui seul. Un appelant qui écrit à l'écran passe par là.
 */
export function objectActionsFor(
  context: ObjectActionContext,
): readonly ObjectAction[] {
  return [...OBJECT_ACTIONS, ...declaredByFamily(context)].filter((action) =>
    action.appliesTo(context),
  );
}

/**
 * Combien la barre contextuelle en montre avant de replier.
 *
 * Cinq est le haut de la fourchette de l'audit, et c'est aussi ce qu'une
 * rangée au-dessus du dessin porte sans faire chercher. Au-delà, on ne lit
 * plus une barre : on la parcourt.
 */
export const CONTEXT_BAR_LIMIT = 5;

/**
 * Et combien elle en montre au minimum.
 *
 * Une barre réduite à un « … » ne dit rien : elle annonce qu'il y a quelque
 * chose sans dire quoi, ce qui coûte un clic pour apprendre ce qu'un mot
 * aurait dit. Quand les rangs utiles ne remplissent pas deux places — c'est le
 * cas depuis un espace qui ne possède pas l'objet, où il ne reste que ce qui
 * lit —, on remonte ce qui était replié.
 */
export const CONTEXT_BAR_MINIMUM = 2;

/** Ce que la barre montre, et ce qu'elle range derrière son « … ». */
export interface ContextBarActions {
  readonly shown: readonly ObjectAction[];
  readonly folded: readonly ObjectAction[];
}

/**
 * Ce que la barre montre de ces actions, et ce qu'elle replie.
 *
 * Le tri est stable à rang égal : l'ordre de déclaration décide, et il est
 * décidé une fois dans `OBJECT_ACTIONS`. Un affichage qui trierait lui-même
 * inventerait une hiérarchie que le registre n'a pas dite.
 */
export function contextBarActions(
  actions: readonly ObjectAction[],
): ContextBarActions {
  const ranked = [
    ...actions.filter(({ importance }) => importance === 'PRIMARY'),
    ...actions.filter(({ importance }) => importance === 'SECONDARY'),
  ];
  const advanced = actions.filter(
    ({ importance }) => importance === 'ADVANCED',
  );
  const shown = ranked.slice(0, CONTEXT_BAR_LIMIT);
  const folded = [...ranked.slice(CONTEXT_BAR_LIMIT), ...advanced];
  while (shown.length < CONTEXT_BAR_MINIMUM && folded.length > 0)
    shown.push(folded.shift()!);
  return { shown, folded };
}
