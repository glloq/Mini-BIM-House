declare const entityIdBrand: unique symbol;

/** A stable project-wide identity. IDs are opaque to prevent accidental mixing with labels. */
export type EntityId<Kind extends string = string> = string & {
  readonly [entityIdBrand]: Kind;
};

export type ProjectId = EntityId<'Project'>;
export type LevelId = EntityId<'Level'>;
export type BuildingId = EntityId<'Building'>;
export type SiteId = EntityId<'Site'>;
export type WallId = EntityId<'Wall'>;
export type OpeningId = EntityId<'Opening'>;
export type SpaceId = EntityId<'Space'>;
export type SlabId = EntityId<'Slab'>;
export type RoofPlaneId = EntityId<'RoofPlane'>;
export type ComponentInstanceId = EntityId<'ComponentInstance'>;
export type StairId = EntityId<'Stair'>;

export function entityId<Kind extends string = string>(
  value: string,
): EntityId<Kind> {
  if (value.trim().length === 0) {
    throw new TypeError('An entity ID must not be empty');
  }
  return value as EntityId<Kind>;
}

/**
 * Produces a new identity without coupling domain code to array positions.
 * The factory argument keeps ID creation deterministic in tests and import tools.
 */
export function createEntityId<Kind extends string = string>(
  factory: () => string = () => globalThis.crypto.randomUUID(),
): EntityId<Kind> {
  return entityId<Kind>(factory());
}
