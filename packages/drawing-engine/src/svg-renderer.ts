import type {
  DrawingView,
  GraphicProfile,
  ObjectState,
  SceneGeometry,
  ScenePrimitive,
  SemanticScene,
} from './scene.js';
import { resolveGraphicToken } from './style-resolver.js';

export interface SvgStyle {
  readonly stroke?: string;
  readonly fill?: string;
  /** Technical line width in paper millimetres. */
  readonly strokeWidthPaperMm?: number;
  readonly dashPaperMm?: readonly number[];
  readonly opacity?: number;
  readonly fontFamily?: string;
  readonly fontSizePaperMm?: number;
  /**
   * The weight a label is set in.
   *
   * A room's name and its area are two levels of the same annotation, and a
   * drawing that sets them in one weight has the reader work out which is
   * which.
   */
  readonly fontWeight?: number | 'normal' | 'bold';
  readonly textAnchor?: 'start' | 'middle' | 'end';
  /**
   * How a light line ends and turns.
   *
   * Mitred joins on a hairline symbol grow spikes at sharp angles; rounded
   * ones do not. It is a property of the charter, so it is stated here.
   */
  readonly strokeLinecap?: 'butt' | 'round' | 'square';
  readonly strokeLinejoin?: 'miter' | 'round' | 'bevel';
}

export interface SvgStyleCatalog {
  readonly tokens: Readonly<Record<string, SvgStyle>>;
  readonly stateOverrides?: Readonly<Partial<Record<ObjectState, SvgStyle>>>;
}

export interface SvgRenderOptions {
  /** UI states are omitted by default so technical exports remain stable. */
  readonly includeInteractionStates?: boolean;
  readonly includeXmlDeclaration?: boolean;
  /** Preserve semantic group boundaries without changing primitive z-order. */
  readonly includeSemanticGroups?: boolean;
  readonly documentMetadata?: Readonly<Record<string, string>>;
}

export function renderSemanticSceneToSvg(
  scene: SemanticScene,
  view: DrawingView,
  profile: GraphicProfile,
  styles: SvgStyleCatalog,
  options: SvgRenderOptions = {},
): string {
  if (scene.viewId !== view.id)
    throw new TypeError(
      'Semantic scene does not belong to the supplied drawing view.',
    );
  if (profile.id !== view.graphicProfileId)
    throw new TypeError('Graphic profile does not match the drawing view.');
  const width = view.viewport.max.x - view.viewport.min.x;
  const height = view.viewport.max.y - view.viewport.min.y;
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0)
    throw new RangeError('SVG viewport must have a positive finite size.');
  const body = options.includeSemanticGroups
    ? renderSemanticGroups(scene.primitives, view, profile, styles, options)
    : scene.primitives
        .map((primitive) =>
          renderPrimitive(primitive, view, profile, styles, options),
        )
        .join('');
  const metadata = renderDocumentMetadata(options.documentMetadata);
  const declaration = options.includeXmlDeclaration
    ? '<?xml version="1.0" encoding="UTF-8"?>'
    : '';
  return `${declaration}<svg xmlns="http://www.w3.org/2000/svg" viewBox="${number(view.viewport.min.x)} ${number(view.viewport.min.y)} ${number(width)} ${number(height)}" data-view-id="${attribute(view.id)}">${metadata}${body}</svg>`;
}

function renderSemanticGroups(
  primitives: readonly ScenePrimitive[],
  view: DrawingView,
  profile: GraphicProfile,
  styles: SvgStyleCatalog,
  options: SvgRenderOptions,
): string {
  let result = '';
  let groupKey: string | undefined;
  let groupBody = '';
  const flush = (): void => {
    if (groupKey === undefined) return;
    const [discipline, layer] = groupKey.split('\u0000');
    result += `<g data-discipline="${attribute(discipline ?? '')}" data-layer="${attribute(layer ?? '')}">${groupBody}</g>`;
  };
  for (const primitive of primitives) {
    const nextKey = `${primitive.discipline}\u0000${primitive.layer}`;
    if (groupKey !== nextKey) {
      flush();
      groupKey = nextKey;
      groupBody = '';
    }
    groupBody += renderPrimitive(primitive, view, profile, styles, options);
  }
  flush();
  return result;
}

function renderDocumentMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): string {
  if (metadata === undefined || Object.keys(metadata).length === 0) return '';
  const canonical = Object.fromEntries(
    Object.entries(metadata).sort(([first], [second]) =>
      first.localeCompare(second),
    ),
  );
  return `<metadata>${text(JSON.stringify(canonical))}</metadata>`;
}

function renderPrimitive(
  primitive: ScenePrimitive,
  view: DrawingView,
  profile: GraphicProfile,
  catalog: SvgStyleCatalog,
  options: SvgRenderOptions,
): string {
  const token = resolveGraphicToken(profile, primitive);
  if (token === undefined)
    throw new RangeError(
      `Graphic profile has no token for semantic role: ${primitive.semanticRole}`,
    );
  const base = catalog.tokens[token];
  if (base === undefined)
    throw new RangeError(`Unknown graphic token: ${token}`);
  const state = options.includeInteractionStates ? primitive.state : undefined;
  const override =
    state === undefined ? {} : (catalog.stateOverrides?.[state] ?? {});
  /*
   * Un état ne remplit pas ce qui n'était pas rempli.
   *
   * La parcelle est un contour tireté, sans fond ; la sélectionner la
   * transformait en aplat bleu sur toute la feuille, parce que l'état repeint
   * `fill` sans regarder ce que le jeton disait. Un état dit **comment** un
   * dessin est pris, pas **ce qu'il est** : il change une couleur, il ne
   * transforme pas un trait en surface.
   */
  const style = {
    ...base,
    ...override,
    ...(base.fill === 'none' ? { fill: 'none' } : {}),
  };
  validateStyle(style);
  const attributes = [
    `id="${attribute(primitive.id)}"`,
    primitive.sourceObjectId === undefined
      ? ''
      : `data-source-id="${attribute(primitive.sourceObjectId)}"`,
    `data-role="${primitive.semanticRole}"`,
    `data-layer="${attribute(primitive.layer)}"`,
    state === undefined ? '' : `data-state="${state}"`,
    svgStyle(style, view.scale),
  ]
    .filter(Boolean)
    .join(' ');
  return geometryElement(primitive.geometry, attributes, style, view.scale);
}

