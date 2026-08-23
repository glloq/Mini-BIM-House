/**
 * Ce que le bâtiment dessiné donne, en une page.
 *
 * La liste des constats répond à « qu'est-ce qui ne va pas ». Elle ne répond
 * pas à « où en est ma maison » — pour ça il faut la lire en entier, compter
 * les lignes par métier, et savoir de tête quels calculs n'ont pas tourné.
 *
 * Trois états et pas un de plus. **Tenu** : rien à signaler. **Écart** : un
 * constat nommé. **Calcul disponible** : quelque chose peut être calculé et ne
 * l'a pas été — ce qui n'est pas un défaut, seulement un travail qui attend.
 *
 * Un métier que le projet ne fait pas vivre n'a pas de ligne. Un projet sans
 * photovoltaïque n'affiche pas « Photovoltaïque — vide » : il n'affiche rien.
 */
import {
  designDomain,
  type DesignDomainId,
  type Project,
} from '@house-technical-designer/core-domain';

import { domainsInPlay } from '../ux/scope-filter.js';
import type { CheckItem } from './checks-model.js';

export type StudyState = 'HELD' | 'GAP' | 'AVAILABLE';

export interface StudyLine {
  readonly domain: DesignDomainId;
  readonly label: string;
  readonly state: StudyState;
  /** Combien d'écarts, quand il y en a. */
  readonly gaps: number;
}

export interface StudyFigures {
  /** Ce que les pièces enferment, tous niveaux confondus. */
  readonly livingAreaM2: number;
  /** Ce que le bâtiment prend au sol. */
  readonly footprintM2: number;
}

/** À quel métier un constat parle, quand il le dit dans son identifiant. */
function domainOfCheck(
  check: CheckItem,
  domains: readonly DesignDomainId[],
): DesignDomainId | undefined {
  const id = check.id.toLowerCase();
  return domains.find((domain) => id.startsWith(domain.toLowerCase()));
}

export function studyLines(
  project: Project,
  checks: readonly CheckItem[],
  options: { readonly ran?: boolean } = {},
): readonly StudyLine[] {
  const inPlay = [...domainsInPlay(project)];
  return inPlay.map((domain) => {
    const gaps = checks.filter(
      (check) =>
        check.status === 'FAIL' && domainOfCheck(check, inPlay) === domain,
    ).length;
    const modules = designDomain(domain).calculationModules ?? [];
    const state: StudyState =
      gaps > 0
        ? 'GAP'
        : modules.length > 0 && options.ran !== true
          ? 'AVAILABLE'
          : 'HELD';
    return { domain, label: designDomain(domain).label, state, gaps };
  });
}

/**
 * Les deux surfaces qu'on cite quand on parle d'une maison.
 *
 * L'habitable est la somme des pièces ; l'emprise, ce que le rez-de-chaussée
 * prend au sol. Aucune n'est stockée : les deux se relisent du modèle, comme
 * tout le reste.
 */
export function studyFigures(project: Project): StudyFigures {
  let livingAreaMm2 = 0;
  let footprintMm2 = 0;
  for (const level of project.building.levels) {
    for (const space of level.spaces) {
      if (space.boundaryMode !== 'MANUAL') continue;
      livingAreaMm2 += Math.abs(shoelace(space.manualPolygon.outer));
    }
    if (level.elevationMm !== 0) continue;
    for (const slab of level.slabs)
      if (slab.role === 'FLOOR')
        footprintMm2 = Math.max(
          footprintMm2,
          Math.abs(shoelace(slab.polygon.outer)),
        );
  }
  return {
    livingAreaM2: livingAreaMm2 / 1_000_000,
    footprintM2: footprintMm2 / 1_000_000,
  };
}

function shoelace(
  points: readonly { readonly x: number; readonly y: number }[],
): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
}
