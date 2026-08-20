import { describe, expect, it } from 'vitest';
import { defaultVisibility } from '@house-technical-designer/view-query';
import { loadDemoProject } from './demo-project.js';
import { exportProjectPlan } from './project-workspace.js';

/**
 * The drawing of the reference house, kept under a baseline.
 *
 * The plan is produced from the model by pure code, so the same project always
 * yields the same file. Comparing it with a stored baseline catches a change no
 * assertion would think to look for — a layer that stopped being drawn, a
 * hatch that changed, a viewport that shifted — and the difference is readable
 * as a diff rather than as a pixel count.
 *
 * A pixel comparison across three rendering engines would answer a different
 * question, and answer it differently on every machine; this answers the one
 * the application is responsible for.
 */
describe('reference plan drawing', () => {
  it('matches the stored baseline', async () => {
    const demo = loadDemoProject();
    expect(demo.status).toBe('OK');
    if (demo.status !== 'OK') return;
    const artifact = exportProjectPlan(demo.file, {
      layers: defaultVisibility(),
    });
    await expect(artifact.content).toMatchFileSnapshot(
      './__snapshots__/reference-plan.svg',
    );
  });

  it('draws every architectural layer the reference house declares', () => {
    const demo = loadDemoProject();
    if (demo.status !== 'OK') return;
    const { content } = exportProjectPlan(demo.file, {
      layers: defaultVisibility(),
    });
    // Named here so that a baseline updated without a second thought still
    // fails when a layer has quietly stopped being drawn.
    for (const layer of [
      'architecture.walls',
      'architecture.openings',
      'architecture.spaces',
    ])
      expect(content).toContain(`data-layer="${layer}"`);
  });
});
