/**
 * L'angle du nord, ramené dans le tour.
 *
 * 370° et −350° sont le même nord ; les écrire différemment ferait deux
 * projets identiques que rien ne compare. Une ligne dans son propre fichier
 * parce qu'un module qui exporte un composant n'exporte que des composants.
 */
export function northAngle(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  return ((Math.round(degrees) % 360) + 360) % 360;
}
