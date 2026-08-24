/**
 * Un contour, quel que soit l'objet qui le porte.
 *
 * Une dalle, une toiture, une parcelle et une trémie sont la même chose : une
 * suite de sommets qui se referme. Elles étaient pourtant quatre écrans :
 * la dalle et la toiture avaient des poignées, la parcelle n'en avait aucune
 * — on la retraçait pour la corriger — et la trémie n'existait même pas comme
 * objet une fois percée.
 *
 * Ce module dit **où est le contour** et **comment le réécrire**, et rien
 * d'autre. Tout ce qui manipule des sommets — poignées, insertion, suppression,
 * longueurs de côtés, aire — travaille dessus et ignore ce qui le porte. C'est
 * ce qui permet d'ajouter une cinquième surface sans écrire un cinquième
 * éditeur.
 *
 * Rien n'est mémorisé : le contour est **lu** du projet à chaque appel.
 */
import type { Project } from '@house-technical-designer/core-domain';
import {
  SetParcelBoundaryCommand,
  UpdateRoofCommand,
  UpdateSiteObstacleCommand,
  UpdateSlabCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';

/** Ce qui porte le contour. Une trémie est un anneau creusé dans une dalle. */
export type SurfaceKind = 'SLAB' | 'ROOF' | 'SLAB_HOLE' | 'SITE';

export interface PolygonSurface {
  readonly objectId: string;
  readonly kind: SurfaceKind;
  /** Comment on nomme l'objet, au singulier, dans une phrase. */
  readonly label: string;
  /** Le niveau qui le porte, quand il en a un. */
  readonly levelId?: string;
  /** L'anneau qu'on modifie — l'extérieur, ou le trou pour une trémie. */
  readonly outline: readonly Point2D[];
  /** Le contour réécrit, remis là où il vit. */
  readonly withOutline: (outline: readonly Point2D[]) => ProjectCommand;
}

/**
 * L'identifiant d'une trémie : la dalle qui la porte, et son rang.
 *
 * Un trou n'était rien — il vivait dans le tableau `holes` d'une dalle, sans
 * nom, donc sans moyen d'être désigné, donc sans moyen d'être corrigé. Il en
 * a un maintenant, et il se lit : « la deuxième trémie de cette dalle ».
 */
export function slabHoleId(slabId: string, index: number): string {
  return `${slabId}#hole:${index}`;
}

/** L'inverse, pour qui reçoit un identifiant et cherche à quoi il renvoie. */
export function readSlabHoleId(
  objectId: string,
): { readonly slabId: string; readonly index: number } | undefined {
  const cut = objectId.indexOf('#hole:');
  if (cut < 0) return undefined;
  const index = Number(objectId.slice(cut + '#hole:'.length));
  if (!Number.isInteger(index) || index < 0) return undefined;
  return { slabId: objectId.slice(0, cut), index };
}

function levelsOf(project: Project, levelId: string | undefined) {
  // Le niveau courant d'abord : c'est celui qu'on dessine, et deux niveaux
  // peuvent porter des objets homonymes dans deux fichiers réunis.
  const levels = project.building.levels;
  const active = levels.find(({ id }) => id === levelId);
  return active === undefined ? levels : [active, ...levels];
}

/**
 * Le contour que cet identifiant désigne, et de quoi le réécrire.
 *
 * L'ordre des essais est celui des fréquences : on corrige surtout des dalles
 * et des toitures. La parcelle et les obstacles vivent hors des niveaux.
 */
export function polygonSurface(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): PolygonSurface | undefined {
  const hole = readSlabHoleId(objectId);
  for (const level of levelsOf(project, levelId)) {
    if (hole !== undefined) {
      const host = level.slabs.find(({ id }) => id === hole.slabId);
      const ring = host?.polygon.holes?.[hole.index];
      if (host === undefined || ring === undefined) continue;
      return {
        objectId,
        kind: 'SLAB_HOLE',
        label: 'Trémie',
        levelId: level.id,
        outline: ring,
        withOutline: (outline) =>
          new UpdateSlabCommand(level.id, host.id, {
            polygon: {
              outer: host.polygon.outer,
              holes: (host.polygon.holes ?? []).map((existing, index) =>
                index === hole.index
                  ? outline.map((point) => ({ ...point }))
                  : existing,
              ),
            },
          }),
      };
    }
    const slab = level.slabs.find(({ id }) => id === objectId);
    if (slab !== undefined)
      return {
        objectId,
        kind: 'SLAB',
        label: 'Dalle',
        levelId: level.id,
        outline: slab.polygon.outer,
        withOutline: (outline) =>
          new UpdateSlabCommand(level.id, slab.id, {
            polygon: {
              ...slab.polygon,
              outer: outline.map((point) => ({ ...point })),
            },
          }),
      };
    const roof = level.roofs.find(({ id }) => id === objectId);
    if (roof !== undefined)
      return {
        objectId,
        kind: 'ROOF',
        label: 'Toiture',
        levelId: level.id,
        outline: roof.footprint.outer,
        withOutline: (outline) =>
          new UpdateRoofCommand(level.id, roof.id, {
            footprint: {
              ...roof.footprint,
              outer: outline.map((point) => ({ ...point })),
            },
          }),
      };
  }

  if (objectId === 'site:parcel') {
    const parcel = project.site.parcelBoundary;
    if (parcel === undefined) return undefined;
    return {
      objectId,
      kind: 'SITE',
      label: 'Parcelle',
      outline: parcel.outer,
      // La parcelle ne se déplace pas — c'est la limite du sol — mais ses
      // sommets se corrigent : un bornage se relève, il ne se retrace pas.
      withOutline: (outline) => new SetParcelBoundaryCommand(outline),
    };
  }

  const obstacle = (project.site.obstacles ?? []).find(
    ({ id }) => id === objectId,
  );
  if (obstacle !== undefined)
    return {
      objectId,
      kind: 'SITE',
      label: obstacle.name ?? 'Emprise',
      outline: obstacle.boundary.outer,
      withOutline: (outline) =>
        new UpdateSiteObstacleCommand(obstacle.id, { outline }),
    };

  return undefined;
}

/** Toutes les trémies d'un projet, avec l'identifiant qui les désigne. */
export function slabHoles(
  project: Project,
  levelId: string | undefined,
): readonly { readonly objectId: string; readonly slabId: string }[] {
  const level =
    levelId === undefined
      ? project.building.levels[0]
      : project.building.levels.find(({ id }) => id === levelId);
  if (level === undefined) return [];
  return level.slabs.flatMap((slab) =>
    (slab.polygon.holes ?? []).map((_ring, index) => ({
      objectId: slabHoleId(slab.id, index),
      slabId: slab.id,
    })),
  );
}

/**
 * Tout ce qui, dans ce projet, est un contour qu'on peut corriger.
 *
 * Sert à savoir **ce qu'on vient de créer** : une commande ne rend pas
 * l'identifiant de ce qu'elle a fait, et le comparer avant/après est la seule
 * réponse qui ne demande à aucune commande de se souvenir de quoi que ce soit.
 */
export function surfaceIds(
  project: Project,
  levelId: string | undefined,
): readonly string[] {
  const level =
    levelId === undefined
      ? project.building.levels[0]
      : project.building.levels.find(({ id }) => id === levelId);
  return [
    ...(level === undefined
      ? []
      : [
          ...level.slabs.map(({ id }) => id),
          ...level.roofs.map(({ id }) => id),
        ]),
    ...slabHoles(project, levelId).map(({ objectId }) => objectId),
    ...(project.site.parcelBoundary === undefined ? [] : ['site:parcel']),
    ...(project.site.obstacles ?? []).map(({ id }) => id),
  ];
}
