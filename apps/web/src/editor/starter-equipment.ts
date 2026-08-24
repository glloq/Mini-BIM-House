/**
 * Les fiches qu'un projet neuf tient parce que l'interface les propose.
 *
 * Un projet neuf n'avait aucune fiche : `Aménagement` était vide, `Systèmes`
 * aussi, et les deux disaient poliment d'ouvrir la bibliothèque. C'était
 * cohérent — une entrée qui ne peut rien poser est une promesse — mais c'était
 * répondre « allez chercher » à quelqu'un qui vient de cliquer « Lit ».
 *
 * La liste n'est pas écrite ici : elle **est** celle des familles que les
 * headers nomment. Ajouter un bouton à une sous-partie installe donc la fiche
 * qu'il pose, et rien d'autre — le catalogue générique en tient quatre cents,
 * et un projet neuf n'a pas à en porter quatre cents pour poser un lit.
 *
 * Le passage d'une fiche du catalogue à une fiche du projet est celui que tout
 * le monde emprunte : `equipmentSnapshot`, avec ce que la famille déclare. Il
 * n'y a pas deux chemins.
 */
import {
  equipmentCategoryOfFamily,
  family,
  familyCapabilities,
} from '@house-technical-designer/catalog-registry';
import {
  equipmentSnapshot,
  genericEquipmentCatalog,
} from '@house-technical-designer/equipment-catalog';
import {
  HOST_TYPES,
  type EquipmentDefinition,
} from '@house-technical-designer/core-domain';

import { allToolboxEntries } from './toolbox.js';

function isHostType(value: string): value is (typeof HOST_TYPES)[number] {
  return (HOST_TYPES as readonly string[]).includes(value);
}

/** Les familles que les headers nomment, sans doublon. */
export function offeredFamilies(): readonly string[] {
  return [
    ...new Set(
      allToolboxEntries()
        .map(({ family: named }) => named)
        .filter((named): named is string => named !== undefined),
    ),
  ];
}

/**
 * La fiche générique d'**une** famille, prise à la demande.
 *
 * Un projet qui ne tient pas la fiche voyait le bouton disparaître : ouvrir
 * `Aménagement` sur un projet neuf donnait un espace entièrement vide, sans
 * une sous-partie, avec pour seul recours « ouvrez la bibliothèque ». C'était
 * répondre « allez chercher » à quelqu'un qui vient de cliquer « Lit ».
 *
 * L'entrée reste donc là et **installe ce qu'elle pose**, au moment où on la
 * prend. C'est le même passage que pour un projet neuf — il n'y en a pas deux.
 */
export function equipmentForFamily(
  familyId: string,
): EquipmentDefinition | undefined {
  const raw = genericEquipmentCatalog().find(
    (definition) => definition.familyId === familyId,
  );
  if (raw === undefined) return undefined;
  const category = equipmentCategoryOfFamily(familyId);
  const chosen = category === undefined ? raw : { ...raw, category };
  return equipmentSnapshot(chosen, {
    id: chosen.id,
    allowedHosts: (family(familyId)?.placement?.allowedHosts ?? []).filter(
      isHostType,
    ),
    requiredClearances: family(familyId)?.clearances ?? [],
    capabilities: familyCapabilities(familyId),
  });
}

/**
 * La fiche du catalogue générique pour chaque famille proposée.
 *
 * Une famille que le catalogue ne tient pas ne donne rien : le bouton reste
 * absent, ce qui est la règle, plutôt qu'une fiche inventée.
 */
export function starterEquipment(): readonly EquipmentDefinition[] {
  const wanted = new Set(offeredFamilies());
  const seen = new Set<string>();
  const chosen: EquipmentDefinition[] = [];
  for (const raw of genericEquipmentCatalog()) {
    const familyId = raw.familyId;
    if (!wanted.has(familyId) || seen.has(familyId)) continue;
    seen.add(familyId);
    // La catégorie est le mot de la famille et non celui de la fiche : c'est
    // ce que `genericCatalog()` estampille, et le tampon doit être le même,
    // sinon la même fiche arrive dans deux catégories selon le chemin pris.
    const category = equipmentCategoryOfFamily(familyId);
    const entry = category === undefined ? raw : { ...raw, category };
    chosen.push(
      equipmentSnapshot(entry, {
        id: entry.id,
        allowedHosts: (family(familyId)?.placement?.allowedHosts ?? []).filter(
          isHostType,
        ),
        requiredClearances: family(familyId)?.clearances ?? [],
        capabilities: familyCapabilities(familyId),
      }),
    );
  }
  return chosen;
}
