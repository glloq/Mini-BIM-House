import { describe, expect, it } from 'vitest';
import { CalculationOrchestrator } from '@house-technical-designer/calculation-core';
import type { Project } from '@house-technical-designer/core-domain';
import { PROJECT_CALCULATION_MODULES } from './modules.js';
import { PROJECT_CALCULATION_MODULE_IDS } from './project-inputs.js';
import {
  createPreReferenceClimate,
  createPreReferenceProject,
} from './pre-reference-fixture.js';
import { createProjectCalculationContext } from './project-context.js';
import { buildProjectCalculationInputs } from './project-inputs.js';

function build(project: Project) {
  return buildProjectCalculationInputs(
    createProjectCalculationContext(project, {
      climate: createPreReferenceClimate(),
    }),
  );
}

function engine(): CalculationOrchestrator {
  const orchestrator = new CalculationOrchestrator();
  PROJECT_CALCULATION_MODULES.forEach((module) =>
    orchestrator.register(module),
  );
  return orchestrator;
}

const project = (): Project =>
  structuredClone(createPreReferenceProject().project);

function outputs(built: ReturnType<typeof build>) {
  return engine()
    .calculateModule('electrical', built.inputs, {})
    .then((outcome) => {
      if (outcome.status === 'ERROR') throw new Error(outcome.message);
      return outcome.result;
    });
}

describe('the electrical module in the project pipeline', () => {
  it('is one of the modules the project drives', () => {
    expect(PROJECT_CALCULATION_MODULE_IDS).toContain('electrical');
    expect(PROJECT_CALCULATION_MODULES.map(({ id }) => id)).toContain(
      'electrical',
    );
  });

  it('reads the circuit, its loads and its cables from the network', () => {
    const input = build(project()).inputs.electrical as Record<string, unknown>;
    expect(input.circuits).toHaveLength(1);
    expect(
      (input.circuits as readonly Record<string, unknown>[])[0],
    ).toMatchObject({
      id: 'electrical:lighting-circuit',
      boardId: 'electrical:board',
      voltageV: 230,
      phases: 1,
      loadIds: ['electrical:luminaire'],
    });
    // The feeder and the branch both belong to the circuit.
    expect(
      (input.cables as readonly Record<string, unknown>[]).map(({ id }) => id),
    ).toEqual(['electrical:feeder', 'electrical:cable']);
  });

  it('takes the load power from the equipment the node stands for', async () => {
    const result = await outputs(build(project()));
    // The luminaire node carries no power of its own; it names a catalogue
    // equipment, and that is where the 12 W comes from.
    expect(result.outputs.installedPowerW).toBe(12);
    expect(result.outputs.designPowerW).toBe(12);
  });

  it('reports a load whose power nobody stated instead of assuming one', () => {
    const source = project();
    const stripped: Project = {
      ...source,
      equipment: (source.equipment ?? []).filter(
        ({ id }) => id !== 'luminaire',
      ),
    };
    const missing = build(stripped).missing.filter(
      ({ moduleId }) => moduleId === 'electrical',
    );
    expect(missing.map(({ key }) => key)).toContain(
      'loads/electrical:luminaire/activePowerW',
    );
  });

  it('refuses to size a circuit whose voltage nobody stated', () => {
    const source = project();
    const unstated: Project = {
      ...source,
      systems: (source.systems ?? []).map((network) =>
        network.discipline !== 'ELECTRICAL'
          ? network
          : {
              ...network,
              nodes: network.nodes.map((node) =>
                node.kind === 'CIRCUIT' || node.kind === 'DISTRIBUTION_BOARD'
                  ? { ...node, properties: {} }
                  : node,
              ),
            },
      ),
    };
    const missing = build(unstated).missing.filter(
      ({ moduleId }) => moduleId === 'electrical',
    );
    expect(missing.map(({ key }) => key)).toContain(
      'circuits/electrical:lighting-circuit/nominalVoltageV',
    );
  });

  it('computes a voltage drop along the run it was given', async () => {
    const result = await outputs(build(project()));
    const circuit = (
      result.outputs.circuits as readonly Record<string, unknown>[]
    )[0]!;
    expect(Number(circuit.designCurrentA)).toBeGreaterThan(0);
    const cables = circuit.cables as readonly Record<string, unknown>[];
    expect(cables).toHaveLength(2);
    // Resistive drop on 1.5 mm² copper: small, positive, and stated per cable.
    for (const cable of cables)
      expect(Number(cable.voltageDropV)).toBeGreaterThan(0);
  });
});

/**
 * Ce qu'un circuit ramifié valait, et ce qu'il vaut.
 *
 * Le moteur ne savait additionner qu'une suite ordonnée de câbles, et faisait
 * passer le courant total du circuit dans chacun. Tout le reste — c'est-à-dire
 * tout circuit de maison, où l'on tire une dérivation par pièce — ressortait
 * sans aucune chute de tension, avec un avertissement disant que la
 * configuration n'était pas gérée.
 *
 * Ces tests passent par la chaîne réelle : le projet, ses réseaux, l'adaptateur
 * et le moteur.
 */
describe('un circuit qui se ramifie', () => {
  it('rend une chute de tension, là où il n’en rendait aucune', async () => {
    const result = await outputs(build(project()));
    const circuit = (
      result.outputs.circuits as readonly Record<string, unknown>[]
    )[0]!;
    expect(circuit.status).toBe('OK');
    expect(typeof circuit.voltageDropV).toBe('number');
    expect(circuit.voltageDropV as number).toBeGreaterThan(0);
  });

  it('nomme la charge la plus défavorisée', () => {
    // La moitié utile du résultat : c'est ce point-là qu'on rapprochera, ou
    // dont on grossira le câble. Une chute sans son point ne se corrige pas.
    return outputs(build(project())).then((result) => {
      const circuit = (
        result.outputs.circuits as readonly Record<string, unknown>[]
      )[0]!;
      expect(circuit.worstLoadId).toBe('electrical:luminaire');
    });
  });

  it('fait porter à chaque tronçon le courant de ce qu’il alimente', async () => {
    /*
     * Deux câbles en série vers une seule charge : les deux portent donc le
     * même courant, celui de la charge. Ce que ce test fige n'est pas ce
     * nombre — c'est que le courant vienne des charges en aval et non du
     * total du circuit, ce qui se voit dès qu'une dérivation existe.
     */
    const result = await outputs(build(project()));
    const circuit = (
      result.outputs.circuits as readonly Record<string, unknown>[]
    )[0]!;
    const cables = circuit.cables as readonly Record<string, unknown>[];
    expect(cables).toHaveLength(2);
    for (const cable of cables)
      expect(cable.currentA).toBeCloseTo(circuit.designCurrentA as number, 9);
  });

  it('lit la connexion que le réseau déclare, et non le tracé', () => {
    /*
     * Un câble dont le tracé part d'ailleurs que du nœud dont il déclare
     * partir reste connecté : c'est le cas de quatre câbles de la maison de
     * démonstration, et c'est ce qui faisait dire « déconnecté » à une
     * première version qui lisait la géométrie.
     */
    const input = build(project()).inputs.electrical as Record<string, unknown>;
    const cables = input.cables as readonly Record<string, unknown>[];
    expect(cables.every(({ fromNodeId }) => typeof fromNodeId === 'string'));
    expect(
      (input.circuits as readonly Record<string, unknown>[])[0]!.rootNodeId,
    ).toBe('electrical:board');
  });
});
