import type {
  DrawingView,
  GraphicProfile,
  ObjectState,
  SceneGeometry,
  ScenePrimitive,
  SemanticScene,
} from './scene.js';

export interface SvgStyle {
  readonly stroke?: string;
  readonly fill?: string;
  /** Technical line width in paper millimetres. */
  readonly strokeWidthPaperMm?: number;
  readonly dashPaperMm?: readonly number[];
  readonly opacity?: number;
  readonly fontFamily?: string;
  readonly fontSizePaperMm?: number;
}

export interface SvgStyleCatalog {
  readonly tokens: Readonly<Record<string, SvgStyle>>;
  readonly stateOverrides?: Readonly<Partial<Record<ObjectState, SvgStyle>>>;
}

export interface SvgRenderOptions {
  /** UI states are omitted by default so technical exports remain stable. */
  readonly includeInteractionStates?: boolean;
  readonly includeXmlDeclaration?: boolean;
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
  const body = scene.primitives
    .map((primitive) =>
      renderPrimitive(primitive, view, profile, styles, options),
    )
    .join('');
  const declaration = options.includeXmlDeclaration
    ? '<?xml version="1.0" encoding="UTF-8"?>'
    : '';
  return `${declaration}<svg xmlns="http://www.w3.org/2000/svg" viewBox="${number(view.viewport.min.x)} ${number(view.viewport.min.y)} ${number(width)} ${number(height)}" data-view-id="${attribute(view.id)}">${body}</svg>`;
}

function renderPrimitive(
  primitive: ScenePrimitive,
  view: DrawingView,
  profile: GraphicProfile,
  catalog: SvgStyleCatalog,
  options: SvgRenderOptions,
): string {
  const token = profile.roleTokens[primitive.semanticRole];
  const base = token === undefined ? {} : catalog.tokens[token];
  if (base === undefined)
    throw new RangeError(`Unknown graphic token: ${token}`);
  const state = options.includeInteractionStates ? primitive.state : undefined;
  const style = {
    ...base,
    ...(state === undefined ? {} : catalog.stateOverrides?.[state]),
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
