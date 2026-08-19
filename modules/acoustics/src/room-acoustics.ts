export const OCTAVE_BANDS_HZ = [125, 250, 500, 1_000, 2_000, 4_000] as const;
export type OctaveBandHz = (typeof OCTAVE_BANDS_HZ)[number];

export interface AcousticSurface {
  readonly surfaceId: string;
  readonly areaM2: number;
  readonly absorptionCoefficientByBand?: Readonly<
    Partial<Record<OctaveBandHz, number>>
  >;
}

export interface RoomAcousticsMethod {
  readonly id: string;
  readonly version: string;
  /** Sabine-style constant matching m³, m² and seconds. */
  readonly reverberationConstant: number;
  readonly bandsHz: readonly OctaveBandHz[];
  readonly assumptions: readonly string[];
}

export interface RoomAcousticsInput {
  readonly roomId: string;
  readonly volumeM3?: number;
  readonly surfaces: readonly AcousticSurface[];
}

export type AcousticDiagnosticCode =
  | 'ACOUSTIC_MISSING_VOLUME'
  | 'ACOUSTIC_MISSING_ABSORPTION'
  | 'ACOUSTIC_ZERO_EQUIVALENT_ABSORPTION';

export interface AcousticDiagnostic {
  readonly code: AcousticDiagnosticCode;
  readonly roomId: string;
  readonly bandHz?: OctaveBandHz;
  readonly surfaceId?: string;
  readonly message: string;
}

export interface AcousticSurfaceContribution {
  readonly surfaceId: string;
  readonly areaM2: number;
  readonly absorptionCoefficient?: number;
  readonly equivalentAbsorptionAreaM2?: number;
}

export interface RoomAcousticBandResult {
  readonly bandHz: OctaveBandHz;
  readonly equivalentAbsorptionAreaM2?: number;
  readonly reverberationTimeS?: number;
  readonly surfaceContributions: readonly AcousticSurfaceContribution[];
}

export interface RoomAcousticsResult {
  readonly status: 'OK' | 'PARTIAL';
  readonly roomId: string;
  readonly methodId: string;
  readonly methodVersion: string;
  readonly assumptions: readonly string[];
  readonly bands: readonly RoomAcousticBandResult[];
  readonly diagnostics: readonly AcousticDiagnostic[];
}

/** Calculates equivalent absorption and a simplified Sabine RT per octave band. */
export function calculateRoomAcoustics(
  input: RoomAcousticsInput,
  method: RoomAcousticsMethod,
): RoomAcousticsResult {
  validateMethod(method);
  if (input.roomId.trim() === '')
    throw new TypeError('Room ID must not be empty.');
  if (input.volumeM3 !== undefined)
    assertPositiveFinite(input.volumeM3, 'room volume');
  const surfaceIds = new Set<string>();
  for (const surface of input.surfaces) {
    if (surface.surfaceId.trim() === '')
      throw new TypeError('Surface ID must not be empty.');
    if (surfaceIds.has(surface.surfaceId))
      throw new TypeError(
        `Duplicate acoustic surface ID ${surface.surfaceId}.`,
      );
    surfaceIds.add(surface.surfaceId);
    assertNonNegativeFinite(
      surface.areaM2,
      `surface ${surface.surfaceId} area`,
    );
    for (const coefficient of Object.values(
      surface.absorptionCoefficientByBand ?? {},
    ))
      if (
        coefficient !== undefined &&
        (!Number.isFinite(coefficient) || coefficient < 0 || coefficient > 1)
      )
        throw new RangeError(
          `Surface ${surface.surfaceId} absorption coefficient must be between 0 and 1.`,
        );
  }
  const diagnostics: AcousticDiagnostic[] = [];
  if (input.volumeM3 === undefined)
    diagnostics.push({
      code: 'ACOUSTIC_MISSING_VOLUME',
      roomId: input.roomId,
      message: `Room ${input.roomId} volume is unknown.`,
    });
  const bands = method.bandsHz.map((bandHz): RoomAcousticBandResult => {
    let incomplete = false;
    const surfaceContributions = input.surfaces.map(
      (surface): AcousticSurfaceContribution => {
        const absorptionCoefficient =
          surface.absorptionCoefficientByBand?.[bandHz];
        if (absorptionCoefficient === undefined) {
          incomplete = true;
          diagnostics.push({
            code: 'ACOUSTIC_MISSING_ABSORPTION',
            roomId: input.roomId,
            bandHz,
            surfaceId: surface.surfaceId,
            message: `Surface ${surface.surfaceId} has no absorption coefficient at ${bandHz} Hz.`,
          });
        }
        return {
          surfaceId: surface.surfaceId,
          areaM2: surface.areaM2,
          ...(absorptionCoefficient === undefined
            ? {}
            : {
                absorptionCoefficient,
                equivalentAbsorptionAreaM2:
                  absorptionCoefficient * surface.areaM2,
              }),
        };
      },
    );
    const equivalentAbsorptionAreaM2 = incomplete
      ? undefined
      : surfaceContributions.reduce(
          (sum, surface) => sum + required(surface.equivalentAbsorptionAreaM2),
          0,
        );
    if (equivalentAbsorptionAreaM2 === 0)
      diagnostics.push({
        code: 'ACOUSTIC_ZERO_EQUIVALENT_ABSORPTION',
        roomId: input.roomId,
        bandHz,
        message: `Equivalent absorption at ${bandHz} Hz is zero, so reverberation time is undefined.`,
      });
    const reverberationTimeS =
      input.volumeM3 === undefined ||
      equivalentAbsorptionAreaM2 === undefined ||
      equivalentAbsorptionAreaM2 === 0
        ? undefined
        : (method.reverberationConstant * input.volumeM3) /
          equivalentAbsorptionAreaM2;
    return {
      bandHz,
      ...(equivalentAbsorptionAreaM2 === undefined
        ? {}
        : { equivalentAbsorptionAreaM2 }),
      ...(reverberationTimeS === undefined ? {} : { reverberationTimeS }),
      surfaceContributions: [...surfaceContributions].sort(
        (first, second) =>
          (second.equivalentAbsorptionAreaM2 ?? -1) -
            (first.equivalentAbsorptionAreaM2 ?? -1) ||
          first.surfaceId.localeCompare(second.surfaceId),
      ),
    };
  });
  return {
    status: diagnostics.length === 0 ? 'OK' : 'PARTIAL',
    roomId: input.roomId,
    methodId: method.id,
    methodVersion: method.version,
    assumptions: method.assumptions,
    bands,
    diagnostics,
  };
}

