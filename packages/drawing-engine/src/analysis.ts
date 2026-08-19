import type {
  AnalysisObjectState,
  AnalysisOverlay,
} from '@house-technical-designer/calculation-core';
import type { ObjectState, ScenePrimitive } from './scene.js';

/** Projects calculation output onto existing semantic geometry without copying it. */
export function applyAnalysisOverlay(
  primitives: readonly ScenePrimitive[],
  overlay: AnalysisOverlay,
): readonly ScenePrimitive[] {
  return primitives.map((primitive) => {
    if (primitive.sourceObjectId === undefined) return primitive;
    if (!Object.hasOwn(overlay.values, primitive.sourceObjectId))
      return primitive;
    const value = overlay.values[primitive.sourceObjectId] ?? null;
    const analysisState =
      overlay.states?.[primitive.sourceObjectId] ??
      (value === null ? 'UNKNOWN' : 'NORMAL');
    return {
      ...primitive,
      state: objectState(analysisState),
      metadata: {
        ...primitive.metadata,
        analysisOverlayId: overlay.id,
        analysisMetric: overlay.metric,
        analysisUnit: overlay.unit,
        analysisValue: value,
        analysisState,
      },
    };
  });
}

function objectState(state: AnalysisObjectState): ObjectState {
  if (state === 'ERROR') return 'ERROR';
  if (state === 'WARNING') return 'WARNING';
  if (state === 'UNKNOWN') return 'GHOST';
  return 'NORMAL';
}
