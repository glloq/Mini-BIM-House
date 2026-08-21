/**
 * What is done, for one family, on each of the axes a family has to cross.
 *
 * A family is not « done » or « not done ». A window can be modelled, drawn,
 * costed and have no acoustic data; a heat pump can have a full performance
 * map and no symbol. Saying so on one axis at a time is what turns a list of
 * three hundred families into work that several people can pick up
 * independently and measure.
 */
export const STATUS_AXES = [
  'MODEL',
  'PROPERTIES',
  'PORTS',
  'PLACEMENT',
  'PLAN_SYMBOL',
  'ELEVATION_SYMBOL',
  'SCHEMATIC_SYMBOL',
  'NETWORK',
  'CALCULATION',
  'QUANTITIES',
  'COST',
  'CARBON',
  'RULES',
  'TESTS',
  'GENERIC_DATA',
  'PRODUCT_DATA',
] as const;
export type StatusAxis = (typeof STATUS_AXES)[number];

/**
 * How far one axis has got.
 *
 * `NONE` and `PARTIAL` are not failures: most of a hundred families will sit
 * there for a long time, and a plan that pretends otherwise is a plan nobody
 * can trust. `VALIDATED` means a test proves it, which is the only difference
 * between « written » and « working ».
 */
export const STATUS_VALUES = ['NONE', 'PARTIAL', 'READY', 'VALIDATED'] as const;
export type StatusValue = (typeof STATUS_VALUES)[number];

export type FamilyStatus = Partial<Readonly<Record<StatusAxis, StatusValue>>>;

export function isStatusAxis(value: string): value is StatusAxis {
  return (STATUS_AXES as readonly string[]).includes(value);
}

export function isStatusValue(value: string): value is StatusValue {
  return (STATUS_VALUES as readonly string[]).includes(value);
}

/** An axis a family says nothing about is an axis nobody has started. */
export function statusOf(status: FamilyStatus, axis: StatusAxis): StatusValue {
  return status[axis] ?? 'NONE';
}

const WEIGHT: Readonly<Record<StatusValue, number>> = {
  NONE: 0,
  PARTIAL: 1,
  READY: 2,
  VALIDATED: 3,
};

/**
 * How far a family has got overall, between 0 and 1.
 *
 * Every axis counts the same, on purpose: a family with a symbol and no model
 * is not further along than one with a model and no symbol, and weighting the
 * axes would be deciding for the person doing the work which half matters.
 */
export function completeness(status: FamilyStatus): number {
  const total = STATUS_AXES.reduce(
    (sum, axis) => sum + WEIGHT[statusOf(status, axis)],
    0,
  );
  return total / (STATUS_AXES.length * WEIGHT.VALIDATED);
}
