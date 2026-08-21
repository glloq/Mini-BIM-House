import type { FamilyDefinition } from './families.js';
import {
  STATUS_AXES,
  completeness,
  statusOf,
  type FamilyStatus,
  type StatusAxis,
  type StatusValue,
} from './status.js';
import { DATA_DOMAINS, type DataDomain } from './registries.js';

/**
 * One family together with where it has actually got to.
 *
 * The status is passed in rather than read off the family, because five of the
 * sixteen axes are measured from the registries and not written down. A report
 * built from `family.status` alone would show the half somebody typed and
 * silently drop the half that is true.
 */
export interface FamilyReview {
  readonly family: FamilyDefinition;
  readonly status: FamilyStatus;
}

export interface AxisCount {
  readonly axis: StatusAxis;
  readonly counts: Readonly<Record<StatusValue, number>>;
}

/** How many families sit at each status, axis by axis. */
export function axisCounts(
  reviews: readonly FamilyReview[],
): readonly AxisCount[] {
  return STATUS_AXES.map((axis) => {
    const counts: Record<StatusValue, number> = {
      NONE: 0,
      PARTIAL: 0,
      READY: 0,
      VALIDATED: 0,
    };
    for (const review of reviews) counts[statusOf(review.status, axis)] += 1;
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
  reviews: readonly FamilyReview[],
): readonly DomainProgress[] {
  return DATA_DOMAINS.map((domain) => {
    const own = reviews.filter((review) => review.family.domain === domain);
    const total = own.reduce(
      (sum, review) => sum + completeness(review.status),
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
  reviews: readonly FamilyReview[],
  priority: number,
): readonly FamilyReview[] {
  return reviews
    .filter((review) => review.family.priority === priority)
    .filter((review) => completeness(review.status) < 1)
    .sort(
      (first, second) =>
        completeness(first.status) - completeness(second.status) ||
        first.family.id.localeCompare(second.family.id),
    );
}
