/**
 * Ce que la barre d'outils montre, parmi tout ce que l'outil accepte.
 *
 * Un outil déclare ses options ; la barre les affichait toutes, à plat, dans
 * l'ordre de la déclaration. L'outil Terrain proposait ainsi « Tracer, Nature,
 * Hauteur, Nom » — et quand Tracer valait « La parcelle », la nature, la
 * hauteur et le nom décrivaient un obstacle qu'on n'était pas en train de
 * tracer. Trois champs qui ne voulaient rien dire, offerts au moment précis où
 * l'on regarde la barre pour décider.
 *
 * La règle de ce module tient en une phrase : **au moment du placement, ne
 * montrer que ce qui peut changer la décision immédiate.** Ce qui ne s'applique
 * pas disparaît, ce qui se règle après coup se replie, le reste est là.
 *
 * Il ne décide rien lui-même — chaque option dit ce qu'elle est dans le
 * registre — et il ne touche à aucune valeur : c'est une mise en page, calculée
 * à chaque rendu et jamais conservée. `optionValue` continue de répondre pour
 * une option repliée comme pour une option masquée, ce qui est la seule raison
 * pour laquelle masquer est acceptable.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  optionValue,
  type ToolDrafts,
  type ToolOptionContext,
  type ToolOptionDefinition,
} from './tool-options.js';

/** Une option telle qu'elle sera posée à l'écran, valeur comprise. */
export interface OfferedToolOption {
  readonly option: ToolOptionDefinition;
  /** Ce qu'elle vaut maintenant, repli du projet compris. */
  readonly value: string;
  /** Faux quand la question se pose mais qu'on ne peut pas encore y répondre. */
  readonly enabled: boolean;
}

/** Comment les options d'un outil se rangent, à cet instant. */
export interface ToolOptionLayout {
  /** Ce qui pèse sur le geste en cours, offert d'un coup. */
  readonly primary: readonly OfferedToolOption[];
  /** Ce qui se règle exprès, derrière un dépliage. */
  readonly advanced: readonly OfferedToolOption[];
  /**
   * Combien de réglages repliés ne sont plus à leur valeur par défaut.
   *
   * Un réglage qu'on a changé et qui se cache est un piège : on dessine avec
   * une valeur qu'on ne voit plus. Le dépliage n'est pas forcé ouvert pour
   * autant — il appartient à celui qui lit, pas au rendu — mais il dit combien
   * de choses il cache qui ne sont pas celles d'origine.
   */
  readonly changedAdvanced: number;
}

/**
 * De quoi une option peut se servir pour répondre.
 *
 * `value` passe par `optionValue`, donc par les replis : une option qui
 * demande « que vaut Tracer ? » avant que l'utilisateur n'ait rien touché
 * obtient « PARCEL » et non la chaîne vide, et la barre montre dès le premier
 * instant ce qu'elle montrera au premier clic.
 */
export function toolOptionContext(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
): ToolOptionContext {
  return {
    project,
    value: (key) => optionValue(project, toolId, options, drafts, key),
  };
}

/** Les options que l'état actuel rend applicables, dans l'ordre déclaré. */
export function visibleToolOptions(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
): readonly ToolOptionDefinition[] {
  const context = toolOptionContext(project, toolId, options, drafts);
  return options.filter((option) => option.visibleWhen?.(context) !== false);
}

/**
 * Le rangement complet, tel que la barre n'a plus qu'à le dérouler.
 *
 * L'ordre de déclaration est conservé à l'intérieur de chaque groupe : le
 * registre reste l'endroit où l'on lit dans quel ordre un outil pose ses
 * questions, et ce module ne fait que les séparer en deux.
 */
export function toolOptionLayout(
  project: Project,
  toolId: string,
  options: readonly ToolOptionDefinition[],
  drafts: ToolDrafts,
): ToolOptionLayout {
  const context = toolOptionContext(project, toolId, options, drafts);
  const offered = options
    .filter((option) => option.visibleWhen?.(context) !== false)
    .map((option) => ({
      option,
      value: optionValue(project, toolId, options, drafts, option.key),
      enabled: option.enabledWhen?.(context) !== false,
    }));
  const advanced = offered.filter(({ option }) => option.level === 'ADVANCED');
  return {
    primary: offered.filter(({ option }) => option.level !== 'ADVANCED'),
    advanced,
    changedAdvanced: advanced.filter(
      ({ option, value }) => value !== option.fallback(context),
    ).length,
  };
}
