import type { FamilyDefinition } from './families.js';
import {
  STATUS_AXES,
  completeness,
  statusOf,
  type StatusAxis,
  type StatusValue,
} from './status.js';
import { DATA_DOMAINS, type DataDomain } from './registries.js';

export interface AxisCount {
  readonly axis: StatusAxis;
  readonly counts: Readonly<Record<StatusValue, number>>;
}

/** How many families sit at each status, axis by axis. */
export function axisCounts(
  families: readonly FamilyDefinition[],
): readonly AxisCount[] {
  return STATUS_AXES.map((axis) => {
    const counts: Record<StatusValue, number> = {
      NONE: 0,
      PARTIAL: 0,
      READY: 0,
      VALIDATED: 0,
    };
    for (const entry of families)
      counts[statusOf(entry.status ?? {}, axis)] += 1;
    return { axis, counts };
  });
}

export interface DomainProgress {
  readonly domain: DataDomain;
  readonly families: number;
  /** Between 0 and 1, every axis weighing the same. */
  readonly completeness: number;
}

export function domainProgress(
  families: readonly FamilyDefinition[],
): readonly DomainProgress[] {
  return DATA_DOMAINS.map((domain) => {
    const own = families.filter((entry) => entry.domain === domain);
    const total = own.reduce(
      (sum, entry) => sum + completeness(entry.status ?? {}),
      0,
    );
    return {
      domain,
      families: own.length,
      completeness: own.length === 0 ? 0 : total / own.length,
    };
  }).filter(({ families: count }) => count > 0);
}

/**
 * The families a wave still has to work on, least advanced first.
 *
 * This is the queue. Each line is work someone can pick up without talking to
 * anybody: the family says what it is, what it connects with, what reads it,
 * and how far it has got.
 */
export function pendingOfWave(
  families: readonly FamilyDefinition[],
  priority: number,
): readonly FamilyDefinition[] {
  return families
    .filter((entry) => entry.priority === priority)
    .filter((entry) => completeness(entry.status ?? {}) < 1)
    .sort(
      (first, second) =>
        completeness(first.status ?? {}) - completeness(second.status ?? {}) ||
        first.id.localeCompare(second.id),
    );
}
