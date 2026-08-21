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
  | 'GENERIC'
  | 'STANDARD'
  | 'MANUFACTURER'
  | 'DATABASE'
  | 'USER'
  | 'CALCULATED'
  | 'OTHER';

/**
 * Where the values of a catalogue entry come from, as a whole.
 *
 * One statement per entry. `sources` says it property by property, which is
 * what a manufacturer sheet needs when half its figures are declared and half
 * are computed; most entries have one answer for all of them, and repeating it
 * once per field is the same sentence copied twenty times.
 */
export interface EquipmentProvenance {
  readonly type: PropertySourceType;
  readonly reference: string;
  readonly url?: string;
  /** When the value was true, which is not when the file was written. */
  readonly validAt?: string;
}

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
  /**
   * The kind of connection this is, from the port registry.
   *
   * `discipline` and `role` were two free strings, so a heat pump declared
   * `HEATING` / `FLOW` while its family declared `HEATING_FLOW` and nothing
   * could tell that these were the same thing — or notice when they stopped
   * being. The registry decides what may be joined to what; a port that does
   * not name one of its types is a port nothing can check.
   */
  readonly portTypeId: string;
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

/**
 * The room one entry needs around it, and on which side.
 *
 * Which zones a thing has is a property of the family — every air-source heat
 * pump has an intake and an exhaust. How far they reach is a property of the
 * entry, because it is the machine that says two metres in front of its fan
 * and a hundred millimetres behind it. The zone is named as a string here and
 * checked against the registry's closed list at the gate, exactly as the
 * family and the port kinds are.
 */
export interface EquipmentClearance {
  readonly zone: string;
  readonly frontMm?: number;
  readonly backMm?: number;
  readonly leftMm?: number;
  readonly rightMm?: number;
  readonly aboveMm?: number;
  readonly belowMm?: number;
  /** Why this room is needed: a rule, a manual, a trade practice. */
  readonly reason?: string;
}

/** A catalogue entry: everything shared by all instances of an equipment. */
export interface EquipmentDefinition {
  readonly id: string;
  /**
   * The family of the master nomenclature this entry is an entry of.
   *
   * It used to be dropped by the loader and rebuilt into a separate map, which
   * works at nineteen entries and stops working the moment a catalogue is
   * imported: the one thing that says what a definition *is* has to travel
   * with it.
   */
  readonly familyId: string;
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
  readonly clearances?: readonly EquipmentClearance[];
  readonly provenance: EquipmentProvenance;
  readonly sources: readonly EquipmentPropertySource[];
}

/**
 * A thing placed in the building, seen from the catalogue.
 *
 * There used to be two of these: `ComponentInstance` in the model, which is
 * what a project actually stores, and an `EquipmentInstance` here that nothing
 * placed. Two types for one idea drift until the day one of them gains a field
 * the other needs — so what is left is the part the catalogue has to know
 * about, which the placed component satisfies as it stands.
 *
 * It names the entry rather than copying it, and records which version was
 * placed, so that a catalogue correction is reported instead of silently
 * changing a house nobody touched.
 */
export interface PlacedEquipment {
  readonly id: string;
  readonly definitionId?: string;
  readonly definitionVersion?: string;
  /**
   * What this one carries beyond its model.
   *
   * A measured value or a setting of this instance. The model stores anything
   * a file can hold here, so what is not a scalar is not an equipment value
   * and is reported rather than used.
   */
  readonly properties?: Readonly<Record<string, unknown>>;
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
  | 'EQUIPMENT_UNKNOWN_FAMILY'
  | 'EQUIPMENT_UNKNOWN_PORT_TYPE'
  | 'EQUIPMENT_MISSING_FAMILY_PORT'
  | 'EQUIPMENT_UNKNOWN_CLEARANCE'
  | 'EQUIPMENT_SCHEMA_MISMATCH'
  | 'EQUIPMENT_PRODUCT_WITHOUT_MANUFACTURER'
  | 'EQUIPMENT_INVALID_CURVE'
  | 'EQUIPMENT_UNKNOWN_DEFINITION'
  | 'EQUIPMENT_UNPINNED_DEFINITION'
  | 'EQUIPMENT_DEFINITION_VERSION_MISMATCH'
  | 'EQUIPMENT_PERFORMANCE_OUT_OF_RANGE';

export interface EquipmentIssue {
  readonly code: EquipmentIssueCode;
  readonly path: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
}
