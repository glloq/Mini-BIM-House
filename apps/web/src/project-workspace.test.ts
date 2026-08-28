import { describe, expect, it } from 'vitest';
import { genericAssemblyCatalog } from '@house-technical-designer/assemblies/catalog';
import { STARTER_LIBRARY } from '@house-technical-designer/catalog-registry/starter';
import {
  LAYER_PRESETS,
  defaultVisibility,
  presetVisibility,
} from '@house-technical-designer/view-query';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import { loadProjectJson } from '@house-technical-designer/project-io/files';
import { readFileSync } from 'node:fs';
import { APPLICATION_VERSION } from './version.js';
import {
  addWallToProject,
  createBlankProject,
  exportProjectPlan,
  planExportIssues,
  ProjectEditingSession,
  screenPointToModel,
  summarizeProject,
} from './project-workspace.js';

describe('web project workspace', () => {
  it('creates a canonical blank project without inventing domain values', () => {
    const file = createBlankProject('2026-08-19T00:00:00Z');
    expect(loadProjectJson(JSON.stringify(file))).toMatchObject({
      status: 'OK',
    });
    expect(summarizeProject(file)).toMatchObject({
      levels: 1,
      walls: 0,
      openings: 0,
      spaces: 0,
      systems: 0,
    });
  });

  it('ships a usable library so a new project can host a wall immediately', () => {
    const file = createBlankProject('2026-08-19T00:00:00Z');
    const materials = file.project.materialLibrary!.materials;
    const assemblies = file.project.assemblies!;
    expect(materials.length).toBeGreaterThan(0);
    // A basket, not a shelf. A new project used to be handed all thirty-five
    // build-ups and all fifty-nine materials, none of them chosen by anybody,
    // in a project where nothing is drawn yet — and the three catalogues went
    // into the first payload with them. It starts with one build-up per kind
    // of surface a house shell is made of; the rest is picked.
    expect(assemblies).toHaveLength(STARTER_LIBRARY.assemblies.length);
    expect(assemblies.length).toBeLessThan(genericAssemblyCatalog().length);
    expect(new Set(assemblies.map(({ category }) => category))).toEqual(
      new Set(['WALL', 'PARTITION', 'FLOOR', 'ROOF', 'CEILING']),
    );
    // The materials are what those build-ups are made of: no more, so nothing
    // is carried for nothing, and no less, so no layer names a material the
    // project does not hold.
    const known = new Set(materials.map(({ id }) => id));
    expect(known).toEqual(
      new Set(
        assemblies.flatMap(({ layers }) =>
          layers.map(({ materialId }) => materialId),
        ),
      ),
    );

    const wall = addWallToProject(
      file,
      {
        startXmm: 0,
        startYmm: 0,
        endXmm: 5000,
        endYmm: 0,
        assemblyId: assemblies.find(({ category }) => category === 'WALL')!.id,
      },
      'wall-1',
    );
    expect(wall.status).toBe('OK');
  });

  it('exports an interaction-free SVG from persisted wall paths', () => {
    const file = createBlankProject('2026-08-19T00:00:00Z');
    const level = file.project.building.levels[0]!;
    const populated: ProjectFile = {
      ...file,
      project: {
        ...file.project,
        building: {
          ...file.project.building,
          levels: [
            {
              ...level,
              walls: [
                {
                  id: 'wall-1' as ProjectFile['project']['building']['levels'][number]['walls'][number]['id'],
                  type: 'WALL' as const,
                  levelId: level.id,
                  path: {
                    points: [
                      { x: 0, y: 0 },
                      { x: 5000, y: 0 },
                    ],
                  },
                  referenceSide: 'CENTER' as const,
                  // A wall takes a wall's build-up. It used to take whichever
                  // one came first, which was a wall only because the
                  // catalogue happened to start with one.
                  assemblyId: file.project.assemblies!.find(
                    ({ category }) => category === 'WALL',
                  )!.id,
                  baseOffsetMm: 0,
                  heightMode: 'EXPLICIT' as const,
                  heightMm: 2500,
                  role: 'EXTERIOR' as const,
                },
              ],
            },
          ],
        },
      },
    };
    const artifact = exportProjectPlan(populated, {
      layers: defaultVisibility(),
    });
    expect(artifact.content).toContain('data-role="WALL_CUT"');
    expect(artifact.content).not.toContain('data-state');
    // The architectural sheet shows a wall, not its build-up; the materials
    // sheet shows the build-up. One model, two drawings, one layer switch.
    expect(artifact.content).not.toContain('architecture.wall-layers');
    expect(
      exportProjectPlan(populated, {
        layers: presetVisibility(
          LAYER_PRESETS.find(({ id }) => id === 'materials')!,
        ),
      }).content,
    ).toContain('architecture.wall-layers');
    expect(artifact.content).toContain('1:50');
    expect(artifact.fileName).toContain('rez-de-chaussee');
    expect(
      planExportIssues(populated, { layers: defaultVisibility() }),
    ).toEqual([]);
  });

  it('adds walls through canonical editor validation and rejects missing assemblies', () => {
    const blank = createBlankProject('2026-08-19T00:00:00Z');
    const draft = {
      startXmm: 0,
      startYmm: 0,
      endXmm: 5000,
      endYmm: 0,
      assemblyId: 'wall-assembly',
    };
    expect(addWallToProject(blank, draft, 'wall-new')).toMatchObject({
      status: 'ERROR',
    });
    const assembly = {
      id: 'wall-assembly',
      name: 'Mur test',
      category: 'WALL',
      layers: [
        {
          id: 'layer-test',
          materialId: 'material-test',
          thicknessM: 0.2,
          role: 'STRUCTURE',
        },
      ],
    } as unknown as NonNullable<ProjectFile['project']['assemblies']>[number];
    const configured: ProjectFile = {
      ...blank,
      project: { ...blank.project, assemblies: [assembly] },
    };
    const result = addWallToProject(configured, draft, 'wall-new');
    expect(result.status).toBe('OK');
    if (result.status === 'OK') {
      expect(result.file.project.building.levels[0]?.walls).toHaveLength(1);
      expect(configured.project.building.levels[0]?.walls).toHaveLength(0);
    }
    const session = new ProjectEditingSession(configured);
    expect(session.addWall(draft, 'wall-history').status).toBe('OK');
    expect(session.file.project.building.levels[0]?.walls).toHaveLength(1);
    expect(session.undo().status).toBe('OK');
    expect(session.file.project.building.levels[0]?.walls).toHaveLength(0);
    expect(session.redo().status).toBe('OK');
    expect(session.file.project.building.levels[0]?.walls).toHaveLength(1);
  });

  it('maps screen clicks to rounded millimetre model coordinates', () => {
    expect(
      screenPointToModel(
        { x: 150, y: 75 },
        { left: 100, top: 50, width: 200, height: 100 },
        { min: { x: -500, y: -500 }, max: { x: 9500, y: 7500 } },
      ),
    ).toEqual({ x: 2000, y: 1500 });
    expect(() =>
      screenPointToModel(
        { x: 0, y: 0 },
        { left: 0, top: 0, width: 0, height: 100 },
        { min: { x: 0, y: 0 }, max: { x: 1, y: 1 } },
      ),
    ).toThrow(/positives/u);
  });
});

