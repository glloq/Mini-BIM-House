import type { Point3D } from '@house-technical-designer/geometry';
import type { ClearanceZone } from '@house-technical-designer/technical-types';
import type { ComponentCategory, ComponentInstance } from './component.js';
import type { EquipmentDefinition, JsonValue, Project } from './types.js';

/**
 * One thing standing in the building, with everything known about it.
 *
 * The model held the two halves apart and nothing put them together. A
 * catalogue entry said what a heat pump of that model is; a component said
 * where this one stands. The calculations read the first and never the second,
 * so a project with three radiators and a project with one were the same
 * project as far as heating was concerned — and moving something changed
 * nothing at all.
 *
 * Derived, and never written to the project. It is the entry and the placement
 * seen together, and storing it would be a second answer to a question the
 * model already answers — one that stops agreeing the moment either half
 * changes.
 */
export interface ResolvedPlacedEquipment {
  readonly instanceId: string;
  readonly definitionId?: string;
  readonly definitionVersion?: string;
  readonly familyId?: string;
  /** What the catalogue calls this kind of thing: `RADIATOR`, `LUMINAIRE`. */
  readonly kind?: string;
  /**
   * The coarse grouping the fiche states, when it states one.
   *
   * `category` on this object is the *discipline* a plan reads — heating,
   * sanitary, electrical. This is the other one: what the catalogue calls the
   * thing. Both are needed, and conflating them is how a radiator came to be
   * grouped under « chauffage » and found by nothing looking for radiators.
   */
  readonly catalogCategory?: string;
  readonly category: ComponentCategory;
  readonly name?: string;
  readonly levelId: string;
  readonly spaceId?: string;
  readonly hostObjectId?: string;
  /** Where it stands, the height counted from the ground rather than the floor. */
  readonly position: Point3D;
  readonly rotationDeg: number;
  /** What the model says, the same for every one of them. */
  readonly definitionProperties: Readonly<Record<string, JsonValue>>;
  /** What this one carries beyond its model. */
  readonly instanceProperties: Readonly<Record<string, JsonValue>>;
  /** The two seen together, the instance winning. */
  readonly resolvedProperties: Readonly<Record<string, JsonValue>>;
  readonly ports: readonly {
    readonly id: string;
    readonly portTypeId?: string;
  }[];
  /** The zones this kind of thing has, measured or not. */
  readonly requiredClearances: readonly ClearanceZone[];
  readonly clearances: readonly {
    readonly zone: ClearanceZone;
    readonly frontMm?: number;
    readonly backMm?: number;
    readonly leftMm?: number;
    readonly rightMm?: number;
    readonly aboveMm?: number;
    readonly belowMm?: number;
    readonly reason?: string;
  }[];
  readonly dimensions?: {
    readonly widthMm?: number;
    readonly depthMm?: number;
    readonly heightMm?: number;
  };
  readonly provenance?: EquipmentDefinition['provenance'];
  /**
   * What is wrong with this placement, said rather than absorbed.
   *
   * A component naming a model the project no longer holds, or pinning a
   * version the project's own copy has moved past, is reported here: the
   * calculations must be able to say « designed with figures that are no
   * longer these » instead of quietly using whichever ones are loaded.
   */
  readonly issues: readonly string[];
}

function resolveOne(
  component: ComponentInstance,
  levelElevationMm: number,
  definition: EquipmentDefinition | undefined,
): ResolvedPlacedEquipment {
  const issues: string[] = [];
  if (component.definitionId !== undefined && definition === undefined)
    issues.push(`names no model the project holds: ${component.definitionId}`);
  if (
    definition?.version !== undefined &&
    component.definitionVersion !== undefined &&
    definition.version !== component.definitionVersion
  )
    issues.push(
      `was placed with ${component.definitionId}@${component.definitionVersion}, and the project now holds ${definition.version}`,
    );
  const name = component.name ?? definition?.name;
  const definitionProperties = definition?.properties ?? {};
  const instanceProperties = component.properties ?? {};
  return {
    instanceId: component.id,
    ...(component.definitionId === undefined
      ? {}
      : { definitionId: component.definitionId }),
    ...(component.definitionVersion === undefined
      ? {}
      : { definitionVersion: component.definitionVersion }),
    ...(definition?.familyId === undefined
      ? {}
      : { familyId: definition.familyId }),
    ...(definition?.kind === undefined ? {} : { kind: definition.kind }),
    ...(definition?.category === undefined
      ? {}
      : { catalogCategory: definition.category }),
    category: component.category,
    ...(name === undefined ? {} : { name }),
    levelId: component.levelId,
    ...(component.spaceId === undefined ? {} : { spaceId: component.spaceId }),
    ...(component.hostObjectId === undefined
      ? {}
      : { hostObjectId: component.hostObjectId }),
    // Absolute, like a roof elevation and like a network node: a calculation
    // comparing two storeys cannot do it from two heights above two floors.
    position: {
      x: component.position.x,
      y: component.position.y,
      z: levelElevationMm + component.elevationMm,
    },
    rotationDeg: component.rotationDeg,
    definitionProperties,
    instanceProperties,
    resolvedProperties: { ...definitionProperties, ...instanceProperties },
    ports: definition?.ports ?? [],
    clearances: definition?.clearances ?? [],
    requiredClearances: definition?.requiredClearances ?? [],
    ...(definition?.dimensions === undefined
      ? {}
      : { dimensions: definition.dimensions }),
    ...(definition?.provenance === undefined
      ? {}
      : { provenance: definition.provenance }),
    issues,
  };
}

