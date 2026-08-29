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
 *
 * Depuis que la coque n'a plus qu'une colonne, celle-ci fait deux métiers :
 * poser, et lire ce qu'on a désigné. Elle les fait l'un après l'autre — deux
 * modes annoncés en toutes lettres — et non l'un sous l'autre : 220 px de
 * large ne portent pas deux panneaux, et les propriétés d'un objet qu'on vient
 * de cliquer ne se lisent pas cinq cents pixels plus bas. Le mode courant est
 * dérivé de la sélection dans `column-mode.ts` ; ces deux boutons ne servent
 * qu'à contredire ce qu'elle en déduit.
 */
import type { ReactNode } from 'react';

import { creationStage } from '../ux/creation-stages.js';
import { destinationsOfStage } from '../ux/creation-stages.js';
import type { ShellNavigation } from '../ux/stage-state.js';
import { DESTINATION_LABELS, type DestinationId } from '../ux/destinations.js';
import type { ColumnMode } from './column-mode.js';

/** Ce que chaque mode de la colonne s'appelle, dans l'ordre où on le lit. */
const MODES: readonly { readonly id: ColumnMode; readonly label: string }[] = [
  { id: 'TOOLS', label: 'Outils' },
  { id: 'PROPERTIES', label: 'Propriétés' },
];

export interface ContextPanelProps {
  readonly navigation: ShellNavigation;
  readonly activeTab: DestinationId;
  readonly onSelectTab: (tab: DestinationId) => void;
  /** Ce que la colonne montre : ce qu'on pose, ou ce qu'on a désigné. */
  readonly mode: ColumnMode;
  readonly onSelectMode: (mode: ColumnMode) => void;
  /**
   * Vrai quand la colonne a bien deux choses à montrer.
   *
   * Une bascule dont une position est vide n'est pas une bascule : c'est un
   * bouton qui ne fait rien, et il coûte sa rangée à chaque écran. Au repos,
   * rien n'est désigné et il n'y a rien à décrire — la colonne pose, et c'est
   * tout ce qu'elle a à dire.
   */
  readonly modesOffered: boolean;
  /** Ce que la sélection est, montré à la place des outils. */
  readonly properties: ReactNode;
  /**
   * Ce qui vaut pour les deux modes, entre les destinations et la bascule.
   *
   * L'étage sur lequel on dessine est de ceux-là. Il avait suivi les outils,
   * et désigner un mur le faisait donc disparaître — or ce n'est pas un
   * contenu qu'on range, c'est où va ce qu'on trace, et la question se pose
   * autant en lisant un objet qu'en en posant un.
   */
  readonly context?: ReactNode;
  readonly children?: ReactNode;
}

export function ContextPanel({
  navigation,
  activeTab,
  onSelectTab,
  mode,
  onSelectMode,
  modesOffered,
  properties,
  context,
  children,
}: ContextPanelProps) {
  const stage = creationStage(navigation.stage);
  // Les bibliothèques ne sont pas des destinations : on ne « va » pas dans les
  // matériaux, on les ouvre parce qu'un mur en désigne un. Elles sont rangées
  // avec le reste de ce qu'on cherche, dans l'arborescence.
  const destinations = destinationsOfStage(navigation.stage);
  /*
   * La liste montre où l'on peut aller **et** où l'on est.
   *
   * Une bibliothèque n'est pas une destination de l'étape : on l'ouvre depuis
   * une propriété. Mais une fois dedans, si rien ne la nomme, plus rien ne
   * ramène au plan — et une étape qui n'offre qu'une destination n'affichait
   * aucune liste du tout.
   */
  const rows = destinations.includes(activeTab)
    ? destinations
    : [...destinations, activeTab];
  return (
    <>
      <p className="panel-label">{stage.label}</p>
      {rows.length > 1 && (
        <nav
          className="context-group"
          aria-label={`Ouvrir dans ${stage.label}`}
          role="group"
        >
          <p className="context-group-label">Ouvrir</p>
          {rows.map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === activeTab ? 'active' : undefined}
              aria-current={tab === activeTab ? 'page' : undefined}
              onClick={() => onSelectTab(tab)}
            >
              {DESTINATION_LABELS[tab]}
            </button>
          ))}
        </nav>
      )}
      {context}
      {/*
       * La bascule est collée à ce qu'elle bascule, et pas en haut de la
       * colonne : une commande qu'on lit à trois rangées de son effet est une
       * commande qu'on cherche. Les destinations, elles, restent au-dessus des
       * deux modes parce qu'elles valent pour les deux — on quitte le plan
       * aussi bien depuis les outils que depuis les propriétés.
       *
       * Et elle n'existe que lorsqu'il y a deux choses à montrer. Au repos,
       * rien n'est désigné : la colonne pose, la bascule n'aurait qu'une
       * position pleine, et deux boutons de plus s'offriraient en permanence
       * dans une colonne dont le budget est de dix. Ce qu'on veut lire au
       * repos — l'étage, l'échelle, le rendu — s'ouvre depuis « Propriétés »
       * dans la barre haute, qui est là pour ça et ne coûte rien ici.
       */}
      {modesOffered && (
        <div
          className="column-modes"
          role="group"
          aria-label="Ce que la colonne montre"
        >
          {MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={id === mode ? 'active' : undefined}
              aria-pressed={id === mode}
              onClick={() => onSelectMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {/*
       * Un seul des deux est rendu, et non caché.
       *
       * Un panneau `hidden` reste dans le document : il garde ses champs dans
       * l'ordre de tabulation d'un lecteur d'écran, et il fait mentir tout ce
       * qui compte ce que la colonne offre. Ce que la colonne ne montre pas
       * n'est pas là.
       */}
      {/*
       * Le volet défile, donc il s'atteint au clavier.
       *
       * Une zone qui défile sans être focalisable est une zone dont le contenu
       * n'existe pas pour qui n'a pas de souris : rien ne permet de la faire
       * défiler. `tabIndex` la rend atteignable, et le nom dit lequel des deux
       * modes on vient d'atteindre — « Propriétés » et « Outils » ne sont pas
       * la même liste, et arriver dans l'une en croyant être dans l'autre est
       * exactement ce qu'un nom évite.
       */}
      <div
        className="column-pane"
        role="region"
        aria-label={mode === 'PROPERTIES' ? 'Propriétés' : 'Outils'}
        tabIndex={0}
      >
        {mode === 'PROPERTIES' ? properties : children}
      </div>
    </>
  );
}
