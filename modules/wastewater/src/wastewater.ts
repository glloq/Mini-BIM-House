import type {
  JsonValue,
  NetworkEdge,
  NetworkNode,
  TechnicalNetwork,
} from '@house-technical-designer/core-domain';
import {
  millimetres,
  millimetresToMetres,
  numericValue,
} from '@house-technical-designer/units';

export type WastewaterSystemType =
  | 'GREYWATER'
  | 'BLACKWATER'
  | 'COMBINED_WASTEWATER'
  | 'CONDENSATE'
  | 'VENT'
  | 'OTHER';

export type WastewaterNodeKind =
  | 'FIXTURE'
  | 'JUNCTION'
  | 'STACK'
  | 'VENT'
  | 'CLEANOUT'
  | 'INSPECTION_CHAMBER'
  | 'MANHOLE'
  | 'ACCESS_POINT'
  | 'OUTLET';

export interface WastewaterNode extends NetworkNode {
  readonly kind: WastewaterNodeKind;
  /** Method input only. Its meaning is defined by the selected method. */
  readonly dischargeUnits?: number;
}

export interface GravityPipeProperties extends Readonly<
  Record<string, JsonValue>
> {
  readonly internalDiameterM?: number;
  readonly materialId?: string;
}

export interface WastewaterSegment extends NetworkEdge {
  readonly kind: 'GRAVITY_PIPE';
  readonly properties: GravityPipeProperties;
}

export interface WastewaterNetwork extends Omit<
  TechnicalNetwork,
  'discipline' | 'systemType' | 'nodes' | 'edges'
> {
  readonly discipline: 'WASTEWATER';
  readonly systemType: WastewaterSystemType;
  readonly nodes: readonly WastewaterNode[];
  readonly edges: readonly WastewaterSegment[];
}

export interface WastewaterFlowMethod {
  readonly id: string;
  readonly version: string;
  /** Externally registered implementation; normative tables do not live here. */
  readonly designFlowM3s: (totalDischargeUnits: number) => number;
}

export type WastewaterDiagnosticCode =
  | 'WASTEWATER_DISCONNECTED'
  | 'WASTEWATER_REVERSE_SLOPE'
  | 'WASTEWATER_ZERO_SLOPE'
  | 'WASTEWATER_INVALID_DIAMETER'
  | 'WASTEWATER_LEVEL_CONFLICT'
  | 'WASTEWATER_METHOD_MISSING';

export interface WastewaterDiagnostic {
  readonly code: WastewaterDiagnosticCode;
  readonly entityId: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}

export interface WastewaterSegmentResult {
  readonly segmentId: string;
  readonly lengthM?: number;
  readonly elevationDropM?: number;
  readonly slope?: number;
  readonly totalDischargeUnits?: number;
  readonly designFlowM3s?: number;
}

export interface WastewaterAnalysis {
  readonly status: 'OK' | 'PARTIAL' | 'FAILED';
  readonly methodId?: string;
  readonly methodVersion?: string;
  readonly segments: readonly WastewaterSegmentResult[];
  readonly diagnostics: readonly WastewaterDiagnostic[];
}

