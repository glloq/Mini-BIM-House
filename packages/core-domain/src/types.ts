import type { BuildingId, EntityId, LevelId, ProjectId, SiteId } from './ids';
import type { Polygon2D } from '@house-technical-designer/geometry';
import type { Material } from '@house-technical-designer/materials';
import type { Assembly } from '@house-technical-designer/assemblies';
import type { Wall } from './wall.js';
import type { Opening } from './opening.js';
import type { Space } from './space.js';
import type { Slab } from './slab.js';
import type { RoofPlane } from './roof-plane.js';
import type { TechnicalNetwork } from './network.js';
import type { Annotation } from './annotation.js';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type ExtensionNamespace = `${string}.${string}`;
export type Extensions = Readonly<
  Partial<Record<ExtensionNamespace, JsonValue>>
>;

export type ProjectPhase = 'EXISTING' | 'TO_REMOVE' | 'NEW' | 'TEMPORARY';

export interface CommonMetadata {
  readonly tags?: readonly string[];
  readonly properties?: Readonly<Record<string, JsonValue>>;
  readonly extensions?: Extensions;
}

export interface BaseEntity<
  Id extends EntityId = EntityId,
> extends CommonMetadata {
  readonly id: Id;
  readonly phase?: ProjectPhase;
}

export interface ProjectMetadata {
  readonly name: string;
  readonly description?: string;
  readonly author?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly projectRevision?: string;
  readonly notes?: string;
}

export interface GeoLocation {
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
}

export interface SiteObstacle extends BaseEntity {
  readonly boundary: Polygon2D;
  readonly heightMm?: number;
}

export interface Site extends CommonMetadata {
  readonly id?: SiteId;
  readonly location?: GeoLocation;
  readonly altitudeM?: number;
  readonly northAngleDeg: number;
  readonly climateProfileId?: string;
  readonly parcelBoundary?: Polygon2D;
  readonly obstacles?: readonly SiteObstacle[];
}

export interface Level extends BaseEntity<LevelId> {
  readonly name: string;
  readonly elevationMm: number;
  readonly defaultStoreyHeightMm: number;
  readonly walls: readonly Wall[];
  readonly slabs: readonly Slab[];
  readonly roofs: readonly RoofPlane[];
  readonly openings: readonly Opening[];
  readonly stairs: readonly JsonValue[];
  readonly spaces: readonly Space[];
  readonly annotations: readonly Annotation[];
}

export type ZoneType =
  | 'THERMAL'
  | 'VENTILATION'
  | 'ELECTRICAL'
  | 'ACOUSTIC'
  | 'LIGHTING'
  | 'FIRE'
  | 'WATER'
  | 'SECURITY'
  | 'CUSTOM';

export const ZONE_TYPES = [
  'THERMAL',
  'VENTILATION',
  'ELECTRICAL',
  'ACOUSTIC',
  'LIGHTING',
  'FIRE',
  'WATER',
  'SECURITY',
  'CUSTOM',
] as const satisfies readonly ZoneType[];

export function isZoneType(value: string): value is ZoneType {
  return (ZONE_TYPES as readonly string[]).includes(value);
}

export interface Zone extends BaseEntity {
  readonly type: ZoneType;
  readonly name: string;
  readonly spaceIds: readonly EntityId[];
  readonly properties: Readonly<Record<string, JsonValue>>;
}

export interface Building extends CommonMetadata {
  readonly id?: BuildingId;
  readonly levels: readonly Level[];
  readonly zones: readonly Zone[];
}

export interface RegulatoryContext {
  readonly country: string;
  readonly region?: string;
  readonly projectType?: string;
  readonly referenceDate?: string;
  readonly enabledRulePacks: readonly JsonValue[];
}

export interface EquipmentDefinition {
  readonly id: string;
  readonly kind: string;
  readonly catalogKind: 'GENERIC' | 'PRODUCT' | 'CUSTOM';
  readonly properties: Readonly<Record<string, JsonValue>>;
}
export interface ScenarioOverride {
  readonly path: string;
  readonly operation: 'SET' | 'ADD' | 'REMOVE' | 'REPLACE_REFERENCE';
  readonly value?: JsonValue;
}
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly baseProjectRevision: string;
  readonly overrides: readonly ScenarioOverride[];
  readonly enabledModules?: readonly string[];
}
export interface ModuleSettings {
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly methodId: string;
  readonly precisionTarget?:
    'ESTIMATE' | 'ENGINEERING' | 'STANDARD' | 'REGULATORY';
  readonly settings: Readonly<Record<string, JsonValue>>;
  readonly rulePackIds?: readonly string[];
}

export interface Project extends BaseEntity<ProjectId> {
  readonly metadata: ProjectMetadata;
  readonly site: Site;
  readonly building: Building;
  readonly materialLibrary?: { readonly materials: readonly Material[] };
  readonly assemblies?: readonly Assembly[];
  readonly equipment?: readonly EquipmentDefinition[];
  readonly systems?: readonly TechnicalNetwork[];
  readonly scenarios?: readonly Scenario[];
  readonly drawingViews?: readonly JsonValue[];
  readonly calculationSettings?: Readonly<Record<string, ModuleSettings>>;
  readonly regulatoryContext?: RegulatoryContext;
}

export interface ProjectFile {
  readonly format: 'house-technical-designer-project';
  readonly schemaVersion: string;
  readonly applicationVersion?: string;
  readonly project: Project;
  readonly references?: Readonly<Record<string, JsonValue>>;
  readonly extensions?: Extensions;
}
