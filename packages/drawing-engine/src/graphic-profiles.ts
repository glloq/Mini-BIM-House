import {
  graphicProfileId,
  type GraphicProfile,
  type ObjectState,
  type SemanticRole,
} from './scene.js';
import type { SvgStyle, SvgStyleCatalog } from './svg-renderer.js';

export type GraphicOutputMode = 'SCREEN' | 'PRINT';

export interface GraphicProfileBundle {
  readonly id: string;
  readonly version: string;
  readonly mode: GraphicOutputMode;
  readonly profile: GraphicProfile;
  readonly styles: SvgStyleCatalog;
  /** Informational references only; a profile is not a compliance claim. */
  readonly designReferences: readonly string[];
}

const allRoles: readonly SemanticRole[] = [
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

const roleTokens: Readonly<Record<SemanticRole, string>> = {
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

const paperWidths = {
  ultraThin: 0.13,
  thin: 0.18,
  medium: 0.25,
  thick: 0.35,
  cut: 0.5,
} as const;

function styles(
  mode: GraphicOutputMode,
  locale: 'generic' | 'fr',
): SvgStyleCatalog {
  const black = '#111111';
  const color = (screen: string): string => (mode === 'PRINT' ? black : screen);
  const tokens: Record<string, SvgStyle> = {
    site: {
      stroke: '#777777',
      fill: 'none',
      strokeWidthPaperMm: paperWidths.thin,
    },
    'space-fill': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#ffffff' : '#f4f1e8',
      strokeWidthPaperMm: 0,
    },
    'wall-cut': {
      stroke: black,
      fill: black,
      strokeWidthPaperMm: paperWidths.cut,
    },
    // Material layers are distinguished by their construction role, the way a
    // technical drawing hatches by material family rather than by product.
    'wall-layer-structure': {
      stroke: black,
      fill: mode === 'PRINT' ? '#c9c9c9' : '#9fb0b8',
      strokeWidthPaperMm: paperWidths.ultraThin,
    },
    'wall-layer-insulation': {
      stroke: black,
      fill: mode === 'PRINT' ? '#ededed' : '#f2d492',
      strokeWidthPaperMm: paperWidths.ultraThin,
    },
    'wall-layer-finish': {
      stroke: black,
      fill: mode === 'PRINT' ? '#ffffff' : '#dfe7ea',
      strokeWidthPaperMm: paperWidths.ultraThin,
    },
    'wall-layer-other': {
      stroke: black,
      fill: mode === 'PRINT' ? '#f5f5f5' : '#cfd6d9',
      strokeWidthPaperMm: paperWidths.ultraThin,
    },
    'wall-below': {
      stroke: '#555555',
      fill: 'none',
      strokeWidthPaperMm: paperWidths.thin,
      dashPaperMm: [2, 1],
    },
    opening: {
      stroke: black,
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    // The reveal erases the wall it passes through, so the opening reads as a
    // gap rather than as an outline drawn over solid masonry.
    'opening-reveal': {
      stroke: black,
      fill: '#ffffff',
      strokeWidthPaperMm: paperWidths.thin,
    },
    network: {
      stroke: black,
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'water-cold': {
      stroke: color('#1769aa'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'water-hot': {
      stroke: color('#c62828'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'water-recirculation': {
      stroke: color('#ad1457'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.thin,
      dashPaperMm: [3, 1],
    },
    'water-non-potable': {
      stroke: color('#2e7d32'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
      dashPaperMm: [4, 1],
    },
    'vent-supply': {
      stroke: color('#1565c0'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'vent-exhaust': {
      stroke: color('#6a1b9a'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'vent-transfer': {
      stroke: color('#455a64'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.thin,
      dashPaperMm: [2, 1],
    },
    'electrical-power': {
      stroke: color('#d32f2f'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'electrical-lighting': {
      stroke: color('#f57f17'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    'electrical-control': {
      stroke: color('#5d4037'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.thin,
      dashPaperMm: [2, 1],
    },
    'electrical-pv': {
      stroke: color('#00838f'),
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    symbol: {
      stroke: black,
      fill: 'none',
      strokeWidthPaperMm: paperWidths.medium,
    },
    annotation: {
      stroke: black,
      fill: 'none',
      strokeWidthPaperMm: paperWidths.thin,
      fontFamily: 'sans-serif',
      fontSizePaperMm: 2.5,
    },
    dimension: {
      stroke: black,
      fill: 'none',
      strokeWidthPaperMm: paperWidths.ultraThin,
      fontFamily: 'sans-serif',
      fontSizePaperMm: locale === 'fr' ? 2.5 : 2.4,
    },
    analysis: {
      stroke: black,
      fill: mode === 'PRINT' ? '#dddddd' : '#ffcc80',
      strokeWidthPaperMm: paperWidths.thin,
    },
    // Analysis classes carry the position of a value on its scale, not the
    // value itself: the profile decides what a low or a high band looks like.
    'analysis-low': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#eeeeee' : '#7fb069',
      strokeWidthPaperMm: 0,
      opacity: 0.75,
    },
    'analysis-medium': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#cccccc' : '#f2c14e',
      strokeWidthPaperMm: 0,
      opacity: 0.75,
    },
    'analysis-high': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#999999' : '#e2725b',
      strokeWidthPaperMm: 0,
      opacity: 0.8,
    },
    'analysis-unknown': {
      stroke: black,
      fill: mode === 'PRINT' ? '#ffffff' : '#d9d9d9',
      strokeWidthPaperMm: paperWidths.ultraThin,
      dashPaperMm: [2, 1],
      opacity: 0.7,
    },
  };
  const stateOverrides: Partial<Record<ObjectState, SvgStyle>> = {
    SELECTED: { stroke: '#1976d2' },
    HOVER: { stroke: '#0288d1' },
    WARNING: { stroke: '#ed6c02' },
    ERROR: { stroke: '#d32f2f' },
    GHOST: { opacity: 0.35 },
  };
  return { tokens, stateOverrides };
}

function bundle(
  locale: 'generic' | 'fr',
  mode: GraphicOutputMode,
): GraphicProfileBundle {
  const suffix = mode.toLowerCase();
  const id = `${locale}-technical-${suffix}`;
  const result: GraphicProfileBundle = {
    id,
    version: '1.0.0',
    mode,
    profile: {
      id: graphicProfileId(id),
      name:
        locale === 'fr'
          ? `Technique FR initial — ${mode}`
          : `Generic technical — ${mode}`,
      locale: locale === 'fr' ? 'fr-FR' : 'und',
      roleTokens,
      ...(mode === 'SCREEN' ? { minimumScreenStrokePx: 1 } : {}),
      ...(locale === 'fr' ? { symbolOverrides: {} } : {}),
    },
    styles: styles(mode, locale),
    designReferences: [
      'ISO 128 principles',
      'ISO 129-1 dimensioning principles',
    ],
  };
  validateGraphicProfileBundle(result);
  return result;
}

export function validateGraphicProfileBundle(
  bundle: GraphicProfileBundle,
): void {
  if (bundle.id.trim() === '' || bundle.version.trim() === '')
    throw new TypeError(
      'Graphic profile identity and version must not be empty.',
    );
  if (bundle.profile.id !== bundle.id)
    throw new TypeError('Graphic bundle and profile IDs must match.');
  for (const role of allRoles) {
    const token = bundle.profile.roleTokens[role];
    if (token === undefined || bundle.styles.tokens[token] === undefined)
      throw new RangeError(
        `Graphic profile has no style for semantic role ${role}.`,
      );
  }
  for (const [token, style] of Object.entries(bundle.styles.tokens)) {
    validateProfileStyle(token, style);
  }
  for (const [state, style] of Object.entries(
    bundle.styles.stateOverrides ?? {},
  ))
    validateProfileStyle(`state ${state}`, style);
}

function validateProfileStyle(token: string, style: SvgStyle): void {
  if (
    style.strokeWidthPaperMm !== undefined &&
    (!Number.isFinite(style.strokeWidthPaperMm) || style.strokeWidthPaperMm < 0)
  )
    throw new RangeError(
      `Graphic token ${token} has an invalid paper stroke width.`,
    );
  if (
    style.fontSizePaperMm !== undefined &&
    (!Number.isFinite(style.fontSizePaperMm) || style.fontSizePaperMm <= 0)
  )
    throw new RangeError(`Graphic token ${token} has an invalid font size.`);
  if (
    style.opacity !== undefined &&
    (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)
  )
    throw new RangeError(`Graphic token ${token} has an invalid opacity.`);
  if (
    style.dashPaperMm?.some(
      (length) => !Number.isFinite(length) || length <= 0,
    ) === true
  )
    throw new RangeError(`Graphic token ${token} has an invalid dash pattern.`);
}

export const GENERIC_TECHNICAL_SCREEN = bundle('generic', 'SCREEN');
export const GENERIC_TECHNICAL_PRINT = bundle('generic', 'PRINT');
export const FR_INITIAL_SCREEN = bundle('fr', 'SCREEN');
export const FR_INITIAL_PRINT = bundle('fr', 'PRINT');

/**
 * Every graphic profile this version ships.
 *
 * Four profiles existed and one was findable: the application compared a saved
 * view's profile against the generic screen bundle and reported anything else
 * as « une charte que cette version ne connaît pas » — including the three it
 * was shipping. A registry is what makes the choice a choice.
 */
export const GRAPHIC_PROFILE_REGISTRY: readonly GraphicProfileBundle[] = [
  GENERIC_TECHNICAL_SCREEN,
  GENERIC_TECHNICAL_PRINT,
  FR_INITIAL_SCREEN,
  FR_INITIAL_PRINT,
];

const PROFILES_BY_ID = new Map(
  GRAPHIC_PROFILE_REGISTRY.map((entry) => [entry.id, entry]),
);

export function graphicProfileBundle(
  id: string,
): GraphicProfileBundle | undefined {
  return PROFILES_BY_ID.get(id);
}

/** The profiles for one output, so a screen never offers a print charter. */
export function graphicProfilesForMode(
  mode: GraphicOutputMode,
): readonly GraphicProfileBundle[] {
  return GRAPHIC_PROFILE_REGISTRY.filter((entry) => entry.mode === mode);
}

/**
 * The profile to print a screen profile with, and the other way round.
 *
 * The same drawing, printed, is not the same drawing: colour that separates
 * networks on a screen becomes five indistinguishable greys on paper. The pair
 * is stated here so exporting never silently changes the charter's locale.
 */
export function graphicProfileForMode(
  id: string,
  mode: GraphicOutputMode,
): GraphicProfileBundle | undefined {
  const held = graphicProfileBundle(id);
  if (held === undefined) return undefined;
  if (held.mode === mode) return held;
  return GRAPHIC_PROFILE_REGISTRY.find(
    (entry) =>
      entry.mode === mode && entry.profile.locale === held.profile.locale,
  );
}
