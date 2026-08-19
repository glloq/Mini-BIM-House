import { describe, expect, it } from 'vitest';
import {
  calculateRoomAcoustics,
  compareAcousticTreatments,
  type RoomAcousticsMethod,
} from './room-acoustics.js';

const method: RoomAcousticsMethod = {
  id: 'sabine-test',
  version: '1',
  reverberationConstant: 0.16,
  bandsHz: [500, 1_000],
  assumptions: ['Diffuse field approximation'],
};
const input = {
  roomId: 'room',
  volumeM3: 100,
  surfaces: [
    {
      surfaceId: 'floor',
      areaM2: 20,
      absorptionCoefficientByBand: { 500: 0.1, 1000: 0.2 },
    },
    {
      surfaceId: 'ceiling',
      areaM2: 20,
      absorptionCoefficientByBand: { 500: 0.5, 1000: 0.6 },
    },
  ],
} as const;

describe('room acoustics', () => {
  it('ACO-001 sums equivalent absorption by band', () => {
    expect(
      calculateRoomAcoustics(input, method).bands[0]
        ?.equivalentAbsorptionAreaM2,
    ).toBe(12);
  });
  it('ACO-002 increasing absorption reduces Sabine reverberation time', () => {
    const base = calculateRoomAcoustics(input, method).bands[0]
      ?.reverberationTimeS;
    const treated = calculateRoomAcoustics(
      {
        ...input,
        surfaces: input.surfaces.map((surface) => ({
          ...surface,
          absorptionCoefficientByBand: {
            ...surface.absorptionCoefficientByBand,
            500: 0.8,
          },
        })),
      },
      method,
    ).bands[0]?.reverberationTimeS;
    expect(treated).toBeLessThan(base ?? 0);
  });
  it('ACO-003 keeps a band unknown when one surface coefficient is missing', () => {
    const result = calculateRoomAcoustics(
      { ...input, surfaces: [{ surfaceId: 'unknown', areaM2: 10 }] },
      method,
    );
    expect(result.bands[0]?.equivalentAbsorptionAreaM2).toBeUndefined();
    expect(result.bands[0]?.reverberationTimeS).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe('ACOUSTIC_MISSING_ABSORPTION');
  });
  it('ACO-004 always identifies the method and its assumptions', () => {
    expect(calculateRoomAcoustics(input, method)).toMatchObject({
      methodId: 'sabine-test',
      methodVersion: '1',
      assumptions: ['Diffuse field approximation'],
    });
  });
  it('compares treatment area without embedding a target or catalog value', () => {
    const result = calculateRoomAcoustics(input, method);
    const proposals = compareAcousticTreatments(
      result,
      100,
      500,
      0.8,
      [
        { treatmentId: 'missing', absorptionCoefficientByBand: {} },
        { treatmentId: 'panel', absorptionCoefficientByBand: { 500: 0.8 } },
      ],
      method,
    );
    expect(proposals).toEqual([
      {
        treatmentId: 'missing',
        bandHz: 500,
        targetReverberationTimeS: 0.8,
        reason: 'MISSING_TREATMENT_COEFFICIENT',
      },
      {
        treatmentId: 'panel',
        bandHz: 500,
        targetReverberationTimeS: 0.8,
        additionalAreaM2: 10,
      },
    ]);
  });
  it('rejects invalid absorption and duplicate surfaces', () => {
    expect(() =>
      calculateRoomAcoustics(
        {
          roomId: 'room',
          volumeM3: 10,
          surfaces: [
            {
              surfaceId: 'bad',
              areaM2: 1,
              absorptionCoefficientByBand: { 500: 1.1 },
            },
          ],
        },
        method,
      ),
    ).toThrow(RangeError);
    expect(() =>
      calculateRoomAcoustics(
        {
          roomId: 'room',
          volumeM3: 10,
          surfaces: [
            { surfaceId: 'same', areaM2: 1 },
            { surfaceId: 'same', areaM2: 2 },
          ],
        },
        method,
      ),
    ).toThrow(TypeError);
  });
});
