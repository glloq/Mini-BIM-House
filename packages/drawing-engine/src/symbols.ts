import type {
  BoundingBox2D,
  Point2D,
} from '@house-technical-designer/geometry';

import type {
  Discipline,
  GraphicProfile,
  ScenePrimitive,
  SemanticRole,
} from './scene.js';

export type SymbolSpace = 'MODEL_SPACE' | 'PAPER_SPACE';
export type SymbolPrimitive =
  | {
      readonly kind: 'LINE';
      readonly start: Point2D;
      readonly end: Point2D;
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'POLYLINE';
      readonly points: readonly Point2D[];
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'POLYGON';
      readonly points: readonly Point2D[];
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'CIRCLE';
      readonly center: Point2D;
      readonly radius: number;
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'ARC';
      readonly center: Point2D;
      readonly radius: number;
      readonly startAngleDeg: number;
      readonly endAngleDeg: number;
      readonly role: SemanticRole;
    }
  | {
      readonly kind: 'TEXT';
      readonly anchor: Point2D;
      readonly text: string;
      readonly role: SemanticRole;
    };

export interface SymbolAnchor {
  readonly id: string;
  readonly point: Point2D;
  readonly kind: 'INSERTION' | 'CONNECTION' | 'LABEL';
}

export interface SymbolDefinition {
  readonly id: string;
  readonly name: string;
  readonly semanticType: string;
  readonly discipline: Discipline;
  readonly viewBox: BoundingBox2D;
  readonly anchors: readonly SymbolAnchor[];
  readonly primitives: readonly SymbolPrimitive[];
  readonly scaleRules: {
    readonly space: SymbolSpace;
    readonly nominalSizeMm?: number;
  };
  readonly references?: readonly string[];
}

export interface SymbolLibrary {
  readonly id: string;
  readonly version: string;
  readonly definitions: Readonly<Record<string, SymbolDefinition>>;
}

export interface SymbolPlacement {
  readonly id: string;
  readonly symbolId: string;
  readonly position: Point2D;
  readonly drawingScale: number;
  readonly rotationDeg?: number;
  readonly modelScale?: number;
  readonly sourceObjectId?: string;
  readonly layer?: string;
  readonly zIndex?: number;
}

export function createSymbolLibrary(
  id: string,
  version: string,
  definitions: readonly SymbolDefinition[],
): SymbolLibrary {
  if (id.trim() === '' || version.trim() === '')
    throw new TypeError(
      'Symbol library identity and version must not be empty.',
    );
  const entries: Record<string, SymbolDefinition> = {};
  for (const definition of definitions) {
    validateSymbolDefinition(definition);
    if (entries[definition.id] !== undefined)
      throw new TypeError(`Duplicate symbol ID: ${definition.id}`);
    entries[definition.id] = definition;
  }
  return { id, version, definitions: entries };
}

export function resolveSymbol(
  library: SymbolLibrary,
  requestedId: string,
  profile: GraphicProfile,
): SymbolDefinition {
  const resolvedId = profile.symbolOverrides?.[requestedId] ?? requestedId;
  const definition = library.definitions[resolvedId];
  if (definition === undefined)
    throw new RangeError(`Unknown symbol: ${resolvedId}`);
  return definition;
}

/** Projects a safe symbol definition into the semantic scene; no arbitrary SVG is accepted. */
export function placeSymbol(
  definition: SymbolDefinition,
  placement: SymbolPlacement,
): readonly ScenePrimitive[] {
  validateSymbolDefinition(definition);
  if (placement.symbolId !== definition.id)
    throw new TypeError(
      'Symbol placement does not match the supplied definition.',
    );
  if (!Number.isFinite(placement.drawingScale) || placement.drawingScale <= 0)
    throw new RangeError('Drawing scale must be finite and positive.');
  const modelScale = placement.modelScale ?? 1;
  if (!Number.isFinite(modelScale) || modelScale <= 0)
    throw new RangeError('Symbol model scale must be finite and positive.');
  if (!finitePoint(placement.position))
    throw new RangeError('Symbol position must contain finite coordinates.');
  if (
    placement.rotationDeg !== undefined &&
    !Number.isFinite(placement.rotationDeg)
  )
    throw new RangeError('Symbol rotation must be finite.');
  const scale =
    (definition.scaleRules.space === 'PAPER_SPACE'
      ? placement.drawingScale
      : 1) * modelScale;
  const rotation = ((placement.rotationDeg ?? 0) * Math.PI) / 180;
  const transform = (point: Point2D): Point2D => ({
    x:
      placement.position.x +
      scale * (point.x * Math.cos(rotation) - point.y * Math.sin(rotation)),
    y:
      placement.position.y +
      scale * (point.x * Math.sin(rotation) + point.y * Math.cos(rotation)),
  });
  return definition.primitives.map((primitive, index): ScenePrimitive => ({
    id: `${placement.id}:${index}`,
    ...(placement.sourceObjectId === undefined
      ? {}
      : { sourceObjectId: placement.sourceObjectId }),
    semanticRole: primitive.role,
    geometry: primitiveGeometry(primitive, transform),
    layer: placement.layer ?? `SYMBOL_${definition.discipline}`,
    zIndex: placement.zIndex ?? 60,
    discipline: definition.discipline,
    metadata: {
      symbolId: definition.id,
      semanticType: definition.semanticType,
    },
  }));
}

