import {
  DEFAULT_GEOMETRY_TOLERANCE,
  type Point3D,
} from '@house-technical-designer/geometry';
import {
  resolveCircuitTopology,
  type TopologyFailure,
} from './circuit-topology.js';
import {
  millimetres,
  millimetresToMetres,
  numericValue,
} from '@house-technical-designer/units';
import type {
  ElectricalCable,
  ElectricalCircuit,
  ElectricalLoad,
  VoltageReference,
} from './electrical-domain.js';

export const ELECTRICAL_POWER_METHOD_ID =
  'balanced-active-power-demand-v1' as const;
export const RESISTIVE_VOLTAGE_DROP_METHOD_ID =
  'resistive-path-voltage-drop-v1' as const;

export interface CableElectricalInput {
  readonly cable: ElectricalCable;
  /** Catalog/method value at the selected material and temperature. */
  readonly conductorResistanceOhmPerM?: number;
}

export interface ElectricalCircuitCalculationInput {
  readonly circuit: ElectricalCircuit;
  readonly loads: readonly ElectricalLoad[];
  /**
   * Les tronçons du circuit.
   *
   * Sans topologie, ils doivent former une suite ordonnée et continue, et
   * chacun porte alors le courant total — c'est le contrat d'origine, et il
   * est conservé pour qui l'utilise encore. Avec topologie, l'ordre n'a plus
   * d'importance : l'arbre se lit sur la géométrie.
   */
  readonly cables: readonly CableElectricalInput[];
  /**
   * Ce que le réseau déclare relier, et d'où le circuit part.
   *
   * La donner change ce qui est calculé, et pour le mieux : le circuit est
   * alors traité comme l'arbre qu'il est, chaque tronçon portant le courant
   * des seules charges qu'il alimente, et la chute rendue est celle de la
   * charge la plus défavorisée. Sans elle, l'ancien contrat tient — une suite
   * ordonnée de câbles, le courant total dans chacun.
   *
   * La connectivité est **déclarée** et non déduite du dessin. Les deux
   * peuvent diverger : dans la maison de démonstration, quatre câbles ont un
   * tracé qui part à un mètre du nœud dont ils déclarent partir. La géométrie
   * ne sert donc qu'à la longueur.
   */
  readonly topology?: CircuitTopologyInput;
}

/** Ce que le réseau déclare d'un circuit : qui relie quoi, et depuis où. */
export interface CircuitTopologyInput {
  /** Le nœud d'où le circuit part : le tableau, ou sa protection. */
  readonly rootNodeId: string;
  /** Les deux nœuds que chaque câble relie, par identifiant de câble. */
  readonly cableEnds: Readonly<
    Record<string, { readonly from: string; readonly to: string }>
  >;
  /** Le nœud qui porte chaque charge, par identifiant de charge. */
  readonly loadNodes: Readonly<Record<string, string>>;
}

export interface ElectricalCableResult {
  readonly cableId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly lengthM: number;
  readonly currentA?: number;
  readonly voltageDropV?: number;
  readonly warnings: readonly ElectricalCalculationWarning[];
}

export interface ElectricalCircuitResult {
  readonly circuitId: string;
  readonly status: 'OK' | 'PARTIAL';
  readonly powerMethodId: typeof ELECTRICAL_POWER_METHOD_ID;
  readonly voltageDropMethodId: typeof RESISTIVE_VOLTAGE_DROP_METHOD_ID;
  readonly installedPowerW?: number;
  readonly designPowerW?: number;
  readonly designApparentPowerVA?: number;
  readonly designCurrentA?: number;
  readonly voltageDropV?: number;
  readonly voltageDropPercent?: number;
  /**
   * La charge qui subit cette chute.
   *
   * Sur un arbre, la chute du circuit est celle du point le plus défavorisé,
   * et savoir lequel est la moitié utile du résultat : c'est ce point qu'on va
   * rapprocher, ou dont on va grossir le câble.
   */
  readonly worstLoadId?: string;
  readonly cables: readonly ElectricalCableResult[];
  readonly warnings: readonly ElectricalCalculationWarning[];
}

export interface ElectricalCalculationWarning {
  readonly code:
    | 'ELEC_UNKNOWN_ACTIVE_POWER'
    | 'ELEC_UNKNOWN_DEMAND_FACTOR'
    | 'ELEC_UNKNOWN_POWER_FACTOR'
    | 'ELEC_UNKNOWN_RESISTANCE'
    | 'ELEC_UNSUPPORTED_CONFIGURATION'
    /** Les câbles ne forment pas un arbre : rien ne s'y calcule. */
    | 'ELEC_UNRESOLVED_TOPOLOGY';
  readonly objectId: string;
  readonly message: string;
}

