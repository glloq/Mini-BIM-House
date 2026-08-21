import type { QuantityItem } from './quantities.js';

/** Enough of a placed thing to count it. */
export interface CountablePlacement {
  readonly instanceId: string;
  readonly definitionId?: string;
  readonly kind?: string;
  readonly familyId?: string;
}

/**
 * What the house holds, counted.
 *
 * A bill of materials that only knew how much concrete a house contains could
 * say nothing about the twelve radiators, the four fans and the eighteen
 * sockets standing in it — and those are what a client asks the price of.
 *
 * Counted per model rather than per object: a quote lists « radiateur
 * générique × 12 », not twelve lines saying one.
 */
export function placedEquipmentQuantities(
  placed: readonly CountablePlacement[],
): readonly QuantityItem[] {
  const groups = new Map<string, CountablePlacement[]>();
  for (const one of placed) {
    // Something placed without a model is still something placed; it is
    // counted under its own identity rather than dropped.
    const key = one.definitionId ?? one.instanceId;
    const held = groups.get(key);
    if (held === undefined) groups.set(key, [one]);
    else held.push(one);
  }
  return [...groups]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, held]) => ({
      id: `count:${key}`,
      sourceEntityId: key,
      quantityType: 'COUNT' as const,
      level: 'GEOMETRIC' as const,
      value: held.length,
      unit: 'u' as const,
      trace: {
        methodId: 'placed-equipment-v1' as const,
        sourceEntityIds: held.map(({ instanceId }) => instanceId),
        formula: `${held.length} × ${key}`,
      },
    }));
}

/** What a run made of nothing is filed under, so a reader can tell. */
export const UNNAMED_RUN = 'sans produit';

/** Enough of a run to measure it. */
export interface MeasurableRun {
  readonly id: string;
  readonly productId?: string;
  readonly path: readonly {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  }[];
}

/**
 * How much of each product a project runs, in metres.
 *
 * A network was drawn and nothing measured it: the length of tube a house
 * needs is the first question a plumber's quote answers, and it was in the
 * drawing all along.
 *
 * Runs made of nothing are measured too, under their own identity, because
 * « the drawing holds forty metres nobody has chosen a tube for » is worth
 * saying.
 */
export function networkRunQuantities(
  runs: readonly MeasurableRun[],
): readonly QuantityItem[] {
  const groups = new Map<string, { ids: string[]; metres: number }>();
  for (const run of runs) {
    const key = run.productId ?? UNNAMED_RUN;
    const metres =
      run.path.slice(1).reduce((total, point, index) => {
        const previous = run.path[index]!;
        return (
          total +
          Math.hypot(
            point.x - previous.x,
            point.y - previous.y,
            point.z - previous.z,
          )
        );
      }, 0) / 1000;
    const held = groups.get(key);
    if (held === undefined) groups.set(key, { ids: [run.id], metres });
    else {
      held.ids.push(run.id);
      held.metres += metres;
    }
  }
  return [...groups]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, held]) => ({
      id: `run:${key}`,
      sourceEntityId: key,
      quantityType: 'LENGTH' as const,
      level: 'GEOMETRIC' as const,
      value: held.metres,
      unit: 'm' as const,
      trace: {
        methodId: 'network-run-v1' as const,
        sourceEntityIds: held.ids,
        formula: `${held.ids.length} tronçon(s) de ${key}`,
      },
    }));
}
