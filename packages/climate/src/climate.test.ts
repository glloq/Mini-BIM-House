import { describe, expect, it } from 'vitest';
import {
  analyzeClimateCompleteness,
  climateFingerprint,
  createClimateDataset,
  validateClimateDataset,
  type ClimateDataset,
} from './climate.js';

const monthly: ClimateDataset = {
  id: 'monthly',
  location: {
    latitude: 48.1,
    longitude: -1.7,
    timezone: 'Europe/Paris',
  },
  resolution: 'MONTHLY',
  source: { id: 'manual', provider: 'USER' },
  samples: [
    {
      timestamp: '2025-01',
      airTemperatureC: 6,
      relativeHumidity: 0.85,
      precipitationMm: 70,
      globalHorizontalIrradianceWhM2: 45_000,
    },
    {
      timestamp: '2025-03',
      airTemperatureC: 9,
      precipitationMm: 50,
      globalHorizontalIrradianceWhM2: 90_000,
    },
  ],
};

describe('climate datasets', () => {
  it('accepts a monthly temperature, rain, and irradiation dataset', () => {
    expect(validateClimateDataset(monthly)).toEqual([]);
    expect(createClimateDataset(monthly)).toEqual(monthly);
  });

  it('validates humidity, precipitation, and timestamp ordering', () => {
    const invalid: ClimateDataset = {
      ...monthly,
      samples: [
        { timestamp: '2025-02', relativeHumidity: 1.1 },
        { timestamp: '2025-01', precipitationMm: -1 },
      ],
    };
    expect(validateClimateDataset(invalid).map(({ code }) => code)).toEqual([
      'CLIMATE_INVALID_VALUE',
      'CLIMATE_UNORDERED_TIMESTAMPS',
      'CLIMATE_INVALID_VALUE',
    ]);
  });

  it('requires an explicit timezone and ordered hourly instants', () => {
    const hourly: ClimateDataset = {
      ...monthly,
      resolution: 'HOURLY',
      location: { ...monthly.location, timezone: '' },
      samples: [
        { timestamp: '2025-01-01T02:00:00+01:00' },
        { timestamp: '2025-01-01T00:30:00Z' },
      ],
    };
    expect(validateClimateDataset(hourly).map(({ code }) => code)).toEqual([
      'CLIMATE_MISSING_TIMEZONE',
      'CLIMATE_UNORDERED_TIMESTAMPS',
    ]);
  });

  it('reports completeness and missing periods without interpolation', () => {
    const result = analyzeClimateCompleteness(monthly, [
      'airTemperatureC',
      'relativeHumidity',
      'precipitationMm',
    ]);
    expect(result).toEqual({
      expectedValueCount: 6,
      knownValueCount: 5,
      ratio: 5 / 6,
      gaps: [{ from: '2025-02', to: '2025-02', strategy: 'NONE' }],
    });
  });

  it('produces a deterministic, versioned fingerprint', () => {
    expect(climateFingerprint(monthly)).toBe(climateFingerprint(monthly));
    expect(climateFingerprint(monthly)).toMatch(/^climate-fnv1a-v1-/);
    expect(climateFingerprint({ ...monthly, id: 'different' })).not.toBe(
      climateFingerprint(monthly),
    );
  });

  it('rejects empty dataset provenance and duplicate completeness fields', () => {
    const invalid: ClimateDataset = {
      ...monthly,
      id: '',
      source: { id: '', provider: '' },
    };
    expect(validateClimateDataset(invalid).map(({ code }) => code)).toContain(
      'CLIMATE_EMPTY_ID',
    );
    expect(() =>
      analyzeClimateCompleteness(monthly, [
        'precipitationMm',
        'precipitationMm',
      ]),
    ).toThrow(/unique/);
  });
});
