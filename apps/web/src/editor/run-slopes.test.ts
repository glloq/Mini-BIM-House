import { describe, expect, it } from 'vitest';

import { loadDemoProject } from '../demo-project.js';
import { MINIMUM_FALL_PERCENT, runSlopes, slopeLabel } from './run-slopes.js';

function house() {
  const loaded = loadDemoProject();
  if (loaded.status !== 'OK') throw new Error(loaded.message);
  return loaded.file.project;
}

/** Un projet à un seul réseau, dont on décide la pente. */
function withFall(discipline: string, fallMm: number) {
  const project = house();
  return {
    ...project,
    systems: [
      {
        id: 'run',
        discipline: discipline as 'WASTEWATER',
        systemType: 'TEST',
        nodes: [],
        ports: [],
        edges: [
          {
            id: 'edge-1',
            fromPortId: 'a',
            toPortId: 'b',
            kind: 'GRAVITY_PIPE',
            path: [
              { x: 0, y: 0, z: 0 },
              { x: 10_000, y: 0, z: -fallMm },
            ],
          },
        ],
      },
    ],
  };
}

describe('what a run of pipe says about its own fall', () => {
  it('writes a slope the way a plumber says it', () => {
    expect(slopeLabel(2)).toBe('2,0 %');
    expect(slopeLabel(0.5)).toBe('0,5 %');
  });

  it('marks a run that will not flow', () => {
    /*
     * Une évacuation horizontale est une évacuation qui ne s'écoule pas, et
     * c'est la seule chose qu'un plan doit crier. En dessous d'un pour cent,
     * la marque ; au-dessus, un nombre discret.
     */
    const flat = runSlopes(withFall('WASTEWATER', 0))[0]!;
    expect(flat.tooFlat).toBe(true);
    const sloped = runSlopes(withFall('WASTEWATER', 200))[0]!;
    expect(sloped.slopePercent).toBeCloseTo(2, 6);
    expect(sloped.tooFlat).toBe(false);
    expect(MINIMUM_FALL_PERCENT).toBe(1);
  });

  it('says nothing about what does not flow by gravity', () => {
    // Un câble n'a pas de pente, une gaine non plus, et leur en écrire une
    // serait inventer une exigence que personne n'a.
    expect(runSlopes(withFall('ELECTRICAL', 0))).toEqual([]);
    expect(runSlopes(withFall('VENTILATION', 0))).toEqual([]);
    expect(runSlopes(withFall('RAINWATER', 0))).toHaveLength(1);
  });

  it('reads only what is selected when asked to', () => {
    expect(
      runSlopes(withFall('WASTEWATER', 200), { selection: ['edge-1'] }),
    ).toHaveLength(1);
    expect(
      runSlopes(withFall('WASTEWATER', 200), { selection: ['autre'] }),
    ).toEqual([]);
  });
});
