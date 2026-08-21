import { entityId, textNoteId } from '@house-technical-designer/core-domain';
import type { Project } from '@house-technical-designer/core-domain';
import { assemblyId } from '@house-technical-designer/assemblies';
import { loadDemoProject } from '../demo-project.js';

/**
 * The reference house with one object of every family the model knows.
 *
 * Only tests import this, which is why it lives apart from the application:
 * nothing that ships reaches it, and the bundle budget proves it. It exists
 * because several suites need the same thing — a project that actually holds a
 * stair, a whole roof, a post, a placed thing, a note and an obstacle — and
 * three copies of a fixture drift until they are three different projects
 * testing three different things.
 */
export function populatedProject(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  const base = result.file.project;
  const ground = base.building.levels[0]!;
  return {
    ...base,
    site: {
      ...base.site,
      obstacles: [
        {
          id: entityId('obstacle-tree'),
          boundary: {
            outer: [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
              { x: 1000, y: 1000 },
            ],
          },
          kind: 'TREE',
          name: 'Tilleul',
        },
      ],
    },
    building: {
      ...base.building,
      levels: [
        {
          ...ground,
          annotations: [
            ...ground.annotations,
            {
              id: textNoteId('note-demolition'),
              kind: 'TEXT',
              at: { x: 500, y: 500 },
              text: 'Existant à démolir',
            },
          ],
          stairs: [
            {
              id: entityId('stair-main'),
              type: 'STAIR',
              levelId: ground.id,
              topLevelId: entityId('upper'),
              stairType: 'STRAIGHT',
              widthMm: 900,
              riserCount: 16,
              treadDepthMm: 270,
              path: {
                points: [
                  { x: 0, y: 0 },
                  { x: 4050, y: 0 },
                ],
              },
            },
          ],
          roofStructures: [
            {
              id: entityId('roof-whole'),
              type: 'ROOF',
              levelId: ground.id,
              footprint: {
                outer: [
                  { x: 0, y: 0 },
                  { x: 10_000, y: 0 },
                  { x: 10_000, y: 8000 },
                  { x: 0, y: 8000 },
                ],
              },
              edges: Array.from({ length: 4 }, () => ({
                kind: 'SLOPED' as const,
                slopeDeg: 35,
                overhangMm: 400,
              })),
              assemblyId: assemblyId('assembly-horizontal'),
              baseElevationMm: 2500,
            },
          ],
          structure: [
            {
              id: entityId('member-column'),
              type: 'STRUCTURAL_MEMBER',
              levelId: ground.id,
              kind: 'COLUMN',
              path: [{ x: 2000, y: 2000 }],
              widthMm: 200,
              depthMm: 200,
            },
          ],
          components: [
            {
              id: entityId('component-radiator'),
              type: 'COMPONENT_INSTANCE',
              levelId: ground.id,
              category: 'HEATING',
              name: 'Radiateur séjour',
              position: { x: 3000, y: 1000 },
              elevationMm: 300,
              rotationDeg: 0,
            },
          ],
        },
      ],
    },
    drawingViews: [
      {
        id: 'view-ground',
        type: 'PLAN',
        name: 'Plan du rez-de-chaussée',
        levelId: ground.id,
        scaleDenominator: 50,
        layers: {},
        graphicProfileId: 'generic-technical-screen',
      },
    ],
    sheets: [
      {
        id: 'sheet-plans',
        number: 'A-001',
        title: 'Plans',
        format: 'A3',
        orientation: 'LANDSCAPE',
        viewports: [
          {
            id: 'viewport-ground',
            viewId: 'view-ground',
            scaleDenominator: 50,
            x: 10,
            y: 10,
            width: 250,
            height: 150,
          },
        ],
      },
    ],
  };
}
