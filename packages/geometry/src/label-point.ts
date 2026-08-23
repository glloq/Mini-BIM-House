import { polygonContains } from './operations.js';
import type { Point2D, Polygon2D } from './types.js';

/** A place to write in a shape, and how much room there is around it. */
export interface InteriorLabelPoint {
  readonly point: Point2D;
  /**
   * Distance from the point to the nearest edge, holes included.
   *
   * What a caller needs to decide whether the text it wants to write fits: a
   * room's bounding box says nothing useful about an L, and the label of an L
   * is exactly the one that ends up in the corridor.
   */
  readonly clearance: number;
  /**
   * The width of a text centred on this point that still stays inside.
   *
   * Clearance alone is the radius of a circle, and a room is not a circle: a
   * corridor four metres long and one wide holds its name comfortably and no
   * circle inside it says so.
   */
  readonly horizontalSpan: number;
}

interface Cell {
  readonly x: number;
  readonly y: number;
  /** Half the cell's side. */
  readonly half: number;
  readonly distance: number;
  /** The best distance any point of this cell could still have. */
  readonly potential: number;
}

/**
 * The point of a shape furthest from its edges — its « pole of inaccessibility ».
 *
 * A label was placed at the average of the outline's vertices, which is inside
 * a rectangle and outside an L: the room's name landed in the corridor next
 * door, and a name in the wrong room is worse than no name. This is the
 * classic grid-and-refine search (Mapbox's polylabel), written here in some
 * forty lines rather than taken as a dependency.
 */
export function interiorLabelPoint(
  polygon: Polygon2D,
  precision?: number,
): InteriorLabelPoint | undefined {
  const outer = polygon.outer;
  if (outer.length < 3) return undefined;
  const xs = outer.map(({ x }) => x);
  const ys = outer.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const size = Math.min(width, height);
  if (size <= 0) return undefined;
  const tolerance =
    precision !== undefined && precision > 0 ? precision : size / 100;

  const cellAt = (x: number, y: number, half: number): Cell => {
    const distance = signedDistance(polygon, { x, y });
    return {
      x,
      y,
      half,
      distance,
      potential: distance + half * Math.SQRT2,
    };
  };

  const queue = new MaxHeap();
  const step = size / 2;
  for (let x = minX; x < maxX; x += step)
    for (let y = minY; y < maxY; y += step)
      queue.push(
        cellAt(
          Math.min(x + step / 2, maxX),
          Math.min(y + step / 2, maxY),
          step / 2,
        ),
      );

  let best = cellAt((minX + maxX) / 2, (minY + maxY) / 2, 0);
  for (let cell = queue.pop(); cell !== undefined; cell = queue.pop()) {
    if (cell.distance > best.distance) best = cell;
    if (cell.potential - best.distance <= tolerance) continue;
    const half = cell.half / 2;
    queue.push(cellAt(cell.x - half, cell.y - half, half));
    queue.push(cellAt(cell.x + half, cell.y - half, half));
    queue.push(cellAt(cell.x - half, cell.y + half, half));
    queue.push(cellAt(cell.x + half, cell.y + half, half));
  }
  if (best.distance <= 0) return undefined;
  const point = { x: best.x, y: best.y };
  return {
    point,
    clearance: best.distance,
    horizontalSpan: horizontalSpan(polygon, point),
  };
}

/** How wide a text centred on a point may be before it leaves the shape. */
function horizontalSpan(polygon: Polygon2D, point: Point2D): number {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.POSITIVE_INFINITY;
  for (const ring of [polygon.outer, ...(polygon.holes ?? [])])
    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index]!;
      const to = ring[(index + 1) % ring.length]!;
      // The same half-open rule the containment test uses, so a vertex lying
      // on the line counts once rather than twice or not at all.
      if (from.y > point.y === to.y > point.y) continue;
      const crossing =
        from.x + ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y);
      if (crossing <= point.x) left = Math.min(left, point.x - crossing);
      else right = Math.min(right, crossing - point.x);
    }
  const half = Math.min(left, right);
  return Number.isFinite(half) ? half * 2 : 0;
}

/** Distance to the nearest edge, negative outside the shape. */
function signedDistance(polygon: Polygon2D, point: Point2D): number {
  const rings = [polygon.outer, ...(polygon.holes ?? [])];
  let nearest = Number.POSITIVE_INFINITY;
  for (const ring of rings)
    for (let index = 0; index < ring.length; index += 1) {
      const from = ring[index]!;
      const to = ring[(index + 1) % ring.length]!;
      nearest = Math.min(nearest, distanceToSegment(point, from, to));
    }
  return polygonContains(polygon, point) ? nearest : -nearest;
}

function distanceToSegment(point: Point2D, from: Point2D, to: Point2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared,
          ),
        );
  return Math.hypot(
    point.x - (from.x + ratio * dx),
    point.y - (from.y + ratio * dy),
  );
}

/** The cell with the most promise first; enough of a heap for one search. */
class MaxHeap {
  readonly #items: Cell[] = [];

  push(cell: Cell): void {
    this.#items.push(cell);
    let index = this.#items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#items[parent]!.potential >= this.#items[index]!.potential)
        break;
      this.#swap(parent, index);
      index = parent;
    }
  }

  pop(): Cell | undefined {
    const top = this.#items[0];
    if (top === undefined) return undefined;
    const last = this.#items.pop()!;
    if (this.#items.length === 0) return top;
    this.#items[0] = last;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;
      if (
        left < this.#items.length &&
        this.#items[left]!.potential > this.#items[largest]!.potential
      )
        largest = left;
      if (
        right < this.#items.length &&
        this.#items[right]!.potential > this.#items[largest]!.potential
      )
        largest = right;
      if (largest === index) break;
      this.#swap(index, largest);
      index = largest;
    }
    return top;
  }

  #swap(first: number, second: number): void {
    const held = this.#items[first]!;
    this.#items[first] = this.#items[second]!;
    this.#items[second] = held;
  }
}
