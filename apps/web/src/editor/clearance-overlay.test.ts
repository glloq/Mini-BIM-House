import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { clearanceReport } from '@house-technical-designer/core-domain';
import { populatedProject } from '../test-support/populated-project.js';
import { clearancePrimitives } from './clearance-overlay.js';

/** The reference house with a heat pump that states the room it needs. */
function withHeatPump(): Project {
  const base = populatedProject();
  const ground = base.building.levels[0]!;
  return {
    ...base,
    equipment: [
      {
        id: 'heat-pump-model',
        familyId: 'HEAT_PUMP_AIR_WATER_MONOBLOC',
        kind: 'HEAT_PUMP',
        catalogKind: 'GENERIC',
        version: '1.0.0',
        dimensions: { widthMm: 1000, depthMm: 400, heightMm: 800 },
        requiredClearances: ['MAINTENANCE', 'AIR_INTAKE', 'AIR_EXHAUST'],
        clearances: [
          { zone: 'AIR_EXHAUST', frontMm: 2000, reason: 'Soufflage' },
          { zone: 'AIR_INTAKE', backMm: 300 },
        ],
        properties: {},
      },
    ],
    building: {
      ...base.building,
      levels: [
        {
          ...ground,
          components: [
            ...(ground.components ?? []),
            {
              ...ground.components![0]!,
              id: 'pump-1' as never,
              definitionId: 'heat-pump-model',
              definitionVersion: '1.0.0',
              position: { x: 0, y: 0 },
              rotationDeg: 0,
            },
          ],
        },
      ],
    },
  };
}

describe('the room the machines need, on the plan', () => {
  it('draws nothing until somebody asks for a kind of zone', () => {
    expect(clearancePrimitives(withHeatPump(), { groups: [] })).toEqual([]);
  });

  it('draws the volume the thing occupies without anybody declaring it', () => {
    const drawn = clearancePrimitives(withHeatPump(), {
      levelId: 'ground',
      groups: ['PHYSICAL'],
    });
    expect(drawn.map(({ id }) => id)).toEqual(['clearance:pump-1:PHYSICAL']);
  });

  it('draws the air of a machine when the air is asked for, and nothing else', () => {
    const drawn = clearancePrimitives(withHeatPump(), {
      levelId: 'ground',
      groups: ['AIR'],
    });
    expect(drawn.map(({ metadata }) => metadata?.clearanceZone).sort()).toEqual(
      ['AIR_EXHAUST', 'AIR_INTAKE'],
    );
    expect(
      drawn.find(({ metadata }) => metadata?.clearanceZone === 'AIR_EXHAUST')
        ?.metadata?.reason,
    ).toBe('Soufflage');
  });

  it('does not draw a zone the model requires and nobody has measured', () => {
    // An empty rectangle where a two-metre one belongs is worse than nothing.
    const drawn = clearancePrimitives(withHeatPump(), {
      levelId: 'ground',
      groups: ['ACCESS'],
    });
    expect(drawn).toEqual([]);
    expect(
      clearanceReport(withHeatPump()).unmeasured.map(({ zone }) => zone),
    ).toEqual(['MAINTENANCE']);
  });
});
