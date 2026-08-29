/**
 * Ce qu'un outil demande, clic par clic, dit avec les mots du métier.
 *
 * Un outil savait dire **combien** de clics il attend, et rien de plus. De ce
 * nombre l'écran tirait « Cliquez le premier point », « Cliquez le second
 * point » : exact, dérivé d'une seule source, et parfaitement muet. Personne
 * ne pense « mon outil demande deux points ». On pense « je choisis le mur à
 * décaler, puis je dis de quel côté et de combien » — et l'outil Décaler,
 * justement, affichait « premier point / second point » pour ces deux gestes
 * qui n'ont rien de commun.
 *
 * Une étape nomme donc **l'objet du geste** plutôt que son rang. Elle dit
 * aussi de quelle nature il est : désigner un mur qui existe, poser un point
 * libre, donner une direction, indiquer un côté et un écart. Cette nature est
 * ce dont vivront ensuite le curseur, l'aperçu, le magnétisme et la saisie
 * numérique : aujourd'hui elle sert la phrase affichée, et l'endroit où on
 * l'écrira demain est déjà celui-ci plutôt qu'un `switch` de plus dans la
 * toile.
 *
 * La déclaration reste **facultative**. Un outil qui n'en donne pas continue
 * d'être décrit par son nombre de points, comme avant, mot pour mot : on
 * enrichit vingt-cinq outils un par un, on ne les réécrit pas d'un coup.
 */
import type { ObjectKind } from './object-editors.js';

/**
 * La nature d'un clic, indépendamment de ce qu'il désigne.
 *
 * Quatre gestes, parce que quatre choses différentes se passent à l'écran :
 * on vise un objet qui existe déjà et il faut le mettre en évidence ; on pose
 * un point libre et il faut l'accrocher à la trame ; on donne une direction et
 * seul l'angle compte ; on dit un côté et une distance, et là un champ de
 * saisie a un sens. Le nom de l'étape est ce qui permettra de choisir sans
 * demander à l'outil.
 */
export type InteractionStepKind = 'PICK' | 'POINT' | 'DIRECTION' | 'DISTANCE';

export interface InteractionStep {
  readonly kind: InteractionStepKind;
  /**
   * La phrase affichée, sans point final.
   *
   * Le point final n'appartient pas à l'étape : c'est l'écran qui compose la
   * phrase complète, parfois en y ajoutant ce qui est déjà posé ou la façon
   * d'en sortir. Une étape qui portait sa ponctuation obligeait à la retirer
   * pour la prolonger.
   */
  readonly prompt: string;
  /**
   * Les familles d'objets que ce clic peut désigner, quand il en désigne.
   *
   * Un outil qui coupe un mur ne devrait pas pouvoir attraper une cotation
   * qui passe par là. La toile ne lit pas encore cette liste — elle prend ce
   * qui est sous le curseur — mais la déclarer ici est ce qui permettra de la
   * restreindre sans que la toile apprenne le nom des outils.
   */
  readonly accepts?: readonly ObjectKind[];
  /**
   * Si une valeur peut être tapée plutôt que cliquée à cette étape.
   *
   * Décaler d'exactement 200 mm ne se clique pas : cela se saisit. L'étape le
   * dit ; le champ de saisie viendra le lire.
   */
  readonly numericInput?: true;
}

/**
 * L'étape que décrit le clic à venir, quand l'outil en a déclaré.
 *
 * Pour un outil qui sait combien de clics il attend, chaque clic a son étape.
 * Pour un tracé qui ne s'arrête pas tout seul, les clics au-delà des étapes
 * déclarées répètent la dernière : un mur continu n'a pas de trentième coin
 * qui mérite sa propre phrase, il a un coin suivant, indéfiniment.
 */
export function stepForClick(
  steps: readonly InteractionStep[] | undefined,
  placed: number,
): InteractionStep | undefined {
  if (steps === undefined || steps.length === 0) return undefined;
  if (placed < 0) return undefined;
  return placed < steps.length ? steps[placed] : steps[steps.length - 1];
}

/** Ce qu'il faut connaître d'un outil pour juger ses étapes : rien de plus. */
export interface StepCoherenceSubject {
  readonly requiredPoints: number;
  readonly openEnded?: true;
  readonly interaction?: readonly InteractionStep[];
}

/**
 * Pourquoi les étapes d'un outil contredisent son nombre de points, s'il y a
 * une raison de le dire.
 *
 * Deux déclarations qui décrivent la même chose sont deux vérités qui vont
 * finir par diverger : un outil passé de deux à trois clics, dont les étapes
 * en décrivent toujours deux, afficherait « Cliquez son extrémité » pour un
 * clic qui n'est pas celui-là. Le nombre de points reste l'autorité — c'est
 * lui que la toile compte — et les étapes doivent le couvrir exactement.
 *
 * Exactement, sauf pour un tracé ouvert : là `requiredPoints` n'est pas un
 * compte mais un minimum, et la dernière étape se répète, donc une seule
 * étape suffit déjà à décrire tous les clics à partir d'elle. Ce qui reste
 * interdit est d'en déclarer **plus** que le minimum : ce serait décrire une
 * suite finie d'étapes pour un tracé qui n'en a pas, et promettre une
 * quatrième phrase à qui posera un quatrième coin sur trente.
 */
export function stepCoherenceProblem(
  tool: StepCoherenceSubject,
): string | undefined {
  const steps = tool.interaction;
  if (steps === undefined) return undefined;
  if (steps.length === 0)
    return 'des étapes déclarées mais vides : ne rien déclarer dit déjà cela';
  if (tool.openEnded === true)
    return steps.length <= tool.requiredPoints
      ? undefined
      : `${steps.length} étape(s) pour un tracé ouvert d'au moins ${tool.requiredPoints} clic(s) : une suite finie ne décrit pas un tracé sans fin`;
  const typedOnAPick = steps.find(
    (step) => step.numericInput === true && step.kind === 'PICK',
  );
  /*
   * On ne tape pas un objet au clavier.
   *
   * `numericInput` promet un champ où l'on donne la valeur exacte que le clic
   * aurait visée — une longueur, un cap, un écart. Une étape qui demande de
   * **désigner** un objet n'a pas de valeur à taper : la déclarer ainsi
   * annoncerait une saisie qui ne peut pas exister.
   */
  if (typedOnAPick !== undefined)
    return `l’étape « ${typedOnAPick.prompt} » désigne un objet : rien ne s’y tape`;
  return steps.length === tool.requiredPoints
    ? undefined
    : `${steps.length} étape(s) pour ${tool.requiredPoints} clic(s) attendu(s)`;
}
