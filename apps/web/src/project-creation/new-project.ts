/**
 * The project a filled-in creation page describes.
 *
 * The modal asked ten questions in a box before the first wall, and half of
 * them were not decisions: a latitude and a north angle are measurements, taken
 * later, graphically, on the very drawing the box was standing in front of.
 *
 * What is asked here are the structuring decisions — what this project is, how
 * it starts, what it is made of vertically, roughly where it stands, what
 * trades will be worked on — and every one of them stays changeable
 * afterwards. Nothing asked here is a fact the project could not be told later.
 */
import {
  defaultDomainsFor,
  DESIGN_DOMAIN_IDS,
  isDesignDomainId,
  validateProjectScope,
  type DesignDomainId,
  type ProjectScope,
} from '@house-technical-designer/core-domain';
import type { ProjectFile } from '@house-technical-designer/core-domain';

import type {
  InitialBuildingShape,
  NewProjectDraft,
  NewProjectLevelDraft,
} from '../ux/new-project-draft.js';
import { createBlankProject } from '../project-workspace.js';
import {
  DEFAULT_LEVEL_STACK,
  levelStackIssues,
  stackedLevels,
} from './level-stack.js';

export const DEFAULT_NEW_PROJECT_DRAFT: NewProjectDraft = {
  metadata: { name: 'Nouveau projet' },
  intent: 'NEW_BUILD',
  startMode: 'GUIDED',
  units: 'METRIC',
  levels: DEFAULT_LEVEL_STACK,
  location: {},
  enabledDomains: defaultDomainsFor('NEW_BUILD'),
  initialShape: { kind: 'NONE' },
};

/**
 * Whether the coordinates say a place.
 *
 * Half a pair is not half a location: a latitude without a longitude points at
 * a circle round the earth. Both or neither.
 */
export function locatedCoordinates(
  draft: NewProjectDraft,
): { readonly latitudeDeg: number; readonly longitudeDeg: number } | undefined {
  const { latitudeDeg, longitudeDeg } = draft.location;
  if (latitudeDeg === undefined || longitudeDeg === undefined) return undefined;
  return { latitudeDeg, longitudeDeg };
}

/** Why this draft cannot become a project, if it cannot. */
export function newProjectIssues(draft: NewProjectDraft): readonly string[] {
  const issues: string[] = [...levelStackIssues(draft.levels)];
  if (draft.metadata.name.trim() === '')
    issues.push('Le projet a besoin d’un nom.');
  const { latitudeDeg, longitudeDeg, countryCode } = draft.location;
  if ((latitudeDeg === undefined) !== (longitudeDeg === undefined))
    issues.push(
      'Une latitude sans longitude ne situe rien : donnez les deux, ou aucune.',
    );
  if (latitudeDeg !== undefined && Math.abs(latitudeDeg) > 90)
    issues.push('Une latitude va de −90° à 90°.');
  if (longitudeDeg !== undefined && Math.abs(longitudeDeg) > 180)
    issues.push('Une longitude va de −180° à 180°.');
  if (countryCode !== undefined && countryCode.trim() === '')
    issues.push('Le pays décide des jeux de règles applicables.');
  for (const id of draft.enabledDomains)
    if (!isDesignDomainId(id)) issues.push(`Domaine inconnu : ${String(id)}.`);
  issues.push(...validateProjectScope(scopeOf(draft)));
  const shape = draft.initialShape;
  if (shape !== undefined && shape.kind !== 'NONE') {
    if (!((shape.widthMm ?? 0) > 0) || !((shape.depthMm ?? 0) > 0))
      issues.push('Une emprise a besoin d’une largeur et d’une profondeur.');
    if (shape.kind !== 'RECTANGLE' && !((shape.wingMm ?? 0) > 0))
      issues.push('Cette forme a besoin d’une aile.');
  }
  return issues;
}

export function scopeOf(draft: NewProjectDraft): ProjectScope {
  const wanted = new Set<DesignDomainId>(
    draft.enabledDomains.filter(isDesignDomainId),
  );
  // Architecture is never off, whatever the boxes say.
  wanted.add('ARCHITECTURE');
  return {
    intent: draft.intent,
    enabledDomains: DESIGN_DOMAIN_IDS.filter((id) => wanted.has(id)),
  };
}