function primitiveGeometry(
  primitive: SymbolPrimitive,
  transform: (point: Point2D) => Point2D,
): ScenePrimitive['geometry'] {
  if (primitive.kind === 'LINE')
    return {
      kind: 'POLYLINE',
      polyline: {
        points: [transform(primitive.start), transform(primitive.end)],
        closed: false,
      },
    };
  if (primitive.kind === 'POLYLINE')
    return {
      kind: 'POLYLINE',
      polyline: { points: primitive.points.map(transform), closed: false },
    };
  if (primitive.kind === 'POLYGON')
    return {
      kind: 'POLYGON',
      polygon: { outer: primitive.points.map(transform) },
    };
  if (primitive.kind === 'TEXT')
    return {
      kind: 'TEXT',
      anchor: transform(primitive.anchor),
      text: primitive.text,
    };
  const start = primitive.kind === 'CIRCLE' ? 0 : primitive.startAngleDeg;
  const end = primitive.kind === 'CIRCLE' ? 360 : primitive.endAngleDeg;
  const count = Math.max(8, Math.ceil(Math.abs(end - start) / 15));
  const points = Array.from({ length: count + 1 }, (_, index) => {
    const angle = ((start + ((end - start) * index) / count) * Math.PI) / 180;
    return transform({
      x: primitive.center.x + primitive.radius * Math.cos(angle),
      y: primitive.center.y + primitive.radius * Math.sin(angle),
    });
  });
  return { kind: 'POLYLINE', polyline: { points, closed: false } };
}

function validateSymbolDefinition(definition: SymbolDefinition): void {
  if (
    definition.id.trim() === '' ||
    definition.name.trim() === '' ||
    definition.semanticType.trim() === ''
  )
    throw new TypeError(
      'Symbol identity, name, and semantic type must not be empty.',
    );
  const values = [
    definition.viewBox.min.x,
    definition.viewBox.min.y,
    definition.viewBox.max.x,
    definition.viewBox.max.y,
  ];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    definition.viewBox.min.x >= definition.viewBox.max.x ||
    definition.viewBox.min.y >= definition.viewBox.max.y
  )
    throw new RangeError(`Symbol ${definition.id} has an invalid view box.`);
  if (definition.primitives.length === 0)
    throw new TypeError(`Symbol ${definition.id} must contain a primitive.`);
  if (
    definition.scaleRules.nominalSizeMm !== undefined &&
    (!Number.isFinite(definition.scaleRules.nominalSizeMm) ||
      definition.scaleRules.nominalSizeMm <= 0)
  )
    throw new RangeError(
      `Symbol ${definition.id} has an invalid nominal size.`,
    );
  const anchorIds = new Set<string>();
  for (const anchor of definition.anchors) {
    if (
      anchor.id.trim() === '' ||
      anchorIds.has(anchor.id) ||
      !finitePoint(anchor.point)
    )
      throw new TypeError(
        `Symbol ${definition.id} has an invalid or duplicate anchor.`,
      );
    anchorIds.add(anchor.id);
  }
  for (const primitive of definition.primitives)
    validatePrimitive(definition.id, primitive);
}

function validatePrimitive(symbolId: string, primitive: SymbolPrimitive): void {
  const points =
    primitive.kind === 'LINE'
      ? [primitive.start, primitive.end]
      : primitive.kind === 'POLYLINE' || primitive.kind === 'POLYGON'
        ? primitive.points
        : primitive.kind === 'TEXT'
          ? [primitive.anchor]
          : [primitive.center];
  if (points.some((point) => !finitePoint(point)))
    throw new RangeError(`Symbol ${symbolId} contains non-finite coordinates.`);
  if (
    (primitive.kind === 'POLYLINE' && points.length < 2) ||
    (primitive.kind === 'POLYGON' && points.length < 3)
  )
    throw new RangeError(
      `Symbol ${symbolId} contains an incomplete ${primitive.kind.toLowerCase()}.`,
    );
  if (
    (primitive.kind === 'CIRCLE' || primitive.kind === 'ARC') &&
    (!Number.isFinite(primitive.radius) || primitive.radius <= 0)
  )
    throw new RangeError(`Symbol ${symbolId} contains an invalid radius.`);
  if (
    primitive.kind === 'ARC' &&
    (![primitive.startAngleDeg, primitive.endAngleDeg].every(Number.isFinite) ||
      primitive.startAngleDeg === primitive.endAngleDeg)
  )
    throw new RangeError(`Symbol ${symbolId} contains an invalid arc.`);
}

