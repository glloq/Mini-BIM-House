export interface AnalysisScale {
  readonly kind: 'CONTINUOUS';
  readonly minimum: number;
  readonly maximum: number;
  readonly clamp: boolean;
}

/** Semantic calculation output. Renderers resolve values to visual tokens. */
export interface AnalysisOverlay {
  readonly id: string;
  readonly metric: string;
  readonly unit: string;
  readonly values: Readonly<Record<string, number | string | null>>;
  readonly scale?: AnalysisScale;
  readonly states?: Readonly<Record<string, AnalysisObjectState>>;
}

export type AnalysisObjectState = 'NORMAL' | 'WARNING' | 'ERROR' | 'UNKNOWN';

export interface NetworkAnalysisDatum {
  readonly objectId: string;
  readonly value?: number;
  readonly state: AnalysisObjectState;
}

export function createNetworkAnalysisOverlay(
  id: string,
  metric: string,
  unit: string,
  data: readonly NetworkAnalysisDatum[],
): AnalysisOverlay {
  if (id.trim() === '' || metric.trim() === '' || unit.trim() === '')
    throw new TypeError(
      'Analysis overlay ID, metric, and unit must not be empty',
    );
  const seen = new Set<string>();
  const ordered = [...data].sort((first, second) =>
    first.objectId.localeCompare(second.objectId),
  );
  for (const datum of ordered) {
    if (datum.objectId.trim() === '')
      throw new TypeError('Analysis object ID must not be empty');
    if (seen.has(datum.objectId))
      throw new RangeError(`Duplicate analysis object ${datum.objectId}`);
    seen.add(datum.objectId);
    if (datum.value !== undefined && !Number.isFinite(datum.value))
      throw new RangeError(
        `Analysis value for ${datum.objectId} must be finite`,
      );
  }
  const values = Object.fromEntries(
    ordered.map(({ objectId, value }) => [objectId, value ?? null]),
  );
  const states = Object.fromEntries(
    ordered.map(({ objectId, state }) => [objectId, state]),
  );
  const scale = continuousScale(
    ordered.flatMap(({ value }) => (value === undefined ? [] : [value])),
  );
  return {
    id,
    metric,
    unit,
    values,
    states,
    ...(scale === undefined ? {} : { scale }),
  };
}

export function continuousScale(
  values: readonly number[],
): AnalysisScale | undefined {
  if (values.length === 0) return undefined;
  if (values.some((value) => !Number.isFinite(value)))
    throw new RangeError('Analysis scale values must be finite');
  return {
    kind: 'CONTINUOUS',
    minimum: values.reduce((minimum, value) => Math.min(minimum, value)),
    maximum: values.reduce((maximum, value) => Math.max(maximum, value)),
    clamp: true,
  };
}
