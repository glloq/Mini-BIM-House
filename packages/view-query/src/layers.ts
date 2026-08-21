import type { Discipline } from '@house-technical-designer/drawing-engine';

/**
 * A drawing layer the user can switch on and off.
 *
 * Layers are a property of the view, never of the project: turning one off hides
 * primitives, it never removes anything from the model.
 */
export interface LayerDescriptor {
  readonly id: string;
  readonly label: string;
  readonly discipline: Discipline;
  /** Whether the layer is on when no explicit choice has been made. */
  readonly defaultVisible: boolean;
}

export const PLAN_LAYERS = [
  {
    id: 'architecture.walls',
    label: 'Murs',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'architecture.wall-layers',
    label: 'Couches de matériaux',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'architecture.openings',
    label: 'Ouvertures',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'architecture.slabs',
    label: 'Dalles',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'architecture.roofs',
    label: 'Toitures',
    discipline: 'ARCHITECTURE',
    defaultVisible: false,
  },
  {
    id: 'architecture.spaces',
    label: 'Pièces',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'architecture.space-labels',
    label: 'Étiquettes de pièces',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'architecture.stairs',
    label: 'Escaliers',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'components.placed',
    label: 'Équipements posés',
    discipline: 'OTHER',
    defaultVisible: true,
  },
  {
    id: 'annotation.dimensions',
    label: 'Cotations',
    discipline: 'ARCHITECTURE',
    defaultVisible: true,
  },
  {
    id: 'water.pipes',
    label: 'Eau',
    discipline: 'WATER',
    defaultVisible: false,
  },
  {
    id: 'wastewater.pipes',
    label: 'Évacuations',
    discipline: 'WASTEWATER',
    defaultVisible: false,
  },
  {
    id: 'ventilation.ducts',
    label: 'Ventilation',
    discipline: 'VENTILATION',
    defaultVisible: false,
  },
  {
    id: 'electrical.circuits',
    label: 'Électricité',
    discipline: 'ELECTRICAL',
    defaultVisible: false,
  },
  {
    id: 'analysis.overlay',
    label: 'Analyse',
    discipline: 'OTHER',
    defaultVisible: false,
  },
] as const satisfies readonly LayerDescriptor[];

export type PlanLayerId = (typeof PLAN_LAYERS)[number]['id'];

export type LayerVisibility = Readonly<Record<string, boolean>>;

/** Layer set a discipline view turns on, described once for the whole app. */
export interface LayerPreset {
  readonly id: string;
  readonly label: string;
  readonly disciplines: readonly Discipline[];
  readonly layers: readonly PlanLayerId[];
}

const ARCHITECTURE_BASE: readonly PlanLayerId[] = [
  'architecture.walls',
  'architecture.wall-layers',
  'architecture.openings',
  'architecture.slabs',
  'architecture.spaces',
  'architecture.space-labels',
  'architecture.stairs',
  'components.placed',
  'annotation.dimensions',
];

/** Discipline views the user can switch between without a second model. */
export const LAYER_PRESETS: readonly LayerPreset[] = [
  {
    id: 'architecture',
    label: 'Architecture',
    disciplines: ['ARCHITECTURE'],
    layers: ARCHITECTURE_BASE,
  },
  {
    id: 'materials',
    label: 'Matériaux',
    disciplines: ['ARCHITECTURE'],
    layers: [
      'architecture.walls',
      'architecture.wall-layers',
      'architecture.openings',
      'architecture.spaces',
    ],
  },
  {
    id: 'plumbing',
    label: 'Plomberie',
    disciplines: ['ARCHITECTURE', 'WATER', 'WASTEWATER'],
    layers: [
      'architecture.walls',
      'architecture.openings',
      'architecture.spaces',
      'architecture.space-labels',
      'water.pipes',
      'wastewater.pipes',
    ],
  },
  {
    id: 'ventilation',
    label: 'Ventilation',
    disciplines: ['ARCHITECTURE', 'VENTILATION'],
    layers: [
      'architecture.walls',
      'architecture.openings',
      'architecture.spaces',
      'architecture.space-labels',
      'ventilation.ducts',
    ],
  },
  {
    id: 'electrical',
    label: 'Électricité',
    disciplines: ['ARCHITECTURE', 'ELECTRICAL', 'LIGHTING'],
    layers: [
      'architecture.walls',
      'architecture.openings',
      'architecture.spaces',
      'architecture.space-labels',
      'electrical.circuits',
    ],
  },
  {
    id: 'thermal',
    label: 'Thermique',
    disciplines: ['ARCHITECTURE', 'OTHER'],
    layers: [
      'architecture.walls',
      'architecture.openings',
      'architecture.spaces',
      'architecture.space-labels',
      'analysis.overlay',
    ],
  },
  {
    id: 'synthesis',
    label: 'Synthèse',
    disciplines: [
      'ARCHITECTURE',
      'WATER',
      'WASTEWATER',
      'VENTILATION',
      'ELECTRICAL',
    ],
    layers: [
      ...ARCHITECTURE_BASE,
      'water.pipes',
      'wastewater.pipes',
      'ventilation.ducts',
      'electrical.circuits',
    ],
  },
  {
    id: 'print',
    label: 'Impression',
    disciplines: ['ARCHITECTURE'],
    layers: [
      'architecture.walls',
      'architecture.wall-layers',
      'architecture.openings',
      'architecture.spaces',
      'architecture.space-labels',
      'annotation.dimensions',
    ],
  },
];

/** Visibility map every layer of a preset turns on, others off. */
export function presetVisibility(preset: LayerPreset): LayerVisibility {
  return Object.fromEntries(
    PLAN_LAYERS.map(({ id }) => [id, preset.layers.includes(id)]),
  );
}

/** Visibility map from the layers' own defaults. */
export function defaultVisibility(): LayerVisibility {
  return Object.fromEntries(
    PLAN_LAYERS.map(({ id, defaultVisible }) => [id, defaultVisible]),
  );
}

/** Disciplines a visibility map requires, so the view can filter them too. */
export function visibleDisciplines(
  visibility: LayerVisibility,
): readonly Discipline[] {
  const disciplines = PLAN_LAYERS.filter(
    ({ id }) => visibility[id] === true,
  ).map(({ discipline }) => discipline);
  return [...new Set<Discipline>(disciplines)];
}
