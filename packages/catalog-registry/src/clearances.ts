/**
 * The room an object needs around it, and what for.
 *
 * « Physical » is what the object occupies; everything else is space nobody may
 * build in for a reason, and the reasons are not the same. Maintenance space
 * can be shared with a corridor and cannot be shared with a wall; an air intake
 * cannot be shared with an air exhaust; a combustible clearance is a fire rule
 * and not a convenience. One list of « clearance in millimetres » cannot say
 * any of that.
 */
export const CLEARANCE_ZONES = [
  'PHYSICAL',
  'INSTALLATION',
  'MAINTENANCE',
  'SERVICE',
  'USAGE',
  'ACCESSIBILITY',
  'OPENING',
  'AIR_INTAKE',
  'AIR_EXHAUST',
  'THERMAL',
  'FIRE',
  'COMBUSTIBLE_CLEARANCE',
  'ELECTRICAL_WORKING',
] as const;
export type ClearanceZone = (typeof CLEARANCE_ZONES)[number];

export const CLEARANCE_LABELS: Readonly<Record<ClearanceZone, string>> = {
  PHYSICAL: 'Encombrement',
  INSTALLATION: 'Pose',
  MAINTENANCE: 'Entretien',
  SERVICE: 'Intervention',
  USAGE: 'Usage',
  ACCESSIBILITY: 'Accessibilité',
  OPENING: 'Débattement d’ouverture',
  AIR_INTAKE: 'Prise d’air',
  AIR_EXHAUST: 'Rejet d’air',
  THERMAL: 'Dégagement thermique',
  FIRE: 'Dégagement au feu',
  COMBUSTIBLE_CLEARANCE: 'Distance aux matériaux combustibles',
  ELECTRICAL_WORKING: 'Zone de travail électrique',
};

export function isClearanceZone(value: string): value is ClearanceZone {
  return (CLEARANCE_ZONES as readonly string[]).includes(value);
}

/**
 * How much room one zone needs, and on which side.
 *
 * A single « clearance in millimetres » cannot describe an appliance: a heat
 * pump wants two metres in front of its fan and a hundred millimetres behind
 * it, and a boiler wants its service space where the door opens rather than
 * evenly all around. Sides are local to the object, so a rotation moves them
 * with it.
 */
export interface ClearanceZoneDefinition {
  readonly zone: ClearanceZone;
  /** Away from the face the thing is used or serviced from. */
  readonly frontMm?: number;
  readonly backMm?: number;
  readonly leftMm?: number;
  readonly rightMm?: number;
  readonly aboveMm?: number;
  readonly belowMm?: number;
  /** Why this room is needed: a rule, a manual, a trade practice. */
  readonly reason?: string;
}

/** Where a thing stands, in the units the model stores. */
export interface ClearancePlacement {
  readonly objectId: string;
  /** The centre of its footprint, on its storey. */
  readonly position: { readonly x: number; readonly y: number };
  /** The underside, above the storey. */
  readonly elevationMm: number;
  /** Counter-clockwise from east, as everything placed in this model is. */
  readonly rotationDeg: number;
  /** Across the front, front to back, and floor to top. */
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

/**
 * One zone of one placed object, in the coordinates of the storey.
 *
 * Derived, and never written to the project: it is the definition and the
 * placement seen together, and storing it would be a second answer to a
 * question the model already answers — one that stops agreeing the moment the
 * thing is moved.
 */
export interface ClearanceZoneInstance {
  readonly zone: ClearanceZone;
  readonly objectId: string;
  /** The four corners, turned with the object. */
  readonly footprint: readonly { readonly x: number; readonly y: number }[];
  readonly baseMm: number;
  readonly topMm: number;
  readonly reason?: string;
}

/** The room a placed object claims, zone by zone. */
export function clearanceZones(
  placement: ClearancePlacement,
  definitions: readonly ClearanceZoneDefinition[],
): readonly ClearanceZoneInstance[] {
  return definitions.map((definition) => {
    // Local axes: x from back to front, y from right to left, z upwards.
    const front = placement.depthMm / 2 + (definition.frontMm ?? 0);
    const back = placement.depthMm / 2 + (definition.backMm ?? 0);
    const left = placement.widthMm / 2 + (definition.leftMm ?? 0);
    const right = placement.widthMm / 2 + (definition.rightMm ?? 0);
    const radians = (placement.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const corner = (x: number, y: number) => ({
      x: placement.position.x + x * cos - y * sin,
      y: placement.position.y + x * sin + y * cos,
    });
    return {
      zone: definition.zone,
      objectId: placement.objectId,
      footprint: [
        corner(front, -right),
        corner(front, left),
        corner(-back, left),
        corner(-back, -right),
      ],
      baseMm: placement.elevationMm - (definition.belowMm ?? 0),
      topMm:
        placement.elevationMm + placement.heightMm + (definition.aboveMm ?? 0),
      ...(definition.reason === undefined ? {} : { reason: definition.reason }),
    };
  });
}

/**
 * What a zone tolerates sharing its space with.
 *
 * This is the whole reason the zones are named rather than counted. The square
 * metre in front of a boiler and the square metre in front of a washing
 * machine may be the same square metre — one person stands in it, and never in
 * both at once. The volume a heat pump draws its air from and the volume
 * another one blows its air into may not be the same volume, whatever the
 * distance between the two machines: sharing them is how a machine ends up
 * breathing its neighbour's exhaust.
 *
 * Each list is what the zone accepts; `PHYSICAL` accepts nothing, because two
 * solids cannot occupy one place and no clearance is clear if something stands
 * in it.
 */
const SHARED_WITH: Readonly<Record<ClearanceZone, readonly ClearanceZone[]>> = {
  PHYSICAL: [],
  // Room for a person: whoever installs, services, uses or reaches the thing
  // stands in the same place, one at a time.
  INSTALLATION: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'THERMAL',
    'FIRE',
    'COMBUSTIBLE_CLEARANCE',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  MAINTENANCE: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'THERMAL',
    'FIRE',
    'COMBUSTIBLE_CLEARANCE',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  SERVICE: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'THERMAL',
    'FIRE',
    'COMBUSTIBLE_CLEARANCE',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  USAGE: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'THERMAL',
    'FIRE',
    'COMBUSTIBLE_CLEARANCE',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  ACCESSIBILITY: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'THERMAL',
    'FIRE',
    'COMBUSTIBLE_CLEARANCE',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  OPENING: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'THERMAL',
    'FIRE',
    'COMBUSTIBLE_CLEARANCE',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  ELECTRICAL_WORKING: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'AIR_INTAKE',
    'AIR_EXHAUST',
  ],
  // Air: an intake and an exhaust in the same volume is a machine breathing
  // what it has just rejected, and no distance between the two makes that
  // acceptable.
  AIR_INTAKE: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'AIR_INTAKE',
  ],
  AIR_EXHAUST: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
    'ELECTRICAL_WORKING',
    'AIR_EXHAUST',
  ],
  // Heat: a person may stand there; nothing that burns may sit there, and two
  // things that both get hot may not warm each other.
  THERMAL: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
  ],
  FIRE: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
  ],
  COMBUSTIBLE_CLEARANCE: [
    'INSTALLATION',
    'MAINTENANCE',
    'SERVICE',
    'USAGE',
    'ACCESSIBILITY',
    'OPENING',
  ],
};

