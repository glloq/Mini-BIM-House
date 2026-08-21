import type { Project } from '@house-technical-designer/core-domain';
import { edgeMidpoints } from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';

/**
 * A handle the user drags on the plan.
 *
 * Grips are derived from the selection, never stored: what the model holds is
 * the geometry, and the handles are one way of showing it. Each one says what
 * dragging it would change, so the canvas can stay ignorant of commands.
 */
export type Grip =
  | {
      readonly kind: 'WALL_POINT';
      readonly id: string;
      readonly at: Point2D;
      readonly wallId: string;
      readonly pointIndex: number;
    }
  | {
      readonly kind: 'WALL_BODY';
      readonly id: string;
      readonly at: Point2D;
      readonly wallId: string;
    }
  | {
      readonly kind: 'OPENING';
      readonly id: string;
      readonly at: Point2D;
      readonly openingId: string;
      readonly wallId: string;
    }
  | {
      readonly kind: 'POLYGON_VERTEX';
      readonly id: string;
      readonly at: Point2D;
      readonly objectId: string;
      readonly objectKind: 'SLAB' | 'ROOF';
      readonly vertexIndex: number;
    }
  | {
      readonly kind: 'POLYGON_EDGE';
      readonly id: string;
      readonly at: Point2D;
      readonly objectId: string;
      readonly objectKind: 'SLAB' | 'ROOF';
      readonly edgeIndex: number;
    }
  | {
      readonly kind: 'ROUTE_VERTEX';
      readonly id: string;
      readonly at: Point2D;
      readonly networkId: string;
      readonly edgeId: string;
      readonly vertexIndex: number;
    };

/** What dragging or clicking a grip asks the application to do. */
export type GeometryEdit =
  | {
      readonly kind: 'WALL_POINT';
      readonly wallId: string;
      readonly pointIndex: number;
      readonly to: Point2D;
    }
  | {
      readonly kind: 'WALL_MOVE';
      readonly wallId: string;
      readonly delta: Point2D;
    }
  | {
      readonly kind: 'WALL_SPLIT';
      readonly wallId: string;
      readonly at: Point2D;
    }
  | {
      readonly kind: 'OPENING_OFFSET';
      readonly openingId: string;
      readonly offsetMm: number;
    }
  | {
      readonly kind: 'POLYGON_VERTEX';
      readonly objectId: string;
      readonly objectKind: 'SLAB' | 'ROOF';
      readonly vertexIndex: number;
      readonly to: Point2D;
    }
  | {
      readonly kind: 'POLYGON_INSERT';
      readonly objectId: string;
      readonly objectKind: 'SLAB' | 'ROOF';
      readonly edgeIndex: number;
      readonly at: Point2D;
    }
  | {
      readonly kind: 'POLYGON_REMOVE';
      readonly objectId: string;
      readonly objectKind: 'SLAB' | 'ROOF';
      readonly vertexIndex: number;
    }
  | {
      readonly kind: 'ROUTE_VERTEX';
      readonly networkId: string;
      readonly edgeId: string;
      readonly vertexIndex: number;
      readonly to: Point2D;
    };

function levelOf(project: Project, levelId: string | undefined) {
  return levelId === undefined
    ? project.building.levels[0]
    : project.building.levels.find(({ id }) => id === levelId);
}

/** Where an opening sits along the axis of the wall that hosts it. */
export function openingAnchor(
  wallPoints: readonly Point2D[],
  offsetMm: number,
  widthMm: number,
): Point2D | undefined {
  const start = wallPoints[0];
  const end = wallPoints[wallPoints.length - 1];
  if (start === undefined || end === undefined) return undefined;
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length === 0) return undefined;
  const ratio = (offsetMm + widthMm / 2) / length;
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

/** How far along its wall a point falls, in millimetres from the start. */
export function offsetAlongWall(
  wallPoints: readonly Point2D[],
  point: Point2D,
): number | undefined {
  const start = wallPoints[0];
  const end = wallPoints[wallPoints.length - 1];
  if (start === undefined || end === undefined) return undefined;
  const axis = { x: end.x - start.x, y: end.y - start.y };
  const length = Math.hypot(axis.x, axis.y);
  if (length === 0) return undefined;
  return ((point.x - start.x) * axis.x + (point.y - start.y) * axis.y) / length;
}

