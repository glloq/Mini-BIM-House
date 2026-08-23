/**
 * Ce que le plan montre, sur une rangée, contre le plan.
 *
 * Quatre notions vivaient sous le mot « vue » et à quatre endroits : le niveau
 * dans une liste déroulante du panneau gauche, la discipline dans une liste de
 * boutons juste en dessous, la charte graphique nulle part sauf dans la
 * palette, les calques dans deux écrans concurrents. Elles décrivent toutes ce
 * que le dessin montre : elles sont donc à côté du dessin, sur la même rangée.
 *
 * L'en-tête du canvas disparaît dans celle-ci — il répétait le nom du niveau
 * au-dessus d'elle, et deux rangées pour une phrase font trente-six pixels que
 * le plan n'a pas.
 */
import type { ReactNode } from 'react';

import {
  designDomain,
  type DesignDomainId,
} from '@house-technical-designer/core-domain';

export interface ViewBarDomainChoice {
  readonly id: DesignDomainId;
  /** Combien de réseaux le projet en tient : « rien à voir » ≠ « rien de tracé ». */
  readonly networks: number;
}

export interface ViewBarProps {
  /** L'étage dessiné, nommé. On en change dans l'arborescence, pas ici. */
  readonly levelName: string;
  readonly domains: readonly ViewBarDomainChoice[];
  readonly activeDomain?: DesignDomainId;
  readonly onDomain: (domain: DesignDomainId) => void;
  /** La variante dessinée, quand le projet en porte. */
  readonly scenarios: readonly { readonly id: string; readonly name: string }[];
  readonly scenarioId?: string;
  readonly onScenario: (scenarioId: string | undefined) => void;
  /** Le bouton d'affichage et son panneau, montés par l'appelant. */
  readonly display: ReactNode;
}

export function ViewBar({
  levelName,
  domains,
  activeDomain,
  onDomain,
  scenarios,
  scenarioId,
  onScenario,
  display,
}: ViewBarProps) {
  return (
    <header className="view-bar" aria-label="Ce que le plan montre">
      <h2>{levelName}</h2>
      {domains.length > 1 && (
        <label className="view-choice">
          <span className="visually-hidden">Discipline</span>
          <select
            value={activeDomain ?? ''}
            onChange={(event) => onDomain(event.target.value as DesignDomainId)}
          >
            {domains.map(({ id, networks }) => (
              <option key={id} value={id}>
                {designDomain(id).label}
                {networks === 0 ? '' : ` (${networks})`}
              </option>
            ))}
          </select>
        </label>
      )}
      {scenarios.length > 0 && (
        <label className="view-choice">
          Variante
          <select
            value={scenarioId ?? ''}
            onChange={(event) =>
              onScenario(
                event.target.value === '' ? undefined : event.target.value,
              )
            }
          >
            <option value="">Le projet lui-même</option>
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="view-bar-end">{display}</div>
    </header>
  );
}
