import {
  isClearanceZone,
  isDataDomain,
  isDataRegistry,
  portRequirement,
  unknownPortKinds,
  type ClearanceZone,
  type DataDomain,
  type DataRegistry,
  type PortRequirementCandidate,
} from '@house-technical-designer/technical-types';
import { isHostType, HOST_TYPES } from '@house-technical-designer/core-domain';
import {
  isMeasuredAxis,
  isStatusAxis,
  isStatusValue,
  type FamilyStatus,
} from './status.js';
import {
  validateCapabilities,
  type CatalogCapability,
} from './capabilities.js';
import {
  CATALOG_WAVES,
  DEFAULT_LIFECYCLE,
  isCatalogLifecycle,
  isCatalogWave,
  type CatalogLifecycle,
  type CatalogWave,
} from './catalog-identity.js';
import { isEquipmentCategory } from '@house-technical-designer/equipment-catalog';
import { isMaterialCategory } from '@house-technical-designer/materials';
import { isAssemblyCategory } from '@house-technical-designer/assemblies';
import { isOpeningCategory } from '@house-technical-designer/opening-catalog';

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
  readonly priority: CatalogWave;
  /**
   * Where this family stands in its own life.
   *
   * Absent means in service. A nomenclature that can only grow is one nobody
   * can correct: the day a family turns out to be wrong, the choice is between
   * changing it underneath every project that used it and leaving it there for
   * ever.
   */
  readonly lifecycle?: CatalogLifecycle;
  /** Which family to use instead, once this one is leaving service. */
  readonly replacedBy?: string;
  readonly retiredReason?: string;
  /**
   * What may be done with a thing of this family that nothing else implies.
   *
   * Only the capabilities that are genuine decisions: whether it is a layer of
   * an assembly, whether it pierces a wall, whether it is counted. The rest —
   * placeable, connectable, drawn, calculated — are read from what the family
   * already declares and must not be written down. `capabilitiesOf` gives the
   * whole answer; this field alone gives the half somebody typed.
   */
  readonly capabilities?: readonly CatalogCapability[];
  /**
   * The coarse grouping the interface sorts and filters by.
   *
   * Said here and nowhere else. It used to be stated on every catalogue entry,
   * beside a `kind` that said almost the same thing, and at nineteen entries
   * the two had already parted company.
   */
  readonly category?: string;
  /**
   * What an object of this family is always connected by.
   *
   * A radiator without its flow and its return is not a radiator that has
   * been simplified, it is one that cannot be routed. What is genuinely
   * conditional — the dimming line of a luminaire, the condensate drain of a
   * heat pump — belongs in `optionalPorts`, so that requiring the rest stays
   * meaningful.
   */
  readonly ports?: readonly PortRequirementCandidate[];
  /** What such an object may also be connected by, without having to be. */
  readonly optionalPorts?: readonly PortRequirementCandidate[];
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
  | 'domain'
  | 'registry'
  | 'ports'
  | 'optionalPorts'
  | 'clearances'
  | 'status'
  | 'priority'
  | 'lifecycle'
  | 'capabilities'
> {
  readonly domain: string;
  readonly registry: string;
  readonly priority: number;
  readonly lifecycle?: string;
  readonly capabilities?: readonly string[];
  readonly ports?: readonly PortRequirementCandidate[];
  readonly optionalPorts?: readonly PortRequirementCandidate[];
  readonly clearances?: readonly string[];
  readonly status?: Readonly<Record<string, string>>;
}

/** Whether the coarse grouping belongs to the list its registry groups by. */
function categoryFits(family: FamilyCandidate): boolean {
  const category = family.category ?? '';
  switch (family.registry) {
    case 'MATERIAL':
      return isMaterialCategory(category);
    case 'ASSEMBLY':
      return isAssemblyCategory(category);
    case 'OPENING':
      return isOpeningCategory(category);
    default:
      return isEquipmentCategory(category);
  }
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
    /** Every family identifier, so a replacement can be checked to exist. */
    readonly families?: ReadonlySet<string>;
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
  // A wave is one of six batches of work, not a free integer: a family written
  // into wave 9 would simply never appear in any plan of work, silently,
  // because nothing would be looking for a wave 9.
  if (!Number.isInteger(family.priority) || !isCatalogWave(family.priority))
    at(
      'priority',
      `must be one of the ${CATALOG_WAVES.length} waves of work, from 1 to ${CATALOG_WAVES.length}`,
    );
  const lifecycle = family.lifecycle ?? DEFAULT_LIFECYCLE;
  if (!isCatalogLifecycle(lifecycle))
    at('lifecycle', `unknown lifecycle ${lifecycle}`);
  const retired = lifecycle === 'DEPRECATED' || lifecycle === 'WITHDRAWN';
  if (
    retired &&
    family.replacedBy === undefined &&
    family.retiredReason === undefined
  )
    at(
      'lifecycle',
      'a family leaving service must name its replacement or say why it has none',
    );
  if (!retired && family.replacedBy !== undefined)
    at('replacedBy', 'a family in service is not replaced by another');
  if (family.replacedBy === family.id)
    at('replacedBy', 'a family cannot replace itself');
  else if (
    family.replacedBy !== undefined &&
    known.families !== undefined &&
    !known.families.has(family.replacedBy)
  )
    at('replacedBy', `unknown family ${family.replacedBy}`);
  for (const issue of validateCapabilities(family)) issues.push(issue);
  // The one place the coarse grouping is stated, and each registry groups by
  // its own closed list: a material is INSULATION or MASONRY, an equipment is
  // a HEAT_PUMP, and a value outside the list its registry uses would sort and
  // filter into a bucket no screen offers.
  if (family.category !== undefined && !categoryFits(family))
    at(
      'category',
      `${family.category} is not a category of the ${family.registry} registry`,
    );
  const required = (family.ports ?? []).map(portRequirement);
  for (const [index, requirement] of required.entries()) {
    for (const kind of unknownPortKinds(requirement))
      at(`ports/${index}`, `unknown port type ${kind}`);
    if (requirement.anyOf.length === 0)
      at(`ports/${index}`, 'names no port kind at all');
    if (!Number.isInteger(requirement.minCount) || requirement.minCount < 0)
      at(
        `ports/${index}`,
        'must ask for a whole number of ports, at least zero',
      );
    if (
      requirement.maxCount !== undefined &&
      requirement.maxCount < requirement.minCount
    )
      at(
        `ports/${index}`,
        'takes fewer ports than it needs, which nothing can satisfy',
      );
  }
  const alreadyRequired = new Set(required.flatMap(({ anyOf }) => anyOf));
  for (const [index, candidate] of (family.optionalPorts ?? []).entries()) {
    const requirement = portRequirement(candidate);
    for (const kind of unknownPortKinds(requirement))
      at(`optionalPorts/${index}`, `unknown port type ${kind}`);
    for (const kind of requirement.anyOf)
      if (alreadyRequired.has(kind))
        at(`optionalPorts/${index}`, `${kind} is already required`);
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
    // Seventy-one families declared a plan symbol was ready and not one of
    // them named a symbol. An axis that can be measured is measured.
    else if (isMeasuredAxis(axis))
      at(
        `status/${axis}`,
        'is measured from the registries and must not be written down',
      );
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
