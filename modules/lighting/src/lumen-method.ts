import type { ElectricalLoad } from '@house-technical-designer/electrical';
import type { Point2D } from '@house-technical-designer/geometry';

export const LUMEN_METHOD_ID = 'lumen-average-v1' as const;

export interface LuminaireSource {
  readonly sourceType: 'MANUFACTURER' | 'CATALOG' | 'USER' | 'OTHER';
  readonly reference?: string;
}

export interface LuminaireDefinition {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly luminousFluxLm: number;
  readonly electricalPowerW: number;
  readonly powerFactor?: number;
  readonly colorTemperatureK?: number;
  readonly cri?: number;
  readonly source: LuminaireSource;
}

export interface LuminairePlacement {
  readonly id: string;
  readonly luminaireId: string;
  readonly roomId: string;
  /** Persisted editor position in millimetres. */
  readonly position: Point2D;
  readonly elevationMm?: number;
  readonly orientationDeg?: number;
}

export interface LumenMethodInput {
  readonly roomId: string;
  readonly roomAreaM2: number;
  readonly utilizationFactor: number;
  readonly maintenanceFactor: number;
  readonly placements: readonly LuminairePlacement[];
  readonly luminaires: readonly LuminaireDefinition[];
}

export interface LumenMethodResult {
  readonly roomId: string;
  readonly methodId: typeof LUMEN_METHOD_ID;
  readonly luminaireCount: number;
  readonly installedLuminousFluxLm: number;
  readonly averageIlluminanceLux: number;
  readonly installedPowerW: number;
  readonly powerDensityWm2: number;
  readonly utilizationFactor: number;
  readonly maintenanceFactor: number;
}

export interface LuminaireQuantityProposal {
  readonly methodId: typeof LUMEN_METHOD_ID;
  readonly targetIlluminanceLux: number;
  readonly quantity: number;
  readonly achievedAverageIlluminanceLux: number;
}

export interface RectangularGridInput {
  readonly roomId: string;
  readonly luminaireId: string;
  readonly quantity: number;
  readonly origin: Point2D;
  readonly widthMm: number;
  readonly depthMm: number;
}

export function calculateLumenMethod(
  input: LumenMethodInput,
): LumenMethodResult {
  if (input.roomId.trim() === '')
    throw new TypeError('Room ID must not be empty');
  validateFactors(
    input.roomAreaM2,
    input.utilizationFactor,
    input.maintenanceFactor,
  );
  const definitions = validateCatalog(input.luminaires);
  const seenPlacements = new Set<string>();
  let installedLuminousFluxLm = 0;
  let installedPowerW = 0;
  for (const placement of input.placements) {
    if (placement.id.trim() === '' || seenPlacements.has(placement.id))
      throw new RangeError(
        'Luminaire placement IDs must be non-empty and unique',
      );
    seenPlacements.add(placement.id);
    if (placement.roomId !== input.roomId)
      throw new RangeError(`Placement ${placement.id} belongs to another room`);
    if (
      ![placement.position.x, placement.position.y].every(Number.isFinite) ||
      (placement.elevationMm !== undefined &&
        !Number.isFinite(placement.elevationMm)) ||
      (placement.orientationDeg !== undefined &&
        !Number.isFinite(placement.orientationDeg))
    )
      throw new RangeError(`Placement ${placement.id} position must be finite`);
    const definition = definitions.get(placement.luminaireId);
    if (definition === undefined)
      throw new RangeError(`Luminaire ${placement.luminaireId} does not exist`);
    installedLuminousFluxLm += definition.luminousFluxLm;
    installedPowerW += definition.electricalPowerW;
  }
  return {
    roomId: input.roomId,
    methodId: LUMEN_METHOD_ID,
    luminaireCount: input.placements.length,
    installedLuminousFluxLm,
    averageIlluminanceLux:
      (installedLuminousFluxLm *
        input.utilizationFactor *
        input.maintenanceFactor) /
      input.roomAreaM2,
    installedPowerW,
    powerDensityWm2: installedPowerW / input.roomAreaM2,
    utilizationFactor: input.utilizationFactor,
    maintenanceFactor: input.maintenanceFactor,
  };
}

