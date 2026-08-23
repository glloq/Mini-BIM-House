/**
 * Les valeurs de la barre d'état, écrites comme on les lit.
 *
 * Séparées du composant parce qu'un test les lit, et parce qu'un fichier qui
 * exporte un composant et des fonctions perd le rechargement à chaud.
 */
/**
 * Un pas de grille écrit comme on le dit.
 *
 * « 100 mm » est juste et ne se lit pas ; « 10 cm » se lit. Au-dessus du
 * mètre on passe au mètre, en dessous du centimètre on garde le millimètre :
 * la règle est celle d'un mètre de chantier, pas celle d'un tableur.
 */
export function gridLabel(spacingMm: number): string {
  if (spacingMm >= 1000)
    return `${(spacingMm / 1000).toFixed(spacingMm % 1000 === 0 ? 0 : 2)} m`;
  if (spacingMm >= 10 && spacingMm % 10 === 0) return `${spacingMm / 10} cm`;
  return `${spacingMm} mm`;
}

/**
 * L'échelle, comme un plan la porte.
 *
 * « 20 px/m » ne dit rien à personne ; « 1:50 » dit qu'un centimètre sur le
 * papier vaut cinquante sur la maison. Elle dépend de la définition de
 * l'écran, qu'on prend à 96 points par pouce faute de pouvoir la mesurer — et
 * c'est pourquoi elle s'écrit « ≈ ».
 */
export function scaleLabel(pixelsPerMm: number): string {
  const mmPerPixel = 1 / pixelsPerMm;
  const ratio = Math.round((mmPerPixel * 96) / 25.4);
  return ratio <= 0 ? '—' : `1:${ratio}`;
}
