import type {
  ClimateDataset,
  ClimateSampleProperty,
} from '@house-technical-designer/climate';
import { analyzeClimateCompleteness } from '@house-technical-designer/climate';

/**
 * What one module needs from a climate dataset.
 *
 * There is no single notion of a "complete" dataset: a file carrying only
 * temperatures is complete for the heating load and useless for rainwater.
 * Each module states what it reads, and coverage is reported per module.
 */
export interface ClimateConsumer {
  readonly moduleId: string;
  readonly label: string;
  readonly properties: readonly ClimateSampleProperty[];
  /** Time step the module needs, when it needs one. */
  readonly resolution?: ClimateDataset['resolution'];
}

export const CLIMATE_CONSUMERS: readonly ClimateConsumer[] = [
  {
    moduleId: 'heating',
    label: 'Chauffage',
    properties: ['airTemperatureC'],
  },
  {
    moduleId: 'energy-balance',
    label: 'Bilan énergétique',
    properties: ['airTemperatureC'],
  },
  {
    moduleId: 'photovoltaic',
    label: 'Photovoltaïque',
    properties: ['globalHorizontalIrradianceWhM2', 'airTemperatureC'],
  },
  {
    moduleId: 'battery',
    label: 'Batterie',
    properties: ['globalHorizontalIrradianceWhM2'],
    resolution: 'HOURLY',
  },
  {
    moduleId: 'hygrothermal',
    label: 'Hygrothermie',
    properties: ['airTemperatureC', 'relativeHumidity'],
  },
  {
    moduleId: 'rainwater',
    label: 'Eaux pluviales',
    properties: ['precipitationMm'],
  },
];

export type CoverageVerdict = 'COVERED' | 'PARTIAL' | 'ABSENT' | 'WRONG_STEP';

export interface ModuleCoverage {
  readonly moduleId: string;
  readonly label: string;
  readonly verdict: CoverageVerdict;
  /** Properties the dataset does not carry at all. */
  readonly missing: readonly ClimateSampleProperty[];
  /** Share of the expected values the dataset actually holds. */
  readonly ratio: number;
}

export const PROPERTY_LABELS: Readonly<
  Partial<Record<ClimateSampleProperty, string>>
> = {
  airTemperatureC: 'température',
  relativeHumidity: 'humidité relative',
  globalHorizontalIrradianceWhM2: 'ensoleillement global',
  directNormalIrradianceWhM2: 'ensoleillement direct',
  diffuseHorizontalIrradianceWhM2: 'ensoleillement diffus',
  precipitationMm: 'précipitations',
  windSpeedMs: 'vent',
  windDirectionDeg: 'direction du vent',
  atmosphericPressurePa: 'pression',
};

export function propertyLabel(property: ClimateSampleProperty): string {
  return PROPERTY_LABELS[property] ?? property;
}

function carries(
  dataset: ClimateDataset,
  property: ClimateSampleProperty,
): boolean {
  return dataset.samples.some((sample) => sample[property] !== undefined);
}

/**
 * What each module can and cannot do with a dataset.
 *
 * A property no sample carries is absent, which is not the same as a property
 * present with gaps: the first makes the module impossible, the second makes
 * it partial. Reporting one number for the whole file would hide both.
 */
export function moduleCoverage(
  dataset: ClimateDataset,
): readonly ModuleCoverage[] {
  return CLIMATE_CONSUMERS.map((consumer) => {
    const missing = consumer.properties.filter(
      (property) => !carries(dataset, property),
    );
    const present = consumer.properties.filter((property) =>
      carries(dataset, property),
    );
    const ratio =
      present.length === 0
        ? 0
        : analyzeClimateCompleteness(dataset, present).ratio;
    const verdict: CoverageVerdict =
      missing.length === consumer.properties.length
        ? 'ABSENT'
        : missing.length > 0
          ? 'PARTIAL'
          : consumer.resolution !== undefined &&
              dataset.resolution !== consumer.resolution
            ? 'WRONG_STEP'
            : ratio < 1
              ? 'PARTIAL'
              : 'COVERED';
    return {
      moduleId: consumer.moduleId,
      label: consumer.label,
      verdict,
      missing,
      ratio,
    };
  });
}

/** Why a module cannot use the dataset, in the user's terms. */
export function coverageDetail(
  coverage: ModuleCoverage,
  dataset: ClimateDataset,
): string {
  const consumer = CLIMATE_CONSUMERS.find(
    ({ moduleId }) => moduleId === coverage.moduleId,
  );
  switch (coverage.verdict) {
    case 'COVERED':
      return 'toutes les grandeurs nécessaires sont présentes';
    case 'ABSENT':
    case 'PARTIAL':
      return coverage.missing.length > 0
        ? `absent : ${coverage.missing.map(propertyLabel).join(', ')}`
        : `${(coverage.ratio * 100).toFixed(0)} % des valeurs renseignées`;
    case 'WRONG_STEP':
      return `pas de temps ${dataset.resolution.toLowerCase()} au lieu de ${(consumer?.resolution ?? '').toLowerCase()}`;
  }
}
