import { levelEntities, type EntityFamily } from './entity-index.js';
import type { Level } from './types.js';

/**
 * What a thing can be fixed to.
 *
 * A family says a radiator hangs on a wall and a heat pump stands on the
 * ground; until the list of answers was closed, that sentence was a free
 * string, and `WALL`, `Wall` and `MUR` were three different supports none of
 * which matched the others. Naming them is what lets the editor refuse a
 * placement instead of drawing something that could not be built.
 */
export const HOST_TYPES = [
  'WALL',
  'SLAB',
  'CEILING',
  'ROOF',
  'SITE',
  'OPENING',
  'DISTRIBUTION_BOARD',
] as const;
export type HostType = (typeof HOST_TYPES)[number];

export const HOST_TYPE_LABELS: Readonly<Record<HostType, string>> = {
  WALL: 'Mur',
  SLAB: 'Dalle',
  CEILING: 'Plafond',
  ROOF: 'Toiture',
  SITE: 'Terrain',
  OPENING: 'Baie',
  DISTRIBUTION_BOARD: 'Tableau',
};

export function isHostType(value: string): value is HostType {
  return (HOST_TYPES as readonly string[]).includes(value);
}

/**
 * Which objects of the model can serve as each kind of support.
 *
 * A ceiling is not an object: it is the underside of the slab above, and the
 * thing a luminaire is fixed to is that slab. The site is not an object
 * either — something standing on the ground is hosted by nothing, which is why
 * `SITE` claims no family and a component placed there carries no host.
 *
 * Whole roofs are here as well as roof planes. Leaving them out was how a roof
 * window could be drawn on a roof the editor then refused to recognise as a
 * support.
 */
export const HOST_FAMILIES: Readonly<
  Record<HostType, readonly EntityFamily[]>
> = {
  WALL: ['WALL'],
  SLAB: ['SLAB'],
  CEILING: ['SLAB'],
  ROOF: ['ROOF_PLANE', 'ROOF_STRUCTURE'],
  SITE: [],
  OPENING: ['OPENING'],
  DISTRIBUTION_BOARD: ['COMPONENT'],
};

/**
 * What each object of a storey can be a support for.
 *
 * One slab answers for two supports — it is a floor from above and a ceiling
 * from below — so the answer is a set rather than a single kind.
 */
export function levelHosts(
  level: Level,
): ReadonlyMap<string, ReadonlySet<HostType>> {
  const byFamily = new Map<EntityFamily, HostType[]>();
  for (const host of HOST_TYPES)
    for (const family of HOST_FAMILIES[host])
      byFamily.set(family, [...(byFamily.get(family) ?? []), host]);
  const hosts = new Map<string, ReadonlySet<HostType>>();
  for (const { id, family } of levelEntities(level)) {
    const kinds = byFamily.get(family);
    if (kinds !== undefined) hosts.set(id, new Set(kinds));
  }
  return hosts;
}

/**
 * Whether a placement a family allows can be satisfied by this object.
 *
 * A family that allows nothing but the site has no host to check; anything
 * else has to be fixed to something of a kind it accepts.
 */
export function hostAccepts(
  allowedHosts: readonly string[],
  hosted: ReadonlySet<HostType> | undefined,
): boolean {
  if (hosted === undefined) return false;
  return allowedHosts.some((host) => isHostType(host) && hosted.has(host));
}
