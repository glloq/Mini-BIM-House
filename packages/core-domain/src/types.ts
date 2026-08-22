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
import type { ComponentInstance } from './component.js';
import type { Stair } from './stair.js';
import type { Roof } from './roof.js';
import type { ProjectSheet, SavedDrawingView } from './documents.js';
import type { StructuralMember } from './structure.js';
import type { HostType } from './host-types.js';
import type { ClearanceZone } from '@house-technical-designer/technical-types';

import type { ProjectScope } from './design-scope.js';

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

/**
 * What stands on the site around the house.
 *
 * A neighbouring building, a tree and a zone that must stay clear all cast
 * shade, take room and change where things can go — and none of them behaves
 * like the others when the sun is computed. The kind belongs to the obstacle.
 */
export const SITE_OBSTACLE_KINDS = [
  'BUILDING',
  'TREE',
  'EXCLUSION',
  'OTHER',
] as const;
export type SiteObstacleKind = (typeof SITE_OBSTACLE_KINDS)[number];

export function isSiteObstacleKind(value: string): value is SiteObstacleKind {
  return (SITE_OBSTACLE_KINDS as readonly string[]).includes(value);
}

export interface SiteObstacle extends BaseEntity {
  readonly boundary: Polygon2D;
  readonly heightMm?: number;
  readonly kind?: SiteObstacleKind;
  readonly name?: string;
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
  /**
   * The stairs starting on this storey.
   *
   * They were an untyped list until now, so nothing could be drawn, measured
   * or checked: an escalier was a shape of JSON the application agreed to
   * carry and could not read.
   */
  readonly stairs: readonly Stair[];
  readonly spaces: readonly Space[];
  readonly annotations: readonly Annotation[];
  /**
   * The things placed on this storey.
   *
   * Optional so a file written before components existed still reads: a level
   * that says nothing about components holds none, which is the truth about
   * every project written until now.
   */
  readonly components?: readonly ComponentInstance[];
  /**
   * The roofs described by what encloses them rather than plane by plane.
   *
   * The planes they are made of are derived and never stored, so `roofs` holds
   * only planes drawn one at a time — which is what every project written
   * until now contains.
   */
  readonly roofStructures?: readonly Roof[];
  /**
   * The structure of this storey: columns, beams, footings.
   *
   * They are objects of the building and nothing computes them yet. Waiting
   * for a structural engine before allowing them would be waiting to describe
   * a house before being able to check it.
   */
  readonly structure?: readonly StructuralMember[];
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

/**
 * A rule pack this project is checked against, and at which version.
 *
 * The version is the point. A project checked against a pack, then reopened
 * once the pack has moved on, is checked against something else — and the
 * report would say « conforme » about a text nobody read. It is the same rule
 * the catalogue already follows for a placed thing: record what was used, so
 * the application can say « le référentiel a bougé depuis » instead of quietly
 * checking against different rules.
 */
export interface RulePackSelection {
  readonly id: string;
  /** The version the project was last checked against. */
  readonly version?: string;
  /** Why this pack applies here, in the words the user reads. */
  readonly applicability?: string;
  /** Where the text comes from. A pack with no source claims nothing. */
  readonly sourceReference?: string;
}

/**
 * Where and when this project is judged.
 *
 * No pack chosen is **not** a default pack. An empty list means nothing is
 * checked against any text, and the application says so rather than applying
 * a national reference nobody asked for.
 */
export interface RegulatoryContext {
  readonly country: string;
  readonly region?: string;
  readonly projectType?: string;
  readonly referenceDate?: string;
  /**
   * The packs the project activates.
   *
   * A bare string is what a file written before selections carried a version
   * holds; it is read as a selection pinning no version.
   */
  readonly enabledRulePacks: readonly (string | RulePackSelection)[];
}

/** Every activated pack, whichever way the file states it. */
export function rulePackSelections(
  context: RegulatoryContext | undefined,
): readonly RulePackSelection[] {
  return (context?.enabledRulePacks ?? []).flatMap((entry) => {
    if (typeof entry === 'string') return entry === '' ? [] : [{ id: entry }];
    if (typeof entry !== 'object' || entry === null) return [];
    const { id } = entry as { readonly id?: unknown };
    return typeof id === 'string' && id !== '' ? [entry] : [];
  });
}

export function validateRegulatoryContext(
  context: RegulatoryContext,
): readonly string[] {
  const issues: string[] = [];
  if (context.country.trim() === '') issues.push('country must not be empty');
  if (
    context.referenceDate !== undefined &&
    Number.isNaN(Date.parse(context.referenceDate))
  )
    issues.push('referenceDate must be a date');
  for (const [index, entry] of (context.enabledRulePacks ?? []).entries()) {
    if (typeof entry === 'string') {
      if (entry.trim() === '')
        issues.push(`enabledRulePacks/${index} must name a pack`);
      continue;
    }
    if (typeof entry !== 'object' || entry === null) {
      issues.push(`enabledRulePacks/${index} must name a pack`);
      continue;
    }
    const selection = entry;
    if (typeof selection.id !== 'string' || selection.id.trim() === '')
      issues.push(`enabledRulePacks/${index}/id must not be empty`);
  }
  return issues;
}

/**
 * A catalogue entry as this project holds it.
 *
 * The project keeps its own copy rather than pointing at a catalogue that can
 * move underneath it: a file has to open the same way in two years. What it
 * records of the entry it came from — the family it belongs to and the version
 * it was copied at — is what lets the application say « the catalogue has moved
 * on since » instead of quietly designing with different figures.
 *
 * The copy has to be a copy. It used to keep four fields and smuggle the rest
 * into `properties` as `catalogDefinitionId`, so a project claiming to be
 * self-contained had lost the ports, the room the thing needs, what it may be
 * fixed to and where its figures came from — everything, in other words, that
 * makes it more than a bag of numbers.
 */
export interface EquipmentDefinition {
  readonly id: string;
  /** The family of the master nomenclature, when the entry came from one. */
  readonly familyId?: string;
  readonly kind: string;
  readonly catalogKind: 'GENERIC' | 'PRODUCT' | 'CUSTOM';
  /** The version of the catalogue entry this copy was taken from. */
  readonly version?: string;
  readonly name?: string;
  readonly category?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly dimensions?: {
    readonly widthMm?: number;
    readonly depthMm?: number;
    readonly heightMm?: number;
  };
  /** What it is connected by, each port naming a kind of the registry. */
  readonly ports?: readonly {
    readonly id: string;
    readonly portTypeId?: string;
    readonly position?: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
  }[];
  /**
   * The zones a thing of this family has, whether or not this entry says how
   * far each reaches.
   *
   * Copied from the family with the entry, like `allowedHosts`: a zone the
   * model requires and nobody has measured has to be reportable, and it cannot
   * be reported from a list the file does not carry.
   */
  readonly requiredClearances?: readonly ClearanceZone[];
  /** The room it needs around it, zone by zone and side by side. */
  readonly clearances?: readonly {
    readonly zone: ClearanceZone;
    readonly frontMm?: number;
    readonly backMm?: number;
    readonly leftMm?: number;
    readonly rightMm?: number;
    readonly aboveMm?: number;
    readonly belowMm?: number;
    readonly reason?: string;
  }[];
  /** Where every figure of this copy comes from. */
  readonly provenance?: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
  readonly costEntryId?: string;
  readonly environmentalDeclarationId?: string;
  /**
   * What a thing of this kind may be fixed to.
   *
   * The rule travels with the copy rather than being looked up in a catalogue.
   * Two reasons: a project has to open the same way in two years, when the
   * catalogue may have tightened the rule and would then refuse a house that
   * was legal when it was drawn; and the editor, the importer and the checks
   * all have to answer the same way, which they can only do from something the
   * file itself carries.
   */
  readonly allowedHosts?: readonly HostType[];
  readonly properties: Readonly<Record<string, JsonValue>>;
}
/**
 * A network product as this project holds it.
 *
 * A copy of what the catalogue said the day the run was drawn, version
 * included, so that the run keeps meaning what it meant.
 */
export interface NetworkProductSnapshot {
  readonly id: string;
  /** PIPE, CABLE, DUCT, CONDUIT, FLUE — the family it is an entry of. */
  readonly family: string;
  readonly domain: string;
  readonly label: string;
  readonly version?: string;
  readonly properties: Readonly<Record<string, JsonValue>>;
  readonly provenance?: {
    readonly type: string;
    readonly reference: string;
    readonly url?: string;
    readonly validAt?: string;
  };
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
  /**
   * The products this project's runs are made of, as this project holds them.
   *
   * A tube's bore and roughness were resolved from the catalogue installed
   * today. Correcting a product six months from now would therefore resize
   * every network already drawn with it, silently — the exact defect that made
   * an equipment definition travel with the project rather than be pointed at.
   * A file has to open the same way in two years.
   */
  readonly networkProducts?: readonly NetworkProductSnapshot[];
  readonly systems?: readonly TechnicalNetwork[];
  readonly scenarios?: readonly Scenario[];
  /**
   * The views of the project the user can come back to.
   *
   * They were an untyped list, so a project exported whatever the screen
   * happened to show and a drawing produced twice was two different drawings.
   */
  readonly drawingViews?: readonly SavedDrawingView[];
  /** The sheets those views are laid out on. */
  readonly sheets?: readonly ProjectSheet[];
  readonly calculationSettings?: Readonly<Record<string, ModuleSettings>>;
  readonly regulatoryContext?: RegulatoryContext;
  /**
   * What the person has decided to design on this project.
   *
   * Optional, and it stays optional: a file written before scopes existed made
   * no such decision, and reading one into it would narrow somebody's project
   * on their behalf. Absent means « tout est offert » — see `projectScopeOf`.
   *
   * It lives in the file rather than in the browser because it is a decision
   * about the project: the same file opened on another machine has to find the
   * same scope. Panel widths go the other way and never enter the file.
   */
  readonly scope?: ProjectScope;
}

export interface ProjectFile {
  readonly format: 'house-technical-designer-project';
  readonly schemaVersion: string;
  readonly applicationVersion?: string;
  readonly project: Project;
  readonly references?: Readonly<Record<string, JsonValue>>;
  readonly extensions?: Extensions;
}