type Level = ProjectFile['project']['building']['levels'][number];
type LevelId = Level['id'];

function levelFrom(
  template: Level,
  draft: NewProjectLevelDraft,
  elevationMm: number,
): Level {
  return {
    ...template,
    id: draft.id as LevelId,
    name: draft.name.trim(),
    elevationMm,
    defaultStoreyHeightMm: draft.heightMm,
  };
}

/**
 * The outline of a starting footprint, in millimetres, centred on the origin.
 *
 * Only the outline: what turns it into walls and a slab are the ordinary
 * commands, so the result is a building like any other rather than a shape
 * only the creation page knows how to make.
 */
export function shapeOutline(
  shape: InitialBuildingShape,
): readonly { readonly x: number; readonly y: number }[] {
  const width = shape.widthMm ?? 0;
  const depth = shape.depthMm ?? 0;
  const wing = shape.wingMm ?? 0;
  const left = -width / 2;
  const right = width / 2;
  const bottom = -depth / 2;
  const top = depth / 2;
  switch (shape.kind) {
    case 'NONE':
      return [];
    case 'RECTANGLE':
      return [
        { x: left, y: bottom },
        { x: right, y: bottom },
        { x: right, y: top },
        { x: left, y: top },
      ];
    case 'L':
      return [
        { x: left, y: bottom },
        { x: right, y: bottom },
        { x: right, y: bottom + wing },
        { x: left + wing, y: bottom + wing },
        { x: left + wing, y: top },
        { x: left, y: top },
      ];
    case 'T':
      return [
        { x: left, y: bottom },
        { x: right, y: bottom },
        { x: right, y: bottom + wing },
        { x: wing / 2, y: bottom + wing },
        { x: wing / 2, y: top },
        { x: -wing / 2, y: top },
        { x: -wing / 2, y: bottom + wing },
        { x: left, y: bottom + wing },
      ];
    case 'U':
      return [
        { x: left, y: bottom },
        { x: right, y: bottom },
        { x: right, y: top },
        { x: right - wing, y: top },
        { x: right - wing, y: bottom + wing },
        { x: left + wing, y: bottom + wing },
        { x: left + wing, y: top },
        { x: left, y: top },
      ];
  }
}

/**
 * The project a filled-in page describes, before any footprint is drawn.
 *
 * The blank project is the base: the page decides the metadata, the site, the
 * stack of levels and the scope, and everything else — generic library,
 * starter assemblies, empty networks — is what a new project already had.
 */
export function projectFromNewDraft(
  draft: NewProjectDraft,
  now: string,
): ProjectFile {
  const blank = createBlankProject(now);
  const template = blank.project.building.levels[0]!;
  const levels = stackedLevels(draft.levels).map(({ level, elevationMm }) =>
    levelFrom(template, level, elevationMm),
  );
  const coordinates = locatedCoordinates(draft);
  const { altitudeM, countryCode } = draft.location;
  const author = draft.metadata.author?.trim();
  const description = draft.metadata.description?.trim();
  return {
    ...blank,
    project: {
      ...blank.project,
      metadata: {
        ...blank.project.metadata,
        name: draft.metadata.name.trim(),
        ...(author === undefined || author === '' ? {} : { author }),
        ...(description === undefined || description === ''
          ? {}
          : { description }),
      },
      site: {
        ...blank.project.site,
        // The north starts at « ↑ écran » and is set graphically later, on the
        // plan, where it can be seen against the drawing rather than typed as
        // a number nobody can check.
        northAngleDeg: 0,
        ...(coordinates === undefined ? {} : { location: coordinates }),
        ...(altitudeM === undefined ? {} : { altitudeM }),
      },
      building: { ...blank.project.building, levels },
      scope: scopeOf(draft),
      regulatoryContext: {
        country: (countryCode ?? 'FR').trim().toUpperCase(),
        enabledRulePacks: [],
      },
    },
  };
}