function geometryElement(
  geometry: SceneGeometry,
  attributes: string,
  style: SvgStyle,
  scale: number,
): string {
  switch (geometry.kind) {
    case 'POINT':
      return `<circle ${attributes} cx="${number(geometry.point.x)}" cy="${number(geometry.point.y)}" r="${number((style.strokeWidthPaperMm ?? 0.2) * scale)}"/>`;
    case 'POLYLINE':
      return `<polyline ${attributes} points="${points(geometry.polyline.points)}" fill="none"/>`;
    case 'POLYGON': {
      const rings = [geometry.polygon.outer, ...(geometry.polygon.holes ?? [])];
      const path = rings.map((ring) => `${pointsAsPath(ring)} Z`).join(' ');
      return `<path ${attributes} d="${path}" fill-rule="evenodd"/>`;
    }
    case 'TEXT': {
      const transform =
        geometry.rotationDeg === undefined
          ? ''
          : ` transform="rotate(${number(geometry.rotationDeg)} ${number(geometry.anchor.x)} ${number(geometry.anchor.y)})"`;
      return `<text ${attributes} x="${number(geometry.anchor.x)}" y="${number(geometry.anchor.y)}"${transform}>${text(geometry.text)}</text>`;
    }
  }
}

function svgStyle(style: SvgStyle, scale: number): string {
  const declarations = [
    style.stroke === undefined ? '' : `stroke:${safeCssValue(style.stroke)}`,
    style.fill === undefined ? '' : `fill:${safeCssValue(style.fill)}`,
    style.strokeWidthPaperMm === undefined
      ? ''
      : `stroke-width:${number(style.strokeWidthPaperMm * scale)}`,
    style.strokeLinecap === undefined
      ? ''
      : `stroke-linecap:${style.strokeLinecap}`,
    style.strokeLinejoin === undefined
      ? ''
      : `stroke-linejoin:${style.strokeLinejoin}`,
    style.dashPaperMm === undefined
      ? ''
      : `stroke-dasharray:${style.dashPaperMm.map((value) => number(value * scale)).join(',')}`,
    style.opacity === undefined ? '' : `opacity:${number(style.opacity)}`,
    style.fontFamily === undefined
      ? ''
      : `font-family:${safeCssValue(style.fontFamily)}`,
    style.fontSizePaperMm === undefined
      ? ''
      : `font-size:${number(style.fontSizePaperMm * scale)}`,
    style.fontWeight === undefined
      ? ''
      : `font-weight:${typeof style.fontWeight === 'number' ? number(style.fontWeight) : style.fontWeight}`,
    style.textAnchor === undefined ? '' : `text-anchor:${style.textAnchor}`,
  ].filter(Boolean);
  return declarations.length === 0 ? '' : `style="${declarations.join(';')}"`;
}

function validateStyle(style: SvgStyle): void {
  if (
    style.strokeWidthPaperMm !== undefined &&
    (!Number.isFinite(style.strokeWidthPaperMm) || style.strokeWidthPaperMm < 0)
  )
    throw new RangeError('Stroke width must be finite and non-negative.');
  if (
    style.fontSizePaperMm !== undefined &&
    (!Number.isFinite(style.fontSizePaperMm) || style.fontSizePaperMm <= 0)
  )
    throw new RangeError('Font size must be finite and positive.');
  if (
    style.opacity !== undefined &&
    (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1)
  )
    throw new RangeError('Opacity must be between zero and one.');
  if (
    style.dashPaperMm?.some(
      (value) => !Number.isFinite(value) || value <= 0,
    ) === true
  )
    throw new RangeError('Dash lengths must be finite and positive.');
  if (
    typeof style.fontWeight === 'number' &&
    (!Number.isFinite(style.fontWeight) ||
      style.fontWeight < 1 ||
      style.fontWeight > 1_000)
  )
    throw new RangeError('Font weight must be between one and one thousand.');
}

function points(
  value: readonly { readonly x: number; readonly y: number }[],
): string {
  return value.map(({ x, y }) => `${number(x)},${number(y)}`).join(' ');
}

function pointsAsPath(
  value: readonly { readonly x: number; readonly y: number }[],
): string {
  if (value.length === 0) return '';
  return `M ${value.map(({ x, y }) => `${number(x)} ${number(y)}`).join(' L ')}`;
}

function number(value: number): string {
  if (!Number.isFinite(value))
    throw new RangeError('SVG coordinates and dimensions must be finite.');
  return Object.is(value, -0) ? '0' : String(value);
}

function safeCssValue(value: string): string {
  if (!/^[#(),.%\-\w\s]+$/u.test(value))
    throw new TypeError('Unsafe SVG style value.');
  return value;
}

function attribute(value: string): string {
  return text(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function text(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