export function proposeLuminaireQuantity(
  targetIlluminanceLux: number,
  roomAreaM2: number,
  luminaire: LuminaireDefinition,
  utilizationFactor: number,
  maintenanceFactor: number,
): LuminaireQuantityProposal {
  positive(targetIlluminanceLux, 'target illuminance');
  validateDefinition(luminaire);
  validateFactors(roomAreaM2, utilizationFactor, maintenanceFactor);
  const usefulFluxPerLuminaire =
    luminaire.luminousFluxLm * utilizationFactor * maintenanceFactor;
  const quantity = Math.ceil(
    (targetIlluminanceLux * roomAreaM2) / usefulFluxPerLuminaire,
  );
  return {
    methodId: LUMEN_METHOD_ID,
    targetIlluminanceLux,
    quantity,
    achievedAverageIlluminanceLux:
      (quantity * usefulFluxPerLuminaire) / roomAreaM2,
  };
}

export function createRectangularLuminaireGrid(
  input: RectangularGridInput,
): readonly LuminairePlacement[] {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    throw new RangeError('Grid quantity must be a positive integer');
  positive(input.widthMm, 'grid width');
  positive(input.depthMm, 'grid depth');
  if (
    input.roomId.trim() === '' ||
    input.luminaireId.trim() === '' ||
    ![input.origin.x, input.origin.y].every(Number.isFinite)
  )
    throw new TypeError('Grid room, luminaire, and origin must be valid');
  const columns = Math.ceil(
    Math.sqrt((input.quantity * input.widthMm) / input.depthMm),
  );
  const rows = Math.ceil(input.quantity / columns);
  return Array.from({ length: input.quantity }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: `${input.roomId}:luminaire:${index + 1}`,
      roomId: input.roomId,
      luminaireId: input.luminaireId,
      position: {
        x: input.origin.x + ((column + 0.5) * input.widthMm) / columns,
        y: input.origin.y + ((row + 0.5) * input.depthMm) / rows,
      },
    };
  });
}

export function createLuminaireElectricalLoad(
  placement: LuminairePlacement,
  luminaire: LuminaireDefinition,
  demandFactor?: number,
): ElectricalLoad {
  validateDefinition(luminaire);
  if (placement.luminaireId !== luminaire.id)
    throw new RangeError('Placement and luminaire definition do not match');
  if (demandFactor !== undefined) ratio(demandFactor, 'demand factor', true);
  return {
    loadId: `lighting:${placement.id}`,
    name: luminaire.name,
    activePowerW: luminaire.electricalPowerW,
    ...(luminaire.powerFactor === undefined
      ? {}
      : { powerFactor: luminaire.powerFactor }),
    ...(demandFactor === undefined ? {} : { demandFactor }),
  };
}

function validateCatalog(
  luminaires: readonly LuminaireDefinition[],
): ReadonlyMap<string, LuminaireDefinition> {
  const definitions = new Map<string, LuminaireDefinition>();
  for (const luminaire of luminaires) {
    validateDefinition(luminaire);
    if (definitions.has(luminaire.id))
      throw new RangeError(`Duplicate luminaire ${luminaire.id}`);
    definitions.set(luminaire.id, luminaire);
  }
  return definitions;
}

function validateDefinition(luminaire: LuminaireDefinition): void {
  if (
    luminaire.id.trim() === '' ||
    luminaire.name.trim() === '' ||
    luminaire.source.sourceType.trim() === ''
  )
    throw new TypeError('Luminaire identity and source must not be empty');
  positive(luminaire.luminousFluxLm, 'luminous flux');
  positive(luminaire.electricalPowerW, 'electrical power');
  if (luminaire.powerFactor !== undefined)
    ratio(luminaire.powerFactor, 'power factor', false);
  if (luminaire.colorTemperatureK !== undefined)
    positive(luminaire.colorTemperatureK, 'color temperature');
  if (
    luminaire.cri !== undefined &&
    (!Number.isFinite(luminaire.cri) ||
      luminaire.cri < 0 ||
      luminaire.cri > 100)
  )
    throw new RangeError('CRI must be in [0, 100]');
}

function validateFactors(areaM2: number, uf: number, mf: number): void {
  positive(areaM2, 'room area');
  ratio(uf, 'utilization factor', false);
  ratio(mf, 'maintenance factor', false);
}

function ratio(value: number, name: string, allowZero: boolean): void {
  if (
    !Number.isFinite(value) ||
    value > 1 ||
    (allowZero ? value < 0 : value <= 0)
  )
    throw new RangeError(
      `${name} must be in ${allowZero ? '[0, 1]' : '(0, 1]'}`,
    );
}

function positive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be finite and positive`);
}
