import { describe, expect, it } from 'vitest';
import { allRoofPlanes, entityId } from '@house-technical-designer/core-domain';
import type { Project, Roof } from '@house-technical-designer/core-domain';
import { assemblyId } from '@house-technical-designer/assemblies';
import { loadDemoProject } from '../demo-project.js';
import { projectChecks } from './checks-model.js';

function project(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

function roofOn(outer: readonly { x: number; y: number }[]): Roof {
  return {
    id: entityId<'Roof'>('roof-shape'),
    type: 'ROOF',
    levelId: entityId<'Level'>('ground'),
    footprint: { outer: [...outer] },
    edges: outer.map(() => ({
      kind: 'SLOPED' as const,
      slopeDeg: 35,
      overhangMm: 0,
    })),
    assemblyId: assemblyId('generic-roof-timber-insulated'),
    baseElevationMm: 2500,
  };
}

function withRoof(roof: Roof): Project {
  const base = project();
  const ground = base.building.levels[0]!;
  return {
    ...base,
    building: {
      ...base.building,
      levels: [{ ...ground, roofStructures: [roof] }],
    },
  };
}

const RECTANGLE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 8000 },
  { x: 0, y: 8000 },
];

const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 10_000, y: 0 },
  { x: 10_000, y: 4000 },
  { x: 5000, y: 4000 },
  { x: 5000, y: 8000 },
  { x: 0, y: 8000 },
];

/**
 * Une croix dont chaque aile a sa propre pente.
 *
 * Il faut, pour ces deux tests, une toiture que le moteur ne sait vraiment pas
 * partitionner — et le L n'en est plus une : le squelette droit le résout,
 * noue comprise. Douze côtés, douze pentes de quinze à soixante-dix degrés,
 * quatre sommets rentrants : le moteur y manque un événement, le voit à ce que
 * ses pans couvrent, et le dit. C'est exactement le cas que ces tests
 * décrivent.
 */
const AWKWARD_CROSS = [
  { x: 3000, y: 0 },
  { x: 6000, y: 0 },
  { x: 6000, y: 3000 },
  { x: 9000, y: 3000 },
  { x: 9000, y: 6000 },
  { x: 6000, y: 6000 },
  { x: 6000, y: 9000 },
  { x: 3000, y: 9000 },
  { x: 3000, y: 6000 },
  { x: 0, y: 6000 },
  { x: 0, y: 3000 },
  { x: 3000, y: 3000 },
];

/** La même croix, avec une pente différente sur chaque côté. */
function awkwardRoof(): Roof {
  return {
    ...roofOn(AWKWARD_CROSS),
    edges: AWKWARD_CROSS.map((_, index) => ({
      kind: 'SLOPED' as const,
      slopeDeg: 15 + index * 5,
      overhangMm: 0,
    })),
  };
}

describe('what a roof contributes to the areas the project counts', () => {
  it('counts the planes of a roof it could partition', () => {
    const level = withRoof(roofOn(RECTANGLE)).building.levels[0]!;
    // One plane per sloped side, plus the plane the reference house draws by
    // hand.
    expect(allRoofPlanes(level)).toHaveLength(level.roofs.length + 4);
  });

  it('counts the planes of an L, valley and all', () => {
    // Un L se partitionne : six côtés, six pans, et ils comptent comme ceux
    // d'un rectangle. Ce test disait le contraire avant que le squelette droit
    // sache refermer les fronts qu'une noue sépare.
    const level = withRoof(roofOn(L_SHAPE)).building.levels[0]!;
    expect(allRoofPlanes(level)).toHaveLength(level.roofs.length + 6);
  });

  it('counts nothing at all for a roof it could not partition', () => {
    // The strips it can draw are not a partition: counting them would put
    // square metres into the quantities, the thermal envelope and the solar
    // gains that nothing could account for.
    const level = withRoof(awkwardRoof()).building.levels[0]!;
    expect(allRoofPlanes(level)).toHaveLength(level.roofs.length);
  });

  it('says out loud that the roof is counted nowhere', () => {
    // Counting nothing is the safe behaviour and a silent one: the user drew a
    // roof and the quantities do not mention it.
    const checks = projectChecks(withRoof(awkwardRoof()), undefined);
    const reported = checks.find(({ id }) =>
      id.includes('roof-unresolved:roof-shape'),
    );
    expect(reported).toBeDefined();
    expect(reported?.status).toBe('UNKNOWN');
    expect(reported?.detail).toContain('métrés');
    expect(reported?.fix?.objectIds).toEqual(['roof-shape']);
  });

  it('says nothing about a roof it did partition', () => {
    const checks = projectChecks(withRoof(roofOn(RECTANGLE)), undefined);
    expect(
      checks.filter(({ id }) => id.includes('roof-unresolved')),
    ).toHaveLength(0);
  });

  it('says nothing about an L either', () => {
    // La forme la plus courante après le rectangle ne doit plus déclencher un
    // constat qui dit « cette toiture n'est comptée nulle part ».
    const checks = projectChecks(withRoof(roofOn(L_SHAPE)), undefined);
    expect(
      checks.filter(({ id }) => id.includes('roof-unresolved')),
    ).toHaveLength(0);
  });
});