export function calculateDesignCurrentA(
  activePowerW: number,
  voltageV: number,
  powerFactor: number,
  phases: 1 | 3,
  voltageReference: VoltageReference,
): number {
  nonNegative(activePowerW, 'active power');
  positive(voltageV, 'voltage');
  if (!Number.isFinite(powerFactor) || powerFactor <= 0 || powerFactor > 1)
    throw new RangeError('power factor must be in (0, 1]');
  if (voltageReference === 'DC')
    throw new RangeError('AC design current does not accept a DC voltage');
  return (
    activePowerW /
    (currentVoltageFactor(phases, voltageReference) * voltageV * powerFactor)
  );
}

export function calculateElectricalCircuit(
  input: ElectricalCircuitCalculationInput,
): ElectricalCircuitResult {
  const { circuit } = input;
  validateCircuitConfiguration(circuit);
  const warnings: ElectricalCalculationWarning[] = [];
  validateCalculationReferences(input);
  const installedPowerW = sumWhenKnown(
    input.loads,
    ({ activePowerW }) => activePowerW,
    (load) =>
      warnings.push(
        warning(
          'ELEC_UNKNOWN_ACTIVE_POWER',
          load.loadId,
          'Active power is unknown.',
        ),
      ),
  );
  const designPowerW = sumWhenKnown(
    input.loads,
    (load) =>
      load.activePowerW === undefined || load.demandFactor === undefined
        ? undefined
        : load.activePowerW * load.demandFactor,
    (load) => {
      if (load.activePowerW === undefined) return;
      warnings.push(
        warning(
          'ELEC_UNKNOWN_DEMAND_FACTOR',
          load.loadId,
          'Demand factor is unknown.',
        ),
      );
    },
  );
  const designApparentPowerVA = sumWhenKnown(
    input.loads,
    (load) =>
      load.activePowerW === undefined ||
      load.demandFactor === undefined ||
      load.powerFactor === undefined
        ? undefined
        : (load.activePowerW * load.demandFactor) / load.powerFactor,
    (load) => {
      if (
        load.activePowerW !== undefined &&
        load.demandFactor !== undefined &&
        load.powerFactor === undefined
      )
        warnings.push(
          warning(
            'ELEC_UNKNOWN_POWER_FACTOR',
            load.loadId,
            'Power factor is unknown.',
          ),
        );
    },
  );
  const designCurrentA =
    designApparentPowerVA === undefined
      ? undefined
      : designApparentPowerVA /
        (currentVoltageFactor(circuit.phases, circuit.voltageReference) *
          circuit.voltageV);
  const factor = pathFactorOf(circuit);
  /*
   * Deux façons de traiter le même circuit, et la première est la bonne.
   *
   * Avec la topologie, le circuit est l'arbre qu'il est : chaque tronçon porte
   * le courant des seules charges qu'il alimente, et la chute rendue est celle
   * de la charge la plus défavorisée. Sans elle, l'ancien contrat tient — une
   * suite ordonnée, le courant total partout — parce qu'un appelant qui ne
   * donne pas de géométrie n'a pas de quoi faire mieux, et qu'un résultat
   * majorant vaut mieux qu'un refus silencieux.
   */
  const declared = input.topology;
  const tree =
    declared === undefined
      ? undefined
      : resolveCircuitTopology(
          input.cables.map(({ cable, conductorResistanceOhmPerM }) => {
            const ends = declared.cableEnds[cable.id];
            return {
              cableId: cable.id,
              // Un câble dont le réseau ne dit pas ce qu'il relie ne mène
              // nulle part : le circuit ressortira « déconnecté », ce qui est
              // vrai, plutôt que raccroché au hasard.
              fromNodeId: ends?.from ?? `${cable.id}:from`,
              toNodeId: ends?.to ?? `${cable.id}:to`,
              path: cable.path,
              ...(conductorResistanceOhmPerM === undefined
                ? {}
                : { resistanceOhmPerM: conductorResistanceOhmPerM }),
            };
          }),
          input.loads.map((load) => {
            const currentA = loadCurrentA(load, circuit);
            return {
              loadId: load.loadId,
              nodeId: declared.loadNodes[load.loadId] ?? load.loadId,
              ...(currentA === undefined ? {} : { currentA }),
            };
          }),
          declared.rootNodeId,
          factor,
        );

  const cables = input.cables.map((cable) =>
    calculateCableVoltageDrop(
      cable,
      factor,
      tree?.status === 'RESOLVED'
        ? tree.currentByCable.get(cable.cable.id)
        : designCurrentA,
    ),
  );

  let voltageDropV: number | undefined;
  let worstLoadId: string | undefined;
  if (input.cables.length === 0)
    warnings.push(
      warning(
        'ELEC_UNSUPPORTED_CONFIGURATION',
        circuit.id,
        'Circuit has no cable path to evaluate.',
      ),
    );
  else if (tree !== undefined) {
    if (tree.status === 'UNRESOLVED')
      warnings.push(
        warning('ELEC_UNRESOLVED_TOPOLOGY', circuit.id, TOPOLOGY[tree.reason]),
      );
    else {
      voltageDropV = tree.worstDropV;
      worstLoadId = tree.worstLoadId;
    }
  } else {
    const isSeriesPath = hasContinuousSeriesPath(input.cables);
    if (!isSeriesPath)
      warnings.push(
        warning(
          'ELEC_UNSUPPORTED_CONFIGURATION',
          circuit.id,
          'Cable inputs must form one ordered continuous series path; branched paths require a per-branch calculation.',
        ),
      );
    else if (!cables.some(({ voltageDropV: drop }) => drop === undefined))
      voltageDropV = cables.reduce(
        (total, cable) => total + cable.voltageDropV!,
        0,
      );
  }
  const cableWarnings = cables.flatMap(({ warnings: entries }) => entries);
  const allWarnings = [...warnings, ...cableWarnings];
  return {
    circuitId: circuit.id,
    status:
      installedPowerW === undefined ||
      designPowerW === undefined ||
      designCurrentA === undefined ||
      voltageDropV === undefined
        ? 'PARTIAL'
        : 'OK',
    powerMethodId: ELECTRICAL_POWER_METHOD_ID,
    voltageDropMethodId: RESISTIVE_VOLTAGE_DROP_METHOD_ID,
    ...(installedPowerW === undefined ? {} : { installedPowerW }),
    ...(designPowerW === undefined ? {} : { designPowerW }),
    ...(designApparentPowerVA === undefined ? {} : { designApparentPowerVA }),
    ...(designCurrentA === undefined ? {} : { designCurrentA }),
    ...(voltageDropV === undefined
      ? {}
      : {
          voltageDropV,
          voltageDropPercent: (voltageDropV / circuit.voltageV) * 100,
        }),
    ...(worstLoadId === undefined ? {} : { worstLoadId }),
    cables,
    warnings: allWarnings,
  };
}

