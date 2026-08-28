import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Project } from '@house-technical-designer/core-domain';
import { equipmentKindOf } from '@house-technical-designer/core-domain';
import { loadProjectJson } from '@house-technical-designer/project-io/files';

import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';

const fixturePath = fileURLToPath(
  new URL(
    '../../../examples/reference-house/reference.houseproj.json',
    import.meta.url,
  ),
);

async function referenceProject(): Promise<Project> {
  const result = loadProjectJson(await readFile(fixturePath, 'utf8'));
  if (result.status !== 'OK') throw new Error(`fixture: ${result.status}`);
  return result.file.project;
}

/** The project with one fixture's design flow taken away. */
function withoutFlow(project: Project, nodeId: string): Project {
  return {
    ...project,
    systems: (project.systems ?? []).map((network) => ({
      ...network,
      nodes: network.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const {
          designFlowLps: _flow,
          targetFlowM3h: _target,
          ...rest
        } = node.properties ?? {};
        return { ...node, properties: rest };
      }),
    })),
  };
}

function inputsOf(project: Project) {
  const context = createProjectCalculationContext(project, { climate: [] });
  return {
    ...buildProjectCalculationInputs(context),
    settings: context.settings,
  };
}

function segments(
  inputs: ReturnType<typeof inputsOf>,
  moduleId: 'water' | 'ventilation',
): readonly Record<string, unknown>[] {
  const module = inputs.inputs[moduleId] as
    { readonly segments?: readonly Record<string, unknown>[] } | undefined;
  return module?.segments ?? [];
}

/**
 * A total is a claim about all of its terms.
 *
 * The application's rule is that an unknown value stays unknown, and the rule
 * held everywhere a single value was read. It broke everywhere values were
 * summed: `?? 0` turned « je ne sais pas » into « zéro », and zero adds,
 * compares and prints like any other number.
 */
describe('a run whose terminals are not all described', () => {
  it('states no cumulated flow, rather than the total of what it knows', async () => {
    const project = await referenceProject();
    const complete = inputsOf(project);
    const trunk = segments(complete, 'water').find(
      ({ id }) => id === 'water:trunk',
    );
    expect(trunk?.cumulatedDesignFlowLps).toBeGreaterThan(0);

    // One basin loses its design flow. The pipe that feeds it used to come out
    // at the total of the others — the total, unmarked, and wrong.
    const partial = inputsOf(withoutFlow(project, 'water:basin'));
    const unknownTrunk = segments(partial, 'water').find(
      ({ id }) => id === 'water:trunk',
    );
    expect(unknownTrunk?.cumulatedDesignFlowLps).toBeNull();
    expect(unknownTrunk?.flowM3s).toBeNull();
  });

  it('says how much it does know, and which object is missing', async () => {
    const project = await referenceProject();
    const partial = inputsOf(withoutFlow(project, 'water:basin'));
    const reported = partial.missing.find(
      ({ key }) => key === 'segments/water:trunk/flow',
    );
    expect(reported?.message).toContain('au moins');
    expect(reported?.message).toContain('water:basin');
    expect(reported?.expectedOrigin).toBe('PROJECT');
  });

  it('does the same for a duct', async () => {
    const project = await referenceProject();
    const partial = inputsOf(
      withoutFlow(project, 'ventilation:extract-kitchen'),
    );
    const trunk = segments(partial, 'ventilation').find(
      ({ id }) => id === 'ventilation:trunk',
    );
    expect(trunk?.flowM3h).toBeNull();
    expect(
      partial.missing.find(
        ({ key }) => key === 'segments/ventilation:trunk/flowM3h',
      )?.message,
    ).toContain('ventilation:extract-kitchen');
  });

  it('never mistakes a junction for a terminal that forgot to speak', async () => {
    // A junction states no flow of its own and that is not an unknown: it
    // carries what is under it. Read from the shape of the run rather than
    // from a list of node kinds, so tomorrow's kind of terminal is not
    // silently taken for a junction.
    const project = await referenceProject();
    const complete = inputsOf(project);
    expect(complete.missing.filter(({ key }) => key.endsWith('/flow'))).toEqual(
      [],
    );
    expect(
      complete.missing.filter(({ key }) => key.endsWith('/flowM3h')),
    ).toEqual([]);
  });
});

describe('what several panels add up to', () => {
  it('is unknown when one of them does not state its power', async () => {
    const project = await referenceProject();
    const stripped: Project = {
      ...project,
      equipment: (project.equipment ?? []).map((definition) => {
        if (equipmentKindOf(definition) !== 'PHOTOVOLTAIC') return definition;
        // Both spellings: a fiche says `peakPowerWp` and a project written
        // before the catalogue says `installedPowerWp`. Taking away one of
        // them and leaving the other is taking away nothing.
        const {
          installedPowerWp: _power,
          peakPowerWp: _peak,
          ...rest
        } = definition.properties;
        return { ...definition, properties: rest };
      }),
    };
    const inputs = inputsOf(stripped);
    const photovoltaic = inputs.inputs['photovoltaic'] as
      { readonly installedPowerWp?: number } | undefined;
    expect(photovoltaic?.installedPowerWp).toBeUndefined();
    // Two panels at 450 Wc and a third nobody described are not a 900 Wc
    // installation: they are an installation of at least 900 Wc.
    expect(
      inputs.missing.find(({ key }) => key === 'installedPowerWp'),
    ).toBeDefined();
  });
});

describe('the additional design load of a room', () => {
  it('is written down as an assumption rather than answered silently', async () => {
    const project = await referenceProject();
    const inputs = inputsOf(project);
    const declared = inputs.settings.assumptionsFor('heating');
    expect(
      declared.some(({ id }) => id === 'additionalRoomLoadW'),
      JSON.stringify(declared),
    ).toBe(true);
    // Zero stays the answer; what changes is that it is written down, travels
    // with the result and can be replaced by a figure somebody chose.
    expect(declared.find(({ id }) => id === 'additionalRoomLoadW')?.value).toBe(
      0,
    );
  });
});

describe('what a room actually loses heat through', () => {
  it('charges each room its own walls rather than a share of the total', async () => {
    const project = await referenceProject();
    const inputs = inputsOf(project);
    const heating = inputs.inputs['heating'] as
      | {
          readonly rooms?: readonly {
            readonly roomId: string;
            readonly envelopeElementIds?: readonly string[];
            readonly horizontalShare?: number;
          }[];
        }
      | undefined;
    const rooms = heating?.rooms ?? [];
    expect(rooms.length).toBeGreaterThan(0);

    // Two rooms of the same floor area no longer carry the same envelope: the
    // one with more façade carries more of it.
    const owned = new Map(
      rooms.map((room) => [
        room.roomId,
        (room.envelopeElementIds ?? []).filter((id) =>
          id.startsWith('envelope:wall:'),
        ).length,
      ]),
    );
    expect([...owned.values()].some((count) => count > 0)).toBe(true);
    expect(new Set(owned.values()).size).toBeGreaterThan(1);
  });

  it('shares what is above and below, and only that, by area', async () => {
    const project = await referenceProject();
    const inputs = inputsOf(project);
    const heating = inputs.inputs['heating'] as {
      readonly rooms?: readonly { readonly horizontalShare?: number }[];
    };
    const shares = (heating.rooms ?? []).map(
      ({ horizontalShare }) => horizontalShare ?? 0,
    );
    for (const share of shares) {
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });
});