/** Everything placed in the building, resolved against what the project holds. */
export function placedEquipment(
  project: Project,
): readonly ResolvedPlacedEquipment[] {
  const definitions = new Map(
    (project.equipment ?? []).map((entry) => [entry.id, entry]),
  );
  return project.building.levels.flatMap((level) =>
    (level.components ?? []).map((component) =>
      resolveOne(
        component,
        level.elevationMm,
        component.definitionId === undefined
          ? undefined
          : definitions.get(component.definitionId),
      ),
    ),
  );
}

function grouped<T extends string>(
  placed: readonly ResolvedPlacedEquipment[],
  key: (one: ResolvedPlacedEquipment) => T | undefined,
): Readonly<Record<string, readonly ResolvedPlacedEquipment[]>> {
  const groups: Record<string, ResolvedPlacedEquipment[]> = {};
  for (const one of placed) {
    const found = key(one);
    if (found === undefined) continue;
    (groups[found] ??= []).push(one);
  }
  return groups;
}

export function placedEquipmentByFamily(
  placed: readonly ResolvedPlacedEquipment[],
): Readonly<Record<string, readonly ResolvedPlacedEquipment[]>> {
  return grouped(placed, ({ familyId }) => familyId);
}

/**
 * The word this application asks an equipment by, and the word a fiche answers.
 *
 * Two vocabularies for one idea. `kind` — `PHOTOVOLTAIC`, `LUMINAIRE`, `FAN` —
 * is what the calculation adapters ask for, and it is what an equipment carried
 * before `familyId` and a coarse `category` replaced it. The catalogue has
 * spoken the new one ever since; nothing that reads equipment moved, so a
 * project made of catalogue fiches grouped under `undefined` and every module
 * reported the same thing: nobody has stated this.
 *
 * It went unseen because the one fixture that runs the modules predated the
 * catalogue and still carried the old shape. The day it was rebuilt from
 * fiches — which is what a reference house is for — three modules stopped
 * finding anything.
 *
 * One explicit table, in one place, like the material loader's `MODEL_FIELD`.
 * Folding the two into one is a format migration and a decision of its own;
 * what must not happen meanwhile is that they silently disagree.
 */
const KIND_OF_CATEGORY: Readonly<Record<string, string>> = {
  PV_MODULE: 'PHOTOVOLTAIC',
  LUMINAIRE: 'LUMINAIRE',
  FAN: 'FAN',
  BATTERY: 'BATTERY',
  DISTRIBUTION_BOARD: 'DISTRIBUTION_BOARD',
};

/** What an equipment is, whichever vocabulary states it. */
export function equipmentKindOf(entry: {
  readonly kind?: string;
  readonly catalogCategory?: string;
  readonly category?: string;
}): string | undefined {
  // A catalogue snapshot writes the coarse category into `kind` as well, so
  // the word has to go through the table wherever it arrived from. A project
  // written before the catalogue says `PHOTOVOLTAIC`, which the table does not
  // hold and therefore does not touch.
  const held = entry.kind ?? entry.catalogCategory;
  return held === undefined ? undefined : (KIND_OF_CATEGORY[held] ?? held);
}

export function placedEquipmentByKind(
  placed: readonly ResolvedPlacedEquipment[],
): Readonly<Record<string, readonly ResolvedPlacedEquipment[]>> {
  return grouped(placed, equipmentKindOf);
}

export function placedEquipmentBySpace(
  placed: readonly ResolvedPlacedEquipment[],
): Readonly<Record<string, readonly ResolvedPlacedEquipment[]>> {
  return grouped(placed, ({ spaceId }) => spaceId);
}
