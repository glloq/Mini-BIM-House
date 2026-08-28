import { describe, expect, it } from 'vitest';
import { entityId } from './ids.js';
import {
  hostAccepts,
  levelHosts,
  HOST_FAMILIES,
  HOST_TYPES,
} from './host-types.js';
import type { Level } from './types.js';

const levelId = entityId<'Level'>('ground');
const assemblyId = 'assembly-wall' as never;

function level(): Level {
  return {
    id: levelId,
    name: 'Rez-de-chaussée',
    elevationMm: 0,
    defaultStoreyHeightMm: 2500,
    walls: [
      {
        id: entityId<'Wall'>('wall-south'),
        type: 'WALL',
        levelId,
        path: {
          points: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
          ],
        },
        referenceSide: 'CENTER',
        assemblyId,
        baseOffsetMm: 0,
        heightMode: 'EXPLICIT',
        heightMm: 2500,
        role: 'EXTERIOR',
      },
    ],
    openings: [
      {
        id: entityId<'Opening'>('opening-entry'),
        type: 'OPENING',
        openingType: 'DOOR',
        host: { kind: 'WALL', id: entityId<'Wall'>('wall-south') },
        offsetAlongHostMm: 1000,
        sillHeightMm: 0,
        widthMm: 900,
        heightMm: 2100,
      },
    ],
    slabs: [
      {
        id: entityId<'Slab'>('slab-ground'),
        type: 'SLAB',
        levelId,
        polygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
          ],
        },
        assemblyId,
        role: 'FLOOR',
        elevationOffsetMm: 0,
      },
    ],
    roofs: [],
    roofStructures: [
      {
        id: entityId<'Roof'>('roof-whole'),
        type: 'ROOF',
        levelId,
        footprint: {
          outer: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 4000 },
          ],
        },
        edges: Array.from({ length: 3 }, () => ({
          kind: 'SLOPED' as const,
          slopeDeg: 35,
          overhangMm: 400,
        })),
        assemblyId,
        baseElevationMm: 2500,
      },
    ],
    stairs: [],
    spaces: [
      {
        id: entityId<'Space'>('space-living'),
        type: 'SPACE',
        levelId,
        name: 'Séjour',
        category: 'LIVING',
        boundaryMode: 'MANUAL',
        manualPolygon: {
          outer: [
            { x: 0, y: 0 },
            { x: 3000, y: 0 },
            { x: 3000, y: 3000 },
          ],
        },
      },
    ],
    annotations: [],
    structure: [],
    components: [
      {
        id: entityId<'ComponentInstance'>('board'),
        type: 'COMPONENT_INSTANCE',
        levelId,
        category: 'ELECTRICAL',
        position: { x: 100, y: 100 },
        elevationMm: 1000,
        rotationDeg: 0,
      },
    ],
  };
}

describe('what a placed thing may be fixed to', () => {
  const hosts = levelHosts(level());

  it('names every kind of support the families are allowed to ask for', () => {
    // A family may write `allowedHosts: ["ROOF"]`; if nothing here answers for
    // it, that family can never be placed and nothing says so.
    for (const host of HOST_TYPES) expect(HOST_FAMILIES[host]).toBeDefined();
  });

  it('accepts a whole roof, not only a roof plane', () => {
    // Roof v2 was left out of the editor's list of supports, so a roof window
    // could be drawn on a roof the editor then refused to recognise.
    expect(hosts.get('roof-whole')).toEqual(new Set(['ROOF']));
  });

  it('lets one slab be a floor from above and a ceiling from below', () => {
    expect(hosts.get('slab-ground')).toEqual(new Set(['SLAB', 'CEILING']));
  });

  it('offers a wall, a baie and another appliance', () => {
    expect(hosts.get('wall-south')).toEqual(new Set(['WALL']));
    expect(hosts.get('opening-entry')).toEqual(new Set(['OPENING']));
    expect(hosts.get('board')).toEqual(new Set(['DISTRIBUTION_BOARD']));
  });

  it('refuses a room, which is a volume and not a support', () => {
    expect(hosts.has('space-living')).toBe(false);
  });

  it('answers whether a family may be fixed to what it found', () => {
    expect(hostAccepts(['WALL', 'SLAB'], hosts.get('wall-south'))).toBe(true);
    expect(hostAccepts(['ROOF'], hosts.get('wall-south'))).toBe(false);
    // Something standing on the ground is hosted by nothing at all.
    expect(hostAccepts(['SITE'], hosts.get('wall-south'))).toBe(false);
    expect(hostAccepts(['WALL'], undefined)).toBe(false);
  });
});
