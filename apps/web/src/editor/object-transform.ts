import type { Point2D, Polygon2D } from '@house-technical-designer/geometry';
import type { Project, TextNote } from '@house-technical-designer/core-domain';
import {
  isTextNote,
  isWallOpening,
} from '@house-technical-designer/core-domain';
import {
  AddComponentCommand,
  AddOpeningCommand,
  AddWallCommand,
  AddRoofCommand,
  AddRoofStructureCommand,
  AddSiteObstacleCommand,
  AddSlabCommand,
  AddStairCommand,
  AddTextNoteCommand,
  AddStructuralMemberCommand,
  MoveNetworkEdgeVertexCommand,
  MoveWallCommand,
  ProjectEditorCommand,
  SetWallPathCommand,
  UpdateComponentCommand,
  UpdateNetworkNodeCommand,
  UpdateRoofCommand,
  UpdateRoofStructureCommand,
  UpdateSiteObstacleCommand,
  UpdateSlabCommand,
  UpdateStairCommand,
  UpdateStructuralMemberCommand,
  UpdateTextNoteCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';

import { chooseHost } from './host-choice.js';

/**
 * How a selection is being transformed.
 *
 * Moving, turning and reflecting are one map from a point to a point. Saying
 * so is what lets a family answer all three at once instead of once per verb:
 * a stair that follows a rotation follows a move for the same reason, and the
 * family that forgot one of the three was the bug this replaces.
 */
export type PlanTransform =
  | { readonly kind: 'TRANSLATE'; readonly deltaMm: Point2D }
  | {
      readonly kind: 'ROTATE';
      readonly centre: Point2D;
      readonly angleDeg: number;
    }
  | {
      readonly kind: 'MIRROR';
      /** Two points of the axis the selection is reflected across. */
      readonly from: Point2D;
      readonly to: Point2D;
    };

/** The point a transform sends this one to. */
export function transformPoint(
  transform: PlanTransform,
  point: Point2D,
): Point2D {
  if (transform.kind === 'TRANSLATE')
    return {
      x: point.x + transform.deltaMm.x,
      y: point.y + transform.deltaMm.y,
    };
  if (transform.kind === 'ROTATE') {
    const radians = (transform.angleDeg * Math.PI) / 180;
    const dx = point.x - transform.centre.x;
    const dy = point.y - transform.centre.y;
    return {
      x: transform.centre.x + dx * Math.cos(radians) - dy * Math.sin(radians),
      y: transform.centre.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
  }
  const axis = {
    x: transform.to.x - transform.from.x,
    y: transform.to.y - transform.from.y,
  };
  const lengthSquared = axis.x * axis.x + axis.y * axis.y;
  // An axis of no length reflects nothing; the point stays where it is rather
  // than becoming a division by zero.
  if (lengthSquared === 0) return point;
  const dx = point.x - transform.from.x;
  const dy = point.y - transform.from.y;
  const projection = (dx * axis.x + dy * axis.y) / lengthSquared;
  const foot = {
    x: transform.from.x + axis.x * projection,
    y: transform.from.y + axis.y * projection,
  };
  return { x: 2 * foot.x - point.x, y: 2 * foot.y - point.y };
}

/**
 * Which way a direction points once the object carrying it has been moved.
 *
 * A roof plane and a placed component both face somewhere, and what they face
 * is read by the sun calculations and by the symbol on the plan. Turning the
 * shape without turning the bearing leaves an object drawn to the east and
 * computed to the south, which is exactly the kind of silent inconsistency
 * this project refuses.
 *
 * The bearing is carried as a direction rather than as a number so that a
 * reflection can be applied to it: reflecting a direction is reflecting the
 * two points it joins. A move changes no direction at all.
 */
export function transformedAzimuthDeg(
  transform: PlanTransform,
  azimuthDeg: number,
): number {
  if (transform.kind === 'TRANSLATE') return azimuthDeg;
  const radians = (azimuthDeg * Math.PI) / 180;
  const facing = { x: Math.cos(radians), y: Math.sin(radians) };
  const origin = { x: 0, y: 0 };
  const moved =
    transform.kind === 'ROTATE'
      ? transformPoint(
          { kind: 'ROTATE', centre: origin, angleDeg: transform.angleDeg },
          facing,
        )
      : // Only the direction of the axis matters to a direction, not where it
        // sits: the reflection is taken about a parallel axis through zero.
        transformPoint(
          {
            kind: 'MIRROR',
            from: origin,
            to: {
              x: transform.to.x - transform.from.x,
              y: transform.to.y - transform.from.y,
            },
          },
          facing,
        );
  const turned = (Math.atan2(moved.y, moved.x) * 180) / Math.PI;
  return ((turned % 360) + 360) % 360;
}

/** A polygon carried elsewhere, holes included. */
export function transformedPolygon(
  polygon: Polygon2D,
  transform: PlanTransform,
): Polygon2D {
  const move = (point: Point2D) => transformPoint(transform, point);
  return {
    outer: polygon.outer.map(move),
    ...(polygon.holes === undefined
      ? {}
      : { holes: polygon.holes.map((hole) => hole.map(move)) }),
  };
}

/** A polygon moved by a distance, which is the transform most often wanted. */
export function translatedPolygon(
  polygon: Polygon2D,
  deltaMm: Point2D,
): Polygon2D {
  return transformedPolygon(polygon, { kind: 'TRANSLATE', deltaMm });
}

/**
 * What a family says about being moved, turned or reflected.
 *
 * Three answers, not two. `undefined` means « this object is not mine »;
 * `REFUSED` means « it is mine and it does not do that », which is a fact
 * about the object worth telling the user; and `OK` carries the commands.
 */
export type TransformOutcome =
  | { readonly status: 'OK'; readonly commands: readonly ProjectCommand[] }
  | { readonly status: 'REFUSED'; readonly message: string };

export type TransformProvider = (
  project: Project,
  levelId: string,
  objectId: string,
  transform: PlanTransform,
  /** Everything else the same action is transforming, this object included. */
  selection: ReadonlySet<string>,
) => TransformOutcome | undefined;

/** What a family says about being copied a little to the side. */
export type DuplicateOutcome =
  | {
      readonly status: 'OK';
      readonly commands: readonly ProjectCommand[];
      readonly createdId: string;
    }
  | { readonly status: 'REFUSED'; readonly message: string };

export interface DuplicationContext {
  readonly newId: (prefix: string) => string;
  /**
   * The copy each object already duplicated by this action received.
   *
   * An opening has to land in the copy of its wall, a component on the copy of
   * its support. Families are asked in the order they are declared, and walls
   * come first, so what hangs on something finds it already copied.
   */
  readonly copies: ReadonlyMap<string, string>;
}

export type DuplicateProvider = (
  project: Project,
  levelId: string,
  objectId: string,
  deltaMm: Point2D,
  context: DuplicationContext,
) => DuplicateOutcome | undefined;

/**
 * What can be done to an object of a family, said by the family itself.
 *
 * The menu greys out what a family does not offer instead of offering it and
 * failing afterwards: an action that is proposed and then refused reads as a
 * defect, while an action that is visibly unavailable reads as a property of
 * the object — which is what it is.
 */
export interface ObjectCapabilities {
  readonly movable: boolean;
  readonly rotatable: boolean;
  readonly mirrorable: boolean;
  readonly duplicable: boolean;
}

export const NOTHING_MOVES: ObjectCapabilities = {
  movable: false,
  rotatable: false,
  mirrorable: false,
  duplicable: false,
};

export const EVERYTHING_MOVES: ObjectCapabilities = {
  movable: true,
  rotatable: true,
  mirrorable: true,
  duplicable: true,
};

function levelOf(project: Project, levelId: string) {
  return project.building.levels.find(({ id }) => id === levelId);
}

const refused = (message: string): TransformOutcome => ({
  status: 'REFUSED',
  message,
});

const done = (...commands: readonly ProjectCommand[]): TransformOutcome => ({
  status: 'OK',
  commands,
});

const verb = (transform: PlanTransform): string =>
  transform.kind === 'TRANSLATE'
    ? 'Déplacer'
    : transform.kind === 'ROTATE'
      ? 'Pivoter'
      : 'Retourner';

export const wallTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const wall = levelOf(project, levelId)?.walls.find(
    ({ id }) => id === objectId,
  );
  if (wall === undefined) return undefined;
  const id = `wall:transform:${objectId}`;
  // A move keeps the wall's own command: it carries the openings along, which
  // rewriting the path point by point would not.
  return done(
    new ProjectEditorCommand(
      id,
      `${verb(transform)} un mur`,
      levelId,
      transform.kind === 'TRANSLATE'
        ? new MoveWallCommand(id, wall.id, transform.deltaMm)
        : new SetWallPathCommand(
            id,
            wall.id,
            wall.path.points.map((point) => transformPoint(transform, point)),
          ),
    ),
  );
};

export const openingTransform: TransformProvider = (
  project,
  levelId,
  objectId,
) =>
  levelOf(project, levelId)?.openings.some(({ id }) => id === objectId) === true
    ? refused(
        'Une ouverture appartient à son mur : faites glisser sa poignée le long du mur, ou transformez le mur qui la porte.',
      )
    : undefined;

export const spaceTransform: TransformProvider = (
  project,
  levelId,
  objectId,
) =>
  levelOf(project, levelId)?.spaces.some(({ id }) => id === objectId) === true
    ? refused(
        'Une pièce est l’espace que ses murs enferment : transformez les murs.',
      )
    : undefined;

export const dimensionTransform: TransformProvider = (
  project,
  levelId,
  objectId,
) =>
  (levelOf(project, levelId)?.annotations ?? []).some(
    ({ id }) => id === objectId,
  )
    ? refused(
        'Une cote mesure des points de murs : elle suit les murs qu’elle mesure.',
      )
    : undefined;

/**
 * A note travels with what it annotates, text and leader together.
 *
 * Its letters are never turned by a mirror: text read backwards is text nobody
 * reads. What it points at moves, what it says stays legible.
 */
export const noteTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const note = (levelOf(project, levelId)?.annotations ?? []).find(
    (annotation): annotation is TextNote =>
      annotation.id === objectId && isTextNote(annotation),
  );
  if (note === undefined) return undefined;
  return done(
    new UpdateTextNoteCommand(levelId, note.id, {
      at: transformPoint(transform, note.at),
      ...(note.leaderTo === undefined
        ? {}
        : { leaderTo: transformPoint(transform, note.leaderTo) }),
      ...(transform.kind === 'ROTATE'
        ? { rotationDeg: (note.rotationDeg ?? 0) + transform.angleDeg }
        : {}),
    }),
  );
};

