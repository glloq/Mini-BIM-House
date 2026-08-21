import type { ScenePrimitive } from '@house-technical-designer/drawing-engine';
import {
  CLEARANCE_LABELS,
  type ClearanceZone,
} from '@house-technical-designer/technical-types';
import {
  clearanceReport,
  type ClearanceReport,
} from '@house-technical-designer/core-domain';
import type { Project } from '@house-technical-designer/core-domain';

/**
 * The clearance zones a user can ask to see.
 *
 * Not one switch: showing every zone of every appliance at once is a plan
 * covered in overlapping rectangles nobody reads. Somebody placing a heat pump
 * wants its air, somebody wiring a board wants the working space in front of
 * it, and neither wants the other.
 */
export const CLEARANCE_GROUPS = [
  { id: 'PHYSICAL', label: CLEARANCE_LABELS.PHYSICAL, zones: ['PHYSICAL'] },
  {
    id: 'ACCESS',
    label: 'Entretien et usage',
    zones: [
      'INSTALLATION',
      'MAINTENANCE',
      'SERVICE',
      'USAGE',
      'ACCESSIBILITY',
      'OPENING',
    ],
  },
  { id: 'AIR', label: 'Air', zones: ['AIR_INTAKE', 'AIR_EXHAUST'] },
  {
    id: 'HEAT',
    label: 'Chaleur et feu',
    zones: ['THERMAL', 'FIRE', 'COMBUSTIBLE_CLEARANCE'],
  },
  {
    id: 'ELECTRICAL',
    label: 'Travail électrique',
    zones: ['ELECTRICAL_WORKING'],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly zones: readonly ClearanceZone[];
}[];

export type ClearanceGroupId = (typeof CLEARANCE_GROUPS)[number]['id'];

const GROUP_OF = new Map<ClearanceZone, ClearanceGroupId>(
  CLEARANCE_GROUPS.flatMap((group) =>
    group.zones.map((zone) => [zone, group.id] as const),
  ),
);

/**
 * The zones of one storey, drawn.
 *
 * Derived on the way to the screen and never stored: they are the model and
 * the placement seen together, and a stored copy stops agreeing the moment
 * anything moves. A zone nobody has measured is not drawn — an empty rectangle
 * where a two-metre one belongs is worse than nothing.
 */
export function clearancePrimitives(
  project: Project,
  options: {
    readonly levelId?: string;
    readonly groups: readonly ClearanceGroupId[];
    readonly report?: ClearanceReport;
  },
): readonly ScenePrimitive[] {
  const chosen = new Set(options.groups);
  if (chosen.size === 0) return [];
  const report = options.report ?? clearanceReport(project);
  const onLevel = new Set<string>(
    project.building.levels
      .filter(
        ({ id }) => options.levelId === undefined || id === options.levelId,
      )
      .flatMap(({ components }) =>
        (components ?? []).map(({ id }) => id as string),
      ),
  );
  const inConflict = new Set(
    report.conflicts.flatMap(({ first, second }) => [
      `${first.objectId} ${first.zone}`,
      `${second.objectId} ${second.zone}`,
    ]),
  );
  return report.zones
    .filter(
      (zone) =>
        zone.known &&
        onLevel.has(zone.objectId) &&
        chosen.has(GROUP_OF.get(zone.zone) ?? 'PHYSICAL'),
    )
    .map((zone) => ({
      id: `clearance:${zone.objectId}:${zone.zone}`,
      sourceObjectId: zone.objectId,
      // A conflict is drawn as the analysis « high » band and a zone that is
      // merely claimed as the low one: the plan says which rectangles are a
      // problem without a legend of its own.
      semanticRole: inConflict.has(`${zone.objectId} ${zone.zone}`)
        ? ('ANALYSIS_HIGH' as const)
        : ('ANALYSIS_LOW' as const),
      geometry: {
        kind: 'POLYGON' as const,
        polygon: { outer: [...zone.footprint] },
      },
      layer: 'analysis.clearances',
      zIndex: 90,
      discipline: 'OTHER' as const,
      metadata: {
        clearanceZone: zone.zone,
        label: CLEARANCE_LABELS[zone.zone],
        conflict: inConflict.has(`${zone.objectId} ${zone.zone}`),
        ...(zone.reason === undefined ? {} : { reason: zone.reason }),
      },
    }));
}