/**
 * The handles for what is selected.
 *
 * Exactly one object at a time: dragging a corner of one wall while three
 * others are selected would be a gesture nobody asked for.
 */
/** Les poignées d’un mur : ses points et, s’il est droit, son corps. */
export function wallGrips(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): readonly Grip[] | undefined {
  const level = levelOf(project, levelId);
  if (level === undefined) return undefined;
  const wall = level.walls.find(({ id }) => id === objectId);
  if (wall !== undefined) {
    const points = wall.path.points;
    const middle = points[Math.floor(points.length / 2)];
    return [
      ...points.map((point, index): Grip => ({
        kind: 'WALL_POINT',
        id: `grip:wall-point:${wall.id}:${index}`,
        at: point,
        wallId: wall.id,
        pointIndex: index,
      })),
      ...(middle === undefined || points.length !== 2
        ? []
        : [
            {
              kind: 'WALL_BODY' as const,
              id: `grip:wall-body:${wall.id}`,
              at: {
                x: (points[0]!.x + points[1]!.x) / 2,
                y: (points[0]!.y + points[1]!.y) / 2,
              },
              wallId: wall.id,
            },
          ]),
    ];
  }
  return undefined;
}

/** La poignée qui fait glisser une ouverture le long de son mur. */
export function openingGrips(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): readonly Grip[] | undefined {
  const level = levelOf(project, levelId);
  if (level === undefined) return undefined;
  const opening = level.openings.find(({ id }) => id === objectId);
  if (opening !== undefined) {
    const host = level.walls.find(({ id }) => id === opening.hostElementId);
    const anchor =
      host === undefined
        ? undefined
        : openingAnchor(
            host.path.points,
            opening.offsetAlongHostMm,
            opening.widthMm,
          );
    return anchor === undefined || host === undefined
      ? undefined
      : [
          {
            kind: 'OPENING',
            id: `grip:opening:${opening.id}`,
            at: anchor,
            openingId: opening.id,
            wallId: host.id,
          },
        ];
  }
  return undefined;
}

/** Les poignées d’un contour : ses sommets et le milieu de ses côtés. */
export function polygonGrips(
  project: Project,
  levelId: string | undefined,
  objectId: string,
): readonly Grip[] | undefined {
  const level = levelOf(project, levelId);
  if (level === undefined) return undefined;
  const slab = level.slabs.find(({ id }) => id === objectId);
  const roof = level.roofs.find(({ id }) => id === objectId);
  const polygon = slab?.polygon ?? roof?.footprint;
  if (polygon === undefined) return undefined;
  const objectKind = slab === undefined ? 'ROOF' : 'SLAB';
  return [
    ...polygon.outer.map((point, index): Grip => ({
      kind: 'POLYGON_VERTEX',
      id: `grip:vertex:${objectId}:${index}`,
      at: point,
      objectId,
      objectKind,
      vertexIndex: index,
    })),
    ...edgeMidpoints(polygon).map(({ edgeIndex, point }): Grip => ({
      kind: 'POLYGON_EDGE',
      id: `grip:edge:${objectId}:${edgeIndex}`,
      at: point,
      objectId,
      objectKind,
      edgeIndex,
    })),
  ];
}

/**
 * The handles of a routed segment: one per corner it turns.
 *
 * The two ends are not among them. A segment starts and finishes at a port,
 * and dragging an end away from its port would draw a pipe that reaches
 * nothing — moving the appliance is what moves the end.
 */
export function routeGrips(
  project: Project,
  _levelId: string | undefined,
  objectId: string,
): readonly Grip[] | undefined {
  for (const network of project.systems ?? []) {
    const edge = network.edges.find(({ id }) => id === objectId);
    if (edge === undefined) continue;
    return edge.path.slice(1, -1).map((point, index) => ({
      kind: 'ROUTE_VERTEX' as const,
      id: `grip:route:${edge.id}:${index + 1}`,
      at: { x: point.x, y: point.y },
      networkId: network.id,
      edgeId: edge.id,
      vertexIndex: index + 1,
    }));
  }
  return undefined;
}