export const slabTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const slab = levelOf(project, levelId)?.slabs.find(
    ({ id }) => id === objectId,
  );
  return slab === undefined
    ? undefined
    : done(
        new UpdateSlabCommand(levelId, slab.id, {
          polygon: transformedPolygon(slab.polygon, transform),
        }),
      );
};

export const roofTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const roof = levelOf(project, levelId)?.roofs.find(
    ({ id }) => id === objectId,
  );
  return roof === undefined
    ? undefined
    : done(
        new UpdateRoofCommand(levelId, roof.id, {
          footprint: transformedPolygon(roof.footprint, transform),
          // The plane faces somewhere, and that is what the sun is calculated
          // against: an outline turned without its bearing would be drawn one
          // way and computed another.
          azimuthDeg: transformedAzimuthDeg(transform, roof.azimuthDeg),
        }),
      );
};

/**
 * A roof described by its outline, whose slopes follow their own sides.
 *
 * Nothing here touches the pitches: a side keeps its place in the outline, so
 * the slope declared for it stays the slope of the same physical side. The
 * bearings are derived from the outline, so reflecting the outline reflects
 * them — which is why this roof needs no azimuth carried by hand.
 */
export const roofStructureTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const roof = (levelOf(project, levelId)?.roofStructures ?? []).find(
    ({ id }) => id === objectId,
  );
  return roof === undefined
    ? undefined
    : done(
        new UpdateRoofStructureCommand(levelId, roof.id, {
          footprint: transformedPolygon(roof.footprint, transform),
        }),
      );
};

