/**
 * The ten phases of a construction project, as an engine rather than as tabs.
 *
 * They were going to become ten more destinations, on top of the eleven that
 * already existed. A phase is not a place: nobody works « dans Vérifications »,
 * they work on a wall and a check happens to be about it. So the phases drive
 * the guide, and the guide recommends — it never blocks, and it never becomes
 * navigation.
 *
 * « Cinq espaces = où je travaille. Les étapes = ce qu'il reste éventuellement
 * à faire. »
 *
 * The state of a step is **derived from the model**, every time it is asked
 * for. `stepCompleted = true` is never written into the project: a flag says
 * the person clicked something, and what matters is whether the house actually
 * has the walls. A project that loses its walls has to lose the step with
 * them.
 */
import type {
  DesignDomainId,
  Project,
  ProjectScope,
} from '@house-technical-designer/core-domain';

import type { UiTarget } from './ui-target.js';

export const WORKFLOW_GROUPS = [
  'PROJECT',
  'SITE',
  'BUILDING',
  'ARCHITECTURE',
  'CONSTRUCTION',
  'FITTING',
  'TECHNICAL',
  'ENERGY',
  'CHECKS',
  'DOCUMENTS',
] as const;
export type WorkflowGroup = (typeof WORKFLOW_GROUPS)[number];

export const WORKFLOW_GROUP_LABELS: Readonly<Record<WorkflowGroup, string>> = {
  PROJECT: 'Projet',
  SITE: 'Terrain',
  BUILDING: 'Bâtiment',
  ARCHITECTURE: 'Architecture',
  CONSTRUCTION: 'Construction',
  FITTING: 'Aménagement',
  TECHNICAL: 'Technique',
  ENERGY: 'Énergie',
  CHECKS: 'Vérifications',
  DOCUMENTS: 'Documents',
};

/**
 * What a step can be.
 *
 * `NOT_APPLICABLE` is not a failure and not a success: a project without solar
 * in its scope has nothing to say about placing panels, and saying « à faire »
 * would invent work nobody signed up for. `BLOCKED` says the step depends on
 * something that has not happened yet — and it still never stops anyone from
 * doing it anyway.
 */
export const WORKFLOW_STEP_STATES = [
  'DONE',
  'CURRENT',
  'AVAILABLE',
  'NOT_APPLICABLE',
  'BLOCKED',
] as const;
export type WorkflowStepState = (typeof WORKFLOW_STEP_STATES)[number];

export const WORKFLOW_STEP_STATE_LABELS: Readonly<
  Record<WorkflowStepState, string>
> = {
  DONE: 'Fait',
  CURRENT: 'En cours',
  AVAILABLE: 'À faire',
  NOT_APPLICABLE: 'Hors périmètre',
  BLOCKED: 'En attente',
};

export interface WorkflowStepDefinition {
  readonly id: string;
  readonly group: WorkflowGroup;
  readonly label: string;
  /** The trade this step belongs to, when it belongs to one. */
  readonly domain?: DesignDomainId;
  /** The steps it reads as done before it is worth starting. */
  readonly after?: readonly string[];
}

/**
 * The steps, frozen.
 *
 * Adding one is an entry here; nothing else in the application holds a list of
 * steps. What each step *measures* is attached to these identifiers by the
 * registry, and the compiler refuses a registry that misses one.
 */
