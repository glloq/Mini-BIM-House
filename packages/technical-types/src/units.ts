/**
 * The units this application writes, and what each of them measures.
 *
 * A closed list, because `KW`, `kw` and `kW` are three spellings of one unit
 * and only one of them is the symbol. With five hundred families and two
 * hundred and fifty properties, a unit typed by hand is a unit that will be
 * typed three ways, and a value read in the wrong one is wrong by a thousand.
 *
 * Adding a unit is a decision, taken here, once.
 */
export const WRITTEN_UNITS = {
  '-': 'RATIO',
  A: 'CURRENT',
  mA: 'CURRENT',
  kA: 'CURRENT',
  V: 'VOLTAGE',
  W: 'POWER',
  kW: 'POWER',
  Wc: 'POWER',
  kWh: 'ENERGY',
  Ah: 'CHARGE',
  Ω: 'RESISTANCE',
  'Ω/km': 'LINEAR_RESISTANCE',
  m: 'LENGTH',
  mm: 'LENGTH',
  'm²': 'AREA',
  'mm²': 'AREA',
  L: 'VOLUME',
  'm³/h': 'VOLUME_FLOW',
  'L/s': 'VOLUME_FLOW',
  'm³/(h·m²)': 'SPECIFIC_FLOW',
  kg: 'MASS',
  'kg/m': 'LINEAR_MASS',
  'kg/m³': 'DENSITY',
  K: 'TEMPERATURE_DIFFERENCE',
  '°C': 'TEMPERATURE',
  '°': 'ANGLE',
  '1/K': 'THERMAL_EXPANSION',
  Pa: 'PRESSURE',
  bar: 'PRESSURE',
  MPa: 'PRESSURE',
  'W/(m·K)': 'THERMAL_CONDUCTIVITY',
  'W/(m²·K)': 'THERMAL_TRANSMITTANCE',
  'm²·K/W': 'THERMAL_RESISTANCE',
  'W/m²': 'IRRADIANCE',
  'J/(kg·K)': 'SPECIFIC_HEAT',
  'MJ/kg': 'CALORIFIC_VALUE',
  'kg/(m²·s^0,5)': 'WATER_ABSORPTION',
  lm: 'LUMINOUS_FLUX',
  'lm/W': 'LUMINOUS_EFFICACY',
  dB: 'SOUND_LEVEL',
  'dB(A)': 'SOUND_LEVEL',
  'mg/m³': 'CONCENTRATION',
  UV: 'UNIT_VALUE',
  h: 'TIME',
  an: 'TIME',
  'm/s': 'VELOCITY',
  'm/m': 'SLOPE',
  '€': 'COST',
  '€/m': 'LINEAR_COST',
  '€/m²': 'AREA_COST',
  '€/m³': 'VOLUME_COST',
  kgCO2e: 'CARBON',
  'kgCO2e/kg': 'SPECIFIC_CARBON',
  'kgCO2e/m': 'LINEAR_CARBON',
  'kgCO2e/m²': 'AREA_CARBON',
} as const satisfies Readonly<Record<string, string>>;

export type WrittenUnit = keyof typeof WRITTEN_UNITS;
export type Quantity = (typeof WRITTEN_UNITS)[WrittenUnit];

export function isWrittenUnit(value: string): value is WrittenUnit {
  return Object.hasOwn(WRITTEN_UNITS, value);
}

/** What a unit measures, which is what makes a conversion possible at all. */
export function quantityOf(unit: string): Quantity | undefined {
  return isWrittenUnit(unit) ? WRITTEN_UNITS[unit] : undefined;
}
