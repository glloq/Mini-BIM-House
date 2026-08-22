/**
 * What the application can do with a thing, said once, as a closed list.
 *
 * The engine used to ask `category === 'HEAT_PUMP'` and `registry ===
 * 'EQUIPMENT'` in a dozen places, which means that adding a family of a kind
 * nobody had foreseen — a rainwater filter, a fuse box, a solar diverter —
 * meant editing the engine. The rule this application is meant to obey is the
 * opposite one: *adding a family or ten thousand references must not require
 * any change to the engine at all.*
 *
 * A capability is the sentence that makes that possible. It says what may be
 * done with a family — placed, connected, drawn, priced — without saying what
 * the family is. A new family gets its behaviour by declaring what it can do;
 * the code branches on the capability, and never on the name.
 */
export const CATALOG_CAPABILITIES = [
  /** It is put somewhere in the building, on a support the editor knows. */
  'PLACEABLE',
  /** It is joined to other things by ports of the registry's kinds. */
  'CONNECTABLE',
  /** It needs room around it, in zones the family names. */
  'CLEARANCE_ZONED',
  /** It appears on a plan as a symbol. */
  'PLAN_DRAWN',
  /** It appears on a one-line or schematic drawing. */
  'SCHEMATIC_DRAWN',
  /** A run may be made of it: a pipe, a cable, a duct, a flue. */
  'RUN_MATERIAL',
  /** It is a layer of an assembly: a material with physical properties. */
  'LAYERED',
  /** It pierces a wall or a roof: a window, a door, a rooflight. */
  'PIERCING',
  /** Its performance varies with conditions and is tabulated, not constant. */
  'PERFORMANCE_MAPPED',
  /** A calculation module reads it. */
  'CALCULATED',
  /** It is counted in the bill of quantities. */
  'QUANTIFIED',
] as const;
export type CatalogCapability = (typeof CATALOG_CAPABILITIES)[number];

export const CATALOG_CAPABILITY_LABELS: Readonly<
  Record<CatalogCapability, string>
> = {
  PLACEABLE: 'Posé dans le bâtiment',
  CONNECTABLE: 'Raccordé par des ports',
  CLEARANCE_ZONED: 'Demande des dégagements',
  PLAN_DRAWN: 'Dessiné en plan',
  SCHEMATIC_DRAWN: 'Dessiné en schéma',
  RUN_MATERIAL: 'Constitue un tracé',
  LAYERED: 'Couche d’un assemblage',
  PIERCING: 'Perce une paroi',
  PERFORMANCE_MAPPED: 'Performance tabulée',
  CALCULATED: 'Lu par un calcul',
  QUANTIFIED: 'Compté en quantitatif',
};

export function isCatalogCapability(value: string): value is CatalogCapability {
  return (CATALOG_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * What a family already says about itself, read as capabilities.
 *
 * These are not written down anywhere and must not be: a family that declares
 * ports is connectable, and saying so a second time is how the two come to
 * disagree. It is the same rule as the measured status axes, for the same
 * reason — seventy-one families once claimed a plan symbol was ready and not
 * one of them named a symbol.
 */
export const DERIVED_CAPABILITIES = [
  'PLACEABLE',
  'CONNECTABLE',
  'CLEARANCE_ZONED',
  'PLAN_DRAWN',
  'SCHEMATIC_DRAWN',
  'RUN_MATERIAL',
  'LAYERED',
  'PIERCING',
  'CALCULATED',
] as const satisfies readonly CatalogCapability[];
export type DerivedCapability = (typeof DERIVED_CAPABILITIES)[number];

export function isDerivedCapability(value: string): value is DerivedCapability {
  return (DERIVED_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * What a family declares that nothing else can tell.
 *
 * Two of eleven. Whether a family's performance is tabulated rather than
 * constant, and whether it is counted in the quantities: each is a decision
 * about the family, not a consequence of another field, and each has to be
 * said. Everything else the family already implies.
 */
export const DECLARED_CAPABILITIES = CATALOG_CAPABILITIES.filter(
  (capability) => !isDerivedCapability(capability),
);

/** Whatever a family has to hold for its capabilities to be worked out. */
export interface CapabilitySubject {
  readonly ports?: readonly unknown[];
  readonly optionalPorts?: readonly unknown[];
  readonly clearances?: readonly unknown[];
  readonly calculators?: readonly string[];
  readonly placement?: unknown;
  readonly graphics?: {
    readonly planSymbol?: string;
    readonly schematicSymbol?: string;
  };
  readonly registry?: string;
  readonly capabilities?: readonly string[];
}

function has(list: readonly unknown[] | undefined): boolean {
  return list !== undefined && list.length > 0;
}

/** The capabilities a family's own declarations already imply. */
export function derivedCapabilities(
  family: CapabilitySubject,
): readonly DerivedCapability[] {
  const found: DerivedCapability[] = [];
  if (family.placement !== undefined) found.push('PLACEABLE');
  if (has(family.ports) || has(family.optionalPorts)) found.push('CONNECTABLE');
  if (has(family.clearances)) found.push('CLEARANCE_ZONED');
  if (family.graphics?.planSymbol !== undefined) found.push('PLAN_DRAWN');
  if (family.graphics?.schematicSymbol !== undefined)
    found.push('SCHEMATIC_DRAWN');
  if (family.registry === 'NETWORK_PRODUCT') found.push('RUN_MATERIAL');
  // A material is a layer of a build-up by being a material, and an opening
  // pierces a wall by being an opening. Writing either down would be the
  // second version of a sentence the registry already says.
  if (family.registry === 'MATERIAL') found.push('LAYERED');
  if (family.registry === 'OPENING') found.push('PIERCING');
  if (has(family.calculators)) found.push('CALCULATED');
  return found;
}

/**
 * Everything this family can do: what it implies, plus what it states.
 *
 * The one function anything branching on behaviour is meant to call. Reading
 * `family.capabilities` directly gets half the answer, which is worse than
 * none: it is the half somebody typed.
 */
export function capabilitiesOf(
  family: CapabilitySubject,
): readonly CatalogCapability[] {
  const found = new Set<CatalogCapability>(derivedCapabilities(family));
  for (const declared of family.capabilities ?? [])
    if (isCatalogCapability(declared) && !isDerivedCapability(declared))
      found.add(declared);
  return CATALOG_CAPABILITIES.filter((capability) => found.has(capability));
}

export function hasCapability(
  family: CapabilitySubject,
  capability: CatalogCapability,
): boolean {
  return capabilitiesOf(family).includes(capability);
}

export interface CapabilityIssue {
  readonly path: string;
  readonly message: string;
}

/** Everything wrong with what a family claims it can do. */
export function validateCapabilities(
  family: CapabilitySubject,
): readonly CapabilityIssue[] {
  const issues: CapabilityIssue[] = [];
  const seen = new Set<string>();
  for (const [index, declared] of (family.capabilities ?? []).entries()) {
    const at = (message: string) =>
      issues.push({ path: `capabilities/${index}`, message });
    if (!isCatalogCapability(declared)) at(`unknown capability ${declared}`);
    else if (isDerivedCapability(declared))
      at(
        `${declared} is read from what the family already declares and must not be written down`,
      );
    else if (seen.has(declared)) at(`${declared} is declared more than once`);
    seen.add(declared);
  }
  return issues;
}
