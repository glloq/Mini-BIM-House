/**
 * Le bord haut : ce qu'est cette application, où l'on est, et ce qui vaut pour
 * tout le fichier.
 *
 * Il y avait deux rangées : un titre au-dessus des sept espaces. Un titre
 * qu'on ne relit jamais et une navigation qu'on lit sans arrêt ne méritent pas
 * la même hauteur, et deux rangées coûtaient 78 px au dessin. Le nom se réduit
 * donc à un mot, les espaces prennent le milieu, et ce qui vaut pour le
 * fichier reste à droite.
 *
 * Seul ce qui concerne le projet entier a sa place ici — ouvrir, enregistrer,
 * annuler, exporter. Ce qui concerne la chose dessinée appartient au header du
 * plan ; l'y mettre est la façon dont une barre supérieure grandit jusqu'à
 * devenir une seconde application.
 *
 * Voir `docs/UX_ARCHITECTURE_V4.md` §1.
 */
import type { ReactNode } from 'react';

export interface TopBarProps {
  readonly eyebrow: string;
  readonly title: string;
  /** Les sept espaces, sur la même rangée que le nom. */
  readonly tabs?: ReactNode;
  readonly actions: ReactNode;
}

export function TopBar({ eyebrow, title, tabs, actions }: TopBarProps) {
  return (
    <header className="app-header">
      {/*
       * Le nom entier reste le titre du document ; ce qui rétrécit est ce
       * qu'on en montre. Le mot visible est hors du titre, faute de quoi le
       * titre s'appellerait « Mini BIMHouse Technical Designer » — deux noms
       * collés que plus personne ne trouve.
       */}
      <p
        className="wordmark"
        aria-hidden="true"
        title={`${title} — ${eyebrow}`}
      >
        Mini BIM
      </p>
      <h1 className="visually-hidden">{title}</h1>
      {tabs}
      <div className="actions">{actions}</div>
    </header>
  );
}
