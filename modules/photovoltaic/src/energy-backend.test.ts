import { describe, expect, it } from 'vitest';
import {
  createPvgisPvBackend,
  offlineSimplePvBackend,
  type PvgisTransport,
} from './energy-backend.js';

describe('photovoltaic energy backends', () => {
  it('calculates a traceable offline estimate from plane irradiation', async () => {
    const result = await offlineSimplePvBackend.calculate({
      installedPowerWp: 9_000,
      planeIrradiation: [
        { period: '2025-02', irradiationWhM2: 100_000 },
        { period: '2025-01', irradiationWhM2: 50_000 },
      ],
      performanceRatio: 0.8,
      source: {
        provider: 'USER',
        datasetId: 'plane-series',
        datasetFingerprint: 'sha256-example',
      },
    });
    expect(result).toMatchObject({
      status: 'ESTIMATE',
      backendId: 'OFFLINE_SIMPLE',
      backendVersion: '1.0.0',
      installedPowerKWp: 9,
      annualEnergyKWh: 1_080,
      specificYieldKWhPerKWp: 120,
      source: { datasetFingerprint: 'sha256-example' },
      assumptions: { performanceRatio: 0.8 },
    });
    expect(result.periods).toEqual([
      { period: '2025-01', energyKWh: 360 },
      { period: '2025-02', energyKWh: 720 },
    ]);
  });

  it('implements PV-004 with backend and source on every result', async () => {
    const offline = await offlineSimplePvBackend.calculate({
      installedPowerWp: 1_000,
      planeIrradiation: [{ period: 'year', irradiationWhM2: 1_000_000 }],
      performanceRatio: 1,
      source: { provider: 'TEST', referenceUrl: 'https://example.test/data' },
    });
    expect(offline.backendId).toBeTruthy();
    expect(offline.source.provider).toBe('TEST');
  });

  it('isolates PVGIS behind an injected transport contract', async () => {
    const requests: unknown[] = [];
    const transport: PvgisTransport = {
      async requestMonthlyEnergy(request) {
        requests.push(request);
        return {
          provider: 'PVGIS',
          datasetId: 'SARAH3',
          referenceUrl: 'https://re.jrc.ec.europa.eu/pvg_tools/en/',
          monthlyEnergyKWh: Array.from({ length: 12 }, (_, index) => ({
            month: 12 - index,
            energyKWh: 100,
          })),
        };
      },
    };
    const backend = createPvgisPvBackend(transport);
    const result = await backend.calculate({
      latitude: 48,
      longitude: 2,
      installedPowerWp: 3_000,
      azimuthDeg: 180,
      tiltDeg: 30,
      systemLossPercent: 14,
      datasetId: 'SARAH3',
    });
    expect(requests).toEqual([
      expect.objectContaining({ peakPowerKWp: 3, datasetId: 'SARAH3' }),
    ]);
    expect(result).toMatchObject({
      backendId: 'PVGIS',
      backendVersion: 'contract-v1',
      annualEnergyKWh: 1_200,
      specificYieldKWhPerKWp: 400,
      source: { provider: 'PVGIS', datasetId: 'SARAH3' },
    });
    expect(result.periods[0]?.period).toBe('MONTH-01');
  });

  it('rejects incomplete offline data without inventing irradiation', async () => {
    await expect(
      offlineSimplePvBackend.calculate({
        installedPowerWp: 1_000,
        planeIrradiation: [],
        performanceRatio: 0.8,
        source: { provider: 'USER' },
      }),
    ).rejects.toThrow(/empty/);
    await expect(
      offlineSimplePvBackend.calculate({
        installedPowerWp: 1_000,
        planeIrradiation: [
          { period: 'same', irradiationWhM2: 10 },
          { period: 'same', irradiationWhM2: 20 },
        ],
        performanceRatio: 0.8,
        source: { provider: 'USER' },
      }),
    ).rejects.toThrow(/unique/);
  });

  it('rejects malformed PVGIS transport responses at the adapter boundary', async () => {
    const backend = createPvgisPvBackend({
      async requestMonthlyEnergy() {
        return {
          provider: 'PVGIS',
          referenceUrl: 'https://example.test',
          monthlyEnergyKWh: [{ month: 1, energyKWh: 100 }],
        };
      },
    });
    await expect(
      backend.calculate({
        latitude: 48,
        longitude: 2,
        installedPowerWp: 1_000,
        azimuthDeg: 180,
        tiltDeg: 30,
        systemLossPercent: 14,
      }),
    ).rejects.toThrow(/invalid monthly response/);
  });
});
