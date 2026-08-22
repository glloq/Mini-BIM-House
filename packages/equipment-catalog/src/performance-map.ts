import { PERFORMANCE_INTERPOLATIONS } from './types.js';
import type {
  EquipmentIssue,
  PerformanceCurve,
  PerformancePoint,
} from './types.js';

function issue(
  code: EquipmentIssue['code'],
  path: string,
  severity: EquipmentIssue['severity'],
  message: string,
): EquipmentIssue {
  return { code, path, severity, message };
}

/**
 * How many axes this version knows how to read.
 *
 * One and two. A compressor map is a table of outdoor temperature against flow
 * temperature; a fan is pressure against flow. Three would be a decision — and
 * a curve declaring three axes used to be accepted, stored, and then answered
 * `OUT_OF_RANGE` for ever, because the only reader refused anything but one.
 * Accepting data nothing can read is how a catalogue fills up with fiches that
 * look complete.
 */
export const MAXIMUM_PERFORMANCE_AXES = 2;

/** The axis count each interpolation is defined for. */
const AXES_FOR: Readonly<Record<string, readonly number[]>> = {
  LINEAR: [1],
  BILINEAR: [2],
  TABLE: [1, 2],
};

const key = (inputs: readonly number[]): string => inputs.join(' ');

/** The distinct values of one axis, in order. */
function axisValues(
  points: readonly PerformancePoint[],
  axis: number,
): readonly number[] {
  return [...new Set(points.map((point) => point.inputs[axis]!))].sort(
    (first, second) => first - second,
  );
}

/**
 * Everything wrong with the shape of one performance map.
 *
 * Only its shape: whether the axes it names exist and carry the units they
 * claim is a question about the property registry, and belongs where the
 * registry is. What is decided here is whether the table can be read at all —
 * a hole in a grid, two points at the same place, an interpolation the axes do
 * not support.
 */
export function validatePerformanceMap(
  curve: PerformanceCurve,
  path: string,
): readonly EquipmentIssue[] {
  const issues: EquipmentIssue[] = [];
  const at = (message: string, where = path) =>
    issues.push(issue('EQUIPMENT_INVALID_CURVE', where, 'ERROR', message));
  const axes = curve.inputAxes.length;
  if (axes === 0 || curve.points.length === 0) {
    at(`Curve ${curve.id} needs at least one axis and one point.`);
    return issues;
  }
  if (axes > MAXIMUM_PERFORMANCE_AXES) {
    at(
      `Curve ${curve.id} declares ${axes} axes; nothing reads more than ${MAXIMUM_PERFORMANCE_AXES}.`,
    );
    return issues;
  }
  const named = new Set(curve.inputAxes.map(({ id }) => id));
  if (named.size !== axes) at(`Curve ${curve.id} names the same axis twice.`);
  if (
    !(PERFORMANCE_INTERPOLATIONS as readonly string[]).includes(
      curve.interpolation,
    )
  )
    at(
      `Curve ${curve.id} interpolates by ${curve.interpolation}, which nothing implements.`,
    );
  else if (!AXES_FOR[curve.interpolation]!.includes(axes))
    at(
      `Curve ${curve.id} interpolates by ${curve.interpolation} over ${axes} axis or axes.`,
    );

  const seen = new Set<string>();
  for (const [index, point] of curve.points.entries()) {
    const where = `${path}/points/${index}`;
    if (point.inputs.length !== axes) {
      at(
        `Point ${index} of curve ${curve.id} does not provide one value per axis.`,
        where,
      );
      continue;
    }
    if (
      !Number.isFinite(point.output) ||
      point.inputs.some((value) => !Number.isFinite(value))
    ) {
      at(
        `Point ${index} of curve ${curve.id} holds a non-finite value.`,
        where,
      );
      continue;
    }
    // Two values at the same place is not a duplicate to be tolerated: it is
    // two different answers to one question, and whichever wins depends on the
    // order the file happens to be written in.
    if (seen.has(key(point.inputs)))
      at(
        `Point ${index} of curve ${curve.id} repeats a point already tabulated.`,
        where,
      );
    seen.add(key(point.inputs));
  }
  if (issues.length > 0) return issues;

  if (curve.interpolation !== 'TABLE' && curve.points.length < 2)
    at(`Curve ${curve.id} interpolates between fewer than two points.`);
  // A two-axis map is read by walking a rectangle. A grid with a hole in it
  // reads as a rectangle right up to the hole, and then answers with a corner
  // that is not there.
  if (axes === 2) {
    const first = axisValues(curve.points, 0);
    const second = axisValues(curve.points, 1);
    const expected = first.length * second.length;
    if (curve.points.length !== expected)
      at(
        `Curve ${curve.id} tabulates ${curve.points.length} of the ${expected} points its ${first.length} by ${second.length} grid needs.`,
      );
  }
  return issues;
}

export type PerformanceLookup =
  | { readonly status: 'OK'; readonly value: number }
  | { readonly status: 'OUT_OF_RANGE'; readonly issue: EquipmentIssue }
  | { readonly status: 'UNREADABLE'; readonly issue: EquipmentIssue };