export const stairTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const stair = levelOf(project, levelId)?.stairs.find(
    ({ id }) => id === objectId,
  );
  return stair === undefined
    ? undefined
    : done(
        new UpdateStairCommand(levelId, stair.id, {
          path: stair.path.points.map((point) =>
            transformPoint(transform, point),
          ),
        }),
      );
};

export const structureTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const member = (levelOf(project, levelId)?.structure ?? []).find(
    ({ id }) => id === objectId,
  );
  return member === undefined
    ? undefined
    : done(
        new UpdateStructuralMemberCommand(levelId, member.id, {
          path: member.path.map((point) => transformPoint(transform, point)),
        }),
      );
};

export const componentTransform: TransformProvider = (
  project,
  levelId,
  objectId,
  transform,
) => {
  const component = (levelOf(project, levelId)?.components ?? []).find(
    ({ id }) => id === objectId,
  );
  if (component === undefined) return undefined;
  const at = transformPoint(transform, component.position);
  return done(
    new UpdateComponentCommand(levelId, component.id, {
      position: { x: at.x, y: at.y },
      // A radiator turned with the wall it hangs on has to end up facing the
      // room, not the direction it faced before the wall moved.
      rotationDeg: transformedAzimuthDeg(transform, component.rotationDeg),
    }),
  );
};

