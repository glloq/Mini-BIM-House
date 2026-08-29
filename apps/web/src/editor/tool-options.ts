import type { Project } from '@house-technical-designer/core-domain';

/** One choice a tool option offers, as the user reads it. */
export interface ToolOptionChoice {
  readonly value: string;
  readonly label: string;
}

/**
 * What an option can look at to answer.
 *
 * An option often depends on the project — the assemblies it holds, the
 * networks it carries — and sometimes on another option of the same tool: the
 * kinds of node one can place depend on the discipline of the network chosen
 * just beside.
 */
export interface ToolOptionContext {
  readonly project: Project;
  readonly value: (key: string) => string;
}

/**
 * À quel moment une option se présente.
 *
 * Une barre d'outils qui montre tout ce qu'un outil accepte montre, au moment
 * du placement, des champs qui ne pèsent pas sur le geste en cours : le rôle
 * d'un mur, la hauteur des lettres d'une annotation, l'altitude d'un composant
 * se règlent aussi bien après coup, et occupent pourtant la même place que
 * l'assemblage, qui, lui, décide de ce qui va être construit.
 *
 * Deux niveaux, et pas trois : ce qui peut changer la décision immédiate, et
 * le reste. Une option qu'on ne sait pas classer reste `PRIMARY` — se tromper
 * en montrant coûte une ligne de trop, se tromper en cachant coûte un réglage
 * qu'on cherche.
 */
export type ToolOptionLevel = 'PRIMARY' | 'ADVANCED';

/**
 * One thing a tool lets the user decide before drawing.
 *
 * The toolbar used to hold a panel per tool, written by hand: the wall's
 * assembly and role, the opening's type and dimensions, the dimension's kind,
 * the network and the node. Every new tool meant another panel, and an editor
 * meant to cover stairs, columns, furniture, ducts and annotations would have
 * ended as a wall of controls nobody arranged.
 *
 * A tool now declares what it asks; the toolbar renders whatever is declared
 * and knows nothing about walls or ducts.
 */
export interface ToolOptionDefinition {
  readonly key: string;
  /**
   * Whether this choice belongs to the tool or to the whole plan.
   *
   * The network being worked on is not a property of one tool: placing a node
   * and routing a run must speak of the same one, and so must the Networks
   * workspace. An option declared shared is stored under its own name, so
   * every tool asking for it reads and writes the same value.
   */
  readonly scope?: 'SHARED';
  readonly kind: 'SELECT' | 'NUMBER' | 'TEXT';
  readonly label: string;
  readonly unit?: string;
  readonly min?: number;
  readonly step?: number;
  readonly hint?: string;
  /** The choices this option offers in this project. */
  readonly choices?: (
    context: ToolOptionContext,
  ) => readonly ToolOptionChoice[];
  /**
   * Whether the option means anything in the state the tool is in.
   *
   * L'outil Terrain trace une parcelle ou un obstacle. Une parcelle est une
   * limite : elle n'a ni nature, ni hauteur, ni nom — la commande les ignore
   * purement et simplement. Les proposer quand même, c'était offrir trois
   * réponses à une question qui n'est pas posée.
   *
   * Une option muette est **absente de l'écran, pas effacée** : sa valeur
   * reste lisible par `optionValue`, que les outils appellent au moment de
   * construire. Repasser sur « Obstacle » retrouve la nature qu'on avait
   * choisie, et un outil ne lit jamais `undefined` parce qu'un champ a quitté
   * la barre. Une option qui ne dit rien est visible.
   */
  readonly visibleWhen?: (context: ToolOptionContext) => boolean;
  /**
   * Whether the option can be changed right now.
   *
   * Différent de `visibleWhen`, et pour une raison précise : il y a des cas
   * où la question se pose mais où l'on ne peut pas encore y répondre — le
   * type d'un nœud de réseau tant qu'aucun réseau n'existe. La masquer ferait
   * disparaître la question ; la montrer inerte dit qu'elle existe et qu'il
   * manque quelque chose avant. Une option qui ne dit rien est modifiable.
   */
  readonly enabledWhen?: (context: ToolOptionContext) => boolean;
  /**
   * Si l'option est offerte d'emblée ou derrière « Plus de réglages ».
   *
   * Ce n'est pas une importance, c'est un moment : `ADVANCED` dit que le
   * repli répond juste dans l'immense majorité des poses, et que le régler
   * est un geste qu'on fait exprès. Rien n'est retiré — voir
   * `option-visibility.ts`, qui ne fait que ranger.
   */
  readonly level?: ToolOptionLevel;
  /**
   * What the option means when the user has not chosen.
   *
   * It is computed from the project rather than fixed: the first assembly of
   * this project, the first network it carries. A default written into the code
   * would be a value nobody chose, pointing at something that may not exist.
   */
  readonly fallback: (context: ToolOptionContext) => string;
}

/** What the user has typed or chosen, by tool and by option. */
export type ToolDrafts = Readonly<Record<string, string>>;

/**
 * The key one option is stored under.
 *
 * Prefixed by the tool, so two tools never share a value by accident; bare
 * when the option is shared on purpose.
 */
export function draftKey(
  toolId: string,
  optionKey: string,
  shared = false,
): string {
  return shared ? optionKey : `${toolId}.${optionKey}`;
}

/** The key an option of this tool is stored under, scope included. */
export function storageKeyOf(
  toolId: string,
  option: ToolOptionDefinition,
): string {
  return draftKey(toolId, option.key, option.scope === 'SHARED');
}

/**
 * The value an option holds right now.
 *
 * A stored value that no longer exists in this project — an assembly that was
 * deleted, a network that was renamed — is not used: the option falls back to
 * what the project can actually offer, rather than drawing with a reference
 * pointing nowhere.
 *
 * Cette fonction ne regarde ni `visibleWhen` ni `level`, et c'est délibéré :
 * ce sont les outils eux-mêmes qui l'appellent pour construire, pas seulement
 * l'affichage. Une option repliée ou masquée garde donc exactement la valeur
 * qu'elle avait — masquer est une décision d'écran, effacer serait une
 * décision de modèle, et un outil qui lirait `undefined` parce qu'un champ a
 * quitté la barre serait un défaut bien pire que le champ de trop.
 */
export function optionValue(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
  key: string,
): string {
  const definition = options.find((option) => option.key === key);
  if (definition === undefined) return '';
  const context: ToolOptionContext = {
    project,
    value: (other) =>
      other === key
        ? (drafts[storageKeyOf(toolId, definition)] ?? '')
        : optionValue(project, toolId, options, drafts, other),
  };
  const held = drafts[storageKeyOf(toolId, definition)];
  if (held === undefined || held === '') return definition.fallback(context);
  if (definition.choices === undefined) return held;
  return definition.choices(context).some(({ value }) => value === held)
    ? held
    : definition.fallback(context);
}

/** The same, read as a number, or nothing when it is not one. */
export function optionNumber(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
  key: string,
): number | undefined {
  const raw = optionValue(project, toolId, options, drafts, key).replace(
    ',',
    '.',
  );
  const parsed = Number(raw);
  return raw.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
}
