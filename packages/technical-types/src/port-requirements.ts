import { isPortType, portType } from './port-types.js';

/**
 * How many ports of which kinds a thing of this family is connected by.
 *
 * A bare port kind used to be the whole answer, and it was matched by
 * *service* rather than by kind — so `HEATING_FLOW` and `HEATING_RETURN`, which
 * carry the same water and share a service, satisfied each other. A heat pump
 * declaring only its return therefore passed a check that asked for both, and
 * the missing connection was found by nobody.
 *
 * Kinds match exactly. What is genuinely interchangeable is written down
 * (`anyOf`), and what comes in numbers is counted: two MPPT inputs, three
 * outgoing circuits, twelve ways on a board, any number of devices on a bus.
 */
export interface PortRequirement {
  /** The kinds that satisfy it. One, usually; more when they truly differ. */
  readonly anyOf: readonly string[];
  /** How many are needed. Zero means « may have one », not « must not ». */
  readonly minCount: number;
  /** How many may exist, when there is a limit. */
  readonly maxCount?: number;
}

/**
 * A requirement as a data file states it.
 *
 * A bare string is the common case written the short way: exactly one port of
 * that kind. Anything else says so.
 */
export type PortRequirementCandidate =
  | string
  | {
      readonly anyOf: readonly string[];
      readonly minCount?: number;
      readonly maxCount?: number;
    };

/** The long form of what a file states the short way. */
export function portRequirement(
  candidate: PortRequirementCandidate,
): PortRequirement {
  if (typeof candidate === 'string')
    return { anyOf: [candidate], minCount: 1, maxCount: 1 };
  return {
    anyOf: candidate.anyOf,
    minCount: candidate.minCount ?? 1,
    ...(candidate.maxCount === undefined
      ? {}
      : { maxCount: candidate.maxCount }),
  };
}

export interface PortRequirementIssue {
  readonly index: number;
  readonly requirement: PortRequirement;
  readonly found: number;
  readonly message: string;
}

function named(requirement: PortRequirement): string {
  return requirement.anyOf.map((id) => portType(id)?.label ?? id).join(' ou ');
}

/**
 * Everything a set of declared ports fails to satisfy.
 *
 * Each declared port answers for one requirement and no more. Without that,
 * one port satisfied every requirement its kind appeared in, which is how a
 * machine with a single water connection could pass for one with a flow and a
 * return.
 *
 * The most constrained requirements are served first — a requirement naming
 * one kind before one naming three — so that a port able to answer either is
 * not spent on the requirement that had another way out.
 */
export function unmetRequirements(
  requirements: readonly PortRequirement[],
  declared: readonly string[],
): readonly PortRequirementIssue[] {
  const pool = new Map<string, number>();
  for (const id of declared) pool.set(id, (pool.get(id) ?? 0) + 1);
  const order = requirements
    .map((requirement, index) => ({ requirement, index }))
    .sort(
      (first, second) =>
        first.requirement.anyOf.length - second.requirement.anyOf.length ||
        first.index - second.index,
    );
  const issues: PortRequirementIssue[] = [];
  for (const { requirement, index } of order) {
    let found = 0;
    for (const kind of requirement.anyOf) {
      const held = pool.get(kind) ?? 0;
      const taken = Math.min(
        held,
        Math.max(0, (requirement.maxCount ?? Number.POSITIVE_INFINITY) - found),
      );
      pool.set(kind, held - taken);
      found += taken;
    }
    if (found < requirement.minCount)
      issues.push({
        index,
        requirement,
        found,
        message:
          requirement.minCount === 1
            ? `is connected by ${named(requirement)}, which this entry does not declare`
            : `is connected by ${requirement.minCount} × ${named(requirement)}, and this entry declares ${found}`,
      });
    else if (
      requirement.maxCount !== undefined &&
      (pool.get(requirement.anyOf[0] ?? '') ?? 0) > 0 &&
      requirement.anyOf.length === 1
    )
      issues.push({
        index,
        requirement,
        found: found + (pool.get(requirement.anyOf[0]!) ?? 0),
        message: `takes at most ${requirement.maxCount} × ${named(requirement)}, and this entry declares more`,
      });
  }
  return issues.sort((first, second) => first.index - second.index);
}

/** Whether every kind a requirement names is one the registry knows. */
export function unknownPortKinds(
  requirement: PortRequirement,
): readonly string[] {
  return requirement.anyOf.filter((id) => !isPortType(id));
}
