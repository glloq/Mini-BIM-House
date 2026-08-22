import type { PropertyDefinition } from './property-schemas.js';

/**
 * A performance map as a data file states it, before anything is checked.
 *
 * The gate reads the shape the files share rather than one package's type: a
 * manufacturer import and the generic catalogue both arrive here.
 */
export interface PerformanceMapCandidate {
  readonly id: string;
  readonly inputAxes: readonly {
    readonly id: string;
    readonly unit: string;
  }[];
  readonly output: string;
  readonly outputUnit: string;
}

export interface VocabularyIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Whether a performance map speaks the application's own vocabulary.
 *
 * The shape of a table — a hole in its grid, two points in one place — is
 * checked where the table is read. This is the other half, and it is the half
 * that fails silently: an axis called `outdoorTemperatureC` in one fiche and
 * `tempExtC` in the next are two different axes as far as anything reading
 * them is concerned, and no amount of well-formed tabulation will make a
 * calculation find the second one.
 *
 * So an axis names a property this application has defined, and states that
 * property's unit. Nineteen fiches had already drifted on the second point:
 * two curves said `m3/h` where the registry says `m³/h`, which is the same
 * quantity written two ways and therefore two units to anything comparing
 * strings.
 */
export function validatePerformanceVocabulary(
  map: PerformanceMapCandidate,
  path: string,
  definitionOf: (key: string) => PropertyDefinition | undefined,
): readonly VocabularyIssue[] {
  const issues: VocabularyIssue[] = [];
  const at = (where: string, message: string) =>
    issues.push({ path: where, message });

  const check = (
    where: string,
    key: string,
    unit: string,
    what: string,
  ): void => {
    const definition = definitionOf(key);
    if (definition === undefined) {
      at(where, `${what} ${key} is not a property this application defines`);
      return;
    }
    if (definition.unit === undefined) {
      if (unit !== '' && unit !== '-')
        at(
          where,
          `${key} is defined without a unit and this map states ${unit}`,
        );
      return;
    }
    if (definition.unit !== unit)
      at(
        where,
        `${key} is measured in ${definition.unit} and this map states ${unit}`,
      );
  };

  for (const [index, axis] of map.inputAxes.entries())
    check(`${path}/inputAxes/${index}`, axis.id, axis.unit, 'axis');
  check(`${path}/output`, map.output, map.outputUnit, 'output');
  return issues;
}

/** Every property a set of performance maps names, axis or output. */
export function performanceVocabulary(
  maps: readonly PerformanceMapCandidate[],
): ReadonlySet<string> {
  const used = new Set<string>();
  for (const map of maps) {
    for (const axis of map.inputAxes) used.add(axis.id);
    used.add(map.output);
  }
  return used;
}
