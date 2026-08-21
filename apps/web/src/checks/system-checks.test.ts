import { describe, expect, it } from 'vitest';
import type {
  ComponentInstance,
  Project,
} from '@house-technical-designer/core-domain';
import { entityId } from '@house-technical-designer/core-domain';
import { demoClimateDatasets, loadDemoProject } from '../demo-project.js';
import { runProjectCalculations } from '../calculations/calculation-runner.js';
import { systemChecks } from './system-checks.js';

function demo(): Project {
  const result = loadDemoProject();
  if (result.status !== 'OK') throw new Error(result.message);
  return result.file.project;
}

async function checksOf(project: Project) {
  const run = await runProjectCalculations(project, demoClimateDatasets());
  return systemChecks(project, run);
}

function idsOf(checks: readonly { readonly id: string }[]): readonly string[] {
  return checks.map(({ id }) => id);
}

/** The reference house with one more thing standing in it. */
function withEquipment(
  project: Project,
  definition: { id: string; kind: string; properties: Record<string, unknown> },
  placements: readonly {
    id: string;
    levelId: string;
    spaceId?: string;
    category: ComponentInstance['category'];
  }[],
): Project {
  return {
    ...project,
    equipment: [
      ...(project.equipment ?? []),
      {
        id: definition.id,
        kind: definition.kind,
        catalogKind: 'GENERIC',
        properties: definition.properties as never,
      },
    ],
    building: {
      ...project.building,
      levels: project.building.levels.map((level) => ({
        ...level,
        components: [
          ...(level.components ?? []),
          ...placements
            .filter((one) => one.levelId === level.id)
            .map((one): ComponentInstance => ({
              id: entityId(one.id),
              type: 'COMPONENT_INSTANCE',
              levelId: level.id,
              category: one.category,
              definitionId: definition.id,
              position: { x: 1000, y: 1000 },
              elevationMm: 300,
              rotationDeg: 0,
              ...(one.spaceId === undefined
                ? {}
                : { spaceId: entityId(one.spaceId) }),
            })),
        ],
      })),
    },
  };
}

