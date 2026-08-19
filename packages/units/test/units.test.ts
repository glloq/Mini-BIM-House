import { describe, expect, it } from 'vitest';
import {
  bars,
  barsToPascals,
  celsiusDifference,
  celsiusDifferenceToKelvinDifference,
  celsiusToKelvins,
  cubicMetres,
  cubicMetresPerSecond,
  cubicMetresPerSecondToLitresPerMinute,
  cubicMetresToCubicMillimetres,
  cubicMetresToLitres,
  degrees,
  degreesCelsius,
  degreesToRadians,
  kelvinDifference,
  kelvinDifferenceToCelsiusDifference,
  kelvins,
  kelvinsToCelsius,
  kilowattHours,
  kilowattHoursToWattHours,
  kilowatts,
  kilowattsToWatts,
  litres,
  litresPerMinute,
  litresPerMinuteToCubicMetresPerSecond,
  litresToCubicMetres,
  metres,
  metresToMillimetres,
  millimetres,
  millimetresToMetres,
  numericValue,
  pascals,
  pascalsToBars,
  pascalsToKilopascals,
  radians,
  radiansToDegrees,
  squareMetres,
  squareMetresToSquareMillimetres,
  squareMillimetres,
  squareMillimetresToSquareMetres,
  wattHours,
  wattHoursToKilowattHours,
  watts,
  wattsToKilowatts,
  kilopascalsToPascals,
  cubicMillimetres,
  cubicMillimetresToCubicMetres,
} from '../src/index.js';

describe('engineering unit conversions', () => {
  it('converts geometry length, area, and volume in both directions', () => {
    expect(millimetresToMetres(millimetres(4_200))).toBe(4.2);
    expect(metresToMillimetres(metres(4.2))).toBe(4_200);
    expect(squareMillimetresToSquareMetres(squareMillimetres(2_500_000))).toBe(
      2.5,
    );
    expect(squareMetresToSquareMillimetres(squareMetres(2.5))).toBe(2_500_000);
    expect(cubicMillimetresToCubicMetres(cubicMillimetres(2_500_000_000))).toBe(
      2.5,
    );
    expect(cubicMetresToCubicMillimetres(cubicMetres(2.5))).toBe(2_500_000_000);
  });

  it('converts litres and cubic metres', () => {
    expect(litresToCubicMetres(litres(1_000))).toBe(1);
    expect(cubicMetresToLitres(cubicMetres(1.25))).toBe(1_250);
  });

  it('converts power and energy independently', () => {
    expect(wattsToKilowatts(watts(2_500))).toBe(2.5);
    expect(kilowattsToWatts(kilowatts(2.5))).toBe(2_500);
    expect(wattHoursToKilowattHours(wattHours(12_500))).toBe(12.5);
    expect(kilowattHoursToWattHours(kilowattHours(12.5))).toBe(12_500);
  });

  it('converts pressure', () => {
    expect(pascalsToKilopascals(pascals(250_000))).toBe(250);
    expect(kilopascalsToPascals(pascalsToKilopascals(pascals(250_000)))).toBe(
      250_000,
    );
    expect(pascalsToBars(pascals(250_000))).toBe(2.5);
    expect(barsToPascals(bars(2.5))).toBe(250_000);
  });

  it('converts flow using 1 L = 0.001 m³ and 60 seconds per minute', () => {
    expect(
      litresPerMinuteToCubicMetresPerSecond(litresPerMinute(60)),
    ).toBeCloseTo(0.001, 12);
    expect(
      cubicMetresPerSecondToLitresPerMinute(cubicMetresPerSecond(0.001)),
    ).toBeCloseTo(60, 12);
  });

  it('distinguishes absolute temperatures from temperature differences', () => {
    expect(celsiusToKelvins(degreesCelsius(0))).toBeCloseTo(273.15, 12);
    expect(kelvinsToCelsius(kelvins(273.15))).toBeCloseTo(0, 12);
    expect(celsiusDifferenceToKelvinDifference(celsiusDifference(12))).toBe(12);
    expect(kelvinDifferenceToCelsiusDifference(kelvinDifference(-3))).toBe(-3);
    expect(() => kelvins(-0.001)).toThrow(RangeError);
  });

  it('converts UI degrees to core radians and back', () => {
    expect(degreesToRadians(degrees(180))).toBeCloseTo(Math.PI, 12);
    expect(radiansToDegrees(radians(Math.PI / 2))).toBeCloseTo(90, 12);
  });

  it('rejects non-finite quantities and explicitly unwraps valid values', () => {
    expect(() => millimetres(Number.NaN)).toThrow(RangeError);
    expect(() => watts(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(numericValue(metres(3.5))).toBe(3.5);
  });
});