/**
 * The site: the parcel and what stands on it.
 *
 * The parcel is the one object of the project that never moves — moving it is
 * moving the house relative to its limits, which is done by moving the house.
 */
export const siteTransform: TransformProvider = (
  project,
  _levelId,
  objectId,
  transform,
) => {
  if (objectId === 'site:parcel')
    return project.site.parcelBoundary === undefined
      ? undefined
      : refused(
          'La parcelle est la limite du terrain : déplacez le bâtiment, pas ses limites.',
        );
  const obstacle = (project.site.obstacles ?? []).find(
    ({ id }) => id === objectId,
  );
  return obstacle === undefined
    ? undefined
    : done(
        new UpdateSiteObstacleCommand(obstacle.id, {
          outline: obstacle.boundary.outer.map((point) =>
            transformPoint(transform, point),
          ),
        }),
      );
};

/**
 * A network object: a node stands somewhere, a segment runs between two.
 *
 * A node moves and its segments follow — the domain re-anchors them. A segment
 * on its own cannot move, because its ends belong to their ports; what it can
 * do is carry its own corners when both of its nodes are travelling with it,
 * which is what keeps a whole run its shape instead of stretching it.
 */
export const networkTransform: TransformProvider = (
  project,
  _levelId,
  objectId,
  transform,
  selection,
) => {
  for (const network of project.systems ?? []) {
    const node = network.nodes.find(({ id }) => id === objectId);
    if (node !== undefined) {
      const at = transformPoint(transform, node.position);
      return done(
        new UpdateNetworkNodeCommand(network.id, node.id, {
          position: { x: at.x, y: at.y, z: node.position.z },
        }),
      );
    }
    const edge = network.edges.find(({ id }) => id === objectId);
    if (edge === undefined) continue;
    const nodeOfPort = new Map(
      network.ports.map((port) => [port.id, port.nodeId] as const),
    );
    const ends = [
      nodeOfPort.get(edge.fromPortId),
      nodeOfPort.get(edge.toPortId),
    ];
    /*
     * `selection` est ce qui voyage **du même mouvement**, et non ce qui est
     * désigné.
     *
     * La distinction n'était pas visible tant que le seul appelant était un
     * déplacement d'ensemble, où les deux coïncident. Un rangement — aligner,
     * répartir — donne à chaque objet son propre écart : ses objets sont
     * désignés ensemble et ne voyagent pas ensemble. Un tronçon qui accepterait
     * là son écart à lui verrait ses coins intermédiaires partir d'un côté
     * pendant que ses nœuds partent de l'autre, et le tracé se déchirerait
     * sans qu'aucun refus ne soit prononcé.
     */
    if (!ends.every((end) => end !== undefined && selection.has(end)))
      return refused(
        'Un tronçon n’a pas de position à lui : il suit les nœuds qu’il relie. Déplacez-les, ou rangez-les.',
      );
    // The ends are moved by their own nodes; only the corners in between are
    // this segment's to carry.
    return done(
      ...edge.path.slice(1, -1).map((point, index) => {
        const at = transformPoint(transform, point);
        return new MoveNetworkEdgeVertexCommand(
          network.id,
          edge.id,
          index + 1,
          at,
        );
      }),
    );
  }
  return undefined;
};

