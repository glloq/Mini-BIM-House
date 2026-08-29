/**
 * Un espace ne propose que ce qu'il a le droit de poser.
 *
 * Depuis qu'un objet appartient à un espace, une entrée de boîte à outils qui
 * fabrique un objet d'un autre espace est un **bouton mort** : le geste part,
 * la commande arrive au seul passage qui écrit, et il la refuse. L'utilisateur
 * clique « WC » dans Systèmes › Eau et lit « Cet objet appartient à
 * Aménagement ».
 *
 * Dix-huit entrées sur deux cent vingt et une étaient dans ce cas, et rien ne
 * le disait : `entry-placement.test.ts` pose bien chaque entrée pour de bon,
 * mais il passe par `ProjectCommandDispatcher` directement, sans l'espace
 * actif — il ne peut donc pas voir un refus qui dépend de l'espace. Deux mille
 * six cent quatre-vingts tests passaient au-dessus de dix-huit boutons qui ne
 * posaient rien.
 *
 * La règle en une phrase : le métier d'un objet décide de l'onglet, et le fait
 * qu'il soit physiquement dehors n'y change rien. Une prise extérieure est de
 * l'électricité, une unité extérieure de pompe à chaleur est du chauffage, et
 * un WC est un sanitaire même quand on vient de parler de sa plomberie.
 *
 * Ce que Systèmes doit offrir à propos d'un WC n'est pas de le poser : c'est
 * de le raccorder.
 */
import { describe, expect, it } from 'vitest';

import { entryCreates } from '../editor/entry-kinds.js';
import { sectionsOfStage } from '../editor/toolbox.js';
import { CREATION_STAGES, type CreationStageId } from './creation-stages.js';
import { family } from '@house-technical-designer/catalog-registry';

import {
  OWNER_OF_CATEGORY,
  OWNER_OF_KIND,
  stageOfFineCategory,
} from './ownership.js';

/**
 * Les espaces qu'une entrée réclamerait pour ce qu'elle pose.
 *
 * Vide veut dire « aucun en particulier » — une cote, une annotation, un objet
 * posé dont la catégorie ne dit pas le métier. Ceux-là ne sont refusés nulle
 * part, donc ils ne peuvent pas être en désaccord avec un onglet.
 */
function ownersOf(entry: {
  readonly family?: string;
  readonly options?: Readonly<Record<string, string>>;
}): ReadonlySet<CreationStageId> {
  const owners = new Set<CreationStageId>();
  for (const kind of entryCreates(entry as never)) {
    if (kind !== 'COMPONENT') {
      const owner = OWNER_OF_KIND[kind];
      if (owner !== undefined) owners.add(owner);
      continue;
    }
    /*
     * La même règle qu'à l'exécution, nourrie de la même donnée par un
     * autre chemin : le projet porte sa copie de fiche, un test peut lire
     * le registre. `stageOfFineCategory` est ce qui les fait répondre
     * pareil — et elle n'importe rien, ce qui la laisse au premier écran
     * sans y traîner les cinq cent vingt-sept familles.
     */
    const owner =
      (entry.family === undefined
        ? undefined
        : stageOfFineCategory(
            family(entry.family)?.category,
            entry.options?.['category'] as never,
          )) ??
      OWNER_OF_CATEGORY[
        (entry.options?.['category'] ?? '') as keyof typeof OWNER_OF_CATEGORY
      ];
    if (owner !== undefined) owners.add(owner);
  }
  return owners;
}

describe('ce qu’un espace propose de poser', () => {
  it('is always something that stage is allowed to place', () => {
    const disagreements: string[] = [];
    let counted = 0;
    for (const stage of CREATION_STAGES)
      for (const section of sectionsOfStage(stage))
        for (const entry of section.entries) {
          counted += 1;
          const owners = ownersOf(entry);
          if (owners.size > 0 && !owners.has(stage))
            disagreements.push(
              `${stage} › ${section.id} — « ${entry.label} » pose ce qui appartient à ${[...owners].join(', ')}`,
            );
        }
    // Assez d'entrées pour que le test veuille dire quelque chose : s'il n'en
    // lisait plus aucune, il passerait en ne regardant rien.
    expect(counted).toBeGreaterThan(150);
    expect(disagreements, disagreements.join('\n')).toEqual([]);
  });
});