export interface AcousticTreatment {
  readonly treatmentId: string;
  readonly absorptionCoefficientByBand: Readonly<
    Partial<Record<OctaveBandHz, number>>
  >;
}
export interface AcousticTreatmentProposal {
  readonly treatmentId: string;
  readonly bandHz: OctaveBandHz;
  readonly targetReverberationTimeS: number;
  readonly additionalAreaM2?: number;
  readonly reason?:
    | 'UNKNOWN_BASE_RESULT'
    | 'MISSING_TREATMENT_COEFFICIENT'
    | 'ZERO_TREATMENT_COEFFICIENT';
}

/** Compares user/catalog supplied treatments; target selection remains outside this calculator. */
export function compareAcousticTreatments(
  result: RoomAcousticsResult,
  volumeM3: number,
  bandHz: OctaveBandHz,
  targetReverberationTimeS: number,
  treatments: readonly AcousticTreatment[],
  method: RoomAcousticsMethod,
): readonly AcousticTreatmentProposal[] {
  assertPositiveFinite(volumeM3, 'room volume');
  assertPositiveFinite(targetReverberationTimeS, 'target reverberation time');
  validateMethod(method);
  if (result.methodId !== method.id || result.methodVersion !== method.version)
    throw new TypeError(
      'Treatment comparison method must match the room result method.',
    );
  const existing = result.bands.find(
    (band) => band.bandHz === bandHz,
  )?.equivalentAbsorptionAreaM2;
  const requiredAbsorption =
    (method.reverberationConstant * volumeM3) / targetReverberationTimeS;
  return [...treatments]
    .sort((a, b) => a.treatmentId.localeCompare(b.treatmentId))
    .map((treatment) => {
      if (treatment.treatmentId.trim() === '')
        throw new TypeError('Treatment ID must not be empty.');
      if (existing === undefined)
        return {
          treatmentId: treatment.treatmentId,
          bandHz,
          targetReverberationTimeS,
          reason: 'UNKNOWN_BASE_RESULT',
        };
      const coefficient = treatment.absorptionCoefficientByBand[bandHz];
      if (coefficient === undefined)
        return {
          treatmentId: treatment.treatmentId,
          bandHz,
          targetReverberationTimeS,
          reason: 'MISSING_TREATMENT_COEFFICIENT',
        };
      if (!Number.isFinite(coefficient) || coefficient < 0 || coefficient > 1)
        throw new RangeError(
          `Treatment ${treatment.treatmentId} coefficient must be between 0 and 1.`,
        );
      if (coefficient === 0)
        return {
          treatmentId: treatment.treatmentId,
          bandHz,
          targetReverberationTimeS,
          reason: 'ZERO_TREATMENT_COEFFICIENT',
        };
      return {
        treatmentId: treatment.treatmentId,
        bandHz,
        targetReverberationTimeS,
        additionalAreaM2:
          Math.max(0, requiredAbsorption - existing) / coefficient,
      };
    });
}

function validateMethod(method: RoomAcousticsMethod): void {
  if (method.id.trim() === '' || method.version.trim() === '')
    throw new TypeError('Acoustic method ID and version must not be empty.');
  assertPositiveFinite(method.reverberationConstant, 'reverberation constant');
  if (
    method.bandsHz.length === 0 ||
    new Set(method.bandsHz).size !== method.bandsHz.length
  )
    throw new TypeError('Acoustic method bands must be non-empty and unique.');
}
function required(value: number | undefined): number {
  if (value === undefined)
    throw new Error('Complete acoustic contribution is unknown.');
  return value;
}
function assertPositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive.`);
}
function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be finite and non-negative.`);
}
