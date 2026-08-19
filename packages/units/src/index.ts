/** Explicit quantities and boundary conversions.
 *
 * Geometry uses millimetres; scientific modules use SI. A quantity can only be
 * created or converted through this package, keeping unit changes visible at
 * module boundaries while retaining ordinary number performance at runtime.
 */

declare const unitBrand: unique symbol;

export type Quantity<Unit extends string> = number & {
  readonly [unitBrand]: Unit;
};

export type Millimetres = Quantity<'length:mm'>;
export type Metres = Quantity<'length:m'>;
export type SquareMillimetres = Quantity<'area:mm2'>;
export type SquareMetres = Quantity<'area:m2'>;
export type CubicMillimetres = Quantity<'volume:mm3'>;
export type CubicMetres = Quantity<'volume:m3'>;
export type Litres = Quantity<'volume:L'>;
export type Watts = Quantity<'power:W'>;
export type Kilowatts = Quantity<'power:kW'>;
export type WattHours = Quantity<'energy:Wh'>;
export type KilowattHours = Quantity<'energy:kWh'>;
export type Pascals = Quantity<'pressure:Pa'>;
export type Kilopascals = Quantity<'pressure:kPa'>;
export type Bars = Quantity<'pressure:bar'>;
export type LitresPerMinute = Quantity<'flow:L/min'>;
export type CubicMetresPerSecond = Quantity<'flow:m3/s'>;
export type DegreesCelsius = Quantity<'temperature:degC'>;
export type Kelvins = Quantity<'temperature:K'>;
export type KelvinDifference = Quantity<'temperature-difference:K'>;
export type CelsiusDifference = Quantity<'temperature-difference:degC'>;
export type Degrees = Quantity<'angle:deg'>;
export type Radians = Quantity<'angle:rad'>;

function quantity<Unit extends string>(
  value: number,
  unit: Unit,
): Quantity<Unit> {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${unit} quantity must be finite`);
  }
  return value as Quantity<Unit>;
}

export const millimetres = (value: number): Millimetres =>
  quantity(value, 'length:mm');
export const metres = (value: number): Metres => quantity(value, 'length:m');
export const squareMillimetres = (value: number): SquareMillimetres =>
  quantity(value, 'area:mm2');
export const squareMetres = (value: number): SquareMetres =>
  quantity(value, 'area:m2');
export const cubicMillimetres = (value: number): CubicMillimetres =>
  quantity(value, 'volume:mm3');
export const cubicMetres = (value: number): CubicMetres =>
  quantity(value, 'volume:m3');
export const litres = (value: number): Litres => quantity(value, 'volume:L');
export const watts = (value: number): Watts => quantity(value, 'power:W');
export const kilowatts = (value: number): Kilowatts =>
  quantity(value, 'power:kW');
export const wattHours = (value: number): WattHours =>
  quantity(value, 'energy:Wh');
export const kilowattHours = (value: number): KilowattHours =>
  quantity(value, 'energy:kWh');
export const pascals = (value: number): Pascals =>
  quantity(value, 'pressure:Pa');
export const kilopascals = (value: number): Kilopascals =>
  quantity(value, 'pressure:kPa');
export const bars = (value: number): Bars => quantity(value, 'pressure:bar');
export const litresPerMinute = (value: number): LitresPerMinute =>
  quantity(value, 'flow:L/min');
export const cubicMetresPerSecond = (value: number): CubicMetresPerSecond =>
  quantity(value, 'flow:m3/s');
export const degreesCelsius = (value: number): DegreesCelsius =>
  quantity(value, 'temperature:degC');
export const kelvins = (value: number): Kelvins => {
  if (value < 0)
    throw new RangeError('absolute temperature cannot be below 0 K');
  return quantity(value, 'temperature:K');
};
export const kelvinDifference = (value: number): KelvinDifference =>
  quantity(value, 'temperature-difference:K');
export const celsiusDifference = (value: number): CelsiusDifference =>
  quantity(value, 'temperature-difference:degC');
export const degrees = (value: number): Degrees => quantity(value, 'angle:deg');
export const radians = (value: number): Radians => quantity(value, 'angle:rad');

export const millimetresToMetres = (value: Millimetres): Metres =>
  metres(value / 1_000);
export const metresToMillimetres = (value: Metres): Millimetres =>
  millimetres(value * 1_000);
export const squareMillimetresToSquareMetres = (
  value: SquareMillimetres,
): SquareMetres => squareMetres(value / 1_000_000);
export const squareMetresToSquareMillimetres = (
  value: SquareMetres,
): SquareMillimetres => squareMillimetres(value * 1_000_000);
export const cubicMillimetresToCubicMetres = (
  value: CubicMillimetres,
): CubicMetres => cubicMetres(value / 1_000_000_000);
export const cubicMetresToCubicMillimetres = (
  value: CubicMetres,
): CubicMillimetres => cubicMillimetres(value * 1_000_000_000);
export const litresToCubicMetres = (value: Litres): CubicMetres =>
  cubicMetres(value / 1_000);
export const cubicMetresToLitres = (value: CubicMetres): Litres =>
  litres(value * 1_000);
export const wattsToKilowatts = (value: Watts): Kilowatts =>
  kilowatts(value / 1_000);
export const kilowattsToWatts = (value: Kilowatts): Watts =>
  watts(value * 1_000);
export const wattHoursToKilowattHours = (value: WattHours): KilowattHours =>
  kilowattHours(value / 1_000);
export const kilowattHoursToWattHours = (value: KilowattHours): WattHours =>
  wattHours(value * 1_000);
export const pascalsToKilopascals = (value: Pascals): Kilopascals =>
  kilopascals(value / 1_000);
export const kilopascalsToPascals = (value: Kilopascals): Pascals =>
  pascals(value * 1_000);
export const pascalsToBars = (value: Pascals): Bars => bars(value / 100_000);
export const barsToPascals = (value: Bars): Pascals => pascals(value * 100_000);
export const litresPerMinuteToCubicMetresPerSecond = (
  value: LitresPerMinute,
): CubicMetresPerSecond => cubicMetresPerSecond(value / 60_000);
export const cubicMetresPerSecondToLitresPerMinute = (
  value: CubicMetresPerSecond,
): LitresPerMinute => litresPerMinute(value * 60_000);
export const celsiusToKelvins = (value: DegreesCelsius): Kelvins =>
  kelvins(value + 273.15);
export const kelvinsToCelsius = (value: Kelvins): DegreesCelsius =>
  degreesCelsius(value - 273.15);
// A temperature interval has the same magnitude in °C and K; unlike absolute
// temperature conversion, no 273.15 offset is applied.
export const celsiusDifferenceToKelvinDifference = (
  value: CelsiusDifference,
): KelvinDifference => kelvinDifference(value);
export const kelvinDifferenceToCelsiusDifference = (
  value: KelvinDifference,
): CelsiusDifference => celsiusDifference(value);
export const degreesToRadians = (value: Degrees): Radians =>
  radians((value * Math.PI) / 180);
export const radiansToDegrees = (value: Radians): Degrees =>
  degrees((value * 180) / Math.PI);

/** Deliberately unwraps a quantity for persistence, display, or numeric APIs. */
export const numericValue = <Unit extends string>(
  value: Quantity<Unit>,
): number => value;
