import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import type {
  ScenePrimitive,
  SemanticRole,
} from '@house-technical-designer/drawing-engine';

/** One band of the overlay legend, with the range it covers. */
export interface OverlayLegendEntry {
  readonly role: SemanticRole;
  readonly label: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly objectCount: number;
}

export interface OverlayLegend {
  readonly metric: string;
  readonly unit: string;
  readonly entries: readonly OverlayLegendEntry[];
  readonly unknownCount: number;
}

const BANDS: readonly {
  readonly role: SemanticRole;
  readonly label: string;
  readonly upperFraction: number;
}[] = [
  { role: 'ANALYSIS_LOW', label: 'Faible', upperFraction: 1 / 3 },
  { role: 'ANALYSIS_MEDIUM', label: 'Moyen', upperFraction: 2 / 3 },
  { role: 'ANALYSIS_HIGH', label: 'Élevé', upperFraction: 1 },
];

function bandOf(value: number, minimum: number, maximum: number): SemanticRole {
  if (maximum <= minimum) return 'ANALYSIS_MEDIUM';
  const fraction = (value - minimum) / (maximum - minimum);
  return (
    BANDS.find(({ upperFraction }) => fraction <= upperFraction)?.role ??
    'ANALYSIS_HIGH'
  );
}

/**
 * Projects an analysis overlay onto the objects already drawn.
 *
 * The overlay only carries semantic values; the band an object falls into is
 * derived here and the graphic profile decides what each band looks like. An
 * object whose value is unknown gets its own band rather than being coloured as
 * if it were zero.
 */
export function overlayPrimitives(
  primitives: readonly ScenePrimitive[],
  overlay: AnalysisOverlay,
  layer = 'analysis.overlay',
): readonly ScenePrimitive[] {
  const minimum = overlay.scale?.minimum ?? 0;
  const maximum = overlay.scale?.maximum ?? 0;
  const drawn = new Set<string>();
  const result: ScenePrimitive[] = [];
  for (const primitive of primitives) {
    const objectId = primitive.sourceObjectId;
    if (objectId === undefined || drawn.has(objectId)) continue;
    if (!(objectId in overlay.values)) continue;
    if (primitive.geometry.kind !== 'POLYGON') continue;
    drawn.add(objectId);
    const value = overlay.values[objectId];
    const semanticRole: SemanticRole =
      typeof value === 'number'
        ? bandOf(value, minimum, maximum)
        : 'ANALYSIS_UNKNOWN';
    result.push({
      id: `overlay:${overlay.id}:${objectId}`,
      sourceObjectId: objectId,
      semanticRole,
      geometry: primitive.geometry,
      layer,
      zIndex: 70,
      discipline: 'OTHER',
      metadata: {
        metric: overlay.metric,
        unit: overlay.unit,
        value: typeof value === 'number' ? value : null,
        state: overlay.states?.[objectId] ?? 'NORMAL',
      },
    });
  }
  return result;
}

/** Builds the legend for an overlay, including how many objects fall in each band. */
export function overlayLegend(overlay: AnalysisOverlay): OverlayLegend {
  const minimum = overlay.scale?.minimum ?? 0;
  const maximum = overlay.scale?.maximum ?? 0;
  const values = Object.values(overlay.values);
  const numeric = values.filter(
    (value): value is number => typeof value === 'number',
  );
  const span = maximum - minimum;
  // A uniform metric has no bands to compare: reporting three identical ranges
  // would suggest a spread the values do not have.
  if (overlay.scale !== undefined && span === 0)
    return {
      metric: overlay.metric,
      unit: overlay.unit,
      entries: [
        {
          role: 'ANALYSIS_MEDIUM',
          label: 'Valeur uniforme',
          minimum,
          maximum,
          objectCount: numeric.length,
        },
      ],
      unknownCount: values.length - numeric.length,
    };
  let lower = minimum;
  const entries = BANDS.map((band, index) => {
    const upper =
      index === BANDS.length - 1
        ? maximum
        : minimum + span * band.upperFraction;
    const entry: OverlayLegendEntry = {
      role: band.role,
      label: band.label,
      ...(overlay.scale === undefined
        ? {}
        : { minimum: lower, maximum: upper }),
      objectCount: numeric.filter(
        (value) => bandOf(value, minimum, maximum) === band.role,
      ).length,
    };
    lower = upper;
    return entry;
  });
  return {
    metric: overlay.metric,
    unit: overlay.unit,
    entries,
    unknownCount: values.length - numeric.length,
  };
}
