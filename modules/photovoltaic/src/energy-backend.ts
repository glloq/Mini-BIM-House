export interface PvEnergyBackend<Input> {
  readonly id: string;
  readonly version: string;
  readonly calculate: (input: Input) => Promise<PvEnergyResult>;
}

export interface PvEnergyPeriodResult {
  readonly period: string;
  readonly energyKWh: number;
}

export interface PvEnergyResult {
  readonly status: 'ESTIMATE';
  readonly backendId: string;
  readonly backendVersion: string;
  readonly source: PvEnergySource;
  readonly installedPowerKWp: number;
  readonly periods: readonly PvEnergyPeriodResult[];
  readonly annualEnergyKWh: number;
  readonly specificYieldKWhPerKWp: number;
  readonly assumptions: Readonly<Record<string, string | number | boolean>>;
}

export interface PvEnergySource {
  readonly provider: string;
  readonly datasetId?: string;
  readonly datasetFingerprint?: string;
  readonly referenceUrl?: string;
}

export interface OfflinePvEnergyInput {
  readonly installedPowerWp: number;
  /** Irradiation already projected onto the module plane. */
  readonly planeIrradiation: readonly {
    readonly period: string;
    readonly irradiationWhM2: number;
  }[];
  readonly performanceRatio: number;
  readonly source: PvEnergySource;
}

export const offlineSimplePvBackend: PvEnergyBackend<OfflinePvEnergyInput> = {
  id: 'OFFLINE_SIMPLE',
  version: '1.0.0',
  async calculate(input): Promise<PvEnergyResult> {
    validateInstalledPower(input.installedPowerWp);
    validateRatio(input.performanceRatio, 'performance ratio');
    validateSource(input.source);
    validatePeriods(input.planeIrradiation);
    const installedPowerKWp = input.installedPowerWp / 1_000;
    const periods = [...input.planeIrradiation]
      .sort((first, second) => first.period.localeCompare(second.period))
      .map(({ period, irradiationWhM2 }): PvEnergyPeriodResult => ({
        period,
        energyKWh:
          (input.installedPowerWp * irradiationWhM2 * input.performanceRatio) /
          1_000_000,
      }));
    const annualEnergyKWh = periods.reduce(
      (total, { energyKWh }) => total + energyKWh,
      0,
    );
    return {
      status: 'ESTIMATE',
      backendId: 'OFFLINE_SIMPLE',
      backendVersion: '1.0.0',
      source: structuredClone(input.source),
      installedPowerKWp,
      periods,
      annualEnergyKWh,
      specificYieldKWhPerKWp: annualEnergyKWh / installedPowerKWp,
      assumptions: {
        method: 'plane-irradiation-times-peak-power',
        performanceRatio: input.performanceRatio,
      },
    };
  },
};

export interface PvgisPvEnergyInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly installedPowerWp: number;
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
  readonly systemLossPercent: number;
  readonly datasetId?: string;
}

export interface PvgisTransportRequest {
  readonly latitude: number;
  readonly longitude: number;
  readonly peakPowerKWp: number;
  readonly azimuthDeg: number;
  readonly tiltDeg: number;
  readonly systemLossPercent: number;
  readonly datasetId?: string;
}

export interface PvgisTransportResponse {
  readonly provider: 'PVGIS';
  readonly datasetId?: string;
  readonly referenceUrl: string;
  readonly monthlyEnergyKWh: readonly {
    readonly month: number;
    readonly energyKWh: number;
  }[];
}

/** Transport is injected so the photovoltaic core never imports HTTP or PVGIS SDK code. */
export interface PvgisTransport {
  readonly requestMonthlyEnergy: (
    request: PvgisTransportRequest,
  ) => Promise<PvgisTransportResponse>;
}

