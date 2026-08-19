import type { Point3D } from '@house-technical-designer/geometry';

/** Outward direction of a port, as a unit vector in the equipment frame. */
export interface EquipmentDirection {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** How the definition relates to a real product. */
export type EquipmentCatalogKind = 'GENERIC' | 'PRODUCT' | 'CUSTOM';

/**
 * Families the application can place and connect. The list is closed so a
 * definition cannot silently introduce a category the interface and the
 * calculation modules do not know how to treat.
 */
export type EquipmentCategory =
  | 'HEAT_PUMP'
  | 'BOILER'
  | 'RADIATOR'
  | 'UNDERFLOOR_HEATING'
  | 'DHW_TANK'
  | 'VENTILATION_UNIT'
  | 'AIR_TERMINAL'
  | 'FAN'
  | 'PUMP'
  | 'PV_MODULE'
  | 'INVERTER'
  | 'BATTERY'
  | 'LUMINAIRE'
  | 'SOCKET'
  | 'DISTRIBUTION_BOARD'
  | 'PROTECTION_DEVICE'
  | 'SANITARY_FIXTURE'
  | 'RAINWATER_TANK'
  | 'SENSOR'
  | 'OTHER';

export type PropertySourceType =
  'STANDARD' | 'MANUFACTURER' | 'DATABASE' | 'USER' | 'CALCULATED' | 'OTHER';

/** Where one declared property value comes from. */
export interface EquipmentPropertySource {
  readonly property: string;
  readonly sourceType: PropertySourceType;
  readonly reference: string;
  readonly url?: string;
  readonly validAt?: string;
}

export interface ClearanceEnvelope {
  readonly frontMm?: number;
  readonly backMm?: number;
  readonly leftMm?: number;
  readonly rightMm?: number;
  readonly topMm?: number;
}

export interface EquipmentDimensions {
  readonly widthMm?: number;
  readonly depthMm?: number;
  readonly heightMm?: number;
  /** Access and service space; a Rule Pack may require more than the catalogue states. */
  readonly clearance?: ClearanceEnvelope;
}

export interface EquipmentPortDefinition {
  readonly id: string;
  readonly discipline: string;
  readonly role: string;
  /** Port position relative to the equipment origin, in millimetres. */
  readonly position: Point3D;
  readonly direction?: EquipmentDirection;
  readonly connectionType?: string;
  readonly nominalSize?: number;
}

export type PerformanceInterpolation =
  'LINEAR' | 'BILINEAR' | 'TABLE' | 'CUSTOM';

export interface PerformanceAxis {
  readonly id: string;
  readonly unit: string;
}

export interface PerformancePoint {
  /** One value per declared input axis, in axis order. */
  readonly inputs: readonly number[];
  readonly output: number;
}

export interface PerformanceCurve {
  readonly id: string;
  readonly inputAxes: readonly PerformanceAxis[];
  readonly output: string;
  readonly outputUnit: string;
  readonly points: readonly PerformancePoint[];
  readonly interpolation: PerformanceInterpolation;
}

export interface EquipmentSymbolBinding {
  readonly discipline: string;
  readonly symbolId: string;
  /** View the symbol applies to; omitted means every view of that discipline. */
  readonly viewType?: 'PLAN' | 'SECTION' | 'ELEVATION' | 'SCHEMATIC';
}

export interface EquipmentRendering {
  readonly symbols: readonly EquipmentSymbolBinding[];
  readonly planFootprint?: 'RECTANGLE' | 'CIRCLE' | 'SYMBOL_ONLY';
  readonly layer?: string;
}

export type EquipmentPropertyValue = string | number | boolean;

/** A catalogue entry: everything shared by all instances of an equipment. */
export interface EquipmentDefinition {
  readonly id: string;
  readonly kind: string;
  readonly category: EquipmentCategory;
  readonly name: string;
  readonly catalogKind: EquipmentCatalogKind;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly version: string;
  readonly dimensions?: EquipmentDimensions;
  readonly ports: readonly EquipmentPortDefinition[];
  readonly properties: Readonly<Record<string, EquipmentPropertyValue>>;
  readonly performanceCurves?: readonly PerformanceCurve[];
  readonly costEntryId?: string;
  readonly environmentalDeclarationId?: string;
  readonly rendering?: EquipmentRendering;
  readonly sources: readonly EquipmentPropertySource[];
}

/**
 * A placed equipment. It references a definition rather than copying it, and
 * records which catalogue version was used so a catalogue update never changes
 * an existing project silently.
 */
export interface EquipmentInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly position: Point3D;
  readonly rotationDeg: number;
  readonly levelId?: string;
  readonly spaceId?: string;
  /** Instance-specific values that win over the definition's properties. */
  readonly overrides?: Readonly<Record<string, EquipmentPropertyValue>>;
}

export type EquipmentIssueCode =
  | 'EQUIPMENT_EMPTY_ID'
  | 'EQUIPMENT_EMPTY_NAME'
  | 'EQUIPMENT_INVALID_VERSION'
  | 'EQUIPMENT_DUPLICATE_ID'
  | 'EQUIPMENT_DUPLICATE_PORT'
  | 'EQUIPMENT_INVALID_DIMENSION'
  | 'EQUIPMENT_INVALID_PROPERTY'
  | 'EQUIPMENT_UNSOURCED_PROPERTY'
  | 'EQUIPMENT_PRODUCT_WITHOUT_MANUFACTURER'
  | 'EQUIPMENT_INVALID_CURVE'
  | 'EQUIPMENT_UNKNOWN_DEFINITION'
  | 'EQUIPMENT_DEFINITION_VERSION_MISMATCH'
  | 'EQUIPMENT_PERFORMANCE_OUT_OF_RANGE';

export interface EquipmentIssue {
  readonly code: EquipmentIssueCode;
  readonly path: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}
