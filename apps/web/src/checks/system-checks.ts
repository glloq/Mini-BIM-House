import type {
  Project,
  ResolvedPlacedEquipment,
} from '@house-technical-designer/core-domain';
import {
  placedEquipment,
  placedEquipmentByKind,
} from '@house-technical-designer/core-domain';
import type { CalculationRun } from '../calculations/calculation-runner.js';
import type { CheckItem } from './checks-model.js';

/**
 * What the house needs, against what is standing in it.
 *
 * The application computed a heating load and counted the heat generators, and
 * nobody ever put the two numbers side by side. Everything here is that
 * comparison and nothing else: it says « ce qui est posé ne suffit pas » or
 * « je ne peux pas savoir », never « ce n'est pas conforme ». Whether an
 * undersized generator breaks a rule of a particular country is a question for
 * a rule pack, which knows which country and which year.
 *
 * Every finding names the two numbers it compared. A verdict whose figures the
 * reader cannot see is a verdict they can only believe.
 */
export function systemChecks(
  project: Project,
  run: CalculationRun | undefined,
): readonly CheckItem[] {
  if (run === undefined) return [];
  const placed = placedEquipment(project);
  const byKind = placedEquipmentByKind(placed);
  return [
    ...heatingChecks(project, run, byKind),
    ...ventilationChecks(project, run, byKind),
    ...electricalChecks(project, run),
    ...solarChecks(run, byKind),
    ...waterChecks(run, byKind),
  ];
}

type Outputs = Readonly<Record<string, unknown>>;

/**
 * What a module produced, whether or not it produced everything.
 *
 * A run is `PARTIAL` when the module said what it could not compute — a
 * voltage drop without a cable length, say. What it did compute is still
 * computed, and refusing to read it would silence every comparison on a house
 * with one unknown in it, which is every house.
 */
