import { describe, expect, it } from 'vitest';
import type { Project } from '@house-technical-designer/core-domain';
import { scenarioOverride, scenarioTargets } from './scenario-changes.js';

function project(): Project {
  return {
    id: 'project' as Project['id'],
    metadata: {
      name: 'Cibles',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      projectRevision: '1',
    },
    site: { northAngleDeg: 0 },
    building: {
      levels: [
        {
          id: 'ground' as Project['building']['levels'][number]['id'],
          name: 'Rez-de-chaussée',
          elevationMm: 0,
          defaultStoreyHeightMm: 2500,
          walls: [
            {
              id: 'wall-north' as Project['building']['levels'][number]['walls'][number]['id'],
              type: 'WALL',
              levelId: 'ground' as Project['building']['levels'][number]['id'],
              assemblyId:
                'assembly-brick' as Project['building']['levels'][number]['walls'][number]['assemblyId'],
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 5000, y: 0 },
                ],
              },
              referenceSide: 'CENTER',
              baseOffsetMm: 0,
              heightMode: 'EXPLICIT',
              heightMm: 2500,
              role: 'EXTERIOR',
            },
          ],
          openings: [],
          slabs: [],
          roofs: [],
          spaces: [],
          stairs: [],
          annotations: [],
        },
      ],
      zones: [],
    },
    assemblies: [
      {
        id: 'assembly-brick' as NonNullable<
          Project['assemblies']
        >[number]['id'],
        name: 'Mur brique',
        category: 'WALL',
        layers: [
          {
            id: 'brick' as NonNullable<
              Project['assemblies']
            >[number]['layers'][number]['id'],
            materialId: 'material-brick' as NonNullable<
              Project['assemblies']
            >[number]['layers'][number]['materialId'],
            thicknessM: 0.2,
          },
        ],
      },
    ],
    equipment: [
      {
        id: 'pv',
        kind: 'PHOTOVOLTAIC',
        catalogKind: 'GENERIC',
        properties: { installedPowerWp: 4000 },
      },
    ],
  };
}

const targetAt = (path: string) =>
  scenarioTargets(project()).find((target) => target.path === path);

describe('what a scenario can vary', () => {
  it('addresses objects by identity, never by position', () => {
    const paths = scenarioTargets(project()).map(({ path }) => path);
    expect(paths).toContain(
      'building/levels/ground/walls/wall-north/assemblyId',
    );
    expect(paths).toContain(
      'assemblies/assembly-brick/layers/brick/thicknessM',
    );
    expect(paths).toContain('equipment/pv/properties/installedPowerWp');
    // Nothing addresses an array position, which another object could take.
    expect(paths.some((path) => /\/\d+\//u.test(path))).toBe(false);
  });

  it('offers the assemblies the project holds for a wall reference', () => {
    const target = targetAt(
      'building/levels/ground/walls/wall-north/assemblyId',
    );
    expect(target?.options).toEqual([
      { value: 'assembly-brick', label: 'Mur brique (assembly-brick)' },
    ]);
  });

  it('refuses a reference the project does not declare', () => {
    const target = targetAt(
      'building/levels/ground/walls/wall-north/assemblyId',
    )!;
    expect(scenarioOverride(target, 'assembly-brick')).toEqual({
      path: target.path,
      operation: 'SET',
      value: 'assembly-brick',
    });
    expect(scenarioOverride(target, 'assemblage-inventé')).toBeUndefined();
  });

  it('reads a number the way the field was typed', () => {
    const target = targetAt(
      'assemblies/assembly-brick/layers/brick/thicknessM',
    )!;
    expect(scenarioOverride(target, '0,3')).toMatchObject({ value: 0.3 });
    expect(scenarioOverride(target, 'épais')).toBeUndefined();
  });
});