/** Ce que chaque défaut de topologie dit, en une phrase lisible. */
const TOPOLOGY: Readonly<Record<TopologyFailure, string>> = {
  DISCONNECTED:
    'Les câbles du circuit ne se rejoignent pas tous : un tronçon ne remonte à aucun tableau.',
  LOOP: 'Les câbles du circuit referment une boucle ; un anneau partage le courant entre deux chemins et se calcule autrement.',
  LOAD_OFF_PATH:
    'Une charge du circuit n’est posée à l’extrémité d’aucun de ses câbles.',
};

/**
 * Aller et retour, ou racine de trois.
 *
 * En monophasé, le courant fait deux fois le trajet — la phase et le neutre —
 * donc la chute compte deux longueurs. En triphasé équilibré, le neutre ne
 * porte rien, et le facteur est √3 entre phases, 1 par rapport au neutre.
 */
function pathFactorOf(circuit: ElectricalCircuit): number {
  if (circuit.phases !== 3) return 2;
  return circuit.voltageReference === 'PHASE_PHASE' ? Math.sqrt(3) : 1;
}

/** Le courant d'emploi d'une charge, quand tout ce qu'il faut est dit. */
function loadCurrentA(
  load: ElectricalLoad,
  circuit: ElectricalCircuit,
): number | undefined {
  if (
    load.activePowerW === undefined ||
    load.demandFactor === undefined ||
    load.powerFactor === undefined
  )
    return undefined;
  return (
    (load.activePowerW * load.demandFactor) /
    load.powerFactor /
    (currentVoltageFactor(circuit.phases, circuit.voltageReference) *
      circuit.voltageV)
  );
}