export const WORKFLOW_STEP_DEFINITIONS = [
  { id: 'NAME_PROJECT', group: 'PROJECT', label: 'Nommer le projet' },
  { id: 'CHOOSE_INTENT', group: 'PROJECT', label: 'Dire ce qu’on construit' },
  { id: 'CHOOSE_SCOPE', group: 'PROJECT', label: 'Choisir les domaines' },
  {
    id: 'LOCATE_SITE',
    group: 'SITE',
    label: 'Situer le terrain',
    domain: 'SITE',
  },
  {
    id: 'ORIENT_NORTH',
    group: 'SITE',
    label: 'Orienter le nord',
    domain: 'SITE',
  },
  {
    id: 'DRAW_PARCEL',
    group: 'SITE',
    label: 'Tracer la parcelle',
    domain: 'SITE',
  },
  {
    id: 'PICK_CLIMATE',
    group: 'SITE',
    label: 'Associer un jeu climatique',
    domain: 'SITE',
    after: ['LOCATE_SITE'],
  },
  { id: 'DEFINE_LEVELS', group: 'BUILDING', label: 'Empiler les niveaux' },
  {
    id: 'SET_LEVEL_HEIGHTS',
    group: 'BUILDING',
    label: 'Régler les hauteurs',
    after: ['DEFINE_LEVELS'],
  },
  {
    id: 'DRAW_EXTERIOR_WALLS',
    group: 'ARCHITECTURE',
    label: 'Dessiner les murs extérieurs',
    domain: 'ARCHITECTURE',
    after: ['DEFINE_LEVELS'],
  },
  {
    id: 'DRAW_PARTITIONS',
    group: 'ARCHITECTURE',
    label: 'Dessiner les cloisons',
    domain: 'ARCHITECTURE',
    after: ['DRAW_EXTERIOR_WALLS'],
  },
  {
    id: 'NAME_SPACES',
    group: 'ARCHITECTURE',
    label: 'Nommer les pièces',
    domain: 'ARCHITECTURE',
    after: ['DRAW_PARTITIONS'],
  },
  {
    id: 'PLACE_OPENINGS',
    group: 'ARCHITECTURE',
    label: 'Poser portes et fenêtres',
    domain: 'ARCHITECTURE',
    after: ['DRAW_EXTERIOR_WALLS'],
  },
  {
    id: 'PLACE_STAIRS',
    group: 'ARCHITECTURE',
    label: 'Poser les escaliers',
    domain: 'ARCHITECTURE',
    after: ['DEFINE_LEVELS'],
  },
  {
    id: 'ASSIGN_WALL_ASSEMBLIES',
    group: 'CONSTRUCTION',
    label: 'Composer les murs',
    domain: 'ARCHITECTURE',
    after: ['DRAW_EXTERIOR_WALLS'],
  },
  {
    id: 'ASSIGN_SLAB_ASSEMBLIES',
    group: 'CONSTRUCTION',
    label: 'Composer les planchers',
    domain: 'ARCHITECTURE',
  },
  {
    id: 'DRAW_ROOF',
    group: 'CONSTRUCTION',
    label: 'Dessiner la toiture',
    domain: 'ARCHITECTURE',
    after: ['DRAW_EXTERIOR_WALLS'],
  },
  {
    id: 'PLACE_STRUCTURE',
    group: 'CONSTRUCTION',
    label: 'Poser la structure',
    domain: 'STRUCTURE',
  },
  {
    id: 'PLACE_FURNITURE',
    group: 'FITTING',
    label: 'Meubler',
    domain: 'FURNITURE',
    after: ['NAME_SPACES'],
  },
  {
    id: 'DRAW_WATER',
    group: 'TECHNICAL',
    label: 'Tracer l’eau froide et chaude',
    domain: 'PLUMBING',
  },
  {
    id: 'DRAW_WASTEWATER',
    group: 'TECHNICAL',
    label: 'Tracer les évacuations',
    domain: 'WASTEWATER',
  },
  {
    id: 'DRAW_RAINWATER',
    group: 'TECHNICAL',
    label: 'Tracer les eaux pluviales',
    domain: 'RAINWATER',
  },
  {
    id: 'DRAW_HEATING',
    group: 'TECHNICAL',
    label: 'Tracer le chauffage',
    domain: 'HEATING',
  },
  {
    id: 'DRAW_VENTILATION',
    group: 'TECHNICAL',
    label: 'Tracer la ventilation',
    domain: 'VENTILATION',
  },
  {
    id: 'DRAW_ELECTRICAL',
    group: 'TECHNICAL',
    label: 'Tracer l’électricité',
    domain: 'ELECTRICAL',
  },
  {
    id: 'PLACE_LIGHTING',
    group: 'TECHNICAL',
    label: 'Poser l’éclairage',
    domain: 'LIGHTING',
    after: ['DRAW_ELECTRICAL'],
  },
  {
    id: 'RUN_THERMAL',
    group: 'ENERGY',
    label: 'Calculer l’enveloppe',
    domain: 'ARCHITECTURE',
    after: ['ASSIGN_WALL_ASSEMBLIES'],
  },
  {
    id: 'PLACE_SOLAR',
    group: 'ENERGY',
    label: 'Poser le photovoltaïque',
    domain: 'SOLAR',
    after: ['DRAW_ROOF'],
  },
  {
    id: 'RUN_ENERGY_BALANCE',
    group: 'ENERGY',
    label: 'Faire le bilan énergétique',
    after: ['RUN_THERMAL'],
  },
  { id: 'RESOLVE_ISSUES', group: 'CHECKS', label: 'Traiter les anomalies' },
  {
    id: 'RUN_RULE_PACKS',
    group: 'CHECKS',
    label: 'Vérifier le référentiel',
  },
  { id: 'SAVE_VIEWS', group: 'DOCUMENTS', label: 'Enregistrer les vues' },
  {
    id: 'COMPOSE_SHEETS',
    group: 'DOCUMENTS',
    label: 'Composer les feuilles',
    after: ['SAVE_VIEWS'],
  },
  {
    id: 'EXPORT',
    group: 'DOCUMENTS',
    label: 'Exporter',
    after: ['COMPOSE_SHEETS'],
  },
] as const satisfies readonly WorkflowStepDefinition[];

export type WorkflowStepId = (typeof WORKFLOW_STEP_DEFINITIONS)[number]['id'];

export const WORKFLOW_STEP_IDS: readonly WorkflowStepId[] =
  WORKFLOW_STEP_DEFINITIONS.map(({ id }) => id);

export const WORKFLOW_STEP_BY_ID: Readonly<
  Record<WorkflowStepId, WorkflowStepDefinition>
> = Object.fromEntries(
  WORKFLOW_STEP_DEFINITIONS.map((step) => [step.id, step]),
) as Readonly<Record<WorkflowStepId, WorkflowStepDefinition>>;

export function isWorkflowStepId(value: string): value is WorkflowStepId {
  return Object.hasOwn(WORKFLOW_STEP_BY_ID, value);
}

/** One thing the guide can offer to do about a step. */
export interface WorkflowAction {
  readonly label: string;
  readonly target: UiTarget;
}

/**
 * What a step measures, and where it sends someone.
 *
 * `evaluate` reads the project and answers; it is given no place to write, on
 * purpose. `applies` is what makes the guide shorten itself on a project that
 * does not do photovoltaics, rather than filling it with steps marked « non
 * concerné ».
 */
export interface WorkflowStepDescriptor {
  readonly id: WorkflowStepId;
  readonly applies: (project: Project, scope: ProjectScope) => boolean;
  readonly evaluate: (project: Project) => WorkflowStepState;
  readonly actions: (project: Project) => readonly WorkflowAction[];
}
