import { describe, expect, it } from 'vitest';
import {
  buildPlanView,
  defaultVisibility,
  overlayPrimitives,
} from '@house-technical-designer/view-query';
import { loadDemoProject, demoClimateDatasets } from '../demo-project.js';
import { runProjectCalculations } from './calculation-runner.js';
import {
  OVERLAY_OPTIONS,
  buildOverlay,
  designTemperatureDifferenceK,
  type OverlayId,
} from './overlay-source.js';

function project() {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

/**
 * Every analysis, run for real on the reference house.
 *
 * An overlay names objects by identifier and the plan names them by identifier,
 * and nothing forces the two to be the same string. When they are not, the
 * analysis runs, the legend appears, and not one line of the drawing changes
 * colour — which reads exactly like « nothing to report ». That is the failure
 * this suite exists to make impossible.
 */
const RUN = await runProjectCalculations(project(), demoClimateDatasets());

/** One analysis, built exactly as the application builds it. */
const overlayFor = (overlayId: OverlayId) =>
  buildOverlay(overlayId, RUN.runs, designTemperatureDifferenceK(RUN.runs));

/** Everything the plan draws, by the object each primitive stands for. */
function drawnObjectIds(): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const level of project().building.levels) {
    const view = buildPlanView(project(), {
      levelId: level.id,
      layers: Object.fromEntries(
        Object.keys(defaultVisibility()).map((id) => [id, true]),
      ),
    });
    for (const primitive of view.primitives)
      if (primitive.sourceObjectId !== undefined)
        ids.add(primitive.sourceObjectId);
  }
  return ids;
}

const ANALYSES = OVERLAY_OPTIONS.filter(({ id }) => id !== 'none').map(
  ({ id, label }) => [label, id] as const,
);

describe('the identifiers every analysis colours by', () => {
  it.each(ANALYSES)('%s names objects the plan draws', (_label, overlayId) => {
    const overlay = overlayFor(overlayId);
    if (overlay === undefined) {
      // A module the reference house cannot feed produces no analysis at all,
      // which is honest; what must never happen is an analysis whose names
      // match nothing.
      expect(
        RUN.runs.find(({ moduleId }) => moduleId !== undefined),
      ).toBeDefined();
      return;
    }
    const drawn = drawnObjectIds();
    const named = Object.keys(overlay.values);
    expect(named.length, `${overlayId} names nothing`).toBeGreaterThan(0);
    const matched = named.filter((objectId) => drawn.has(objectId));
    expect(
      matched.length,
      `${overlayId} names ${named.slice(0, 3).join(', ')}… and the plan draws none of them`,
    ).toBeGreaterThan(0);
  });

  it.each(ANALYSES)('%s actually colours something', (_label, overlayId) => {
    const overlay = overlayFor(overlayId);
    if (overlay === undefined) return;
    const ground = project().building.levels[0]!;
    const view = buildPlanView(project(), {
      levelId: ground.id,
      layers: Object.fromEntries(
        Object.keys(defaultVisibility()).map((id) => [id, true]),
      ),
    });
    expect(
      overlayPrimitives(view.primitives, overlay).length,
      overlayId,
    ).toBeGreaterThan(0);
  });

  it('says which analyses the reference house cannot produce', () => {
    // Not a failure: a house with no photovoltaics produces no photovoltaic
    // analysis. It is written down so that an analysis quietly disappearing
    // from this list is noticed.
    const silent = ANALYSES.filter(
      ([, overlayId]) => overlayFor(overlayId) === undefined,
    ).map(([, overlayId]) => overlayId);
    expect(silent).toEqual([]);
  });
});