/** Derives levels and lengths from millimetre editor paths; no derived slope is persisted. */
export function analyzeWastewaterNetwork(
  network: WastewaterNetwork,
  method?: WastewaterFlowMethod,
): WastewaterAnalysis {
  const diagnostics: WastewaterDiagnostic[] = [];
  const nodes = new Map(network.nodes.map((node) => [node.id, node]));
  const ports = new Map(network.ports.map((port) => [port.id, port]));
  const outgoing = new Map<string, string[]>();
  const edgeNodes = new Map<string, { from: string; to: string }>();
  for (const edge of network.edges) {
    const from = ports.get(edge.fromPortId)?.nodeId;
    const to = ports.get(edge.toPortId)?.nodeId;
    if (
      from === undefined ||
      to === undefined ||
      !nodes.has(from) ||
      !nodes.has(to)
    ) {
      diagnostics.push(
        issue(
          'WASTEWATER_DISCONNECTED',
          edge.id,
          'ERROR',
          'Segment ports must reference network nodes.',
        ),
      );
      continue;
    }
    edgeNodes.set(edge.id, { from, to });
    outgoing.set(from, [...(outgoing.get(from) ?? []), to]);
    const start = edge.path[0];
    const end = edge.path.at(-1);
    if (
      start !== undefined &&
      end !== undefined &&
      (!samePoint(start, nodes.get(from)!.position) ||
        !samePoint(end, nodes.get(to)!.position))
    )
      diagnostics.push(
        issue(
          'WASTEWATER_LEVEL_CONFLICT',
          edge.id,
          'ERROR',
          `Segment ${edge.id} path endpoints do not match its connected node positions.`,
        ),
      );
  }
  const outlets = network.nodes
    .filter(({ kind }) => kind === 'OUTLET')
    .map(({ id }) => id);
  for (const node of network.nodes) {
    if (node.kind === 'OUTLET') continue;
    if (!outlets.some((outlet) => hasDirectedPath(node.id, outlet, outgoing)))
      diagnostics.push(
        issue(
          'WASTEWATER_DISCONNECTED',
          node.id,
          'ERROR',
          `Node ${node.id} has no directed path to an outlet.`,
        ),
      );
  }
  if (method === undefined)
    diagnostics.push(
      issue(
        'WASTEWATER_METHOD_MISSING',
        network.id,
        'WARNING',
        'Design flows are unknown because no wastewater method is active.',
      ),
    );
  else validateMethod(method);

  const segments = [...network.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge): WastewaterSegmentResult => {
      const geometry = segmentGeometry(edge, diagnostics);
      const diameter = edge.properties.internalDiameterM;
      if (diameter === undefined || !Number.isFinite(diameter) || diameter <= 0)
        diagnostics.push(
          issue(
            'WASTEWATER_INVALID_DIAMETER',
            edge.id,
            diameter === undefined ? 'WARNING' : 'ERROR',
            `Segment ${edge.id} requires a positive finite internal diameter.`,
          ),
        );
      const endpoints = edgeNodes.get(edge.id);
      const totalDischargeUnits =
        endpoints === undefined
          ? undefined
          : upstreamDischargeUnits(
              endpoints.from,
              network,
              edgeNodes,
              diagnostics,
            );
      const designFlowM3s =
        method === undefined || totalDischargeUnits === undefined
          ? undefined
          : method.designFlowM3s(totalDischargeUnits);
      if (
        designFlowM3s !== undefined &&
        (!Number.isFinite(designFlowM3s) || designFlowM3s < 0)
      )
        throw new RangeError(
          `Wastewater method ${method?.id ?? 'unknown'} returned an invalid design flow.`,
        );
      return {
        segmentId: edge.id,
        ...geometry,
        ...(totalDischargeUnits === undefined ? {} : { totalDischargeUnits }),
        ...(designFlowM3s === undefined ? {} : { designFlowM3s }),
      };
    });
  const hasError = diagnostics.some(({ severity }) => severity === 'ERROR');
  return {
    status: hasError ? 'FAILED' : diagnostics.length > 0 ? 'PARTIAL' : 'OK',
    ...(method === undefined
      ? {}
      : { methodId: method.id, methodVersion: method.version }),
    segments,
    diagnostics,
  };
}

