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
 *
 * It held twenty words, and two hundred and one families of the nomenclature
 * answered `OTHER` — which is exact and useless: a list that cannot say
 * « mobilier », « vanne » or « prise de terre » cannot be asked for them
 * either. CG-04 wrote that down rather than letting a fiche in a hurry add a
 * value in passing; this is the deliberate lengthening it asked for, and
 * `scripts/equipment-categories.ts` is the family-by-family decision that goes
 * with it.
 *
 * Twenty-one words, each one covering a group of families that exists. Four
 * families left `PROTECTION_DEVICE` for `CONTROL_DEVICE` — a contactor
 * protects nothing — and seven left `SENSOR` for `METER`: a meter counts what
 * has passed, a sensor says what is happening now, and the difference is the
 * one between a bill and a setpoint.
 */
export const EQUIPMENT_CATEGORIES = [
  'HEAT_PUMP',
  'BOILER',
  'STOVE',
  'RADIATOR',
  'UNDERFLOOR_HEATING',
  'HEAT_EXCHANGER',
  'DHW_TANK',
  'VESSEL',
  'HYDRAULIC_ACCESSORY',
  'VENTILATION_UNIT',
  'AIR_TERMINAL',
  'AIR_ACCESSORY',
  'FAN',
  'PUMP',
  'VALVE',
  'FITTING',
  'FLUE_COMPONENT',
  'PV_MODULE',
  'INVERTER',
  'BATTERY',
  'MOUNTING',
  'LUMINAIRE',
  'SOCKET',
  'CONTROL_DEVICE',
  'DISTRIBUTION_BOARD',
  'PROTECTION_DEVICE',
  'EARTHING_DEVICE',
  'CABLE_ROUTING',
  'APPLIANCE',
  'SANITARY_FIXTURE',
  'WATER_TREATMENT',
  'DRAINAGE',
  'RAINWATER_TANK',
  'RAINWATER_DEVICE',
  'SENSOR',
  'METER',
  'DATA_DEVICE',
  'SAFETY_DEVICE',
  'FURNITURE',
  'SITE_FEATURE',
  'OTHER',
] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export function isEquipmentCategory(value: string): value is EquipmentCategory {
  return (EQUIPMENT_CATEGORIES as readonly string[]).includes(value);
}

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
   * `discipline` and `role` sat beside it as two free strings, so a heat pump
   * declared `HEATING` / `FLOW` while its port type said `HEATING_FLOW` and
   * nothing could tell that these were the same thing — or notice when they
   * stopped being. They are gone: the port type carries a domain, a medium, a
   * service and a direction, and anything wanting one of those reads it there.
   * The registry decides what may be joined to what; a port that does not name
   * one of its types is a port nothing can check.
   */
  readonly portTypeId: string;
  /**
   * Où ce raccordement se trouve sur l'appareil, **depuis son origine**, en
   * millimètres.
   *
   * ## L'origine, et pourquoi c'est celle-là
   *
   * L'origine d'un appareil est le point que la pose situe, et il n'y en a
   * qu'un dans ce modèle : le **centre de l'emprise** en x et y, le **dessous**
   * en z. Ce n'est pas une convention inventée ici, c'est celle que le modèle
   * applique déjà à ce même appareil :
   *
   * - `ComponentInstance.position` est le centre de l'emprise — c'est ce que
   *   `componentGhostOutline` dessine avant le clic, un rectangle centré ;
   * - `ComponentInstance.elevationMm` est le dessous — `ClearancePlacement` le
   *   dit mot pour mot (« the underside, above the storey ») et
   *   `clearanceZones` construit le volume de l'appareil de `elevationMm` à
   *   `elevationMm + heightMm` ;
   * - `resolveOne` additionne les deux et rend `position`, à quoi un lecteur
   *   n'a plus qu'à ajouter ce décalage-ci.
   *
   * D'où la propriété que ce champ tient désormais, et qu'un contrôle vérifie
   * fiche par fiche (`EQUIPMENT_PORT_OUTSIDE_BODY`) : **le raccordement est
   * dans le volume de l'appareil**, soit `|x| ≤ largeur/2`, `|y| ≤ profondeur/2`
   * et `0 ≤ z ≤ hauteur`. Un siphon est au bas de l'appareil, donc à z petit ;
   * l'eau chaude d'un ballon est en haut, donc à z proche de sa hauteur.
   *
   * ## Ce que ce champ voulait dire avant, et ce que ça coûtait
   *
   * Rien n'était écrit, et le catalogue s'était donné un autre repère : sur 789
   * ports positionnés, 788 comptaient z depuis le **centre** de la boîte —
   * l'eau froide d'un ballon de 1 500 mm à `z: -740`, le départ d'un radiateur
   * de 600 mm à `z: -280`. Les deux repères tombent d'accord en x et en y et
   * seulement là ; en z, 288 raccordements de 175 fiches se retrouvaient donc
   * **sous** l'appareil qui les porte, et le seul lecteur du champ — le nœud
   * que « Raccorder au réseau » pose — les plaçait sous le plancher : la sortie
   * du WC de la maison de référence tombait 350 mm sous la dalle, au radier du
   * regard, et son raccordement était refusé — à juste titre.
   *
   * Le repère du centre ne demandait pas seulement une addition de plus à
   * chaque lecture : il est **illisible sans les dimensions**, et six fiches
   * déclarent des ports sans déclarer de hauteur. Un décalage qu'on ne peut
   * pas interpréter vaut zéro, et zéro est faux.
   */
  readonly position: Point3D;
  readonly direction?: EquipmentDirection;
  readonly connectionType?: string;
  readonly nominalSize?: number;
}

/**
 * How a value between the tabulated points is found.
 *
 * `TABLE` means it is not: only the points themselves answer, and anything
 * between them is out of range. That is the honest option for a stepped
 * quantity — a fan with three speeds does not have a speed and a half.
 *
 * `CUSTOM` was a fourth value and nothing implemented it. A curve declaring it
 * was accepted, stored, and then answered nothing for ever; the catalogue
 * would have filled up with fiches that look complete.
 */
export const PERFORMANCE_INTERPOLATIONS = [
  'LINEAR',
  'BILINEAR',
  'TABLE',
] as const;
export type PerformanceInterpolation =
  (typeof PERFORMANCE_INTERPOLATIONS)[number];

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
  /**
   * Where this table comes from, when it does not come from the entry's own
   * provenance.
   *
   * A manufacturer sheet often carries one map measured to a standard and
   * another interpolated by the maker's own software, and the difference is
   * the difference between a figure that can be defended and one that cannot.
   */
  readonly provenance?: EquipmentProvenance;
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
  /**
   * The coarse grouping this entry falls into, as a projection of its family.
   *
   * Not stated by the file, and no longer stated twice. An entry used to carry
   * a `kind` and a `category` beside its `familyId` — three taxonomies for one
   * thing — and at nineteen entries one of them had already drifted:
   * `generic-pv-module` said `kind: PHOTOVOLTAIC` and `category: PV_MODULE`.
   * Nothing was wrong with either file, because nothing compared them.
   *
   * The family is the one statement now. This field is what
   * `categoryOfFamily` stamps on the way out, which is why it is optional: an
   * entry read straight from its file has not been resolved yet, and saying so
   * is better than inventing `OTHER`.
   */
  readonly category?: EquipmentCategory;
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
  | 'EQUIPMENT_PORT_OUTSIDE_BODY'
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