const duplicated = (
  createdId: string,
  ...commands: readonly ProjectCommand[]
): DuplicateOutcome => ({ status: 'OK', commands, createdId });

export const wallDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const wall = levelOf(project, levelId)?.walls.find(
    ({ id }) => id === objectId,
  );
  if (wall === undefined) return undefined;
  const copyId = newId('wall');
  return duplicated(
    copyId,
    new ProjectEditorCommand(
      `wall:duplicate:${copyId}`,
      'Dupliquer un mur',
      levelId,
      new AddWallCommand(`wall:duplicate:${copyId}`, {
        ...wall,
        id: copyId as (typeof wall)['id'],
        path: {
          points: wall.path.points.map((point) => ({
            x: point.x + deltaMm.x,
            y: point.y + deltaMm.y,
          })),
        },
      }),
    ),
  );
};

/**
 * An opening, put in the copy of the wall that carries it.
 *
 * Duplicated on its own it would be put back on the same wall at the same
 * place, exactly under the original: two openings occupying one hole.
 */
export const openingDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  _deltaMm,
  { newId, copies },
) => {
  const opening = levelOf(project, levelId)?.openings.find(
    ({ id }) => id === objectId,
  );
  if (opening === undefined) return undefined;
  if (!isWallOpening(opening))
    return {
      status: 'REFUSED',
      message:
        'Une fenêtre de toit se duplique avec le pan qui la porte, et un pan est dérivé de sa toiture.',
    };
  const host = copies.get(opening.host.id);
  if (host === undefined)
    return {
      status: 'REFUSED',
      message:
        'Une ouverture ne se duplique qu’avec son mur : sélectionnez aussi le mur qui la porte.',
    };
  const copyId = newId('opening');
  return duplicated(
    copyId,
    new ProjectEditorCommand(
      `opening:duplicate:${copyId}`,
      'Dupliquer une ouverture',
      levelId,
      new AddOpeningCommand(`opening:duplicate:${copyId}`, {
        ...opening,
        id: copyId as (typeof opening)['id'],
        host: { kind: 'WALL' as const, id: host },
      }),
    ),
  );
};

export const noteDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const note = (levelOf(project, levelId)?.annotations ?? []).find(
    (annotation): annotation is TextNote =>
      annotation.id === objectId && isTextNote(annotation),
  );
  if (note === undefined) return undefined;
  const copyId = newId('note');
  return duplicated(
    copyId,
    new AddTextNoteCommand(levelId, {
      id: copyId,
      at: { x: note.at.x + deltaMm.x, y: note.at.y + deltaMm.y },
      text: note.text,
      ...(note.heightMm === undefined ? {} : { heightMm: note.heightMm }),
      ...(note.rotationDeg === undefined
        ? {}
        : { rotationDeg: note.rotationDeg }),
      ...(note.leaderTo === undefined
        ? {}
        : {
            leaderTo: {
              x: note.leaderTo.x + deltaMm.x,
              y: note.leaderTo.y + deltaMm.y,
            },
          }),
    }),
  );
};

