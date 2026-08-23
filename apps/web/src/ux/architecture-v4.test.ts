import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { genericEquipmentCatalog } from '@house-technical-designer/equipment-catalog';

import { EDITOR_TOOLS } from '../editor/tool-registry.js';

/**
 * Ce que la spécification promet, et que le code doit tenir.
 *
 * `docs/UX_ARCHITECTURE_V4.md` nomme, pour chaque bouton de chaque header, un
 * outil du registre et une famille du catalogue. Une spécification dont les
 * noms ont dérivé est pire que pas de spécification : on l'applique, et on
 * découvre au troisième bouton qu'elle parle d'une famille qui n'existe plus.
 *
 * Ce test lit le document et refuse un nom qui ne répond pas. Il ne vérifie
 * pas que l'interface est conforme — elle ne l'est pas encore, c'est un plan —
 * seulement que le plan est écrit dans la langue du modèle.
 */
const DOCUMENT = readFileSync(
  new URL('../../../../docs/UX_ARCHITECTURE_V4.md', import.meta.url),
  'utf8',
);

/** Les noms en majuscules cités entre accents graves, sans les doublons. */
function quotedNames(): readonly string[] {
  return [
    ...new Set(
      [...DOCUMENT.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)].map(
        (match) => match[1]!,
      ),
    ),
  ];
}

describe('the V4 specification speaks the model’s language', () => {
  const toolIds = new Set(EDITOR_TOOLS.map(({ id }) => id));
  // Ce que le document nomme et que le code n'a pas encore, écrit noir sur
  // blanc en §11 : la spécification a le droit de nommer ce qu'elle demande,
  // à condition de le dire. Le jour où l'outil existe, cette liste maigrit.
  const PLANNED = new Set(['MEASURE']);
  const families = new Set(
    genericEquipmentCatalog()
      .map(({ familyId }) => familyId)
      .filter((id): id is string => id !== undefined),
  );
  // Ce que le document nomme et qui n'est ni un outil ni une famille : des
  // valeurs d'énumération et des identifiants de type, cités pour être précis.
  const OTHER_NAMES = new Set([
    'DESIGN_DOMAINS',
    'PARCEL',
    'OBSTACLE',
    'EXCLUSION',
    'TREE',
    'BUILDING',
    'OTHER',
    'EXTERIOR',
    'INTERIOR',
    'PARTITION',
    'FLOOR',
    'CEILING',
    'FOUNDATION',
    'TERRACE',
    'DOOR',
    'WINDOW',
    'VOID',
    'ROOM',
    'POINTS',
    'WALLS',
    'STRAIGHT',
    'L_SHAPED',
    'U_SHAPED',
    'SPIRAL',
    'SLOPED',
    'GABLE',
    'CENTER',
    'LEFT',
    'RIGHT',
    'YES',
    'SOURCE',
    'JUNCTION',
    'FIXTURE',
    'EMITTER',
    'OUTLET',
    'TANK',
    'TERMINAL',
    'INTAKE',
    'FAN',
    'CIRCUIT',
    'INSPECTION_CHAMBER',
    'SANITARY',
    'HEATING',
    'ELECTRICAL',
    'LIGHTING',
    'VENTILATION',
    'PHOTOVOLTAIC',
    'WATER',
    'WASTEWATER',
    'RAINWATER',
    'SOLAR',
    'STORAGE',
    'DATA',
    'SAFETY',
    'FLUE',
    'PLUMBING',
    'SITE',
    'ARCHITECTURE',
    'STRUCTURE',
    'FITTING',
    'SYSTEMS',
    'ENERGY',
    'CHECKS',
    'DOCUMENTS',
    'PROJECT',
    'BUILDING',
  ]);

  it('names an equipment family the installed catalogue holds', () => {
    const unknown = quotedNames().filter(
      (name) =>
        !families.has(name) &&
        !toolIds.has(name) &&
        !OTHER_NAMES.has(name) &&
        !PLANNED.has(name),
    );
    expect(unknown, `familles inconnues : ${unknown.join(', ')}`).toEqual([]);
  });

  it('names a tool the registry holds', () => {
    const cited = quotedNames().filter(
      (name) => !families.has(name) && !OTHER_NAMES.has(name),
    );
    const missing = cited.filter((name) => !toolIds.has(name));
    // Et rien d'autre : un outil cité que le registre n'a pas et que §11 ne
    // réclame pas est une spécification qui parle toute seule.
    expect(missing).toEqual([...PLANNED]);
  });

  it('keeps the seven tabs, and only seven', () => {
    const banner = DOCUMENT.match(
      /│ PROJET │ TERRAIN │ BÂTIMENT │ AMÉNAGEMENT │ SYSTÈMES │ ÉTUDES │ DOCUMENTS │/,
    );
    expect(banner).not.toBeNull();
  });
});
