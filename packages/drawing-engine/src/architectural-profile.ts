import type {
  GraphicOutputMode,
  GraphicProfileBundle,
} from './graphic-profiles.js';
import { DEFAULT_ROLE_TOKENS } from './role-tokens.js';
import { graphicProfileId, type GraphicStyleRule } from './scene.js';
import type { SpaceGraphicCategory } from './space-categories.js';
import type { SvgStyle, SvgStyleCatalog } from './svg-renderer.js';

/**
 * Paper widths, in millimetres, of the architectural charter.
 *
 * The engine draws in paper millimetres, so these hold at 1:50 and at 1:100
 * alike: an outer wall is half a millimetre of ink on the sheet whatever the
 * scale says, and the hierarchy survives the change instead of collapsing.
 */
const WIDTHS = {
  wallExterior: 0.55,
  wallInterior: 0.4,
  wallPartition: 0.35,
  wallBelow: 0.18,
  opening: 0.22,
  glazing: 0.18,
  fixture: 0.16,
  network: 0.22,
  dimension: 0.15,
  annotation: 0.13,
  hairline: 0.13,
} as const;

/**
 * The colours of the screen charter.
 *
 * Not a house style anybody signed off: what matters and what this fixes is
 * the hierarchy — masonry darkest, openings and fixtures a step back, rooms a
 * wash so light that the walls stay the first thing read.
 */
const SCREEN = {
  wallExterior: '#263B59',
  wallInterior: '#334A68',
  wallPartition: '#405979',
  wallBelow: '#8B99AC',
  opening: '#60738B',
  glazing: '#7C93AE',
  fixture: '#718197',
  textPrimary: '#26364B',
  textSecondary: '#657184',
  site: '#A3AD9B',
  reveal: '#FFFFFF',
  space: {
    BEDROOM: '#DDEAD5',
    LIVING: '#F7F6F1',
    LIVING_KITCHEN: '#F6F4EC',
    KITCHEN: '#F6F3EA',
    BATHROOM: '#DCECF5',
    WC: '#E3EFF6',
    CIRCULATION: '#EEF1F3',
    STORAGE: '#F1EEE5',
    UTILITY: '#ECF0E9',
    OFFICE: '#E9EEF4',
    GARAGE: '#EBC9D0',
    TECHNICAL: '#E5E8EA',
    OTHER: '#F4F4F1',
  },
} as const;

/**
 * The greys of the printed charter.
 *
 * A printed plan may not depend on colour to be read: the same drawing goes
 * out on a monochrome plotter and must keep saying which wall carries the
 * building. Weight does that work here, and the fills only help it.
 */
const PRINT = {
  wallExterior: '#1A1A1A',
  wallInterior: '#4A4A4A',
  wallPartition: '#6B6B6B',
  wallBelow: '#777777',
  opening: '#111111',
  glazing: '#333333',
  fixture: '#444444',
  textPrimary: '#111111',
  textSecondary: '#444444',
  site: '#888888',
  reveal: '#FFFFFF',
  space: {
    BEDROOM: '#FFFFFF',
    LIVING: '#FFFFFF',
    LIVING_KITCHEN: '#FFFFFF',
    KITCHEN: '#FFFFFF',
    BATHROOM: '#F5F5F5',
    WC: '#F5F5F5',
    CIRCULATION: '#F1F1F1',
    STORAGE: '#EFEFEF',
    UTILITY: '#EFEFEF',
    OFFICE: '#FFFFFF',
    GARAGE: '#E8E8E8',
    TECHNICAL: '#E8E8E8',
    OTHER: '#FFFFFF',
  },
} as const;

/** The token a room of each graphic category is drawn with. */
export function spaceCategoryToken(category: SpaceGraphicCategory): string {
  return `space-${category.toLowerCase().replaceAll('_', '-')}`;
}

const SPACE_TOKENS = Object.keys(
  SCREEN.space,
) as readonly SpaceGraphicCategory[];

