import type { Point2D } from '@house-technical-designer/geometry';
import type { ComponentInstanceId, LevelId, SpaceId } from './ids.js';
import type { JsonValue } from './types.js';

/**
 * What a component is for, so a plan can be filtered by trade.
 *
 * A heat pump, a radiator, a luminaire and a bed are all things placed in a
 * house, and no calculation treats them alike. The category belongs to the
 * placed object rather than to the drawing: a duct diagram that showed the
 * furniture would be a diagram nobody asked for.
 */
export const COMPONENT_CATEGORIES = [
  'HEATING',
  'SANITARY',
  'VENTILATION',
  'ELECTRICAL',
  'LIGHTING',
  'PHOTOVOLTAIC',
  'APPLIANCE',
  'FURNITURE',
  'OTHER',
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export function isComponentCategory(value: string): value is ComponentCategory {
  return (COMPONENT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * One thing placed in the building, as opposed to one thing catalogued.
 *
 * `EquipmentDefinition` describes a model of heat pump; it cannot describe the
 * heat pump standing at these coordinates, on this storey, in this room. Until
 * now the second had nowhere to live, so heating, sanitary, ventilation,
 * electricity, lighting, photovoltaics and furniture all stopped at the
 * catalogue.
 *
 * An instance carries where it is and what it stands for, and nothing that can
 * be derived from its definition: the power of the model is a property of the
 * model, and copying it here would be two answers to one question.
 */
export interface ComponentInstance {
  readonly id: ComponentInstanceId;
  readonly type: 'COMPONENT_INSTANCE';
  readonly levelId: LevelId;
  readonly category: ComponentCategory;
  /** The catalogue entry this instance stands for, when it stands for one. */
  readonly definitionId?: string;
  /** What the user calls this one, when the definition's name is not enough. */
  readonly name?: string;
  readonly position: Point2D;
  /** Height above its storey, in millimetres. */
  readonly elevationMm: number;
  /** Which way it faces, in degrees counter-clockwise from east. */
  readonly rotationDeg: number;
  /** The wall, slab or roof it is fixed to, when it is fixed to one. */
  readonly hostObjectId?: string;
  /** The room it stands in, when the model states one. */
  readonly spaceId?: SpaceId;
  /**
   * What this one carries beyond its model.
   *
   * A measured value or a setting of this instance, never a copy of what the
   * definition already says.
   */
  readonly properties?: Readonly<Record<string, JsonValue>>;
}

export type ComponentIssueCode =
  | 'INVALID_POSITION'
  | 'INVALID_ELEVATION'
  | 'INVALID_ROTATION'
  | 'INVALID_CATEGORY';

export interface ComponentIssue {
  readonly code: ComponentIssueCode;
  readonly path: string;
  readonly message: string;
}

export function validateComponentInstance(
  component: ComponentInstance,
): readonly ComponentIssue[] {
  const issues: ComponentIssue[] = [];
  if (
    !Number.isFinite(component.position.x) ||
    !Number.isFinite(component.position.y)
  )
    issues.push({
      code: 'INVALID_POSITION',
      path: 'position',
      message: 'must be finite',
    });
  if (!Number.isFinite(component.elevationMm))
    issues.push({
      code: 'INVALID_ELEVATION',
      path: 'elevationMm',
      message: 'must be finite',
    });
  if (!Number.isFinite(component.rotationDeg))
    issues.push({
      code: 'INVALID_ROTATION',
      path: 'rotationDeg',
      message: 'must be finite',
    });
  if (!isComponentCategory(component.category))
    issues.push({
      code: 'INVALID_CATEGORY',
      path: 'category',
      message: `must be one of ${COMPONENT_CATEGORIES.join(', ')}`,
    });
  return issues;
}
