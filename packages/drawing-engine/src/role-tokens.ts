import type { SemanticRole } from './scene.js';

/**
 * Every semantic role a scene may carry.
 *
 * Stated once, so a charter that forgets one is rejected when it is written
 * rather than when a drawing happens to contain it.
 */
export const SEMANTIC_ROLES: readonly SemanticRole[] = [
  'SITE',
  'SPACE_FILL',
  'WALL_CUT',
  'WALL_LAYER_STRUCTURE',
  'WALL_LAYER_INSULATION',
  'WALL_LAYER_FINISH',
  'WALL_LAYER_OTHER',
  'WALL_BELOW',
  'OPENING',
  'OPENING_REVEAL',
  'NETWORK',
  'WATER_COLD',
  'WATER_HOT',
  'WATER_RECIRCULATION',
  'WATER_NON_POTABLE',
  'VENT_SUPPLY',
  'VENT_EXHAUST',
  'VENT_TRANSFER',
  'ELECTRICAL_POWER',
  'ELECTRICAL_LIGHTING',
  'ELECTRICAL_CONTROL',
  'ELECTRICAL_PV',
  'SYMBOL',
  'ANNOTATION',
  'DIMENSION',
  'ANALYSIS',
  'ANALYSIS_LOW',
  'ANALYSIS_MEDIUM',
  'ANALYSIS_HIGH',
  'ANALYSIS_UNKNOWN',
];

/**
 * The token each role falls back to when no rule of the charter is more
 * precise. Names are shared across charters on purpose: two profiles style
 * the same `wall-cut` differently, they do not rename it.
 */
export const DEFAULT_ROLE_TOKENS: Readonly<Record<SemanticRole, string>> = {
  SITE: 'site',
  SPACE_FILL: 'space-fill',
  WALL_CUT: 'wall-cut',
  WALL_LAYER_STRUCTURE: 'wall-layer-structure',
  WALL_LAYER_INSULATION: 'wall-layer-insulation',
  WALL_LAYER_FINISH: 'wall-layer-finish',
  WALL_LAYER_OTHER: 'wall-layer-other',
  WALL_BELOW: 'wall-below',
  OPENING: 'opening',
  OPENING_REVEAL: 'opening-reveal',
  NETWORK: 'network',
  WATER_COLD: 'water-cold',
  WATER_HOT: 'water-hot',
  WATER_RECIRCULATION: 'water-recirculation',
  WATER_NON_POTABLE: 'water-non-potable',
  VENT_SUPPLY: 'vent-supply',
  VENT_EXHAUST: 'vent-exhaust',
  VENT_TRANSFER: 'vent-transfer',
  ELECTRICAL_POWER: 'electrical-power',
  ELECTRICAL_LIGHTING: 'electrical-lighting',
  ELECTRICAL_CONTROL: 'electrical-control',
  ELECTRICAL_PV: 'electrical-pv',
  SYMBOL: 'symbol',
  ANNOTATION: 'annotation',
  DIMENSION: 'dimension',
  ANALYSIS: 'analysis',
  ANALYSIS_LOW: 'analysis-low',
  ANALYSIS_MEDIUM: 'analysis-medium',
  ANALYSIS_HIGH: 'analysis-high',
  ANALYSIS_UNKNOWN: 'analysis-unknown',
};