function hasContinuousSeriesPath(
  cables: readonly CableElectricalInput[],
): boolean {
  return cables.every(({ cable }, index) => {
    if (index === 0) return true;
    const previous = cables[index - 1]!.cable.path.at(-1)!;
    const current = cable.path[0]!;
    return (
      Math.hypot(
        previous.x - current.x,
        previous.y - current.y,
        previous.z - current.z,
      ) <= DEFAULT_GEOMETRY_TOLERANCE.pointMergeMm
    );
  });
}

export function electricalPathLengthM(path: readonly Point3D[]): number {
  if (path.length < 2) throw new RangeError('Cable path requires two points');
  let totalMm = 0;
  for (let index = 1; index < path.length; index += 1) {
    const first = path[index - 1]!;
    const second = path[index]!;
    const delta = [second.x - first.x, second.y - first.y, second.z - first.z];
    if (delta.some((value) => !Number.isFinite(value)))
      throw new RangeError('Cable path coordinates must be finite');
    totalMm += Math.hypot(...delta);
  }
  if (totalMm <= 0) throw new RangeError('Cable path length must be positive');
  return numericValue(millimetresToMetres(millimetres(totalMm)));
}

function calculateCableVoltageDrop(
  input: CableElectricalInput,
  pathFactor: number,
  currentA: number | undefined,
): ElectricalCableResult {
  const lengthM = electricalPathLengthM(input.cable.path);
  if (currentA === undefined)
    return {
      cableId: input.cable.id,
      status: 'PARTIAL',
      lengthM,
      warnings: [],
    };
  if (input.conductorResistanceOhmPerM === undefined)
    return {
      cableId: input.cable.id,
      status: 'PARTIAL',
      lengthM,
      currentA,
      warnings: [
        warning(
          'ELEC_UNKNOWN_RESISTANCE',
          input.cable.id,
          'Conductor resistance is unknown.',
        ),
      ],
    };
  nonNegative(input.conductorResistanceOhmPerM, 'conductor resistance');
  return {
    cableId: input.cable.id,
    status: 'OK',
    lengthM,
    currentA,
    voltageDropV:
      pathFactor * currentA * input.conductorResistanceOhmPerM * lengthM,
    warnings: [],
  };
}

function sumWhenKnown<T>(
  values: readonly T[],
  select: (value: T) => number | undefined,
  onUnknown: (value: T) => void,
): number | undefined {
  let total = 0;
  let known = true;
  for (const value of values) {
    const selected = select(value);
    if (selected === undefined) {
      known = false;
      onUnknown(value);
    } else {
      nonNegative(selected, 'load contribution');
      total += selected;
    }
  }
  return known ? total : undefined;
}

function validateCircuitConfiguration(circuit: ElectricalCircuit): void {
  positive(circuit.voltageV, 'voltage');
  if (circuit.voltageReference === 'DC' && circuit.phases !== 1)
    throw new RangeError('DC circuits must use one phase/conductor system');
  if (circuit.voltageReference === 'DC')
    throw new RangeError(
      'DC voltage-drop calculation requires a dedicated method and is not supported by this version',
    );
}

function validateCalculationReferences(
  input: ElectricalCircuitCalculationInput,
): void {
  const expectedLoads = [...input.circuit.loadIds].sort();
  const suppliedLoads = input.loads.map(({ loadId }) => loadId).sort();
  if (
    new Set(suppliedLoads).size !== suppliedLoads.length ||
    expectedLoads.length !== suppliedLoads.length ||
    expectedLoads.some((id, index) => id !== suppliedLoads[index])
  )
    throw new RangeError(
      `Loads supplied for circuit ${input.circuit.id} must exactly match its loadIds.`,
    );
  if (
    input.cables.some(
      ({ cable }) => cable.properties.circuitId !== input.circuit.id,
    )
  )
    throw new RangeError(
      `Every cable supplied for circuit ${input.circuit.id} must reference that circuit.`,
    );
}

function currentVoltageFactor(
  phases: 1 | 3,
  voltageReference: VoltageReference,
): number {
  if (phases === 1) return 1;
  return voltageReference === 'PHASE_PHASE' ? Math.sqrt(3) : 3;
}

function warning(
  code: ElectricalCalculationWarning['code'],
  objectId: string,
  message: string,
): ElectricalCalculationWarning {
  return { code, objectId, message };
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}
