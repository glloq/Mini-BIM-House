import { describe, expect, it } from 'vitest';
import type { ProjectFile } from '@house-technical-designer/core-domain';
import { loadProjectJson } from '@house-technical-designer/project-io';
import {
  addWallToProject,
  createBlankProject,
  exportProjectPlan,
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
    expect(summarizeProject(file)).toEqual({
      levels: 1,
      walls: 0,
      openings: 0,
      spaces: 0,
      systems: 0,
      materials: 0,
    });
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
                  assemblyId:
                    'assembly-1' as ProjectFile['project']['building']['levels'][number]['walls'][number]['assemblyId'],
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
    const artifact = exportProjectPlan(populated);
    expect(artifact.content).toContain('data-role="WALL_CUT"');
    expect(artifact.content).not.toContain('data-state');
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
