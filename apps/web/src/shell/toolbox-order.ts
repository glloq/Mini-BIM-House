/**
 * Où les tuiles se trouvent, et pourquoi cela ne dépend pas du projet.
 *
 * Sorti du composant pour deux raisons. La première est qu'une règle
 * d'ergonomie se teste, et qu'un test qui la relit depuis le registre plutôt
 * que depuis la fonction ne prouve rien. La seconde est qu'un fichier de
 * composant qui exporte autre chose que des composants casse le rechargement
 * à chaud, ce que l'outillage signale à juste titre.
 */
import type { ToolboxAvailability, ToolboxSection } from '../editor/toolbox.js';
import { availabilityOf } from '../editor/toolbox.js';
import type { DesignState } from '../ux/design-state.js';

/**
 * L'ordre du registre, et rien d'autre.
 *
 * Les tuiles étaient triées par ce qu'il restait à faire : recommandées
 * d'abord, inertes en dernier. L'intention était bonne — aider à trouver la
 * suite — mais elle se paie sur le geste qu'on fait le plus souvent, qui est
 * de reprendre le même outil.
 *
 * Mesuré entre un projet neuf et la maison de référence : **quarante-six
 * tuiles sur deux cent dix-sept changent de place**. Un cinquième de la boîte
 * bouge pendant qu'on travaille, et « Porte » n'est plus là où on l'a prise il
 * y a deux minutes parce qu'on a tracé un mur entre-temps.
 *
 * L'état, lui, continue de se voir : une recommandée porte son point et sa
 * mise en avant, une inerte porte sa raison. Ce qui change est ce qu'une tuile
 * **dit**, jamais où elle **est** — c'est la seule des deux qu'on retrouve les
 * yeux fermés.
 */
export function ordered(
  section: ToolboxSection,
  design: DesignState,
): readonly ToolboxAvailability[] {
  return section.entries.map((entry) => availabilityOf(entry, design));
}
