import {
  DATA_DOMAINS,
  DATA_DOMAIN_LABELS,
  FAMILY_REGISTRY,
  STATUS_AXES,
  completeness,
  familyStatus,
  portRequirement,
  portType,
  schemaOfFamily,
  statusOf,
  CLEARANCE_LABELS,
  type DataDomain,
  type FamilyDefinition,
  type StatusValue,
} from '@house-technical-designer/catalog-registry';
import {
  HOST_TYPE_LABELS,
  isHostType,
} from '@house-technical-designer/core-domain';
import type { CatalogSummary } from '@house-technical-designer/catalog-registry';

export interface CatalogFilter {
  readonly search?: string;
  readonly domain?: DataDomain;
  readonly wave?: number;
  /** Only the families somebody can actually place something from today. */
  readonly withGenericData?: boolean;
  /**
   * Whether the families that have left service are listed too.
   *
   * They are not, by default. A retired family still opens the projects that
   * hold it — that is the whole point of retiring rather than deleting — and
   * offering it beside the family that replaced it is how a duplicate comes
   * back the day after it was merged. Somebody reading the nomenclature to
   * understand it can still ask for them.
   */
  readonly withRetired?: boolean;
}

export interface CatalogRow {
  readonly familyId: string;
  readonly label: string;
  readonly domain: DataDomain;
  readonly domainLabel: string;
  readonly wave: number;
  /** Between 0 and 1, every axis weighing the same. */
  readonly progress: number;
  readonly entryCount: number;
  /** What replaces this family, when it has left service. */
  readonly replacedBy?: string;
  readonly retiredReason?: string;
}

/**
 * The nomenclature, filtered, as a list somebody can read.
 *
 * Five hundred and eighteen families do not go in a panel that lists nineteen
 * catalogue entries; and the panel that listed nineteen was the whole of what
 * the interface knew about a nomenclature the rest of the application had been
 * checking for weeks. The filters are what make the size usable: a trade, a
 * wave, a word, and « what can I actually place today ».
 */
export function catalogRows(
  summariesByFamily: Readonly<Record<string, readonly CatalogSummary[]>>,
  known: Parameters<typeof familyStatus>[1],
  filter: CatalogFilter = {},
): readonly CatalogRow[] {
  const needle = (filter.search ?? '').trim().toLowerCase();
  return FAMILY_REGISTRY.filter((family) => {
    if (
      filter.withRetired !== true &&
      (family.lifecycle ?? 'ACTIVE') !== 'ACTIVE'
    )
      return false;
    if (filter.domain !== undefined && family.domain !== filter.domain)
      return false;
    if (filter.wave !== undefined && family.priority !== filter.wave)
      return false;
    const entries = summariesByFamily[family.id] ?? [];
    if (filter.withGenericData === true && entries.length === 0) return false;
    if (needle === '') return true;
    return (
      family.label.toLowerCase().includes(needle) ||
      family.id.toLowerCase().includes(needle) ||
      entries.some((entry) => entry.label.toLowerCase().includes(needle))
    );
  })
    .map((family) => ({
      familyId: family.id,
      label: family.label,
      domain: family.domain,
      domainLabel: DATA_DOMAIN_LABELS[family.domain],
      wave: family.priority,
      progress: completeness(familyStatus(family.id, known)),
      entryCount: (summariesByFamily[family.id] ?? []).length,
      ...(family.replacedBy === undefined
        ? {}
        : { replacedBy: family.replacedBy }),
      ...(family.retiredReason === undefined
        ? {}
        : { retiredReason: family.retiredReason }),
    }))
    .sort(
      (first, second) =>
        second.progress - first.progress ||
        first.label.localeCompare(second.label, 'fr'),
    );
}

export interface CatalogAxis {
  readonly axis: string;
  readonly value: StatusValue;
}

export interface CatalogFamilyView {
  readonly family: FamilyDefinition;
  readonly domainLabel: string;
  readonly ports: readonly string[];
  readonly optionalPorts: readonly string[];
  readonly hosts: readonly string[];
  readonly clearances: readonly string[];
  readonly calculators: readonly string[];
  readonly properties: readonly {
    readonly key: string;
    readonly label: string;
    readonly unit?: string;
    readonly source: string;
  }[];
  readonly axes: readonly CatalogAxis[];
  /**
   * The rows of this family, not its fiches.
   *
   * A browser shows a name, a family and a version; it used to be handed whole
   * catalogue entries — ports, clearances, performance maps and every figure —
   * to draw that. Invisible at nineteen entries, and the reason the panel
   * takes four seconds to open at ten thousand. The body is fetched from the
   * repository when somebody actually places one.
   */
  readonly entries: readonly CatalogSummary[];
}

/** Everything the nomenclature holds about one family, in words. */
export function catalogFamilyView(
  familyId: string,
  summariesByFamily: Readonly<Record<string, readonly CatalogSummary[]>>,
  known: Parameters<typeof familyStatus>[1],
): CatalogFamilyView | undefined {
  const found = FAMILY_REGISTRY.find(({ id }) => id === familyId);
  if (found === undefined) return undefined;
  const named = (candidates: readonly unknown[] | undefined) =>
    (candidates ?? []).map((candidate) => {
      const requirement = portRequirement(
        candidate as Parameters<typeof portRequirement>[0],
      );
      const labels = requirement.anyOf
        .map((id) => portType(id)?.label ?? id)
        .join(' ou ');
      return requirement.minCount === 1 && requirement.maxCount === 1
        ? labels
        : `${labels} (${requirement.minCount}${
            requirement.maxCount === undefined
              ? '+'
              : `–${requirement.maxCount}`
          })`;
    });
  const status = familyStatus(familyId, known);
  return {
    family: found,
    domainLabel: DATA_DOMAIN_LABELS[found.domain],
    ports: named(found.ports),
    optionalPorts: named(found.optionalPorts),
    hosts: (found.placement?.allowedHosts ?? []).map((host) =>
      isHostType(host) ? HOST_TYPE_LABELS[host] : host,
    ),
    clearances: (found.clearances ?? []).map((zone) => CLEARANCE_LABELS[zone]),
    calculators: [...(found.calculators ?? [])],
    properties: (schemaOfFamily(familyId)?.properties ?? []).map(
      (property) => ({
        key: property.key,
        label: property.label,
        ...(property.unit === undefined ? {} : { unit: property.unit }),
        source: property.source,
      }),
    ),
    axes: STATUS_AXES.map((axis) => ({ axis, value: statusOf(status, axis) })),
    entries: summariesByFamily[familyId] ?? [],
  };
}

/** The trades that actually hold families, for the filter to offer. */
export const CATALOG_DOMAINS: readonly {
  readonly id: DataDomain;
  readonly label: string;
}[] = DATA_DOMAINS.filter((domain) =>
  FAMILY_REGISTRY.some((family) => family.domain === domain),
).map((domain) => ({ id: domain, label: DATA_DOMAIN_LABELS[domain] }));