export const slabDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const slab = levelOf(project, levelId)?.slabs.find(
    ({ id }) => id === objectId,
  );
  if (slab === undefined) return undefined;
  const copyId = newId('slab');
  return duplicated(
    copyId,
    new AddSlabCommand(levelId, {
      id: copyId,
      polygon: translatedPolygon(slab.polygon, deltaMm),
      assemblyId: slab.assemblyId,
      role: slab.role,
      elevationOffsetMm: slab.elevationOffsetMm,
    }),
  );
};

export const roofDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const roof = levelOf(project, levelId)?.roofs.find(
    ({ id }) => id === objectId,
  );
  if (roof === undefined) return undefined;
  const copyId = newId('roof');
  return duplicated(
    copyId,
    new AddRoofCommand(levelId, {
      id: copyId,
      footprint: translatedPolygon(roof.footprint, deltaMm),
      assemblyId: roof.assemblyId,
      slopeDeg: roof.slopeDeg,
      azimuthDeg: roof.azimuthDeg,
      baseElevationMm: roof.baseElevationMm,
    }),
  );
};

export const roofStructureDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const roof = (levelOf(project, levelId)?.roofStructures ?? []).find(
    ({ id }) => id === objectId,
  );
  if (roof === undefined) return undefined;
  const copyId = newId('roof');
  return duplicated(
    copyId,
    new AddRoofStructureCommand(levelId, {
      id: copyId,
      footprint: translatedPolygon(roof.footprint, deltaMm),
      edges: roof.edges,
      assemblyId: roof.assemblyId,
      baseElevationMm: roof.baseElevationMm,
    }),
  );
};

export const stairDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const stair = levelOf(project, levelId)?.stairs.find(
    ({ id }) => id === objectId,
  );
  if (stair === undefined) return undefined;
  const copyId = newId('stair');
  return duplicated(
    copyId,
    new AddStairCommand(levelId, {
      id: copyId,
      topLevelId: stair.topLevelId,
      stairType: stair.stairType,
      widthMm: stair.widthMm,
      riserCount: stair.riserCount,
      treadDepthMm: stair.treadDepthMm,
      path: stair.path.points.map(({ x, y }) => ({
        x: x + deltaMm.x,
        y: y + deltaMm.y,
      })),
      ...(stair.landings === undefined ? {} : { landings: stair.landings }),
    }),
  );
};

export const structureDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  const member = (levelOf(project, levelId)?.structure ?? []).find(
    ({ id }) => id === objectId,
  );
  if (member === undefined) return undefined;
  const copyId = newId('member');
  return duplicated(
    copyId,
    new AddStructuralMemberCommand(levelId, {
      id: copyId,
      kind: member.kind,
      path: member.path.map(({ x, y }) => ({
        x: x + deltaMm.x,
        y: y + deltaMm.y,
      })),
      widthMm: member.widthMm,
      depthMm: member.depthMm,
      ...(member.elevationMm === undefined
        ? {}
        : { elevationMm: member.elevationMm }),
      ...(member.heightMm === undefined ? {} : { heightMm: member.heightMm }),
      ...(member.materialId === undefined
        ? {}
        : { materialId: member.materialId }),
    }),
  );
};

/**
 * A placed thing, copied onto the copy of what it hangs on when there is one.
 *
 * A radiator duplicated with its wall belongs to the new wall; duplicated
 * alone it keeps the wall it was fixed to, which is what the user sees on the
 * plan and can change afterwards.
 */