function segmentGeometry(
  edge: WastewaterSegment,
  diagnostics: WastewaterDiagnostic[],
): Omit<WastewaterSegmentResult, 'segmentId'> {
  if (edge.path.length < 2) {
    diagnostics.push(
      issue(
        'WASTEWATER_LEVEL_CONFLICT',
        edge.id,
        'ERROR',
        'A gravity segment requires at least two path points.',
      ),
    );
    return {};
  }
  let horizontalLengthMm = 0;
  for (let index = 1; index < edge.path.length; index += 1) {
    const previous = edge.path[index - 1]!;
    const current = edge.path[index]!;
    if (
      ![
        previous.x,
        previous.y,
        previous.z,
        current.x,
        current.y,
        current.z,
      ].every(Number.isFinite)
    ) {
      diagnostics.push(
        issue(
          'WASTEWATER_LEVEL_CONFLICT',
          edge.id,
          'ERROR',
          'Segment path coordinates must be finite.',
        ),
      );
      return {};
    }
    horizontalLengthMm += Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
    );
  }
  if (horizontalLengthMm <= 0) {
    diagnostics.push(
      issue(
        'WASTEWATER_LEVEL_CONFLICT',
        edge.id,
        'ERROR',
        'Slope is undefined for a segment without horizontal length.',
      ),
    );
    return {};
  }
  const start = edge.path[0]!;
  const end = edge.path.at(-1)!;
  const lengthM = numericValue(
    millimetresToMetres(millimetres(horizontalLengthMm)),
  );
  const elevationDropM = numericValue(
    millimetresToMetres(millimetres(start.z - end.z)),
  );
  const slope = elevationDropM / lengthM;
  if (slope < 0)
    diagnostics.push(
      issue(
        'WASTEWATER_REVERSE_SLOPE',
        edge.id,
        'ERROR',
        `Segment ${edge.id} rises in its flow direction.`,
      ),
    );
  else if (slope === 0)
    diagnostics.push(
      issue(
        'WASTEWATER_ZERO_SLOPE',
        edge.id,
        'ERROR',
        `Segment ${edge.id} has zero slope.`,
      ),
    );
  return { lengthM, elevationDropM, slope };
}

function upstreamDischargeUnits(
  segmentFromNodeId: string,
  network: WastewaterNetwork,
  edges: ReadonlyMap<string, { from: string; to: string }>,
  diagnostics: WastewaterDiagnostic[],
): number | undefined {
  const upstream = new Set<string>();
  const visit = (nodeId: string, active: Set<string>): boolean => {
    if (active.has(nodeId)) return false;
    if (upstream.has(nodeId)) return true;
    const nextActive = new Set(active).add(nodeId);
    upstream.add(nodeId);
    return [...edges.values()]
      .filter(({ to }) => to === nodeId)
      .every(({ from }) => visit(from, nextActive));
  };
  if (!visit(segmentFromNodeId, new Set())) {
    diagnostics.push(
      issue(
        'WASTEWATER_LEVEL_CONFLICT',
        segmentFromNodeId,
        'ERROR',
        'Flow aggregation requires an acyclic directed network.',
      ),
    );
    return undefined;
  }
  let total = 0;
  for (const nodeId of upstream) {
    const node = network.nodes.find(({ id }) => id === nodeId)!;
    if (node.kind !== 'FIXTURE') continue;
    if (node.dischargeUnits === undefined) return undefined;
    if (!Number.isFinite(node.dischargeUnits) || node.dischargeUnits < 0)
      throw new RangeError(
        `Fixture ${node.id} discharge units must be finite and non-negative.`,
      );
    total += node.dischargeUnits;
  }
  return total;
}

function hasDirectedPath(
  start: string,
  target: string,
  outgoing: ReadonlyMap<string, readonly string[]>,
): boolean {
  const queue = [start];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...(outgoing.get(current) ?? []));
  }
  return false;
}
function samePoint(
  first: { readonly x: number; readonly y: number; readonly z: number },
  second: { readonly x: number; readonly y: number; readonly z: number },
): boolean {
  return first.x === second.x && first.y === second.y && first.z === second.z;
}
function validateMethod(method: WastewaterFlowMethod): void {
  if (method.id.trim() === '' || method.version.trim() === '')
    throw new TypeError('Wastewater method ID and version must not be empty.');
}
function issue(
  code: WastewaterDiagnosticCode,
  entityId: string,
  severity: 'ERROR' | 'WARNING',
  message: string,
): WastewaterDiagnostic {
  return { code, entityId, severity, message };
}
