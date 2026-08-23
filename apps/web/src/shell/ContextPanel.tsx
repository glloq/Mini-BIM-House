/**
 * Ce qu'on peut faire dans l'étape où l'on est, et rien d'autre.
 *
 * L'ancienne colonne listait les treize destinations d'un coup : elle
 * répondait à « où puis-je aller » — une question que personne ne se pose — au
 * lieu de « qu'est-ce que je fais ici ». Celle-ci montre ce que l'étape
 * courante offre, puis ce que cette étape veut mettre en dessous.
 *
 * Les sous-étapes d'une étape sont déclarées par le registre et rendues par ce
 * que chacune sert : celles de Systèmes et d'Énergie **sont** des disciplines,
 * et c'est le sélecteur de discipline qui les offre — il compte les réseaux et
 * suit le périmètre, ce qu'une rangée de libellés ne saurait faire. Celles du
 * bâtiment et de la structure sont des groupes d'outils, et arriveront avec la
 * boîte à outils contextuelle.
 */
import type { ReactNode } from 'react';

import { creationStage } from '../ux/creation-stages.js';
import { destinationsOf, type ShellNavigation } from '../ux/stage-state.js';
import {
  LEGACY_WORKSPACE_LABELS,
  type LegacyWorkspaceTab,
} from '../ux/workspaces.js';

export interface ContextPanelProps {
  readonly navigation: ShellNavigation;
  readonly activeTab: LegacyWorkspaceTab;
  readonly onSelectTab: (tab: LegacyWorkspaceTab) => void;
  readonly children?: ReactNode;
}

export function ContextPanel({
  navigation,
  activeTab,
  onSelectTab,
  children,
}: ContextPanelProps) {
  const stage = creationStage(navigation.stage);
  const destinations = destinationsOf(navigation.stage);
  return (
    <>
      <p className="panel-label">{stage.label}</p>
      {destinations.length > 1 && (
        <nav
          className="context-group"
          aria-label={`Ouvrir dans ${stage.label}`}
          role="group"
        >
          <p className="context-group-label">Ouvrir</p>
          {destinations.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === activeTab ? 'active' : undefined}
              aria-current={tab === activeTab ? 'page' : undefined}
              onClick={() => onSelectTab(tab)}
            >
              {LEGACY_WORKSPACE_LABELS[tab]}
            </button>
          ))}
        </nav>
      )}
      {children}
    </>
  );
}
