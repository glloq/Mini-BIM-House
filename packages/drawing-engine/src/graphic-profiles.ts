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
  'WALL_BELOW',
  'OPENING',
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
];

const roleTokens: Readonly<Record<SemanticRole, string>> = {
  SITE: 'site',
  SPACE_FILL: 'space-fill',
  WALL_CUT: 'wall-cut',
  WALL_BELOW: 'wall-below',
  OPENING: 'opening',
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
