import { describe, expect, it } from 'vitest';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { coverageDetail, moduleCoverage } from './climate-coverage.js';

function dataset(
  samples: readonly Record<string, number>[],
  resolution: ClimateDataset['resolution'] = 'MONTHLY',
): ClimateDataset {
  return {
    id: 'quimper',
    location: { latitude: 48, longitude: -4, timezone: 'Europe/Paris' },
    resolution,
    source: { id: 'source', provider: 'Démonstration' },
    samples: samples,
  };
}

describe('climate coverage', () => {
  it('does not call a dataset complete for a module whose property is absent', () => {
    const temperaturesOnly = dataset([
      { airTemperatureC: 5 },
      { airTemperatureC: 12 },
    ]);
    const byModule = new Map(
      moduleCoverage(temperaturesOnly).map((entry) => [entry.moduleId, entry]),
    );
    expect(byModule.get('heating')?.verdict).toBe('COVERED');
    // Rainwater needs rain, and this file has none.
    expect(byModule.get('rainwater')?.verdict).toBe('ABSENT');
    expect(byModule.get('hygrothermal')?.verdict).toBe('PARTIAL');
    expect(byModule.get('photovoltaic')?.verdict).toBe('PARTIAL');
  });

  it('names the missing quantity rather than a percentage', () => {
    const coverage = moduleCoverage(dataset([{ airTemperatureC: 5 }])).find(
      ({ moduleId }) => moduleId === 'rainwater',
    )!;
    expect(coverageDetail(coverage, dataset([]))).toContain('précipitations');
  });

  it('reports a time step a module cannot work with', () => {
    const monthly = dataset([
      { globalHorizontalIrradianceWhM2: 90, airTemperatureC: 5 },
    ]);
    const battery = moduleCoverage(monthly).find(
      ({ moduleId }) => moduleId === 'battery',
    )!;
    expect(battery.verdict).toBe('WRONG_STEP');
    expect(coverageDetail(battery, monthly)).toContain('hourly');
  });

  it('covers every module when every quantity is present at the right step', () => {
    const complete = dataset(
      [
        {
          airTemperatureC: 5,
          relativeHumidity: 0.8,
          globalHorizontalIrradianceWhM2: 90,
          precipitationMm: 4,
        },
      ],
      'HOURLY',
    );
    expect(
      moduleCoverage(complete).every(({ verdict }) => verdict === 'COVERED'),
    ).toBe(true);
  });
});