export const componentDuplicate: DuplicateProvider = (
  project,
  levelId,
  objectId,
  deltaMm,
  { newId, copies },
) => {
  const component = (levelOf(project, levelId)?.components ?? []).find(
    ({ id }) => id === objectId,
  );
  if (component === undefined) return undefined;
  const copyId = newId('component');
  const at = {
    x: component.position.x + deltaMm.x,
    y: component.position.y + deltaMm.y,
  };
  /*
   * Le support de la copie : celui de l'original s'il en a un, sinon celui
   * qu'on trouve là où la copie se pose.
   *
   * Un original qui nomme son support garde le sien — et sa copie suit la
   * copie de ce support, quand les deux voyagent ensemble : recopier un mur
   * et sa prise doit donner la prise sur le nouveau mur, pas sur l'ancien.
   *
   * Reste le cas de l'original qui n'en nomme aucun, qui est celui de la
   * maison de référence : ses vingt-trois appareils sont posés sans support,
   * et la fiche d'un plafonnier exige un mur ou une dalle. La copie était
   * donc refusée — « Ce modèle se fixe à : Mur, Dalle » — alors que
   * l'original, lui, est là. On ne pouvait dupliquer aucun équipement de
   * cette maison, et personne ne s'en était aperçu parce que le refus est
   * exact : c'est bien la copie qui manque de support, pas la duplication qui
   * a tort.
   *
   * La copie demande donc son support à la règle qui répond déjà pour une
   * pose — la même, dans le même fichier, avec l'aperçu qui la montre — au
   * point où elle arrive. Un plafonnier recopié tombe sur la dalle qu'il
   * survole ; une prise recopiée le long d'un mur reste sur ce mur.
   */
  const carried =
    component.hostObjectId === undefined
      ? undefined
      : (copies.get(component.hostObjectId) ?? component.hostObjectId);
  const level = levelOf(project, levelId);
  const host =
    carried ??
    (level === undefined
      ? undefined
      : chooseHost(
          level,
          at,
          undefined,
          (project.equipment ?? []).find(
            ({ id }) => id === component.definitionId,
          )?.allowedHosts,
        ).hostObjectId);
  return duplicated(
    copyId,
    new AddComponentCommand(levelId, {
      id: copyId,
      category: component.category,
      position: at,
      rotationDeg: component.rotationDeg,
      elevationMm: component.elevationMm,
      ...(component.name === undefined ? {} : { name: component.name }),
      ...(component.definitionId === undefined
        ? {}
        : { definitionId: component.definitionId }),
      ...(component.spaceId === undefined
        ? {}
        : { spaceId: component.spaceId }),
      ...(host === undefined ? {} : { hostObjectId: host }),
    }),
  );
};

export const siteDuplicate: DuplicateProvider = (
  project,
  _levelId,
  objectId,
  deltaMm,
  { newId },
) => {
  if (objectId === 'site:parcel')
    return project.site.parcelBoundary === undefined
      ? undefined
      : {
          status: 'REFUSED',
          message: 'Un terrain n’a qu’une parcelle.',
        };
  const obstacle = (project.site.obstacles ?? []).find(
    ({ id }) => id === objectId,
  );
  if (obstacle === undefined) return undefined;
  const copyId = newId('obstacle');
  return duplicated(
    copyId,
    new AddSiteObstacleCommand({
      id: copyId,
      outline: translatedPolygon(obstacle.boundary, deltaMm).outer,
      kind: obstacle.kind ?? 'BUILDING',
      ...(obstacle.heightMm === undefined
        ? {}
        : { heightMm: obstacle.heightMm }),
      ...(obstacle.name === undefined ? {} : { name: obstacle.name }),
    }),
  );
};

/**
 * A network object copied alone would be connected to nothing.
 *
 * A node exists to be reached by segments and a segment exists to join two
 * nodes; either on its own is a fragment. Copying a whole run is a feature the
 * networks workspace owes, not something the plan should improvise.
 */
export const networkDuplicate: DuplicateProvider = (
  project,
  _levelId,
  objectId,
) => {
  for (const network of project.systems ?? [])
    if (
      network.nodes.some(({ id }) => id === objectId) ||
      network.edges.some(({ id }) => id === objectId)
    )
      return {
        status: 'REFUSED',
        message:
          'Un objet de réseau se duplique avec le réseau qui le relie : passez par l’espace Réseaux.',
      };
  return undefined;
};
