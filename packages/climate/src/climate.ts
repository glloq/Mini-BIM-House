export type ClimateResolution =
  | 'HOURLY'
  | 'DAILY'
  | 'MONTHLY'
  | 'DESIGN_CONDITIONS';

export interface ClimateLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitudeM?: number;
  readonly timezone: string;
}

export interface ClimateSource {
  readonly id: string;
  readonly provider: string;
  readonly datasetName?: string;
  readonly stationId?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly retrievedAt?: string;
  readonly license?: string;
  readonly referenceUrl?: string;
}

export interface ClimateSample {
  readonly timestamp?: string;
  readonly airTemperatureC?: number;
  readonly relativeHumidity?: number;
  readonly globalHorizontalIrradianceWhM2?: number;
  readonly directNormalIrradianceWhM2?: number;
  readonly diffuseHorizontalIrradianceWhM2?: number;
  readonly precipitationMm?: number;
  readonly windSpeedMs?: number;
  readonly windDirectionDeg?: number;
  readonly atmosphericPressurePa?: number;
}

export interface ClimateDataset {
  readonly id: string;
  readonly location: ClimateLocation;
  readonly resolution: ClimateResolution;
  readonly source: ClimateSource;
  readonly samples: readonly ClimateSample[];
}

export type ClimateSampleProperty = Exclude<keyof ClimateSample, 'timestamp'>;

export interface DataGap {
  readonly from: string;
  readonly to: string;
  readonly strategy: 'NONE';
}

export interface ClimateCompleteness {
  readonly expectedValueCount: number;
  readonly knownValueCount: number;
  readonly ratio: number;
  readonly gaps: readonly DataGap[];
}

export interface ClimateIssue {
  readonly code:
    | 'CLIMATE_EMPTY_ID'
    | 'CLIMATE_INVALID_LOCATION'
    | 'CLIMATE_MISSING_TIMEZONE'
    | 'CLIMATE_INVALID_TIMESTAMP'
    | 'CLIMATE_UNORDERED_TIMESTAMPS'
    | 'CLIMATE_INVALID_VALUE';
  readonly path: string;
  readonly message: string;
}

export function validateClimateDataset(
  dataset: ClimateDataset,
): readonly ClimateIssue[] {
  const issues: ClimateIssue[] = [];
  if (
    dataset.id.trim() === '' ||
    dataset.source.id.trim() === '' ||
    dataset.source.provider.trim() === ''
  )
    issues.push(
      issue(
        'CLIMATE_EMPTY_ID',
        'id',
        'Dataset, source, and provider identifiers must not be empty.',
      ),
    );
  if (
    !Number.isFinite(dataset.location.latitude) ||
    dataset.location.latitude < -90 ||
    dataset.location.latitude > 90 ||
    !Number.isFinite(dataset.location.longitude) ||
    dataset.location.longitude < -180 ||
    dataset.location.longitude > 180 ||
    (dataset.location.altitudeM !== undefined &&
      !Number.isFinite(dataset.location.altitudeM))
  )
    issues.push(
      issue(
        'CLIMATE_INVALID_LOCATION',
        'location',
        'Coordinates and altitude must be finite and coordinates must be in range.',
      ),
    );
  if (dataset.location.timezone.trim() === '')
    issues.push(
      issue(
        'CLIMATE_MISSING_TIMEZONE',
        'location.timezone',
        'Climate datasets require an explicit timezone.',
      ),
    );
  let previousTimestamp: string | undefined;
  dataset.samples.forEach((sample, index) => {
    if (dataset.resolution !== 'DESIGN_CONDITIONS') {
      if (
        sample.timestamp === undefined ||
        !validTimestamp(sample.timestamp, dataset.resolution)
      )
        issues.push(
          issue(
            'CLIMATE_INVALID_TIMESTAMP',
            `samples[${index}].timestamp`,
            `Timestamp does not match ${dataset.resolution}.`,
          ),
        );
      else {
        if (
          previousTimestamp !== undefined &&
          timestampOrder(sample.timestamp, dataset.resolution) <=
            timestampOrder(previousTimestamp, dataset.resolution)
        )
          issues.push(
            issue(
              'CLIMATE_UNORDERED_TIMESTAMPS',
              `samples[${index}].timestamp`,
              'Timestamps must be strictly increasing.',
            ),
          );
        previousTimestamp = sample.timestamp;
      }
    }
    validateSample(sample, index, issues);
  });
  return issues;
}

export function createClimateDataset(dataset: ClimateDataset): ClimateDataset {
  const issues = validateClimateDataset(dataset);
  if (issues.length > 0)
    throw new RangeError(
      issues.map(({ path, message }) => `${path}: ${message}`).join('; '),
    );
  return structuredClone(dataset);
}

