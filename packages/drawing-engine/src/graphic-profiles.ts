import {
  graphicProfileId,
  type GraphicProfile,
  type GraphicStyleRule,
  type ObjectState,
  type SemanticRole,
} from './scene.js';
import { architecturalCleanBundle } from './architectural-profile.js';
import {
  DEFAULT_ROLE_TOKENS,
  GRAPHIC_ROLE_DEFINITIONS,
  GRAPHIC_ROLE_RULES,
  SEMANTIC_ROLES,
  drawingSpaceOf,
  type DrawingSpaceId,
} from './role-tokens.js';
import { graphicStyleRuleSpecificity } from './style-resolver.js';
import type { SvgStyle, SvgStyleCatalog } from './svg-renderer.js';

export type GraphicOutputMode = 'SCREEN' | 'PRINT';

export interface GraphicProfileBundle {
  readonly id: string;
  /**
   * The charter this bundle is a mode of.
   *
   * Screen and print are two bundles of one charter, and the pair used to be
   * guessed from the locale — which said that the architectural charter and
   * the French technical one were the same drawing, because both are written
   * in French. A family is stated, not inferred.
   */
  readonly family: string;
  readonly version: string;
  readonly mode: GraphicOutputMode;
  readonly profile: GraphicProfile;
  readonly styles: SvgStyleCatalog;
  /** Informational references only; a profile is not a compliance claim. */
  readonly designReferences: readonly string[];
}

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
    /*
     * Le sol de la parcelle, puis sa limite : deux dessins, deux jetons.
     *
     * La charte technique reste sobre — son lecteur cherche une gaine, pas un
     * jardin —, mais elle dit tout de même qu'une surface existe : une
     * parcelle qui n'était qu'un trait pâle ne se distinguait pas d'une
     * cotation oubliée. À l'impression le lavis disparaît : un aplat sur toute
     * la page coûte de l'encre et ne dit rien que le contour ne dise déjà.
     */
    'site-parcel': {
      stroke: 'none',
      fill: mode === 'PRINT' ? 'none' : '#EDF3E6',
      strokeWidthPaperMm: 0,
      ...(mode === 'PRINT' ? {} : { opacity: 0.6 }),
    },
    'site-parcel-boundary': {
      stroke: mode === 'PRINT' ? '#777777' : '#4F6B3F',
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
    family: `${locale}-technical`,
    version: '1.0.0',
    mode,
    profile: {
      id: graphicProfileId(id),
      name:
        locale === 'fr'
          ? `Technique FR initial — ${mode}`
          : `Generic technical — ${mode}`,
      locale: locale === 'fr' ? 'fr-FR' : 'und',
      roleTokens: DEFAULT_ROLE_TOKENS,
      // Les seules règles que les chartes techniques énoncent : celles qui
      // font exister les rôles graphiques. Ce ne sont pas des choix de dessin
      // — elles sont les mêmes partout —, et tout ce que ces chartes
      // dessineraient autrement reste une régression.
      styleRules: [...GRAPHIC_ROLE_RULES],
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
  if (
    bundle.id.trim() === '' ||
    bundle.family.trim() === '' ||
    bundle.version.trim() === ''
  )
    throw new TypeError(
      'Graphic profile identity, family and version must not be empty.',
    );
  if (bundle.profile.id !== bundle.id)
    throw new TypeError('Graphic bundle and profile IDs must match.');
  for (const role of SEMANTIC_ROLES) {
    const token = bundle.profile.roleTokens[role];
    if (token === undefined || bundle.styles.tokens[token] === undefined)
      throw new RangeError(
        `Graphic profile has no style for semantic role ${role}.`,
      );
  }
  // Un rôle graphique qu'une charte ne sait pas dessiner est un rôle dont le
  // dessin dépend de la charte ouverte : la parcelle aurait un fond dans un
  // plan d'architecte et lèverait une exception dans un plan technique, le
  // jour où quelqu'un ouvre l'autre.
  for (const { role, token } of GRAPHIC_ROLE_DEFINITIONS)
    if (bundle.styles.tokens[token] === undefined)
      throw new RangeError(
        `Graphic profile has no style for graphic role ${role}.`,
      );
  // A specialisation nobody can draw is worse than no specialisation: the
  // renderer would fail on the one bedroom that happened to carry a category,
  // long after the profile was written.
  for (const [index, rule] of (bundle.profile.styleRules ?? []).entries()) {
    if (graphicStyleRuleSpecificity(rule.match) === 0)
      throw new TypeError(
        `Graphic style rule ${index} states no condition, so it would replace every role.`,
      );
    if (bundle.styles.tokens[rule.token] === undefined)
      throw new RangeError(
        `Graphic style rule ${index} has no style for token ${rule.token}.`,
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
  if (
    typeof style.fontWeight === 'number' &&
    (!Number.isFinite(style.fontWeight) ||
      style.fontWeight < 1 ||
      style.fontWeight > 1_000)
  )
    throw new RangeError(`Graphic token ${token} has an invalid font weight.`);
}

/** A bundle stated elsewhere, checked before this version admits it exists. */
function validated(entry: GraphicProfileBundle): GraphicProfileBundle {
  validateGraphicProfileBundle(entry);
  return entry;
}

export const GENERIC_TECHNICAL_SCREEN = bundle('generic', 'SCREEN');
export const GENERIC_TECHNICAL_PRINT = bundle('generic', 'PRINT');
export const FR_INITIAL_SCREEN = bundle('fr', 'SCREEN');
export const FR_INITIAL_PRINT = bundle('fr', 'PRINT');
export const ARCHITECTURAL_CLEAN_SCREEN = validated(
  architecturalCleanBundle('SCREEN'),
);
export const ARCHITECTURAL_CLEAN_PRINT = validated(
  architecturalCleanBundle('PRINT'),
);

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
  ARCHITECTURAL_CLEAN_SCREEN,
  ARCHITECTURAL_CLEAN_PRINT,
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
    (entry) => entry.mode === mode && entry.family === held.family,
  );
}

/**
 * Le poids qu'un dessin a dans l'espace ouvert.
 *
 * `ACTIVE` est le dessin tel que la charte l'a écrit : c'est le sujet, on est
 * venu pour lui. `REFERENCE` est ce sur quoi on s'appuie sans y toucher — les
 * murs quand on pose un meuble : il faut les voir, et il ne faut pas les lire
 * en premier. `FAINT` est ce qui ne sert ici qu'à ne pas être oublié.
 *
 * Trois niveaux et pas deux : « visible ou non » aurait forcé à choisir entre
 * un plan illisible et un plan où l'on route une gaine dans le vide, et c'est
 * exactement le choix que ce dégradé existe pour ne plus avoir à faire.
 */
export type DrawingEmphasis = 'ACTIVE' | 'REFERENCE' | 'FAINT';

/** Ce qu'un espace laisse en fond. Le reste est dessiné tel quel. */
export interface StageEmphasis {
  readonly reference: readonly DrawingSpaceId[];
  readonly faint: readonly DrawingSpaceId[];
}

/**
 * Ce que chaque espace de création met en avant, et ce qu'il laisse derrière.
 *
 * C'est la moitié visible de `ux/ownership.ts` : un objet ne se modifie que
 * dans son espace, et rien à l'écran ne le disait — la parcelle, le mur et la
 * gaine étaient dessinés du même poids partout, si bien qu'on essayait de
 * déplacer, depuis le Bâtiment, une limite de terrain qui refusait sans qu'on
 * comprenne pourquoi. Un dessin qui dit ce qui est actif est un refus de
 * moins.
 *
 * La table dit ce qui **recule**, pas ce qui avance : un espace qu'elle ne
 * nomme pas est dessiné en entier. C'est la même prudence que là-bas —
 * `undefined` y veut dire « partout » — et elle va dans le seul sens qui ne
 * fait perdre personne : un dessin qu'on n'a pas pensé à classer reste
 * visible, il ne s'efface pas.
 *
 * Les trois espaces absents n'ont rien à dégrader. Le Projet et les Documents
 * ne dessinent pas la maison, ils la décrivent ; les Constats la regardent
 * entière, et griser la moitié du plan pendant qu'on cherche pourquoi une
 * pièce est trop froide reviendrait à cacher la réponse.
 */
export const EMPHASIS_BY_STAGE: Readonly<
  Partial<Record<DrawingSpaceId, StageEmphasis>>
> = {
  // Terrain : la parcelle et ce qui la borde sont le sujet, le bâtiment est
  // ce par rapport à quoi on l'implante, le reste n'a rien à y faire.
  SITE: { reference: ['BUILDING'], faint: ['FITTING', 'SYSTEMS'] },
  // Bâtiment : les murs, les ouvertures et la toiture ; la parcelle reste le
  // cadre dans lequel ils tiennent.
  BUILDING: { reference: ['SITE'], faint: ['FITTING', 'SYSTEMS'] },
  // Aménagement : ce qu'on pose dedans ; les murs disent où ça rentre.
  FITTING: { reference: ['BUILDING'], faint: ['SITE', 'SYSTEMS'] },
  // Systèmes : le réseau et ses équipements ; l'architecture porte les tracés,
  // et le mobilier dit contre quoi on ne peut pas passer — il recule d'un
  // cran, pas de deux.
  SYSTEMS: { reference: ['BUILDING', 'FITTING'], faint: ['SITE'] },
};

/** Le poids d'un dessin dans un espace, par l'espace qui le possède. */
export function drawingEmphasisIn(
  stage: DrawingSpaceId,
  subject: GraphicStyleRule['match'],
): DrawingEmphasis {
  const stated = EMPHASIS_BY_STAGE[stage];
  if (stated === undefined) return 'ACTIVE';
  const owner = drawingSpaceOf(subject);
  if (owner === undefined) return 'ACTIVE';
  if (stated.faint.includes(owner)) return 'FAINT';
  if (stated.reference.includes(owner)) return 'REFERENCE';
  return 'ACTIVE';
}

/**
 * De combien un dessin recule, selon le poids qu'on lui laisse.
 *
 * Reculer, c'est perdre sa couleur avant de perdre sa présence : une gaine
 * grise se lit encore comme une gaine, une gaine effacée ne se lit plus du
 * tout. Le trait maigrit peu — un mur de référence devenu un cheveu cesse de
 * dire où sont les murs, ce qui est la seule raison de l'avoir gardé.
 */
const EMPHASIS_STEPS: Readonly<
  Record<
    Exclude<DrawingEmphasis, 'ACTIVE'>,
    { readonly grey: number; readonly opacity: number; readonly width: number }
  >
> = {
  REFERENCE: { grey: 0.55, opacity: 0.6, width: 0.85 },
  FAINT: { grey: 0.82, opacity: 0.28, width: 0.7 },
};

/** Le gris vers lequel une couleur qui recule se dirige. */
const NEUTRAL_INK = { r: 0x8e, g: 0x94, b: 0x9c } as const;

function readHex(
  colour: string,
): { readonly r: number; readonly g: number; readonly b: number } | undefined {
  const value = colour.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/iu.exec(value);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(value);
  const parts = short
    ? [short[1]!, short[2]!, short[3]!].map((part) => `${part}${part}`)
    : long
      ? [long[1]!, long[2]!, long[3]!]
      : undefined;
  if (parts === undefined) return undefined;
  const [r, g, b] = parts.map((part) => Number.parseInt(part, 16));
  return { r: r!, g: g!, b: b! };
}

/**
 * Une couleur tirée vers le gris neutre.
 *
 * `none` reste `none` : un dessin qui n'était pas rempli ne se remplit pas
 * parce qu'il recule. Ce que la fonction ne sait pas lire, elle le rend tel
 * quel — une charte a le droit d'écrire une couleur autrement, et un rendu
 * inchangé vaut mieux qu'un rendu inventé.
 */
function greyed(
  colour: string | undefined,
  amount: number,
): string | undefined {
  if (colour === undefined || colour === 'none') return colour;
  const channels = readHex(colour);
  if (channels === undefined) return colour;
  const mixed = (from: number, to: number): string =>
    Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${mixed(channels.r, NEUTRAL_INK.r)}${mixed(channels.g, NEUTRAL_INK.g)}${mixed(channels.b, NEUTRAL_INK.b)}`;
}

/** Le même dessin, d'un cran en arrière. */
function stepBack(style: SvgStyle, emphasis: DrawingEmphasis): SvgStyle {
  if (emphasis === 'ACTIVE') return style;
  const step = EMPHASIS_STEPS[emphasis];
  const stroke = greyed(style.stroke, step.grey);
  const fill = greyed(style.fill, step.grey);
  return {
    ...style,
    ...(stroke === undefined ? {} : { stroke }),
    ...(fill === undefined ? {} : { fill }),
    ...(style.strokeWidthPaperMm === undefined
      ? {}
      : { strokeWidthPaperMm: style.strokeWidthPaperMm * step.width }),
    opacity: (style.opacity ?? 1) * step.opacity,
  };
}

/** Le nom du jeton d'un dessin qui recule. */
export function steppedToken(token: string, emphasis: DrawingEmphasis): string {
  return emphasis === 'ACTIVE' ? token : `${token}@${emphasis.toLowerCase()}`;
}

const STAGE_BUNDLES = new Map<string, GraphicProfileBundle>();

/**
 * La charte telle qu'elle se lit depuis un espace de création.
 *
 * C'est un **changement de profil de rendu**, et non un panneau de plus ni un
 * calque qu'on éteint : le même objet est toujours là, toujours désignable,
 * toujours consultable — il est dessiné autrement. Le composant qui affiche le
 * plan n'a donc rien à savoir de tout cela ; il demande la charte de son
 * espace et dessine.
 *
 * L'identifiant de la charte ne change pas. Une vue enregistrée nomme une
 * charte, pas un moment de la séance : l'espace ouvert est un état d'écran, et
 * un plan exporté depuis le Terrain doit sortir comme un plan exporté depuis
 * le Bâtiment. C'est aussi ce qui fait que la vue et le rendu continuent de
 * parler de la même charte, sans quoi le rendu refuserait de dessiner.
 *
 * Le résultat est mémorisé par charte et par espace : il ne dépend de rien
 * d'autre, et le rendre à l'identique évite de recalculer tout le plan à
 * chaque frappe.
 */
export function graphicProfileForStage(
  bundle: GraphicProfileBundle,
  stage: DrawingSpaceId,
): GraphicProfileBundle {
  if (EMPHASIS_BY_STAGE[stage] === undefined) return bundle;
  const key = `${bundle.id} ${stage}`;
  const held = STAGE_BUNDLES.get(key);
  if (held !== undefined) return held;
  const tokens: Record<string, SvgStyle> = { ...bundle.styles.tokens };
  const stepped = (
    token: string,
    subject: GraphicStyleRule['match'],
  ): string => {
    const emphasis = drawingEmphasisIn(stage, subject);
    const base = tokens[token];
    if (emphasis === 'ACTIVE' || base === undefined) return token;
    const name = steppedToken(token, emphasis);
    tokens[name] ??= stepBack(base, emphasis);
    return name;
  };
  const roleTokens: Partial<Record<SemanticRole, string>> = Object.fromEntries(
    Object.entries(bundle.profile.roleTokens).map(([role, token]) => [
      role,
      token === undefined
        ? token
        : stepped(token, { semanticRole: role as SemanticRole }),
    ]),
  );
  const styleRules = (bundle.profile.styleRules ?? []).map(
    (rule): GraphicStyleRule => ({
      ...rule,
      token: stepped(rule.token, rule.match),
    }),
  );
  const result: GraphicProfileBundle = {
    ...bundle,
    profile: {
      ...bundle.profile,
      roleTokens,
      ...(styleRules.length === 0 ? {} : { styleRules }),
    },
    styles: { ...bundle.styles, tokens },
  };
  // Une charte dérivée est une charte : elle passe les mêmes contrôles, sinon
  // le dégradé serait le seul endroit du moteur où un jeton sans style
  // n'échouerait qu'au moment du dessin.
  validateGraphicProfileBundle(result);
  STAGE_BUNDLES.set(key, result);
  return result;
}
