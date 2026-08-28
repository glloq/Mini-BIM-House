import {
  clearanceConflicts,
  clearanceZones,
  CLEARANCE_LABELS,
  type ClearanceConflict,
  type ClearanceZone,
  type ClearanceZoneInstance,
} from '@house-technical-designer/technical-types';
import { placedEquipment } from './placed-equipment.js';
import type { ResolvedPlacedEquipment } from './placed-equipment.js';
import type { Project } from './types.js';

/**
 * A zone the model requires and nobody has measured.
 *
 * Reported rather than drawn as zero. « Nobody has said how much room this
 * needs » and « it needs none » are different statements, and only one of them
 * lets a machine be placed against a wall.
 */
export interface UnmeasuredClearance {
  readonly objectId: string;
  readonly zone: ClearanceZone;
  readonly message: string;
}

export interface ClearanceReport {
  readonly zones: readonly ClearanceZoneInstance[];
  readonly conflicts: readonly ClearanceConflict[];
  readonly unmeasured: readonly UnmeasuredClearance[];
}

/** A thing without dimensions occupies nothing anybody can draw or test. */
function placementOf(placed: ResolvedPlacedEquipment) {
  const width = placed.dimensions?.widthMm;
  const depth = placed.dimensions?.depthMm;
  const height = placed.dimensions?.heightMm;
  if (width === undefined || depth === undefined || height === undefined)
    return undefined;
  return {
    objectId: placed.instanceId,
    position: { x: placed.position.x, y: placed.position.y },
    elevationMm: placed.position.z,
    rotationDeg: placed.rotationDeg,
    widthMm: width,
    depthMm: depth,
    heightMm: height,
  };
}

/**
 * The room every placed thing claims, and where two of them disagree.
 *
 * This is a geometric statement and nothing more: these volumes overlap, and
 * these two kinds of volume may not. Whether that breaks a rule of a
 * particular country is a question for a rule pack, which knows which country
 * and which year; a geometry that answered it would be answering for every
 * jurisdiction at once.
 */
export function clearanceReport(project: Project): ClearanceReport {
  const zones: ClearanceZoneInstance[] = [];
  const unmeasured: UnmeasuredClearance[] = [];
  /*
   * Ce qui est logé dans quoi, et pourquoi cela regarde les dégagements.
   *
   * Un disjoncteur monté dans son tableau occupe le volume du tableau : c'est
   * le montage, pas une collision. La géométrie ne peut pas faire la
   * différence — deux boîtes se recouvrent, un point — et c'est le modèle qui
   * la fait, en disant que l'un loge l'autre.
   *
   * La paire logeur/logé est la seule qui soit ignorée. Les dégagements du
   * tableau valent toujours contre tout le reste : c'est devant le tableau
   * qu'on se tient, et le fait qu'un disjoncteur soit dedans n'y change rien.
   */
  const housing = new Map<string, string>();
  for (const level of project.building.levels)
    for (const component of level.components ?? [])
      if (component.housedInId !== undefined)
        housing.set(component.id, component.housedInId);
  const together = (first: string, second: string): boolean =>
    housing.get(first) === second || housing.get(second) === first;
  for (const placed of placedEquipment(project)) {
    const placement = placementOf(placed);
    if (placement === undefined) continue;
    const required = placed.requiredClearances;
    const own = clearanceZones(placement, placed.clearances, required);
    zones.push(...own);
    for (const zone of own)
      if (!zone.known)
        unmeasured.push({
          objectId: placed.instanceId,
          zone: zone.zone,
          message: `${CLEARANCE_LABELS[zone.zone]} : ce modèle en demande une et personne n'a dit combien.`,
        });
  }
  return {
    zones,
    conflicts: clearanceConflicts(zones).filter(
      ({ first, second }) => !together(first.objectId, second.objectId),
    ),
    unmeasured,
  };
}
