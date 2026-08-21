import type {
  Level,
  Project,
  Wall,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import {
  assemblyId,
  assemblyLayerId,
} from '@house-technical-designer/assemblies';
import { materialId } from '@house-technical-designer/materials';

/**
 * A house far larger than the reference one, built for measuring.
 *
 * The reference house has six walls and three rooms, which measures nothing:
 * the plan view is rebuilt on every pointer move, and what it costs on six
 * walls says nothing about what it costs on six hundred. This one is a grid of
 * rooms over several storeys — the shape of a large dwelling or a small
 * building — and it is derived rather than stored, so it never becomes a
 * fixture that drifts from the domain it is supposed to exercise.
 */
export function largeHouse(storeys: number, roomsPerStorey: number): Project {
  const columns = Math.ceil(Math.sqrt(roomsPerStorey));
  const rows = Math.ceil(roomsPerStorey / columns);
  const ROOM_MM = 4000;
  const levels: Level[] = [];
  for (let storey = 0; storey < storeys; storey += 1) {
    const levelId = entityId<'Level'>(`level-${storey}`);
    const walls: Wall[] = [];
    const spaces: Level['spaces'][number][] = [];
    let index = 0;
    for (let row = 0; row < rows; row += 1)
      for (let column = 0; column < columns; column += 1) {
        if (index >= roomsPerStorey) break;
        const x = column * ROOM_MM;
        const y = row * ROOM_MM;
        // Two walls a room: the north side and the west side. The grid closes
        // itself, which is what a partitioned floor actually looks like.
        for (const [from, to] of [
          [
            { x, y },
            { x: x + ROOM_MM, y },
          ],
          [
            { x, y },
            { x, y: y + ROOM_MM },
          ],
        ] as const)
          walls.push({
            id: entityId<'Wall'>(`wall-${storey}-${index}-${walls.length}`),
            type: 'WALL',
            levelId,
            path: { points: [from, to] },
            referenceSide: 'CENTER',
            assemblyId: assemblyId('assembly-wall'),
            baseOffsetMm: 0,
            heightMode: 'EXPLICIT',
            heightMm: 2500,
            role: storey === 0 ? 'EXTERIOR' : 'PARTITION',
          });
        spaces.push({
          id: entityId<'Space'>(`space-${storey}-${index}`),
          type: 'SPACE',
          levelId,
          name: `Pièce ${storey}-${index}`,
          category: 'LIVING',
          boundaryMode: 'MANUAL',
          manualPolygon: {
            outer: [
              { x, y },
              { x: x + ROOM_MM, y },
              { x: x + ROOM_MM, y: y + ROOM_MM },
              { x, y: y + ROOM_MM },
            ],
          },
        });
        index += 1;
      }
    levels.push({
      id: levelId,
      name: `Niveau ${storey}`,
      elevationMm: storey * 2700,
      defaultStoreyHeightMm: 2500,
      walls,
      slabs: [],
      roofs: [],
      openings: [],
      stairs: [],
      spaces,
      annotations: [],
    });
  }
  return {
    id: entityId<'Project'>('large-house'),
    metadata: {
      name: 'Grande maison',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    site: { northAngleDeg: 0 },
    building: { levels, zones: [] },
    materialLibrary: {
      materials: [
        {
          id: materialId('material'),
          name: 'Maçonnerie',
          kind: 'GENERIC',
          // Conductivity and density both: a material missing one of them is
          // a project the quantities report on, and the point of this fixture
          // is to measure the size of a house rather than the gaps in it.
          properties: { lambdaWmK: 0.8, densityKgM3: 1800 },
        },
      ],
    },
    assemblies: [
      {
        id: assemblyId('assembly-wall'),
        name: 'Mur',
        category: 'WALL',
        layers: [
          {
            id: assemblyLayerId('layer'),
            materialId: materialId('material'),
            thicknessM: 0.2,
          },
        ],
      },
    ],
    equipment: [],
    systems: [],
    scenarios: [],
    drawingViews: [],
    calculationSettings: {},
    regulatoryContext: { country: 'FR', enabledRulePacks: [] },
  };
}