describe('application version', () => {
  it('is the one the repository declares, not a second copy', () => {
    const declared = (
      JSON.parse(
        readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
      ) as { readonly version: string }
    ).version;
    expect(APPLICATION_VERSION).toBe(declared);
    // What the application stamps on a file it writes is that same version.
    expect(createBlankProject('2026-08-19T00:00:00Z').applicationVersion).toBe(
      declared,
    );
  });
});

describe('the charter a sheet is drawn with', () => {
  const populated = (): ProjectFile =>
    createBlankProject('2026-08-19T00:00:00Z');

  it('prints a plan of a house as a plan of a house', () => {
    // The export named the technical charter itself, so every sheet the
    // application produced was the one you read to find a duct.
    expect(
      exportProjectPlan(populated(), { layers: defaultVisibility() }).content,
    ).toContain('architectural-clean-print');
  });

  it('prints a screen charter with its own printed counterpart', () => {
    // Colour that separates five networks on a screen becomes five
    // indistinguishable greys on paper.
    expect(
      exportProjectPlan(populated(), {
        layers: defaultVisibility(),
        graphicProfileId: 'generic-technical-screen',
      }).content,
    ).toContain('generic-technical-print');
  });

  it('falls back on the plan of a house for a charter it does not ship', () => {
    expect(
      exportProjectPlan(populated(), {
        layers: defaultVisibility(),
        graphicProfileId: 'charte-agence',
      }).content,
    ).toContain('architectural-clean-print');
  });
});
