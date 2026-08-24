/**
 * Ce que chaque espace laisse **désigner**.
 *
 * On pouvait prendre la parcelle depuis l'onglet du bâtiment et les murs
 * depuis celui de l'aménagement : un clic un peu large, et l'on déplaçait la
 * limite du terrain en croyant bouger une cloison. Un espace filtre ce qu'il
 * propose ; il doit aussi filtrer ce qu'il prend, sans quoi la séparation des
 * parties n'est qu'une façade.
 *
 * La liste n'est pas écrite deux fois : elle est **dérivée** de ce que
 * l'espace sait poser. Un espace laisse désigner les familles d'objets que ses
 * entrées créent, plus celles qu'on ne peut créer nulle part et qu'il faut
 * pourtant pouvoir atteindre — les niveaux n'en font pas partie, ce sont des
 * rangées, pas des objets.
 *
 * Deux espaces ne filtrent rien, et c'est voulu : `ÉTUDES` ouvre un écart sur
 * son objet, quel qu'il soit, et `DOCUMENTS` met n'importe quoi sur une
 * feuille. Y restreindre la sélection ferait disparaître le constat qu'on
 * vient de cliquer.
 */
import type { CreationStageId } from './creation-stages.js';
import type { ObjectKind } from '../editor/object-editors.js';
import { entryCreates } from '../editor/entry-kinds.js';
import { sectionsOfStage } from '../editor/toolbox.js';

/** Les espaces qui laissent tout désigner, et pourquoi. */
const OPEN_STAGES: ReadonlySet<CreationStageId> = new Set<CreationStageId>([
  // Un écart s'ouvre sur son objet : le restreindre le rendrait inatteignable.
  'CHECKS',
  // Une feuille porte n'importe quelle vue de n'importe quel objet.
  'DOCUMENTS',
  // L'espace du projet ne dessine pas : il n'a rien à restreindre.
  'PROJECT',
]);

/**
 * Ce qu'on peut prendre dans cet espace, ou `undefined` quand tout est permis.
 *
 * Les cotes et les annotations passent partout : elles disent quelque chose du
 * dessin, et on les corrige là où on les lit.
 */
export function selectableKinds(
  stage: CreationStageId,
): ReadonlySet<ObjectKind> | undefined {
  if (OPEN_STAGES.has(stage)) return undefined;
  const kinds = new Set<ObjectKind>(['DIMENSION', 'NOTE']);
  for (const section of sectionsOfStage(stage))
    for (const entry of section.entries)
      for (const kind of entryCreates(entry)) kinds.add(kind);
  return kinds;
}

/** Si cet espace laisse désigner un objet de cette famille. */
export function selectableInStage(
  stage: CreationStageId,
  kind: ObjectKind | undefined,
): boolean {
  const allowed = selectableKinds(stage);
  if (allowed === undefined) return true;
  // Un objet dont aucune famille ne répond n'est refusé par personne : ce
  // serait un objet qu'on voit et qu'on ne peut plus jamais atteindre.
  return kind === undefined || allowed.has(kind);
}
