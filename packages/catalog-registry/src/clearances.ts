/**
 * The room an object needs around it, and what for.
 *
 * « Physical » is what the object occupies; everything else is space nobody may
 * build in for a reason, and the reasons are not the same. Maintenance space
 * can be shared with a corridor and cannot be shared with a wall; an air intake
 * cannot be shared with an air exhaust; a combustible clearance is a fire rule
 * and not a convenience. One list of « clearance in millimetres » cannot say
 * any of that.
 */
export const CLEARANCE_ZONES = [
  'PHYSICAL',
  'INSTALLATION',
  'MAINTENANCE',
  'SERVICE',
  'USAGE',
  'ACCESSIBILITY',
  'OPENING',
  'AIR_INTAKE',
  'AIR_EXHAUST',
  'THERMAL',
  'FIRE',
  'COMBUSTIBLE_CLEARANCE',
  'ELECTRICAL_WORKING',
] as const;
export type ClearanceZone = (typeof CLEARANCE_ZONES)[number];

export const CLEARANCE_LABELS: Readonly<Record<ClearanceZone, string>> = {
  PHYSICAL: 'Encombrement',
  INSTALLATION: 'Pose',
  MAINTENANCE: 'Entretien',
  SERVICE: 'Intervention',
  USAGE: 'Usage',
  ACCESSIBILITY: 'Accessibilité',
  OPENING: 'Débattement d’ouverture',
  AIR_INTAKE: 'Prise d’air',
  AIR_EXHAUST: 'Rejet d’air',
  THERMAL: 'Dégagement thermique',
  FIRE: 'Dégagement au feu',
  COMBUSTIBLE_CLEARANCE: 'Distance aux matériaux combustibles',
  ELECTRICAL_WORKING: 'Zone de travail électrique',
};

export function isClearanceZone(value: string): value is ClearanceZone {
  return (CLEARANCE_ZONES as readonly string[]).includes(value);
}
