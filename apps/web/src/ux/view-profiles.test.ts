import { describe, expect, it } from 'vitest';

import { graphicProfileBundle } from '@house-technical-designer/drawing-engine';
import {
  PLAN_RENDERINGS,
  defaultPlanRendering,
  planRendering,
} from './view-profiles.js';

describe('the drawings the application offers', () => {
  it('names every one of them with a charter it ships', () => {
    for (const entry of PLAN_RENDERINGS)
      expect(graphicProfileBundle(entry.graphicProfileId)?.mode).toBe('SCREEN');
  });

  it('says nothing about what is displayed, only about how', () => {
    // A charter answers « how is it drawn », a layer preset « what is drawn ».
    // Mixing them would forbid an architectural plan of the pipework.
    for (const entry of PLAN_RENDERINGS)
      expect(Object.keys(entry)).not.toContain('layers');
  });

  it('draws a house as a house, and a network as a network', () => {
    expect(defaultPlanRendering('BUILDING').id).toBe('architectural');
    expect(defaultPlanRendering('CHECKS').id).toBe('architectural');
    expect(defaultPlanRendering('SYSTEMS').id).toBe('technical');
  });

  it('keeps a name the user could not have typed out of the list', () => {
    expect(planRendering('architectural')?.label).toBe('Plan architectural');
    expect(planRendering('charte-agence')).toBeUndefined();
    // The words « charte graphique » stay out of what the user reads.
    for (const entry of PLAN_RENDERINGS)
      expect(`${entry.label} ${entry.hint}`.toLowerCase()).not.toContain(
        'charte',
      );
  });
});