function architecturalStyles(mode: GraphicOutputMode): SvgStyleCatalog {
  const palette = mode === 'PRINT' ? PRINT : SCREEN;
  const ink = palette.textPrimary;
  const network = (screen: string): string => (mode === 'PRINT' ? ink : screen);
  const spaceTokens = Object.fromEntries(
    SPACE_TOKENS.map((category) => [
      spaceCategoryToken(category),
      {
        stroke: 'none',
        fill: palette.space[category],
        strokeWidthPaperMm: 0,
      } satisfies SvgStyle,
    ]),
  );
  const wall = (stroke: string, width: number): SvgStyle => ({
    stroke,
    fill: stroke,
    strokeWidthPaperMm: width,
    strokeLinejoin: 'round',
  });
  const tokens: Record<string, SvgStyle> = {
    ...spaceTokens,
    site: {
      stroke: palette.site,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.hairline,
      dashPaperMm: [4, 1.5],
    },
    // The unqualified room: a wash lighter than any named use, so a room whose
    // use nobody stated does not shout louder than a bedroom.
    'space-fill': {
      stroke: 'none',
      fill: palette.space.OTHER,
      strokeWidthPaperMm: 0,
    },
    'wall-cut': wall(palette.wallInterior, WIDTHS.wallInterior),
    'wall-exterior': wall(palette.wallExterior, WIDTHS.wallExterior),
    'wall-interior': wall(palette.wallInterior, WIDTHS.wallInterior),
    'wall-partition': wall(palette.wallPartition, WIDTHS.wallPartition),
    // The material layers belong to the materials drawing, not to this one.
    // They are still styled, because a charter that cannot draw a role is a
    // charter that fails the day somebody turns the layer on.
    'wall-layer-structure': {
      stroke: palette.wallInterior,
      fill: mode === 'PRINT' ? '#C9C9C9' : '#B9C4CE',
      strokeWidthPaperMm: WIDTHS.hairline,
    },
    'wall-layer-insulation': {
      stroke: palette.wallInterior,
      fill: mode === 'PRINT' ? '#EDEDED' : '#F0DDB4',
      strokeWidthPaperMm: WIDTHS.hairline,
    },
    'wall-layer-finish': {
      stroke: palette.wallInterior,
      fill: mode === 'PRINT' ? '#FFFFFF' : '#E4EBEF',
      strokeWidthPaperMm: WIDTHS.hairline,
    },
    'wall-layer-other': {
      stroke: palette.wallInterior,
      fill: mode === 'PRINT' ? '#F5F5F5' : '#D6DDE3',
      strokeWidthPaperMm: WIDTHS.hairline,
    },
    'wall-below': {
      stroke: palette.wallBelow,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.wallBelow,
      dashPaperMm: [3, 1.5],
      strokeLinecap: 'round',
    },
    opening: {
      stroke: palette.opening,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.opening,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    'opening-glazing': {
      stroke: palette.glazing,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.glazing,
      strokeLinecap: 'round',
    },
    // The reveal erases the masonry it passes through: an opening is a gap in
    // a wall, not a drawing laid over one.
    'opening-reveal': {
      stroke: 'none',
      fill: palette.reveal,
      strokeWidthPaperMm: 0,
    },
    network: {
      stroke: ink,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'water-cold': {
      stroke: network('#1769AA'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'water-hot': {
      stroke: network('#C62828'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'water-recirculation': {
      stroke: network('#AD1457'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.glazing,
      dashPaperMm: [3, 1],
    },
    'water-non-potable': {
      stroke: network('#2E7D32'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
      dashPaperMm: [4, 1],
    },
    'vent-supply': {
      stroke: network('#1565C0'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'vent-exhaust': {
      stroke: network('#6A1B9A'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'vent-transfer': {
      stroke: network('#455A64'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.glazing,
      dashPaperMm: [2, 1],
    },
    'electrical-power': {
      stroke: network('#D32F2F'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'electrical-lighting': {
      stroke: network('#EF6C00'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    'electrical-control': {
      stroke: network('#5D4037'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.glazing,
      dashPaperMm: [2, 1],
    },
    'electrical-pv': {
      stroke: network('#00838F'),
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.network,
    },
    // Fixtures are drawn, not filled: a basin is furniture in a plan of a
    // building, and it must never weigh what a wall weighs.
    symbol: {
      stroke: palette.fixture,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.fixture,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    annotation: {
      stroke: 'none',
      fill: palette.textPrimary,
      strokeWidthPaperMm: 0,
      fontFamily: 'sans-serif',
      fontSizePaperMm: 2.5,
      textAnchor: 'middle',
    },
    dimension: {
      stroke: palette.textSecondary,
      fill: 'none',
      strokeWidthPaperMm: WIDTHS.dimension,
      fontFamily: 'sans-serif',
      fontSizePaperMm: 2.2,
      strokeLinecap: 'round',
    },
    analysis: {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#DDDDDD' : '#F2B872',
      strokeWidthPaperMm: 0,
      opacity: 0.7,
    },
    'analysis-low': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#EEEEEE' : '#7FB069',
      strokeWidthPaperMm: 0,
      opacity: 0.6,
    },
    'analysis-medium': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#CCCCCC' : '#F2C14E',
      strokeWidthPaperMm: 0,
      opacity: 0.6,
    },
    'analysis-high': {
      stroke: 'none',
      fill: mode === 'PRINT' ? '#999999' : '#E2725B',
      strokeWidthPaperMm: 0,
      opacity: 0.65,
    },
    'analysis-unknown': {
      stroke: palette.textSecondary,
      fill: mode === 'PRINT' ? '#FFFFFF' : '#DCDCDC',
      strokeWidthPaperMm: WIDTHS.hairline,
      dashPaperMm: [2, 1],
      opacity: 0.6,
    },
  };
  return {
    tokens,
    stateOverrides: {
      // Selection has to win against a much lighter drawing than the technical
      // charter's, so it says so with a colour the plan does not otherwise use.
      SELECTED: { stroke: '#1565C0', fill: '#1565C0' },
      HOVER: { stroke: '#0288D1' },
      WARNING: { stroke: '#ED6C02' },
      ERROR: { stroke: '#D32F2F' },
      GHOST: { opacity: 0.3 },
    },
  };
}

/**
 * What the charter reads beyond the role: the wall's own role, the room's use.
 *
 * Both were in the scene before this profile existed; nothing in the model
 * changed to make them drawable.
 */
const architecturalRules: readonly GraphicStyleRule[] = [
  {
    match: { semanticRole: 'WALL_CUT', metadata: { role: 'EXTERIOR' } },
    token: 'wall-exterior',
  },
  {
    match: { semanticRole: 'WALL_CUT', metadata: { role: 'INTERIOR' } },
    token: 'wall-interior',
  },
  {
    match: { semanticRole: 'WALL_CUT', metadata: { role: 'PARTITION' } },
    token: 'wall-partition',
  },
  {
    match: { semanticRole: 'OPENING', metadata: { part: 'GLAZING' } },
    token: 'opening-glazing',
  },
  ...SPACE_TOKENS.map((category) => ({
    match: {
      semanticRole: 'SPACE_FILL' as const,
      metadata: { graphicCategory: category },
    },
    token: spaceCategoryToken(category),
  })),
];

/**
 * The clean architectural charter: a plan of a house, read as a house.
 *
 * The technical charter is not wrong — it is a charter for a drawing whose
 * reader is looking for a duct. This one is for the drawing whose reader is
 * looking at where they would live, and the two cannot be the same charter, so
 * this one is added rather than the other one bent.
 */
export function architecturalCleanBundle(
  mode: GraphicOutputMode,
): GraphicProfileBundle {
  const id = `architectural-clean-${mode.toLowerCase()}`;
  return {
    id,
    family: 'architectural-clean',
    version: '1.0.0',
    mode,
    profile: {
      id: graphicProfileId(id),
      name: `Plan architectural — ${mode}`,
      locale: 'fr-FR',
      roleTokens: DEFAULT_ROLE_TOKENS,
      styleRules: architecturalRules,
      ...(mode === 'SCREEN' ? { minimumScreenStrokePx: 1 } : {}),
    },
    styles: architecturalStyles(mode),
    designReferences: [
      'ISO 128 principles',
      'ISO 128-23 lines in construction documentation',
      'ISO 129-1 dimensioning principles',
    ],
  };
}
