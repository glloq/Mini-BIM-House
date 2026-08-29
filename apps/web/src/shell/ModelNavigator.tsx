/**
 * L'arborescence du projet, ouverte quand on la demande et pas avant.
 *
 * Elle vivait dans la colonne de gauche, sous un dépliage « Éléments du
 * projet » posé après le sommaire des sous-parties. Fermé, ce dépliage ne
 * montrait rien ; il coûtait quand même sa rangée, son trait et sa marge,
 * en permanence, dans la seule colonne qui reste — celle qui porte désormais
 * aussi les propriétés de la sélection. Une ligne qui ne dit rien tant qu'on
 * ne l'ouvre pas n'a pas à être là quand on ne l'ouvre pas.
 *
 * Retrouver un objet et poser un objet sont deux gestes différents, et un seul
 * des deux se fait à chaque minute. Celui-ci devient donc ce qu'il est : un
 * navigateur qu'on ouvre, où l'on cherche, et qu'on referme. Il paraît par
 * dessus le dessin et non par dessus la colonne, pour que cliquer un mur dans
 * l'arbre montre ses propriétés à côté de l'arbre plutôt que dessous.
 *
 * `Ctrl+K` reste l'autre chemin vers un objet, par son nom plutôt que par sa
 * place, et les deux se renvoient l'un à l'autre : une famille trop longue
 * pour être listée offre un bouton qui ouvre la recherche.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface ModelNavigatorProps {
  /**
   * De combien le panneau s'écarte du bord gauche.
   *
   * Il se pose contre le dessin, à droite de la colonne : ouvert par dessus
   * elle, il cacherait les propriétés de l'objet qu'on vient d'y désigner —
   * c'est-à-dire la réponse à la question qu'on posait.
   */
  readonly leftPx: number;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function ModelNavigator({
  leftPx,
  onClose,
  children,
}: ModelNavigatorProps) {
  return (
    <section
      id="project-navigator"
      className="model-navigator panel"
      role="dialog"
      aria-label="Éléments du projet"
      style={{ '--navigator-left': `${leftPx}px` } as CSSProperties}
    >
      <header className="model-navigator-head">
        <h2>Éléments du projet</h2>
        <button type="button" className="secondary" onClick={onClose}>
          Fermer
        </button>
      </header>
      {children}
    </section>
  );
}
