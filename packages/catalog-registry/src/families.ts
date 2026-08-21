import { isHostType, HOST_TYPES } from '@house-technical-designer/core-domain';
import type { ClearanceZone } from './clearances.js';
import type { DataDomain, DataRegistry } from './registries.js';
import { isClearanceZone } from './clearances.js';
import { isDataDomain, isDataRegistry } from './registries.js';
import { isPortType } from './port-types.js';
import { isStatusAxis, isStatusValue, type FamilyStatus } from './status.js';

/** Where an object of this family may be put. */
export interface FamilyPlacement {
  /**
   * What it may be fixed to.
   *
   * A radiator hangs on a wall, a heat pump stands on the ground, a roof window
   * belongs to a roof. Naming it is what lets the editor refuse a placement
   * instead of drawing something that could not be built.
   */
  readonly allowedHosts: readonly string[];
  /** Whether it belongs to a storey at all: a parcel obstacle does not. */
  readonly levelRequired: boolean;
  readonly rotationAllowed: boolean;
}

/** Which drawings show an object of this family, and as what. */
export interface FamilyGraphics {
  readonly planSymbol?: string;
  readonly elevationSymbol?: string;
  readonly schematicSymbol?: string;
}

/**
 * One family of the master nomenclature.
 *
 * Not a catalogue entry: a family is what a catalogue entry is an entry *of*.
 * « HEAT_PUMP_AIR_WATER » says what such a thing is made of, connected by,
 * drawn as, computed by and how far the work on it has got; a definition then
 * says that this particular one is 8 kW.
 */
export interface FamilyDefinition {
  readonly id: string;
  readonly label: string;
  readonly domain: DataDomain;
  readonly registry: DataRegistry;
  /**
   * The wave this family belongs to.
   *
   * One to six, from the architectural house to the systems around it. A
   * priority is an order of work, not an importance: nothing here is optional.
   */
  readonly priority: number;
  /**
   * What an object of this family is always connected by.
   *
   * A radiator without its flow and its return is not a radiator that has
   * been simplified, it is one that cannot be routed. What is genuinely
   * conditional — the dimming line of a luminaire, the condensate drain of a
   * heat pump — belongs in `optionalPorts`, so that requiring the rest stays
   * meaningful.
   */
  readonly ports?: readonly string[];
  /** What such an object may also be connected by, without having to be. */
  readonly optionalPorts?: readonly string[];
  /** The calculation modules that read an object of this family. */
  readonly calculators?: readonly string[];
  readonly placement?: FamilyPlacement;
  readonly clearances?: readonly ClearanceZone[];
  readonly graphics?: FamilyGraphics;
  /** The property schema this family's entries are checked against. */
  readonly propertySchema?: string;
  readonly status?: FamilyStatus;
  readonly hint?: string;
}

/**
 * A family as a data file states it, before anything has been checked.
 *
 * The strict type says `domain: DataDomain`; a JSON file says `domain:
 * string`, and the difference between the two is exactly what validation
 * earns. Type-asserting the file into the strict shape and then « checking »
 * it is checking something the compiler has already been told is true.
 */
export interface FamilyCandidate extends Omit<
  FamilyDefinition,
  'domain' | 'registry' | 'ports' | 'optionalPorts' | 'clearances' | 'status'
> {
  readonly domain: string;
  readonly registry: string;
  readonly ports?: readonly string[];
  readonly optionalPorts?: readonly string[];
  readonly clearances?: readonly string[];
  readonly status?: Readonly<Record<string, string>>;
}

export interface FamilyIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Checks one family against everything else the registries declare.
 *
 * A family naming a port nobody defined, a clearance zone that does not exist
 * or a status axis that was renamed is a family that will silently do nothing
 * at the moment it is used. Three hundred of them are impossible to proof-read
 * by eye, which is exactly why this exists.
 */
export function validateFamily(
  family: FamilyCandidate,
  known: {
    readonly symbols: ReadonlySet<string>;
    readonly propertySchemas: ReadonlySet<string>;
    readonly calculators: ReadonlySet<string>;
  },
): readonly FamilyIssue[] {
  const issues: FamilyIssue[] = [];
  const at = (path: string, message: string) => issues.push({ path, message });
  if (family.id.trim() === '') at('id', 'must not be empty');
  if (!/^[A-Z][A-Z0-9_]*$/u.test(family.id))
    at('id', 'must be an upper-case identifier such as HEAT_PUMP_AIR_WATER');
  if (family.label.trim() === '') at('label', 'must not be empty');
  if (!isDataDomain(family.domain)) at('domain', `unknown ${family.domain}`);
  if (!isDataRegistry(family.registry))
    at('registry', `unknown ${family.registry}`);
  if (!Number.isInteger(family.priority) || family.priority < 1)
    at('priority', 'must be a wave number of at least one');
  for (const [index, port] of (family.ports ?? []).entries())
    if (!isPortType(port)) at(`ports/${index}`, `unknown port type ${port}`);
  for (const [index, port] of (family.optionalPorts ?? []).entries()) {
    if (!isPortType(port))
      at(`optionalPorts/${index}`, `unknown port type ${port}`);
    else if ((family.ports ?? []).includes(port))
      at(`optionalPorts/${index}`, `${port} is already required`);
  }
  for (const [index, zone] of (family.clearances ?? []).entries())
    if (!isClearanceZone(zone))
      at(`clearances/${index}`, `unknown clearance zone ${zone}`);
  for (const [index, calculator] of (family.calculators ?? []).entries())
    if (!known.calculators.has(calculator))
      at(`calculators/${index}`, `unknown calculation module ${calculator}`);
  for (const [axis, value] of Object.entries(family.status ?? {})) {
    if (!isStatusAxis(axis)) at(`status/${axis}`, `unknown status axis`);
    else if (!isStatusValue(value))
      at(`status/${axis}`, `unknown status value ${value}`);
  }
  for (const [key, symbolId] of Object.entries(family.graphics ?? {}))
    if (typeof symbolId === 'string' && !known.symbols.has(symbolId))
      at(`graphics/${key}`, `unknown symbol ${symbolId}`);
  if (
    family.propertySchema !== undefined &&
    !known.propertySchemas.has(family.propertySchema)
  )
    at('propertySchema', `unknown schema ${family.propertySchema}`);
  // A family whose entries are placed in the building has to say where they
  // may go; one that describes a material or a product has nothing to place.
  const placeable =
    family.registry === 'EQUIPMENT' || family.registry === 'OPENING';
  if (placeable && family.placement === undefined)
    at('placement', 'a placed family must say what it may be fixed to');
  // « Fixed to a wall » only means something if the application knows what a
  // wall is. A free string here would let `WALL`, `Wall` and `MUR` all be
  // written, none of them matching anything the editor can offer.
  const hosts = family.placement?.allowedHosts ?? [];
  if (family.placement !== undefined && hosts.length === 0)
    at('placement/allowedHosts', 'must name at least one support');
  for (const [index, host] of hosts.entries())
    if (!isHostType(host))
      at(
        `placement/allowedHosts/${index}`,
        `unknown support ${host}; the supports are ${HOST_TYPES.join(', ')}`,
      );
  return issues;
}
