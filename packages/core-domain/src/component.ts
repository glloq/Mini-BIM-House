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
  /**
   * The version of that entry the project was designed with.
   *
   * A catalogue is corrected, and a correction that reached an existing
   * project without saying so would change a house nobody touched. Recording
   * which version was placed is what lets the application report the
   * difference rather than absorb it.
   */
  readonly definitionVersion?: string;
  /** What the user calls this one, when the definition's name is not enough. */
  readonly name?: string;
  readonly position: Point2D;
  /** Height above its storey, in millimetres. */
  readonly elevationMm: number;
  /** Which way it faces, in degrees counter-clockwise from east. */
  readonly rotationDeg: number;
  /**
   * The building element it is physically fixed to, when it is fixed to one.
   *
   * A wall, a slab or a roof — something with a surface a thing can be hung
   * on. Not a room, which is a volume rather than a support, and not a
   * catalogue entry, which is a description rather than a place: those are
   * `spaceId` and `definitionId`, and confusing the three is how a radiator
   * ends up « fixed to » the model of a radiator.
   */
  readonly hostObjectId?: string;
  /**
   * L'appareil dans lequel celui-ci est **logé**, quand il l'est.
   *
   * Un disjoncteur est monté dans un tableau, un module dans un rack, une
   * vanne dans un collecteur. Ce n'est ni `hostObjectId` — un tableau n'est pas
   * un élément de construction — ni une collision : ce sont deux objets qui
   * occupent le même volume **exprès**, et le dire est la seule façon de
   * distinguer un appareil correctement monté d'un appareil qui rentre dans un
   * autre.
   *
   * Faute de ce champ, la maison de référence rapportait trois conflits de
   * dégagement entre son tableau et son disjoncteur — « rien ne peut occuper
   * le volume d'un autre objet » — pour un montage que tout électricien fait.
   * L'analyse des dégagements ignore une paire dont l'un loge l'autre, et rien
   * d'autre : les dégagements du **logeur** valent toujours contre le reste,
   * ce qui est juste, puisque c'est devant le tableau qu'on se tient.
   */
  readonly housedInId?: ComponentInstanceId;
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
  | 'INVALID_CATEGORY'
  | 'INVALID_DEFINITION_PIN'
  /** Un appareil logé dans lui-même, ou dans une chaîne qui revient à lui. */
  | 'INVALID_HOUSING';

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
  if (component.housedInId === component.id)
    issues.push({
      code: 'INVALID_HOUSING',
      path: 'housedInId',
      message: 'a component cannot be housed in itself',
    });
  if (!isComponentCategory(component.category))
    issues.push({
      code: 'INVALID_CATEGORY',
      path: 'category',
      message: `must be one of ${COMPONENT_CATEGORIES.join(', ')}`,
    });
  // A version without an entry pins nothing: it is a claim about a catalogue
  // this instance never named.
  if (
    component.definitionVersion !== undefined &&
    component.definitionId === undefined
  )
    issues.push({
      code: 'INVALID_DEFINITION_PIN',
      path: 'definitionVersion',
      message: 'names a version without naming a catalogue entry',
    });
  return issues;
}
