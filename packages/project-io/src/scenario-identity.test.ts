import { describe, expect, it } from 'vitest';
import type { Project, Scenario } from '@house-technical-designer/core-domain';
import { applyScenario } from './scenarios.js';

function project(): Project {
  return {
    id: 'project' as Project['id'],
    metadata: {
      name: 'Identités',
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
          walls: [],
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
      {
        id: 'assembly-timber' as NonNullable<
          Project['assemblies']
        >[number]['id'],
        name: 'Mur ossature bois',
        category: 'WALL',
        layers: [
          {
            id: 'insulation' as NonNullable<
              Project['assemblies']
            >[number]['layers'][number]['id'],
            materialId: 'material-wool' as NonNullable<
              Project['assemblies']
            >[number]['layers'][number]['materialId'],
            thicknessM: 0.14,
          },
        ],
      },
    ],
  };
}

const thicker = (path: string): Scenario => ({
  id: 'thicker',
  name: 'Isolation renforcée',
  baseProjectRevision: '1',
  overrides: [{ path, operation: 'SET', value: 0.3 }],
});

function thicknessOf(applied: Project, assemblyId: string): number | undefined {
  return applied.assemblies?.find(({ id }) => id === assemblyId)?.layers[0]
    ?.thicknessM;
}

describe('a scenario addressing objects by identity', () => {
  it('still names the same layer after another assembly is deleted', () => {
    const withIdentity = thicker(
      'assemblies/assembly-timber/layers/insulation/thicknessM',
    );
    const before = applyScenario(project(), withIdentity);
    expect(before.status).toBe('OK');
    if (before.status !== 'OK') return;
    expect(thicknessOf(before.project, 'assembly-timber')).toBe(0.3);

    const shortened: Project = {
      ...project(),
      assemblies: (project().assemblies ?? []).filter(
        ({ id }) => id !== 'assembly-brick',
      ),
    };
    const after = applyScenario(shortened, withIdentity);
    expect(after.status).toBe('OK');
    if (after.status !== 'OK') return;
    // The timber assembly moved from position 1 to position 0; the scenario
    // still changes the timber assembly.
    expect(thicknessOf(after.project, 'assembly-timber')).toBe(0.3);
  });

  it('shows what an index-based path would have done instead', () => {
    const byPosition = thicker('assemblies/1/layers/0/thicknessM');
    const shortened: Project = {
      ...project(),
      assemblies: (project().assemblies ?? []).filter(
        ({ id }) => id !== 'assembly-brick',
      ),
    };
    const after = applyScenario(shortened, byPosition);
    // Position 1 no longer exists, so the change lands nowhere and is reported
    // rather than silently applied to whatever took its place.
    expect(after.status).toBe('INVALID');
    if (after.status !== 'INVALID') return;
    expect(after.issues[0]?.code).toBe('SCENARIO_PATH_NOT_FOUND');
  });

  it('keeps reading a path written before identities were used', () => {
    const byPosition = thicker('assemblies/1/layers/0/thicknessM');
    const result = applyScenario(project(), byPosition);
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(thicknessOf(result.project, 'assembly-timber')).toBe(0.3);
  });
});

describe('a scenario that would break a reference', () => {
  it('is refused rather than compared or promoted', () => {
    const source = project();
    const withWall: Project = {
      ...source,
      building: {
        ...source.building,
        levels: [
          {
            ...source.building.levels[0]!,
            walls: [
              {
                id: 'wall-north' as (typeof source.building.levels)[number]['walls'][number]['id'],
                type: 'WALL',
                levelId: source.building.levels[0]!.id,
                assemblyId:
                  'assembly-brick' as (typeof source.building.levels)[number]['walls'][number]['assemblyId'],
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
          },
        ],
      },
    };
    const result = applyScenario(withWall, {
      id: 'ghost',
      name: 'Assemblage fantôme',
      baseProjectRevision: '1',
      overrides: [
        {
          path: 'building/levels/ground/walls/wall-north/assemblyId',
          operation: 'SET',
          value: 'assembly-that-does-not-exist',
        },
      ],
    });
    expect(result.status).toBe('INVALID');
    if (result.status !== 'INVALID') return;
    expect(result.issues.map(({ code }) => code)).toContain(
      'SCENARIO_BROKEN_REFERENCE',
    );
    expect(result.issues[0]?.message).toContain('assembly-that-does-not-exist');
  });

  it('does not blame a scenario for a reference the project already broke', () => {
    const source = project();
    const alreadyBroken: Project = {
      ...source,
      assemblies: (source.assemblies ?? []).map((assembly) => ({
        ...assembly,
        layers: assembly.layers.map((layer) => ({
          ...layer,
          materialId: 'material-that-does-not-exist' as typeof layer.materialId,
        })),
      })),
    };
    const result = applyScenario(
      alreadyBroken,
      thicker('assemblies/assembly-timber/layers/insulation/thicknessM'),
    );
    expect(result.status).toBe('OK');
  });
});