function outputsOf(run: CalculationRun, moduleId: string): Outputs | undefined {
  const module = run.runs.find((entry) => entry.moduleId === moduleId);
  if (module?.status !== 'OK' && module?.status !== 'PARTIAL') return undefined;
  return module.result?.outputs;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function rowsOf(value: unknown): readonly Outputs[] {
  return Array.isArray(value)
    ? (value.filter(
        (entry) => typeof entry === 'object' && entry !== null,
      ) as readonly Outputs[])
    : [];
}

/** A property of what is placed, read wherever the resolution put it. */
function property(one: ResolvedPlacedEquipment, ...keys: string[]) {
  for (const key of keys) {
    const found = number(one.resolvedProperties[key]);
    if (found !== undefined) return found;
  }
  return undefined;
}

function summed(
  group: readonly ResolvedPlacedEquipment[],
  ...keys: string[]
): number | undefined {
  let total = 0;
  let known = false;
  for (const one of group) {
    const value = property(one, ...keys);
    if (value === undefined) continue;
    total += value;
    known = true;
  }
  return known ? total : undefined;
}

function label(one: ResolvedPlacedEquipment): string {
  return one.name ?? one.definitionId ?? one.instanceId;
}

function watts(value: number): string {
  return value >= 1000
    ? `${(value / 1000).toFixed(2)} kW`
    : `${value.toFixed(0)} W`;
}

/** The kinds of thing that make heat for a whole house. */
const GENERATORS = [
  'HEAT_PUMP',
  'AIR_WATER_HEAT_PUMP',
  'AIR_AIR_HEAT_PUMP',
  'GROUND_WATER_HEAT_PUMP',
  'GAS_BOILER',
  'WOOD_BOILER',
  'PELLET_BOILER',
  'ELECTRIC_BOILER',
  'DISTRICT_HEATING_SUBSTATION',
];

/** The kinds of thing that give that heat back out, room by room. */
const EMITTERS = [
  'RADIATOR',
  'TOWEL_RAIL',
  'UNDERFLOOR_HEATING_LOOP',
  'FAN_COIL_UNIT',
  'CONVECTOR',
  'ELECTRIC_RADIATOR',
  'WOOD_STOVE',
  'PELLET_STOVE',
];

/**
 * The placed things one of these words names, whichever word names them.
 *
 * These checks ask by a mix of the old `kind` — `FAN`, `AHU` — and family
 * identifiers — `STRING_INVERTER`, `THERMODYNAMIC_WATER_HEATER`. A fiche taken
 * from the catalogue answers to three words: its family, its coarse category,
 * and the `kind` a snapshot writes from that category. Asking by one of them
 * and matching only that one is how a ventilation unit standing in the house
 * came to be found by nothing.
 */
function ofKinds(
  byKind: Readonly<Record<string, readonly ResolvedPlacedEquipment[]>>,
  kinds: readonly string[],
): readonly ResolvedPlacedEquipment[] {
  const wanted = new Set(kinds);
  return Object.values(byKind)
    .flat()
    .filter(
      (placed) =>
        wanted.has(placed.kind ?? '') ||
        wanted.has(placed.catalogCategory ?? '') ||
        wanted.has(placed.familyId ?? ''),
    );
}

function heatingChecks(
  project: Project,
  run: CalculationRun,
  byKind: Readonly<Record<string, readonly ResolvedPlacedEquipment[]>>,
): readonly CheckItem[] {
  const outputs = outputsOf(run, 'heating');
  if (outputs === undefined) return [];
  const checks: CheckItem[] = [];
  const designLoadW = number(outputs.designLoadW);
  const generators = ofKinds(byKind, GENERATORS);

  if (designLoadW !== undefined) {
    if (generators.length === 0)
      checks.push({
        id: 'system:heating:no-generator',
        status: 'UNKNOWN',
        source: 'CALCULATION',
        title: 'Chauffage — aucun générateur posé',
        detail: `La maison demande ${watts(designLoadW)} au point de dimensionnement et aucun générateur n’est posé dans le bâtiment : rien ne dit si la puissance suffit.`,
        fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
      });
    else {
      const installedW = summed(
        generators,
        'heatingPowerW',
        'nominalHeatingPowerW',
        'usefulHeatingPowerW',
        'ratedPowerW',
        // The word the catalogue uses, which is the property registry's.
        'nominalHeatingCapacityW',
      );
      if (installedW === undefined)
        checks.push({
          id: 'system:heating:generator-power-unknown',
          status: 'UNKNOWN',
          source: 'CALCULATION',
          title: 'Chauffage — puissance du générateur inconnue',
          detail: `${generators.map(label).join(', ')} : aucune puissance de chauffage n’est renseignée, donc rien ne se compare aux ${watts(designLoadW)} demandés.`,
          fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
        });
      else if (installedW < designLoadW)
        checks.push({
          id: 'system:heating:generator-undersized',
          status: 'FAIL',
          source: 'CALCULATION',
          title: 'Chauffage — le générateur posé ne couvre pas la demande',
          detail: `${watts(installedW)} posés pour ${watts(designLoadW)} demandés au point de dimensionnement : il manque ${watts(designLoadW - installedW)}.`,
          fix: {
            label: 'Voir sur le plan',
            tab: 'plan',
            objectIds: generators.map(({ instanceId }) => instanceId),
          },
        });
    }
  }

  // Room by room: a room the calculation gives a load to and nothing heats is
  // a cold room, and the total said nothing about it.
  const emittersBySpace = new Map<string, ResolvedPlacedEquipment[]>();
  for (const one of ofKinds(byKind, EMITTERS)) {
    if (one.spaceId === undefined) continue;
    emittersBySpace.set(one.spaceId, [
      ...(emittersBySpace.get(one.spaceId) ?? []),
      one,
    ]);
  }
  const names = new Map(
    project.building.levels
      .flatMap(({ spaces }) => spaces)
      .map((space) => [space.id as string, space.name]),
  );
  // Nothing is said room by room until the house holds at least one emitter:
  // a project whose heating is not drawn yet is not a project with eight cold
  // rooms, and eight findings would bury the one that matters.
  if (emittersBySpace.size > 0)
    for (const room of rowsOf(outputs.rooms)) {
      const roomId = typeof room.roomId === 'string' ? room.roomId : undefined;
      const totalW = number(room.totalW);
      if (roomId === undefined || totalW === undefined || totalW <= 0) continue;
      const name = names.get(roomId) ?? roomId;
      const emitters = emittersBySpace.get(roomId) ?? [];
      if (emitters.length === 0) {
        checks.push({
          id: `system:heating:room-unheated:${roomId}`,
          status: 'FAIL',
          source: 'CALCULATION',
          domain: 'HEATING',
          title: `Chauffage — ${name} n’a pas d’émetteur`,
          detail: `Cette pièce demande ${watts(totalW)} et rien n’y est posé pour les lui donner.`,
          fix: { label: 'Voir sur le plan', tab: 'plan', objectIds: [roomId] },
        });
        continue;
      }
      const emittedW = summed(
        emitters,
        'heatOutputW',
        'nominalPowerW',
        'ratedPowerW',
        'heatingPowerW',
        // The word the catalogue uses for an emitter's output.
        'nominalOutputW',
      );
      if (emittedW === undefined)
        checks.push({
          id: `system:heating:room-power-unknown:${roomId}`,
          status: 'UNKNOWN',
          source: 'CALCULATION',
          domain: 'HEATING',
          title: `Chauffage — ${name} : puissance émise inconnue`,
          detail: `${emitters.map(label).join(', ')} : aucune puissance n’est renseignée, donc rien ne se compare aux ${watts(totalW)} demandés.`,
          fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
        });
      else if (emittedW < totalW)
        checks.push({
          id: `system:heating:room-undersized:${roomId}`,
          status: 'FAIL',
          source: 'CALCULATION',
          domain: 'HEATING',
          title: `Chauffage — ${name} est sous-équipée`,
          detail: `${watts(emittedW)} posés pour ${watts(totalW)} demandés : il manque ${watts(totalW - emittedW)}.`,
          fix: {
            label: 'Voir sur le plan',
            tab: 'plan',
            objectIds: emitters.map(({ instanceId }) => instanceId),
          },
        });
    }
  return checks;
}

function ventilationChecks(
  project: Project,
  run: CalculationRun,
  byKind: Readonly<Record<string, readonly ResolvedPlacedEquipment[]>>,
): readonly CheckItem[] {
  const outputs = outputsOf(run, 'ventilation');
  if (outputs === undefined) return [];
  // What the extract terminals ask for. The module lists the terminals it
  // sized; which of them extract is a fact of the project, and the flow is
  // read from the same place the module read it.
  const sized = new Set(
    rowsOf(outputs.terminals).flatMap(({ id }) =>
      typeof id === 'string' ? [id] : [],
    ),
  );
  let extracted = 0;
  for (const system of project.systems ?? [])
    for (const node of system.nodes) {
      if (!sized.has(node.id)) continue;
      if (node.properties?.airRole !== 'EXTRACT') continue;
      extracted += number(node.properties.targetFlowM3h) ?? 0;
    }
  if (extracted <= 0) return [];
  const fans = ofKinds(byKind, [
    'FAN',
    'MECHANICAL_VENTILATION_UNIT',
    'VENTILATION_UNIT',
    'AHU',
  ]);
  // What the group is, against what the drawing is. Both say it — the fiche in
  // `systemType`, the network in its own — and nothing compared them: the
  // house declared a double-flow unit while its drawing showed passive wall
  // inlets and a single extract trunk, which is a simple-flux system. A
  // balanced unit blows its supply air through ducts the house does not have.
  const checks: CheckItem[] = [];
  const drawn = new Set(
    (project.systems ?? [])
      .filter((system) => system.discipline === 'VENTILATION')
      .flatMap((system) =>
        typeof system.systemType === 'string' ? [system.systemType] : [],
      ),
  );
  for (const one of fans) {
    const stated = one.resolvedProperties['systemType'];
    if (typeof stated !== 'string' || drawn.size === 0) continue;
    if (drawn.has(stated)) continue;
    checks.push({
      id: `system:ventilation:type-mismatch:${one.instanceId}`,
      status: 'FAIL',
      source: 'CALCULATION',
      domain: 'VENTILATION',
      title: 'Ventilation — le groupe posé n’est pas celui du réseau dessiné',
      detail: `${label(one)} est un groupe ${stated} et le réseau est dessiné en ${[...drawn].join(', ')} : l'un souffle par des gaines que l'autre n'a pas.`,
      fix: {
        label: 'Voir sur le plan',
        tab: 'plan',
        objectIds: [one.instanceId],
      },
    });
  }

  if (fans.length === 0)
    return [
      ...checks,
      {
        id: 'system:ventilation:no-unit',
        status: 'UNKNOWN',
        source: 'CALCULATION',
        title: 'Ventilation — aucun groupe posé',
        detail: `Les bouches d’extraction demandent ${extracted.toFixed(0)} m³/h et aucun groupe n’est posé dans le bâtiment : rien ne dit si le débit suit.`,
        fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
      },
    ];
  const designFlow = summed(fans, 'designFlowM3h', 'nominalFlowM3h');
  if (designFlow === undefined)
    return [
      ...checks,
      {
        id: 'system:ventilation:unit-flow-unknown',
        status: 'UNKNOWN',
        source: 'CALCULATION',
        title: 'Ventilation — débit du groupe inconnu',
        detail: `${fans.map(label).join(', ')} : aucun débit nominal n’est renseigné, donc rien ne se compare aux ${extracted.toFixed(0)} m³/h demandés par les bouches.`,
        fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
      },
    ];
  if (designFlow >= extracted) return checks;
  return [
    ...checks,
    {
      id: 'system:ventilation:unit-undersized',
      status: 'FAIL',
      source: 'CALCULATION',
      title: 'Ventilation — le groupe posé ne tient pas les bouches',
      detail: `${designFlow.toFixed(0)} m³/h au groupe pour ${extracted.toFixed(0)} m³/h demandés par les bouches d’extraction : il manque ${(extracted - designFlow).toFixed(0)} m³/h.`,
      fix: {
        label: 'Voir sur le plan',
        tab: 'plan',
        objectIds: fans.map(({ instanceId }) => instanceId),
      },
    },
  ];
}

function electricalChecks(
  project: Project,
  run: CalculationRun,
): readonly CheckItem[] {
  const outputs = outputsOf(run, 'electrical');
  if (outputs === undefined) return [];
  // What each circuit is protected at is a fact of the project, and the
  // current it will carry is a result. Nothing compared them.
  const ratings = new Map<string, number>();
  for (const system of project.systems ?? [])
    for (const node of system.nodes) {
      const rating = number(node.properties?.protectionRatingA);
      if (rating !== undefined) ratings.set(node.id, rating);
    }
  const checks: CheckItem[] = [];
  for (const circuit of rowsOf(outputs.circuits)) {
    const id =
      typeof circuit.circuitId === 'string' ? circuit.circuitId : undefined;
    const currentA = number(circuit.designCurrentA);
    if (id === undefined || currentA === undefined) continue;
    const rating = ratings.get(id);
    if (rating === undefined) {
      checks.push({
        id: `system:electrical:no-rating:${id}`,
        status: 'UNKNOWN',
        source: 'CALCULATION',
        domain: 'ELECTRICAL',
        title: `Électricité — ${id} : calibre de protection inconnu`,
        detail: `Le circuit portera ${currentA.toFixed(1)} A et ne dit pas à quel calibre il est protégé.`,
        fix: { label: 'Ouvrir les réseaux', tab: 'networks', objectIds: [id] },
      });
      continue;
    }
    if (currentA <= rating) continue;
    checks.push({
      id: `system:electrical:overloaded:${id}`,
      status: 'FAIL',
      source: 'CALCULATION',
      domain: 'ELECTRICAL',
      title: `Électricité — ${id} dépasse son calibre`,
      detail: `${currentA.toFixed(1)} A foisonnés pour une protection de ${rating.toFixed(0)} A : le circuit déclenchera.`,
      fix: { label: 'Ouvrir les réseaux', tab: 'networks', objectIds: [id] },
    });
  }
  return checks;
}

function solarChecks(
  run: CalculationRun,
  byKind: Readonly<Record<string, readonly ResolvedPlacedEquipment[]>>,
): readonly CheckItem[] {
  const outputs = outputsOf(run, 'photovoltaic');
  const installedWp = number(outputs?.installedPowerWp);
  if (installedWp === undefined || installedWp <= 0) return [];
  const checks: CheckItem[] = [];
  const inverters = ofKinds(byKind, [
    'STRING_INVERTER',
    'INVERTER',
    'HYBRID_INVERTER',
    'MICRO_INVERTER',
  ]);
  if (inverters.length === 0)
    checks.push({
      id: 'system:pv:no-inverter',
      status: 'UNKNOWN',
      source: 'CALCULATION',
      title: 'Photovoltaïque — aucun onduleur posé',
      detail: `${(installedWp / 1000).toFixed(2)} kWc sont posés en toiture et rien ne les convertit : la chaîne s’arrête aux modules.`,
      fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
    });
  else {
    // `nominalAcPowerW` is what an inverter fiche states; `ratedAcPowerW` is
    // what projects written before the catalogue carry. Reading only the
    // second is how a 5 kVA onduleur came to state no power at all.
    const ratedW = summed(
      inverters,
      'ratedAcPowerW',
      'nominalAcPowerW',
      'nominalPowerW',
    );
    // An inverter is normally smaller than the array it serves; only a gross
    // difference is worth a word, and the figure is shown either way.
    if (ratedW !== undefined && ratedW * 2 < installedWp)
      checks.push({
        id: 'system:pv:inverter-undersized',
        status: 'FAIL',
        source: 'CALCULATION',
        title: 'Photovoltaïque — l’onduleur est très inférieur au champ',
        detail: `${watts(ratedW)} d’onduleur pour ${(installedWp / 1000).toFixed(2)} kWc de modules : plus de la moitié de la production serait écrêtée.`,
        fix: {
          label: 'Voir sur le plan',
          tab: 'plan',
          objectIds: inverters.map(({ instanceId }) => instanceId),
        },
      });
  }
  // A battery charges from something. Without a source, its dispatch is a
  // simulation of an empty battery.
  const batteries = ofKinds(byKind, ['BATTERY', 'BATTERY_STORAGE']);
  if (batteries.length > 0 && inverters.length === 0)
    checks.push({
      id: 'system:pv:battery-without-inverter',
      status: 'UNKNOWN',
      source: 'CALCULATION',
      title: 'Stockage — la chaîne est interrompue',
      detail: `${batteries.map(label).join(', ')} : une batterie est posée, des modules aussi, et aucun onduleur ne les relie.`,
      fix: { label: 'Ouvrir les équipements', tab: 'equipment' },
    });
  return checks;
}

function waterChecks(
  run: CalculationRun,
  byKind: Readonly<Record<string, readonly ResolvedPlacedEquipment[]>>,
): readonly CheckItem[] {
  const checks: CheckItem[] = [];
  const dhw = outputsOf(run, 'dhw');
  const requiredL = number(dhw?.requiredStorageL);
  const tanks = ofKinds(byKind, ['DHW_TANK', 'THERMODYNAMIC_WATER_HEATER']);
  if (requiredL !== undefined && tanks.length > 0) {
    const volumeL = summed(tanks, 'tankVolumeL', 'nominalVolumeL');
    if (volumeL !== undefined && volumeL < requiredL)
      checks.push({
        id: 'system:dhw:tank-undersized',
        status: 'FAIL',
        source: 'CALCULATION',
        title: 'Eau chaude — le ballon posé est plus petit que le besoin',
        detail: `${volumeL.toFixed(0)} L posés pour ${requiredL.toFixed(0)} L de stockage utile calculés.`,
        fix: {
          label: 'Voir sur le plan',
          tab: 'plan',
          objectIds: tanks.map(({ instanceId }) => instanceId),
        },
      });
  }
  // The rain that falls on the roof against the tank that holds it.
  const rain = outputsOf(run, 'rainwater');
  const shortageL = number(rain?.shortageL);
  if (shortageL !== undefined && shortageL > 0) {
    const demandL = number(rain?.demandL);
    checks.push({
      id: 'system:rainwater:shortage',
      status: 'FAIL',
      source: 'CALCULATION',
      title: 'Eau de pluie — la cuve ne couvre pas les besoins',
      detail: `${shortageL.toFixed(0)} L manquent sur l’année${
        demandL === undefined ? '' : ` pour ${demandL.toFixed(0)} L demandés`
      } : la surface de collecte, le volume de la cuve ou la demande ne s’accordent pas.`,
      fix: { label: 'Ouvrir les réglages de calcul', tab: 'project' },
    });
  }
  return checks;
}