export function analyzeClimateCompleteness(
  dataset: ClimateDataset,
  requiredProperties: readonly ClimateSampleProperty[],
): ClimateCompleteness {
  if (new Set(requiredProperties).size !== requiredProperties.length)
    throw new RangeError('Required climate properties must be unique');
  const expectedValueCount = dataset.samples.length * requiredProperties.length;
  const knownValueCount = dataset.samples.reduce(
    (total, sample) =>
      total +
      requiredProperties.filter((property) => sample[property] !== undefined)
        .length,
    0,
  );
  const timestamps = dataset.samples.flatMap(({ timestamp }) =>
    timestamp === undefined ? [] : [timestamp],
  );
  return {
    expectedValueCount,
    knownValueCount,
    ratio: expectedValueCount === 0 ? 1 : knownValueCount / expectedValueCount,
    gaps: detectTimestampGaps(timestamps, dataset.resolution),
  };
}

export function climateFingerprint(dataset: ClimateDataset): string {
  const canonical = canonicalJson(dataset);
  let hash = 2_166_136_261;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `climate-fnv1a-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateSample(
  sample: ClimateSample,
  index: number,
  issues: ClimateIssue[],
): void {
  for (const [property, value] of Object.entries(sample)) {
    if (property === 'timestamp' || value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push(
        issue(
          'CLIMATE_INVALID_VALUE',
          `samples[${index}].${property}`,
          'Climate values must be finite numbers.',
        ),
      );
      continue;
    }
    if (
      (property === 'relativeHumidity' && (value < 0 || value > 1)) ||
      ([
        'globalHorizontalIrradianceWhM2',
        'directNormalIrradianceWhM2',
        'diffuseHorizontalIrradianceWhM2',
        'precipitationMm',
        'windSpeedMs',
      ].includes(property) &&
        value < 0) ||
      (property === 'windDirectionDeg' && (value < 0 || value >= 360)) ||
      (property === 'atmosphericPressurePa' && value <= 0)
    )
      issues.push(
        issue(
          'CLIMATE_INVALID_VALUE',
          `samples[${index}].${property}`,
          `${property} is outside its valid range.`,
        ),
      );
  }
}

function validTimestamp(
  timestamp: string,
  resolution: ClimateResolution,
): boolean {
  if (resolution === 'MONTHLY')
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(timestamp);
  if (resolution === 'DAILY') return validDate(timestamp);
  if (resolution === 'HOURLY')
    return !Number.isNaN(Date.parse(timestamp)) && /T/.test(timestamp);
  return true;
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toISOString().slice(0, 10) === value;
}

function detectTimestampGaps(
  timestamps: readonly string[],
  resolution: ClimateResolution,
): readonly DataGap[] {
  if (resolution === 'DESIGN_CONDITIONS') return [];
  const gaps: DataGap[] = [];
  for (let index = 1; index < timestamps.length; index += 1) {
    const expected = nextTimestamp(timestamps[index - 1]!, resolution);
    if (!sameTimestamp(expected, timestamps[index]!, resolution))
      gaps.push({
        from: expected,
        to: previousTimestamp(timestamps[index]!, resolution),
        strategy: 'NONE',
      });
  }
  return gaps;
}

function previousTimestamp(
  timestamp: string,
  resolution: ClimateResolution,
): string {
  if (resolution === 'MONTHLY') {
    const [year, month] = timestamp.split('-').map(Number) as [number, number];
    return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  }
  const date = new Date(timestamp);
  date.setTime(
    date.getTime() - (resolution === 'HOURLY' ? 3_600_000 : 86_400_000),
  );
  return resolution === 'HOURLY'
    ? date.toISOString()
    : date.toISOString().slice(0, 10);
}

function sameTimestamp(
  first: string,
  second: string,
  resolution: ClimateResolution,
): boolean {
  return (
    timestampOrder(first, resolution) === timestampOrder(second, resolution)
  );
}

function timestampOrder(
  timestamp: string,
  _resolution: ClimateResolution,
): number {
  return Date.parse(timestamp);
}

function nextTimestamp(
  timestamp: string,
  resolution: ClimateResolution,
): string {
  if (resolution === 'MONTHLY') {
    const [year, month] = timestamp.split('-').map(Number) as [number, number];
    const date = new Date(Date.UTC(year, month, 1));
    return date.toISOString().slice(0, 7);
  }
  const date = new Date(timestamp);
  date.setTime(
    date.getTime() + (resolution === 'HOURLY' ? 3_600_000 : 86_400_000),
  );
  return resolution === 'HOURLY'
    ? date.toISOString()
    : date.toISOString().slice(0, 10);
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

function issue(
  code: ClimateIssue['code'],
  path: string,
  message: string,
): ClimateIssue {
  return { code, path, message };
}
