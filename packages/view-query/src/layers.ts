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
  /**
   * The disciplines the layer carries.
   *
   * Usually one. A layer of placed things carries several, because a radiator
   * belongs to heating and a socket to electricity while one switch turns both
   * on: the layer is what the user hides, the discipline is what the drawing
   * is read by, and they are not the same axis.
   */
  readonly disciplines: readonly Discipline[];
  /** Whether the layer is on when no explicit choice has been made. */
  readonly defaultVisible: boolean;
}

export const PLAN_LAYERS = [
  {
    id: 'architecture.walls',
    label: 'Murs',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'architecture.wall-layers',
    label: 'Couches de matériaux',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'architecture.openings',
    label: 'Ouvertures',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'architecture.slabs',
    label: 'Dalles',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'architecture.roofs',
    label: 'Toitures',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: false,
  },
  {
    id: 'architecture.spaces',
    label: 'Pièces',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'architecture.space-labels',
    label: 'Étiquettes de pièces',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'architecture.stairs',
    label: 'Escaliers',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'structure.members',
    label: 'Structure',
    disciplines: ['STRUCTURE'],
    defaultVisible: true,
  },
  {
    id: 'site.parcel',
    label: 'Terrain',
    disciplines: ['SITE'],
    defaultVisible: true,
  },
  {
    id: 'components.placed',
    label: 'Équipements posés',
    // A placed thing belongs to the discipline of what it is: a radiator is
    // heating, a socket electricity, a basin water. One switch shows them all
    // because one drawing shows them all, and the exported drawing still says
    // which is which.
    disciplines: [
      'HEATING',
      'WATER',
      'VENTILATION',
      'ELECTRICAL',
      'LIGHTING',
      'PV',
      'OTHER',
    ],
    defaultVisible: true,
  },
  {
    id: 'annotation.dimensions',
    label: 'Cotations',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'annotation.notes',
    label: 'Annotations',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    // Where the sections are cut and the façades are looked from. On by
    // default: a plan that does not say a section exists is a plan its reader
    // trusts to be the whole drawing.
    id: 'annotation.view-marks',
    label: 'Repères de coupe et de façade',
    disciplines: ['ARCHITECTURE'],
    defaultVisible: true,
  },
  {
    id: 'water.pipes',
    label: 'Eau',
    disciplines: ['WATER'],
    defaultVisible: false,
  },
  {
    id: 'wastewater.pipes',
    label: 'Évacuations',
    disciplines: ['WASTEWATER'],
    defaultVisible: false,
  },
  {
    id: 'ventilation.ducts',
    label: 'Ventilation',
    disciplines: ['VENTILATION'],
    defaultVisible: false,
  },
  {
    id: 'electrical.circuits',
    label: 'Électricité',
    disciplines: ['ELECTRICAL'],
    defaultVisible: false,
  },
  {
    id: 'analysis.overlay',
    label: 'Analyse',
    disciplines: ['OTHER'],
    defaultVisible: false,
  },
  {
    // Off by default: the room around a machine matters when somebody is
    // placing it, and it hides the plan the rest of the time.
    id: 'analysis.clearances',
    label: 'Dégagements',
    disciplines: ['OTHER'],
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
  'structure.members',
  'site.parcel',
  'components.placed',
  'annotation.dimensions',
  'annotation.notes',
  'annotation.view-marks',
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
  ).flatMap(({ disciplines: carried }) => carried);
  return [...new Set<Discipline>(disciplines)];
}