export function createPvgisPvBackend(
  transport: PvgisTransport,
): PvEnergyBackend<PvgisPvEnergyInput> {
  return {
    id: 'PVGIS',
    version: 'contract-v1',
    async calculate(input): Promise<PvEnergyResult> {
      validatePvgisInput(input);
      const installedPowerKWp = input.installedPowerWp / 1_000;
      const response = await transport.requestMonthlyEnergy({
        latitude: input.latitude,
        longitude: input.longitude,
        peakPowerKWp: installedPowerKWp,
        azimuthDeg: input.azimuthDeg,
        tiltDeg: input.tiltDeg,
        systemLossPercent: input.systemLossPercent,
        ...(input.datasetId === undefined
          ? {}
          : { datasetId: input.datasetId }),
      });
      validatePvgisResponse(response);
      const periods = [...response.monthlyEnergyKWh]
        .sort((first, second) => first.month - second.month)
        .map(({ month, energyKWh }) => ({
          period: `MONTH-${month.toString().padStart(2, '0')}`,
          energyKWh,
        }));
      const annualEnergyKWh = periods.reduce(
        (total, { energyKWh }) => total + energyKWh,
        0,
      );
      return {
        status: 'ESTIMATE',
        backendId: 'PVGIS',
        backendVersion: 'contract-v1',
        source: {
          provider: response.provider,
          ...(response.datasetId === undefined
            ? {}
            : { datasetId: response.datasetId }),
          referenceUrl: response.referenceUrl,
        },
        installedPowerKWp,
        periods,
        annualEnergyKWh,
        specificYieldKWhPerKWp: annualEnergyKWh / installedPowerKWp,
        assumptions: {
          azimuthDeg: input.azimuthDeg,
          tiltDeg: input.tiltDeg,
          systemLossPercent: input.systemLossPercent,
        },
      };
    },
  };
}

function validatePeriods(
  periods: OfflinePvEnergyInput['planeIrradiation'],
): void {
  if (periods.length === 0) throw new RangeError('Irradiation series is empty');
  const ids = new Set<string>();
  for (const { period, irradiationWhM2 } of periods) {
    if (period.trim() === '' || ids.has(period))
      throw new RangeError(
        'Irradiation period IDs must be non-empty and unique',
      );
    ids.add(period);
    nonNegative(irradiationWhM2, 'plane irradiation');
  }
}

function validatePvgisInput(input: PvgisPvEnergyInput): void {
  validateInstalledPower(input.installedPowerWp);
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180 ||
    !Number.isFinite(input.azimuthDeg) ||
    input.azimuthDeg < 0 ||
    input.azimuthDeg >= 360 ||
    !Number.isFinite(input.tiltDeg) ||
    input.tiltDeg < 0 ||
    input.tiltDeg >= 90 ||
    !Number.isFinite(input.systemLossPercent) ||
    input.systemLossPercent < 0 ||
    input.systemLossPercent >= 100 ||
    (input.datasetId !== undefined && input.datasetId.trim() === '')
  )
    throw new RangeError(
      'PVGIS location, orientation, loss, or dataset is invalid',
    );
}

function validatePvgisResponse(response: PvgisTransportResponse): void {
  if (
    response.provider !== 'PVGIS' ||
    response.referenceUrl.trim() === '' ||
    response.monthlyEnergyKWh.length !== 12 ||
    new Set(response.monthlyEnergyKWh.map(({ month }) => month)).size !== 12 ||
    response.monthlyEnergyKWh.some(
      ({ month, energyKWh }) =>
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isFinite(energyKWh) ||
        energyKWh < 0,
    )
  )
    throw new RangeError(
      'PVGIS transport returned an invalid monthly response',
    );
}

function validateInstalledPower(value: number): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError('Installed peak power must be finite and positive');
}

function validateRatio(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1)
    throw new RangeError(`${name} must be in (0, 1]`);
}

function validateSource(source: PvEnergySource): void {
  if (
    source.provider.trim() === '' ||
    (source.datasetId !== undefined && source.datasetId.trim() === '') ||
    (source.datasetFingerprint !== undefined &&
      source.datasetFingerprint.trim() === '') ||
    (source.referenceUrl !== undefined && source.referenceUrl.trim() === '')
  )
    throw new TypeError('PV energy source fields must not be empty');
}

function nonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative`);
}
