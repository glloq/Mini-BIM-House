/**
 * Le calque de papier, sous le dessin.
 *
 * Un relevé cadastral, un plan de géomètre, une photo d'esquisse : on commence
 * rarement une maison sur une feuille blanche, et il n'y avait aucun moyen de
 * mettre ce qu'on a sous ce qu'on trace.
 *
 * Il est posé dans le repère du modèle, comme la grille : il suit le
 * déplacement et le zoom, et un mètre de l'image reste un mètre du plan. Il ne
 * prend aucun clic, il n'entre dans aucune sélection, il n'est annoncé à
 * personne — un calque se regarde, il ne se désigne pas.
 *
 * Rien n'est mémorisé : la position à l'écran est **calculée** de la caméra à
 * chaque image, comme tout le reste de ce dossier.
 */
import type { SiteUnderlay } from '@house-technical-designer/core-domain';
import {
  modelToScreen,
  type Camera2D,
} from '@house-technical-designer/editor-core';

export interface UnderlayImageProps {
  readonly camera: Camera2D;
  readonly underlay: SiteUnderlay;
}

export function UnderlayImage({ camera, underlay }: UnderlayImageProps) {
  if (!(camera.viewportWidthPx > 0)) return null;
  const at = modelToScreen(camera, underlay.originMm);
  /*
   * La feuille tournée.
   *
   * Un cadastre est rarement nord en haut et une photo d'esquisse ne l'est
   * jamais ; il fallait jusqu'ici retourner l'image dans un autre logiciel
   * avant de l'importer, ce que personne ne fait deux fois.
   *
   * Elle tourne autour de son centre, parce que c'est ce qu'on attend en
   * redressant une feuille : le dessin pivote sur place au lieu de partir en
   * arc de cercle. Cela ne dérange pas la calibration — mettre à l'échelle
   * autour d'un point fixe et tourner le même dessin donnent le même résultat
   * dans les deux ordres —, et le coin `originMm` continue de dire où l'image
   * serait posée droite, ce que le fichier écrivait déjà.
   */
  const turned = underlay.rotationDeg ?? 0;
  return (
    <img
      className="underlay-image"
      src={underlay.image}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        left: `${at.x}px`,
        top: `${at.y}px`,
        width: `${underlay.widthMm * camera.pixelsPerMm}px`,
        height: `${underlay.heightMm * camera.pixelsPerMm}px`,
        opacity: underlay.opacity ?? 0.55,
        ...(turned === 0 ? {} : { transform: `rotate(${turned}deg)` }),
      }}
    />
  );
}
