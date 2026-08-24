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
      }}
    />
  );
}
