/**
 * A number the project may or may not know, and what happens when several are
 * added up.
 *
 * The application's own rule is that an unknown value stays unknown. The rule
 * held everywhere a single value was read and broke everywhere values were
 * summed: `?? 0` turned « je ne sais pas » into « zéro », and zero is a
 * number — it adds, it compares, it prints. A pipe fed by a shower at
 * 0,15 L/s and a basin whose flow nobody stated came out at 0,15 L/s, which
 * is not the total and is not marked as anything but the total.
 *
 * What is wanted instead is « au moins 0,15 L/s, et je ne sais pas pour le
 * lavabo ». That is two facts, so it takes two fields.
 */

export interface KnownValue {
  readonly status: 'KNOWN';
  readonly value: number;
}

export interface UnknownValue {
  readonly status: 'UNKNOWN';
  /**
   * What the known part adds up to, when some of it is known.
   *
   * A lower bound is worth saying: « au moins 0,15 L/s » sizes nothing on its
   * own, but it tells whoever reads it that the answer is not zero.
   */
  readonly knownPartial?: number;
  /** What could not be resolved, by identity, so the user can go and fix it. */
  readonly missingSourceIds: readonly string[];
}

export type ResolvedNumber = KnownValue | UnknownValue;

export function known(value: number): ResolvedNumber {
  return { status: 'KNOWN', value };
}

export function unknown(
  missingSourceIds: readonly string[],
  knownPartial?: number,
): ResolvedNumber {
  return {
    status: 'UNKNOWN',
    ...(knownPartial === undefined ? {} : { knownPartial }),
    missingSourceIds,
  };
}

/** A value the project stated, or an unknown naming what was missing. */
export function resolvedNumber(
  value: number | undefined,
  sourceId: string,
): ResolvedNumber {
  return value === undefined ? unknown([sourceId]) : known(value);
}

export function isKnown(value: ResolvedNumber): value is KnownValue {
  return value.status === 'KNOWN';
}

/**
 * The number, when it is one.
 *
 * Deliberately not a default: a caller that wants a number has to say what it
 * will do without one, at the call site, where the decision is visible.
 */
export function valueOf(value: ResolvedNumber): number | undefined {
  return value.status === 'KNOWN' ? value.value : undefined;
}

/** What is known so far, whether or not the whole is. */
export function lowerBound(value: ResolvedNumber): number {
  return value.status === 'KNOWN' ? value.value : (value.knownPartial ?? 0);
}

/**
 * The sum, which is unknown as soon as one term is.
 *
 * This is the whole point: a total is a claim about all of its terms, and one
 * term nobody stated makes the claim unstatable. What survives is the lower
 * bound and the list of what is missing.
 */
export function sumResolved(values: readonly ResolvedNumber[]): ResolvedNumber {
  let partial = 0;
  const missing: string[] = [];
  for (const value of values) {
    partial += lowerBound(value);
    if (value.status === 'UNKNOWN') missing.push(...value.missingSourceIds);
  }
  return missing.length === 0
    ? known(partial)
    : unknown(dedupe(missing), partial);
}

/** The largest, unknown as soon as one term is: a bigger one may be hiding. */
export function maxResolved(values: readonly ResolvedNumber[]): ResolvedNumber {
  const missing = values.flatMap((value) =>
    value.status === 'UNKNOWN' ? [...value.missingSourceIds] : [],
  );
  const known2 = values.filter(isKnown).map(({ value }) => value);
  const best = known2.length === 0 ? undefined : Math.max(...known2);
  return missing.length === 0 && best !== undefined
    ? known(best)
    : unknown(dedupe(missing), best);
}

/**
 * The smallest.
 *
 * Unknown too, and for the opposite reason: a smaller one may be hiding, and
 * a minimum is usually the one that sizes something.
 */
export function minResolved(values: readonly ResolvedNumber[]): ResolvedNumber {
  const missing = values.flatMap((value) =>
    value.status === 'UNKNOWN' ? [...value.missingSourceIds] : [],
  );
  const known2 = values.filter(isKnown).map(({ value }) => value);
  const best = known2.length === 0 ? undefined : Math.min(...known2);
  return missing.length === 0 && best !== undefined
    ? known(best)
    : unknown(dedupe(missing), best);
}

/** The mean, unknown as soon as one term is. */
export function averageResolved(
  values: readonly ResolvedNumber[],
): ResolvedNumber {
  if (values.length === 0) return unknown([]);
  const total = sumResolved(values);
  return total.status === 'KNOWN'
    ? known(total.value / values.length)
    : unknown(total.missingSourceIds, lowerBound(total) / values.length);
}

/** Applies a function to a value that is known, and passes the rest through. */
export function mapResolved(
  value: ResolvedNumber,
  apply: (value: number) => number,
): ResolvedNumber {
  return value.status === 'KNOWN'
    ? known(apply(value.value))
    : {
        status: 'UNKNOWN',
        ...(value.knownPartial === undefined
          ? {}
          : { knownPartial: apply(value.knownPartial) }),
        missingSourceIds: value.missingSourceIds,
      };
}

/**
 * What an unknown is, in words.
 *
 * Named after the objects that could not be resolved rather than after the
 * calculation that stopped: the person can only act on the first.
 */
export function describeUnknown(value: UnknownValue): string {
  if (value.missingSourceIds.length === 0)
    return 'Valeur indéterminée : rien à additionner.';
  const named = value.missingSourceIds.slice(0, 4).join(', ');
  const rest = value.missingSourceIds.length - 4;
  const list = rest > 0 ? `${named} et ${rest} autre(s)` : named;
  return value.knownPartial === undefined
    ? `Valeur indéterminée : ${list} ne la déclarent pas.`
    : `Valeur indéterminée : au moins ${value.knownPartial}, mais ${list} ne déclarent rien.`;
}

function dedupe(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