function finitePoint(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

const anchor: readonly SymbolAnchor[] = [
  { id: 'origin', point: { x: 0, y: 0 }, kind: 'INSERTION' },
];
const circle = (role: SemanticRole = 'SYMBOL'): readonly SymbolPrimitive[] => [
  { kind: 'CIRCLE', center: { x: 0, y: 0 }, radius: 2, role },
];
const crossedCircle = (
  role: SemanticRole = 'SYMBOL',
): readonly SymbolPrimitive[] => [
  ...circle(role),
  { kind: 'LINE', start: { x: -1.4, y: -1.4 }, end: { x: 1.4, y: 1.4 }, role },
  { kind: 'LINE', start: { x: -1.4, y: 1.4 }, end: { x: 1.4, y: -1.4 }, role },
];
const definition = (
  id: string,
  name: string,
  semanticType: string,
  discipline: Discipline,
  primitives: readonly SymbolPrimitive[],
): SymbolDefinition => ({
  id,
  name,
  semanticType,
  discipline,
  viewBox: { min: { x: -3, y: -3 }, max: { x: 3, y: 3 } },
  anchors: anchor,
  primitives,
  scaleRules: { space: 'PAPER_SPACE', nominalSizeMm: 6 },
});

export const SYMBOL_LIBRARY_V1 = createSymbolLibrary(
  'generic-technical-symbols',
  '1.0.0',
  [
    definition('architecture.north', 'Nord', 'NORTH_ARROW', 'ARCHITECTURE', [
      {
        kind: 'POLYGON',
        points: [
          { x: 0, y: -3 },
          { x: 1.5, y: 2 },
          { x: 0, y: 1 },
          { x: -1.5, y: 2 },
        ],
        role: 'SYMBOL',
      },
    ]),
    definition(
      'architecture.room-marker',
      'Repère de pièce',
      'ROOM_MARKER',
      'ARCHITECTURE',
      circle(),
    ),
    definition('water.valve', 'Vanne', 'VALVE', 'WATER', [
      {
        kind: 'POLYGON',
        points: [
          { x: -2, y: -1.5 },
          { x: 0, y: 0 },
          { x: -2, y: 1.5 },
        ],
        role: 'WATER_COLD',
      },
      {
        kind: 'POLYGON',
        points: [
          { x: 2, y: -1.5 },
          { x: 0, y: 0 },
          { x: 2, y: 1.5 },
        ],
        role: 'WATER_COLD',
      },
    ]),
    definition('water.flow', 'Sens de flux', 'FLOW_DIRECTION', 'WATER', [
      {
        kind: 'POLYLINE',
        points: [
          { x: -2.5, y: 0 },
          { x: 2.5, y: 0 },
          { x: 1, y: -1.2 },
          { x: 2.5, y: 0 },
          { x: 1, y: 1.2 },
        ],
        role: 'WATER_COLD',
      },
    ]),
    definition(
      'ventilation.supply',
      'Bouche de soufflage',
      'SUPPLY_TERMINAL',
      'VENTILATION',
      crossedCircle('VENT_SUPPLY'),
    ),
    definition(
      'ventilation.extract',
      "Bouche d'extraction",
      'EXTRACT_TERMINAL',
      'VENTILATION',
      circle('VENT_EXHAUST'),
    ),
    definition('electrical.socket', 'Prise', 'SOCKET_OUTLET', 'ELECTRICAL', [
      ...circle('ELECTRICAL_POWER'),
      {
        kind: 'LINE',
        start: { x: -1.4, y: 0 },
        end: { x: 1.4, y: 0 },
        role: 'ELECTRICAL_POWER',
      },
    ]),
    definition(
      'electrical.light-point',
      'Point lumineux',
      'LIGHT_POINT',
      'ELECTRICAL',
      crossedCircle('ELECTRICAL_LIGHTING'),
    ),
    definition('electrical.switch', 'Interrupteur', 'SWITCH', 'ELECTRICAL', [
      {
        kind: 'CIRCLE',
        center: { x: -1.5, y: 0 },
        radius: 0.4,
        role: 'ELECTRICAL_CONTROL',
      },
      {
        kind: 'LINE',
        start: { x: -1.1, y: -0.2 },
        end: { x: 1.8, y: -1.8 },
        role: 'ELECTRICAL_CONTROL',
      },
    ]),
  ],
);