/**
 * Why two zones may not share the same space, when they may not.
 *
 * Says which pair and what for, because « conflict » alone is something a user
 * can read and not act on.
 */
export function clearanceRefusal(
  first: ClearanceZone,
  second: ClearanceZone,
): string | undefined {
  if (SHARED_WITH[first].includes(second)) return undefined;
  if (first === 'PHYSICAL' || second === 'PHYSICAL')
    return `${CLEARANCE_LABELS[first]} et ${CLEARANCE_LABELS[second]} : rien ne peut occuper le volume d’un autre objet.`;
  if (
    (first === 'AIR_INTAKE' && second === 'AIR_EXHAUST') ||
    (first === 'AIR_EXHAUST' && second === 'AIR_INTAKE')
  )
    return 'Prise d’air et rejet d’air : une machine respirerait ce qu’une autre vient de rejeter.';
  return `${CLEARANCE_LABELS[first]} et ${CLEARANCE_LABELS[second]} ne peuvent pas partager le même volume.`;
}

/** Whether two zones may occupy the same space. */
export function clearancesShare(
  first: ClearanceZone,
  second: ClearanceZone,
): boolean {
  return clearanceRefusal(first, second) === undefined;
}

export interface ClearanceConflict {
  readonly first: ClearanceZoneInstance;
  readonly second: ClearanceZoneInstance;
  readonly message: string;
}

/** Whether two heights meet at all. */
function heightsMeet(
  first: ClearanceZoneInstance,
  second: ClearanceZoneInstance,
): boolean {
  return first.baseMm < second.topMm && second.baseMm < first.topMm;
}

/**
 * Whether two convex footprints overlap.
 *
 * Separating axes: two convex shapes are apart exactly when some edge of one
 * of them has all of the other entirely on its far side. Footprints here are
 * rectangles turned with their object, so they are convex by construction.
 */
function footprintsMeet(
  first: readonly { readonly x: number; readonly y: number }[],
  second: readonly { readonly x: number; readonly y: number }[],
): boolean {
  for (const shape of [first, second])
    for (const [index, from] of shape.entries()) {
      const to = shape[(index + 1) % shape.length]!;
      const axis = { x: -(to.y - from.y), y: to.x - from.x };
      const spread = (points: readonly { x: number; y: number }[]) => {
        const values = points.map(
          (point) => point.x * axis.x + point.y * axis.y,
        );
        return { low: Math.min(...values), high: Math.max(...values) };
      };
      const one = spread(first);
      const other = spread(second);
      // Touching is not overlapping: two clearances may meet at a line.
      if (one.high <= other.low || other.high <= one.low) return false;
    }
  return true;
}

/**
 * Every pair of zones that share space they may not share.
 *
 * Zones of one object are left alone: its own physical volume is inside its
 * own maintenance space by construction, and reporting that would bury the
 * cases that matter.
 */
export function clearanceConflicts(
  zones: readonly ClearanceZoneInstance[],
): readonly ClearanceConflict[] {
  const conflicts: ClearanceConflict[] = [];
  for (const [index, first] of zones.entries())
    for (const second of zones.slice(index + 1)) {
      if (first.objectId === second.objectId) continue;
      const refusal = clearanceRefusal(first.zone, second.zone);
      if (refusal === undefined) continue;
      if (!heightsMeet(first, second)) continue;
      if (!footprintsMeet(first.footprint, second.footprint)) continue;
      conflicts.push({ first, second, message: refusal });
    }
  return conflicts;
}
