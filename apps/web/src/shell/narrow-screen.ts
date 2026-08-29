/**
 * Savoir que la colonne est devenue un tiroir, pour pouvoir l'ouvrir.
 *
 * En dessous de 900 px la feuille de style sort le panneau de la grille et en
 * fait un tiroir — latéral, puis montant du bas sous 600 px. Tant que ce
 * panneau ne portait que les outils, personne n'avait besoin de le savoir en
 * JavaScript : on l'ouvrait avec le bouton « Panneau ».
 *
 * Il porte maintenant les propriétés de la sélection. Sur un téléphone,
 * désigner un mur ne montrerait donc rien du tout : la réponse serait dans un
 * tiroir fermé, et il faudrait deux gestes de plus pour lire ce qu'on vient de
 * demander. La feuille monte donc d'elle-même quand on désigne quelque chose,
 * et c'est le seul endroit où la disposition a besoin de se lire.
 *
 * Le seuil est écrit deux fois — ici et dans `styles.css` — et c'est un défaut
 * assumé : une media query ne se lit pas depuis un composant, et un panneau
 * qui s'ouvrirait sur un écran large serait bien pire qu'une constante en
 * double.
 */
import { useEffect, useState } from 'react';

/** Le seuil du tiroir, celui de `@media (max-width: 900px)`. */
export const DRAWER_QUERY = '(max-width: 900px)';

/** Vrai quand le panneau de contexte est un tiroir et non une colonne. */
export function useDrawerScreen(): boolean {
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia === undefined)
      return;
    const media = window.matchMedia(DRAWER_QUERY);
    setDrawer(media.matches);
    const follow = (event: MediaQueryListEvent): void =>
      setDrawer(event.matches);
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);
  return drawer;
}

/**
 * La même question, posée maintenant plutôt qu'au rendu précédent.
 *
 * Un état React répond de ce qui était vrai au dernier rendu. Quand un geste
 * doit décider sur-le-champ — la sélection vient de changer, la feuille
 * doit-elle monter ? — c'est la fenêtre qu'il faut interroger, pas la mémoire
 * qu'on en a gardée.
 */
export function isDrawerScreen(): boolean {
  if (typeof window === 'undefined' || window.matchMedia === undefined)
    return false;
  return window.matchMedia(DRAWER_QUERY).matches;
}
