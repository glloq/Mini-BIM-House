import type { BuildingId, EntityId, LevelId, ProjectId, SiteId } from './ids';
import type { Polygon2D } from '@house-technical-designer/geometry';

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
  readonly walls: readonly JsonValue[];
  readonly slabs: readonly JsonValue[];
  readonly roofs: readonly JsonValue[];
  readonly openings: readonly JsonValue[];
  readonly stairs: readonly JsonValue[];
  readonly spaces: readonly JsonValue[];
  readonly annotations: readonly JsonValue[];
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

export interface Project extends BaseEntity<ProjectId> {
  readonly metadata: ProjectMetadata;
  readonly site: Site;
  readonly building: Building;
  readonly materialLibrary?: { readonly materials: readonly JsonValue[] };
  readonly assemblies?: readonly JsonValue[];
  readonly equipment?: readonly JsonValue[];
  readonly systems?: readonly JsonValue[];
  readonly scenarios?: readonly JsonValue[];
  readonly drawingViews?: readonly JsonValue[];
  readonly calculationSettings?: Readonly<Record<string, JsonValue>>;
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