describe('what the house needs against what is standing in it', () => {
  it('says nothing at all before a calculation has run', () => {
    expect(systemChecks(demo(), undefined)).toEqual([]);
  });

  it('says it cannot tell when nothing makes heat', async () => {
    // The reference house computes a heating load and holds no generator. That
    // is not « conforme » and not « non conforme »: it is unknown, and the two
    // are never merged.
    const checks = await checksOf(demo());
    const generator = checks.find(
      ({ id }) => id === 'system:heating:no-generator',
    )!;
    expect(generator.status).toBe('UNKNOWN');
    // The figure it compared is in the finding, not only in the verdict.
    expect(generator.detail).toMatch(/kW/u);
  });

  it('does not report eight cold rooms in a house with no heating drawn', async () => {
    // One finding that matters, not eight that bury it.
    const checks = await checksOf(demo());
    expect(
      checks.filter(({ id }) => id.startsWith('system:heating:room-')),
    ).toEqual([]);
  });

  it('compares the generator posed with the load computed', async () => {
    const small = await checksOf(
      withEquipment(
        demo(),
        {
          id: 'equipment-tiny-pump',
          kind: 'HEAT_PUMP',
          properties: { heatingPowerW: 800 },
        },
        [{ id: 'component-pump', levelId: 'ground', category: 'HEATING' }],
      ),
    );
    const undersized = small.find(
      ({ id }) => id === 'system:heating:generator-undersized',
    )!;
    expect(undersized.status).toBe('FAIL');
    expect(undersized.detail).toContain('800 W');

    const big = await checksOf(
      withEquipment(
        demo(),
        {
          id: 'equipment-pump',
          kind: 'HEAT_PUMP',
          properties: { heatingPowerW: 9000 },
        },
        [{ id: 'component-pump', levelId: 'ground', category: 'HEATING' }],
      ),
    );
    expect(idsOf(big)).not.toContain('system:heating:generator-undersized');
    expect(idsOf(big)).not.toContain('system:heating:no-generator');
  });

  it('says so when a generator is posed and states no power', async () => {
    const checks = await checksOf(
      withEquipment(
        demo(),
        { id: 'equipment-pump', kind: 'HEAT_PUMP', properties: {} },
        [{ id: 'component-pump', levelId: 'ground', category: 'HEATING' }],
      ),
    );
    expect(
      checks.find(({ id }) => id === 'system:heating:generator-power-unknown')
        ?.status,
    ).toBe('UNKNOWN');
  });

  it('names the rooms nothing heats, once one room is heated', async () => {
    // A radiator in the living room makes every other room's silence a
    // decision rather than an unstarted drawing.
    const checks = await checksOf(
      withEquipment(
        demo(),
        {
          id: 'equipment-radiator',
          kind: 'RADIATOR',
          properties: { heatOutputW: 1200 },
        },
        [
          {
            id: 'component-radiator-living',
            levelId: 'ground',
            spaceId: 'space-living',
            category: 'HEATING',
          },
        ],
      ),
    );
    expect(idsOf(checks)).toContain(
      'system:heating:room-unheated:space-kitchen',
    );
    expect(idsOf(checks)).not.toContain(
      'system:heating:room-unheated:space-living',
    );
  });

  it('reports a room whose emitter is smaller than its load', async () => {
    const checks = await checksOf(
      withEquipment(
        demo(),
        {
          id: 'equipment-radiator',
          kind: 'RADIATOR',
          properties: { heatOutputW: 50 },
        },
        [
          {
            id: 'component-radiator-living',
            levelId: 'ground',
            spaceId: 'space-living',
            category: 'HEATING',
          },
        ],
      ),
    );
    const undersized = checks.find(
      ({ id }) => id === 'system:heating:room-undersized:space-living',
    )!;
    expect(undersized.status).toBe('FAIL');
    expect(undersized.detail).toContain('50 W');
  });

  it('compares the ventilation unit with what its terminals ask', async () => {
    // The reference house extracts 105 m³/h through a 75 m³/h unit: the two
    // figures were both computed and never put side by side.
    const checks = await checksOf(demo());
    const unit = checks.find(
      ({ id }) => id === 'system:ventilation:unit-undersized',
    )!;
    expect(unit.status).toBe('FAIL');
    expect(unit.detail).toContain('105');
  });

  it('says which circuit would trip, and stays quiet when none would', async () => {
    const project = demo();
    expect(idsOf(await checksOf(project))).not.toContain(
      'system:electrical:overloaded:electrical:lighting-circuit',
    );
    const tiny = {
      ...project,
      systems: (project.systems ?? []).map((system) => ({
        ...system,
        nodes: system.nodes.map((node) =>
          node.kind === 'CIRCUIT'
            ? {
                ...node,
                properties: { ...node.properties, protectionRatingA: 0.1 },
              }
            : node,
        ),
      })),
    };
    const overloaded = (await checksOf(tiny)).find(({ id }) =>
      id.startsWith('system:electrical:overloaded:'),
    )!;
    expect(overloaded.status).toBe('FAIL');
    expect(overloaded.detail).toContain('0 A');
  });

  it('says nothing about a photovoltaic chain that is whole', async () => {
    // The reference house has modules, an inverter and a battery, all placed.
    const checks = idsOf(await checksOf(demo()));
    expect(checks).not.toContain('system:pv:no-inverter');
    expect(checks).not.toContain('system:pv:battery-without-inverter');
    expect(checks).not.toContain('system:pv:inverter-undersized');
  });

  it('says the chain stops at the modules when nothing converts them', async () => {
    const project = demo();
    const withoutInverter: Project = {
      ...project,
      building: {
        ...project.building,
        levels: project.building.levels.map((level) => ({
          ...level,
          components: (level.components ?? []).filter(
            ({ definitionId }) => definitionId !== 'equipment-inverter',
          ),
        })),
      },
    };
    const checks = await checksOf(withoutInverter);
    expect(
      checks.find(({ id }) => id === 'system:pv:no-inverter')?.status,
    ).toBe('UNKNOWN');
    // A battery is posed, modules are posed, and nothing links them.
    expect(idsOf(checks)).toContain('system:pv:battery-without-inverter');
  });

  it('reports an inverter far smaller than the array it serves', async () => {
    const project = demo();
    const checks = await checksOf({
      ...project,
      equipment: (project.equipment ?? []).map((entry) =>
        entry.id === 'equipment-inverter'
          ? {
              ...entry,
              properties: { ...entry.properties, ratedAcPowerW: 600 },
            }
          : entry,
      ),
    });
    expect(
      checks.find(({ id }) => id === 'system:pv:inverter-undersized')?.status,
    ).toBe('FAIL');
  });

  it('compares the hot water tank posed with the storage computed', async () => {
    const project = demo();
    // The reference house's own tank is large enough and nothing is said.
    expect(idsOf(await checksOf(project))).not.toContain(
      'system:dhw:tank-undersized',
    );
    const small = {
      ...project,
      equipment: (project.equipment ?? []).map((entry) =>
        entry.kind === 'DHW_TANK'
          ? { ...entry, properties: { ...entry.properties, tankVolumeL: 20 } }
          : entry,
      ),
    };
    const undersized = (await checksOf(small)).find(
      ({ id }) => id === 'system:dhw:tank-undersized',
    )!;
    expect(undersized.status).toBe('FAIL');
    expect(undersized.detail).toContain('20 L');
  });

  it('never states a verdict, only a comparison', async () => {
    // Nothing here is a compliance claim: that is a rule pack's business, and
    // a rule pack knows which country and which year.
    for (const { detail, title } of await checksOf(demo()))
      expect(`${title} ${detail}`.toLowerCase()).not.toContain('conforme');
  });
});