function outOfRange(
  curve: PerformanceCurve,
  axis: number,
  input: number,
  low: number,
  high: number,
): PerformanceLookup {
  return {
    status: 'OUT_OF_RANGE',
    issue: issue(
      'EQUIPMENT_PERFORMANCE_OUT_OF_RANGE',
      `/${curve.id}`,
      'WARNING',
      `${input} ${curve.inputAxes[axis]!.unit} lies outside the tabulated range ${low}-${high}.`,
    ),
  };
}

function unreadable(
  curve: PerformanceCurve,
  message: string,
): PerformanceLookup {
  return {
    status: 'UNREADABLE',
    issue: issue('EQUIPMENT_INVALID_CURVE', `/${curve.id}`, 'ERROR', message),
  };
}

/** Where `input` falls between two tabulated values, or nothing when outside. */
function bracket(
  values: readonly number[],
  input: number,
):
  | { readonly low: number; readonly high: number; readonly ratio: number }
  | undefined {
  const first = values[0]!;
  const last = values.at(-1)!;
  if (input < first || input > last) return undefined;
  for (let index = 1; index < values.length; index += 1) {
    const low = values[index - 1]!;
    const high = values[index]!;
    if (input > high) continue;
    const span = high - low;
    return { low, high, ratio: span === 0 ? 0 : (input - low) / span };
  }
  return { low: last, high: last, ratio: 0 };
}

/**
 * What this map says at these conditions.
 *
 * Nothing is extrapolated, on either axis. A request outside the tabulated
 * domain is reported so the caller can show the limit rather than a
 * confidently wrong number — a compressor asked for its output at minus thirty
 * degrees, when the manufacturer stopped at minus fifteen, has not got a
 * straight line down there: it has a cut-out.
 */
export function lookupPerformance(
  curve: PerformanceCurve,
  inputs: readonly number[],
): PerformanceLookup {
  const axes = curve.inputAxes.length;
  if (inputs.length !== axes)
    return unreadable(
      curve,
      `Curve ${curve.id} takes ${axes} input(s) and was asked with ${inputs.length}.`,
    );
  if (
    axes === 0 ||
    axes > MAXIMUM_PERFORMANCE_AXES ||
    curve.points.length === 0
  )
    return unreadable(
      curve,
      `Curve ${curve.id} declares ${axes} axis or axes, which nothing reads.`,
    );

  const exact = curve.points.find((point) => key(point.inputs) === key(inputs));
  if (exact !== undefined) return { status: 'OK', value: exact.output };
  if (curve.interpolation === 'TABLE')
    return {
      status: 'OUT_OF_RANGE',
      issue: issue(
        'EQUIPMENT_PERFORMANCE_OUT_OF_RANGE',
        `/${curve.id}`,
        'WARNING',
        `Curve ${curve.id} is tabulated point by point and says nothing between them.`,
      ),
    };

  if (axes === 1) {
    const values = axisValues(curve.points, 0);
    const span = bracket(values, inputs[0]!);
    if (span === undefined)
      return outOfRange(curve, 0, inputs[0]!, values[0]!, values.at(-1)!);
    const outputAt = (value: number): number =>
      curve.points.find((point) => point.inputs[0] === value)!.output;
    return {
      status: 'OK',
      value:
        outputAt(span.low) +
        span.ratio * (outputAt(span.high) - outputAt(span.low)),
    };
  }

  const firstValues = axisValues(curve.points, 0);
  const secondValues = axisValues(curve.points, 1);
  const firstSpan = bracket(firstValues, inputs[0]!);
  if (firstSpan === undefined)
    return outOfRange(
      curve,
      0,
      inputs[0]!,
      firstValues[0]!,
      firstValues.at(-1)!,
    );
  const secondSpan = bracket(secondValues, inputs[1]!);
  if (secondSpan === undefined)
    return outOfRange(
      curve,
      1,
      inputs[1]!,
      secondValues[0]!,
      secondValues.at(-1)!,
    );
  const corner = (first: number, second: number): number | undefined =>
    curve.points.find(
      (point) => point.inputs[0] === first && point.inputs[1] === second,
    )?.output;
  const lowLow = corner(firstSpan.low, secondSpan.low);
  const lowHigh = corner(firstSpan.low, secondSpan.high);
  const highLow = corner(firstSpan.high, secondSpan.low);
  const highHigh = corner(firstSpan.high, secondSpan.high);
  if (
    lowLow === undefined ||
    lowHigh === undefined ||
    highLow === undefined ||
    highHigh === undefined
  )
    // The grid has a hole where this rectangle's corner should be. Filling it
    // from the three corners that do exist would be inventing a figure and
    // presenting it as tabulated.
    return unreadable(
      curve,
      `Curve ${curve.id} has no point at one corner of the rectangle around this request.`,
    );
  const low = lowLow + secondSpan.ratio * (lowHigh - lowLow);
  const high = highLow + secondSpan.ratio * (highHigh - highLow);
  return { status: 'OK', value: low + firstSpan.ratio * (high - low) };
}
