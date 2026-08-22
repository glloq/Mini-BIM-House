import { describe, expect, it } from 'vitest';
import type { ClimateDataset } from './climate.js';
import { primarySeries, selectClimate } from './bundle.js';

function dataset(
  id: string,
  resolution: ClimateDataset['resolution'],
  latitude = 48.1,
  longitude = -1.7,
): ClimateDataset {
  return {
    id,
    location: { latitude, longitude, timezone: 'Europe/Paris' },
    resolution,
    source: { id: 'test', kind: 'MEASURED', reference: 'test' } as never,
    samples: [],
  };
}

const RENNES = [
  dataset('rennes-monthly', 'MONTHLY'),
  dataset('rennes-design', 'DESIGN_CONDITIONS'),
  dataset('rennes-hourly', 'HOURLY'),
];
const PARIS = dataset('paris-hourly', 'HOURLY', 48.86, 2.35);

describe('which weather a project is computed with', () => {
  it('gathers every series of the place the project named', () => {
    const selection = selectClimate([...RENNES, PARIS], 'rennes-monthly');
    expect(selection.status).toBe('OK');
    if (selection.status !== 'OK') return;
    expect(selection.bundle.id).toBe('rennes-monthly');
    expect(selection.bundle.monthly?.id).toBe('rennes-monthly');
    expect(selection.bundle.design?.id).toBe('rennes-design');
    // The hourly file of another town is not this town's hourly file.
    expect(selection.bundle.hourly?.id).toBe('rennes-hourly');
    expect(selection.bundle.datasets).toHaveLength(3);
  });

  it('refuses to compute with a climate nobody asked for', () => {
    // A project asking for Bordeaux and given Paris and Nantes used to be
    // computed with one of them, and nothing said so.
    const selection = selectClimate([PARIS], 'bordeaux');
    expect(selection.status).toBe('MISSING');
    if (selection.status !== 'MISSING') return;
    expect(selection.requested).toBe('bordeaux');
    expect(selection.available).toEqual(['paris-hourly']);
    expect(selection.message).toContain('bordeaux');
    expect(selection.message).toContain('paris-hourly');
  });

  it('says so when a climate is loaded and the project names none', () => {
    const selection = selectClimate([PARIS], undefined);
    expect(selection.status).toBe('UNSPECIFIED');
  });

  it('calls a project with no climate at all a project with no climate', () => {
    // Not an error: a project may simply not have one yet.
    expect(selectClimate([], undefined)).toEqual({ status: 'NONE' });
  });

  it('never pairs a design day of one place with a year of another', () => {
    const selection = selectClimate(
      [dataset('rennes-design', 'DESIGN_CONDITIONS'), PARIS],
      'rennes-design',
    );
    if (selection.status !== 'OK') throw new Error(selection.status);
    expect(selection.bundle.hourly).toBeUndefined();
    expect(selection.bundle.datasets.map(({ id }) => id)).toEqual([
      'rennes-design',
    ]);
  });

  it('reads the series the project named before the coarse one', () => {
    const selection = selectClimate(RENNES, 'rennes-design');
    if (selection.status !== 'OK') throw new Error(selection.status);
    expect(primarySeries(selection.bundle).id).toBe('rennes-design');
  });
});
