/** Coordinates are expressed in millimetres in every geometry API. */
export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Point3D extends Point2D {
  readonly z: number;
}

export interface Vector2D {
  readonly x: number;
  readonly y: number;
}

export interface Segment2D {
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface Polyline2D {
  readonly points: readonly Point2D[];
  readonly closed: boolean;
}

export interface Polygon2D {
  readonly outer: readonly Point2D[];
  readonly holes?: readonly (readonly Point2D[])[];
}

export interface BoundingBox2D {
  readonly min: Point2D;
  readonly max: Point2D;
}

export interface BoundingBox3D {
  readonly min: Point3D;
  readonly max: Point3D;
}

export interface GeometryTolerance {
  readonly pointMergeMm: number;
  readonly collinearMm: number;
  readonly angularRad: number;
  readonly areaMm2: number;
}

export type GeometryIssueCode =
  | 'NON_FINITE_COORDINATE'
  | 'INSUFFICIENT_POINTS'
  | 'DEGENERATE_SEGMENT'
  | 'DEGENERATE_POLYGON'
  | 'SELF_INTERSECTION';

export interface GeometryIssue {
  readonly code: GeometryIssueCode;
  readonly message: string;
}

export type SegmentIntersection =
  | { readonly kind: 'NONE' }
  | {
      readonly kind: 'POINT';
      readonly point: Point2D;
      readonly firstParameter: number;
      readonly secondParameter: number;
    }
  | { readonly kind: 'OVERLAP'; readonly segment: Segment2D }
  | {
      readonly kind: 'DEGENERATE';
      readonly segment: 'FIRST' | 'SECOND' | 'BOTH';
    };

export type OffsetResult =
  | { readonly kind: 'OK'; readonly polyline: Polyline2D }
  | { readonly kind: 'DEGENERATE'; readonly message: string };
