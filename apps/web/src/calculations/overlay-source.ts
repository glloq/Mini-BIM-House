import type { AnalysisOverlay } from '@house-technical-designer/calculation-core';
import type { CalculationJson } from '@house-technical-designer/calculation-core';
import type { ModuleRun } from './calculation-runner.js';

/**
 * One analysis the plan can be coloured by.
 *
 * Every entry names the module it reads and the row it reads from, so adding
 * an analysis is describing where its numbers already are rather than writing
 * a fourth way of extracting them. The engines have all been in the repository
 * for a long time; until now only three thermal figures reached the drawing,
 * and the rest were read in tables.
 */
export interface OverlayOption {
  readonly id: string;
  readonly label: string;
  readonly moduleId?: string;
  /** The output the rows come from, and what identifies each row. */
  readonly rowsKey?: string;
  readonly idKey?: string;
  readonly valueKey?: string;
  readonly metric?: string;
  readonly unit?: string;
  /**
   * The discipline whose layer this analysis needs on the plan.
   *
   * Colouring an object nobody is drawing colours nothing: the pipes of a
   * network are hidden until their layer is on, and an analysis that spoke of
   * them without revealing them would look like an analysis that failed.
   */
  readonly discipline?: string;
  /** What the value stands for when a row has none. */
  readonly missingHint?: string;
  /**
   * Where the value hides one level down, when a row is a row of rows.
   *
   * A room's reverberation is not one figure but one per octave band, and the
   * plan colours by one number. Saying which band here keeps the analysis
   * declarative instead of earning a function of its own.
   */
  readonly band?: {
    readonly rowsKey: string;
    readonly matchKey: string;
    readonly matchValue: number;
    readonly valueKey: string;
  };
  /** Whether the value is a yes/no the plan shows as one and zero. */
  readonly boolean?: boolean;
}

export const OVERLAY_OPTIONS = [
  { id: 'none', label: 'Aucune analyse' },
  { id: 'thermal-u', label: 'Transmission U', moduleId: 'thermal' },
  {
    id: 'thermal-heat-loss',
    label: 'Déperditions',
    moduleId: 'thermal',
  },
  {
    id: 'thermal-missing',
    label: 'Données manquantes',
    moduleId: 'thermal',
  },
  {
    id: 'water-velocity',
    label: 'Eau · vitesse',
    moduleId: 'water',
    discipline: 'WATER',
    rowsKey: 'segments',
    idKey: 'id',
    valueKey: 'velocityMs',
    metric: 'WATER_VELOCITY',
    unit: 'm/s',
  },
  {
    id: 'water-pressure-loss',
    label: 'Eau · pertes de charge',
    moduleId: 'water',
    discipline: 'WATER',
    rowsKey: 'segments',
    idKey: 'id',
    valueKey: 'pressureLossPa',
    metric: 'WATER_PRESSURE_LOSS',
    unit: 'Pa',
  },
  {
    id: 'ventilation-velocity',
    label: 'Ventilation · vitesse',
    moduleId: 'ventilation',
    discipline: 'VENTILATION',
    rowsKey: 'segments',
    idKey: 'id',
    valueKey: 'velocityMs',
    metric: 'VENT_VELOCITY',
    unit: 'm/s',
  },
  {
    id: 'ventilation-pressure-loss',
    label: 'Ventilation · pertes de charge',
    moduleId: 'ventilation',
    discipline: 'VENTILATION',
    rowsKey: 'segments',
    idKey: 'id',
    valueKey: 'pressureLossPa',
    metric: 'VENT_PRESSURE_LOSS',
    unit: 'Pa',
  },
  {
    id: 'wastewater-slope',
    label: 'Évacuation · pente',
    moduleId: 'wastewater',
    discipline: 'WASTEWATER',
    rowsKey: 'segments',
    idKey: 'id',
    valueKey: 'slope',
    metric: 'WASTEWATER_SLOPE',
    unit: 'm/m',
  },
  {
    id: 'electrical-voltage-drop',
    label: 'Électricité · chute de tension',
    moduleId: 'electrical',
    discipline: 'ELECTRICAL',
    rowsKey: 'circuits',
    idKey: 'circuitId',
    valueKey: 'voltageDropPercent',
    metric: 'VOLTAGE_DROP',
    unit: '%',
  },
  // What a room needs, what it gets and what it breathes. These figures were
  // all computed and only ever read in a table.
  {
    id: 'heating-room-power',
    label: 'Chauffage · puissance par pièce',
    moduleId: 'heating',
    rowsKey: 'rooms',
    idKey: 'roomId',
    valueKey: 'totalW',
    metric: 'HEATING_POWER',
    unit: 'W',
  },
  {
    id: 'heating-room-density',
    label: 'Chauffage · puissance surfacique',
    moduleId: 'heating',
    rowsKey: 'rooms',
    idKey: 'roomId',
    valueKey: 'wattsPerM2',
    metric: 'HEATING_DENSITY',
    unit: 'W/m²',
  },
  {
    id: 'lighting-illuminance',
    label: 'Éclairage · éclairement moyen',
    moduleId: 'lighting',
    rowsKey: 'rooms',
    idKey: 'roomId',
    valueKey: 'averageIlluminanceLux',
    metric: 'ILLUMINANCE',
    unit: 'lx',
  },
  {
    id: 'lighting-power-density',
    label: 'Éclairage · puissance surfacique',
    moduleId: 'lighting',
    rowsKey: 'rooms',
    idKey: 'roomId',
    valueKey: 'powerDensityWm2',
    metric: 'LIGHTING_DENSITY',
    unit: 'W/m²',
  },
  {
    id: 'iaq-co2',
    label: 'Air intérieur · CO₂ maximal',
    moduleId: 'iaq',
    rowsKey: 'rooms',
    idKey: 'roomId',
    valueKey: 'maximumConcentrationPpm',
    metric: 'CO2',
    unit: 'ppm',
  },
  {
    id: 'acoustics-reverberation',
    label: 'Acoustique · temps de réverbération (1 kHz)',
    moduleId: 'acoustics',
    rowsKey: 'rooms',
    idKey: 'roomId',
    valueKey: 'reverberationTimeS',
    band: {
      rowsKey: 'bands',
      matchKey: 'bandHz',
      matchValue: 1000,
      valueKey: 'reverberationTimeS',
    },
    metric: 'REVERBERATION',
    unit: 's',
  },
  {
    id: 'hygrothermal-condensation',
    label: 'Hygrothermie · risque de condensation',
    moduleId: 'hygrothermal',
    rowsKey: 'assemblies',
    idKey: 'elementId',
    valueKey: 'condensationRisk',
    boolean: true,
    metric: 'CONDENSATION_RISK',
    unit: '—',
  },
  {
    id: 'wastewater-discharge-units',
    label: 'Évacuation · unités de décharge',
    moduleId: 'wastewater',
    discipline: 'WASTEWATER',
    rowsKey: 'segments',
    idKey: 'id',
    valueKey: 'totalDischargeUnits',
    metric: 'DISCHARGE_UNITS',
    unit: 'UD',
  },
  {
    id: 'electrical-design-power',
    label: 'Électricité · puissance foisonnée',
    moduleId: 'electrical',
    discipline: 'ELECTRICAL',
    rowsKey: 'circuits',
    idKey: 'circuitId',
    valueKey: 'designPowerW',
    metric: 'DESIGN_POWER',
    unit: 'W',
  },
] as const satisfies readonly OverlayOption[];

export type OverlayId = (typeof OVERLAY_OPTIONS)[number]['id'];

export function overlayOption(overlayId: string): OverlayOption | undefined {
  return OVERLAY_OPTIONS.find(({ id }) => id === overlayId);
}

function rows(
  value: CalculationJson | undefined,
): readonly Readonly<Record<string, CalculationJson>>[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is Readonly<Record<string, CalculationJson>> =>
          typeof entry === 'object' && entry !== null && !Array.isArray(entry),
      )
    : [];
}

function number(value: CalculationJson | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function text(value: CalculationJson | undefined): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * The one number this analysis colours by, out of a row of the module.
 *
 * A yes/no is shown as one and zero — the plan has one colour scale and a risk
 * of condensation is a risk or it is not. A figure buried one level down, per
 * octave band, is picked by the band the analysis names.
 */
function valueOf(
  declared: OverlayOption,
  row: Readonly<Record<string, CalculationJson>>,
): number | null {
  if (declared.band !== undefined) {
    const band = rows(row[declared.band.rowsKey]).find(
      (entry) =>
        number(entry[declared.band!.matchKey]) === declared.band!.matchValue,
    );
    return band === undefined
      ? null
      : (number(band[declared.band.valueKey]) ?? null);
  }
  const raw = row[declared.valueKey!];
  if (declared.boolean === true)
    return typeof raw === 'boolean' ? (raw ? 1 : 0) : null;
  return number(raw) ?? null;
}

function scaleOf(values: readonly number[]): AnalysisOverlay['scale'] {
  if (values.length === 0) return undefined;
  return {
    kind: 'CONTINUOUS',
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    clamp: true,
  };
}

/**
 * Builds an analysis overlay from a module run.
 *
 * The values come straight from the module's own outputs, so what the plan
 * colours is the same figure the module panel reports.
 */
export function buildOverlay(
  overlayId: OverlayId,
  runs: readonly ModuleRun[],
  designTemperatureDifferenceK: number | undefined,
): AnalysisOverlay | undefined {
  if (overlayId === 'none') return undefined;
  // An analysis that says where its numbers are needs no code of its own: the
  // rows come from the module's own outputs, so what the plan colours is the
  // same figure the module panel reports.
  const declared = overlayOption(overlayId);
  if (
    declared?.rowsKey !== undefined &&
    declared.idKey !== undefined &&
    declared.valueKey !== undefined
  ) {
    const module = runs.find(
      (run) => run.moduleId === declared.moduleId,
    )?.result;
    if (module === undefined) return undefined;
    const entries = rows(module.outputs[declared.rowsKey]).flatMap((row) => {
      const id = text(row[declared.idKey!]);
      if (id === undefined) return [];
      // A row that carries no value is not a row worth zero: it stays unknown
      // and the legend counts it as such.
      return [[id, valueOf(declared, row)] as const];
    });
    if (entries.length === 0) return undefined;
    const numeric = entries
      .map(([, value]) => value)
      .filter((value): value is number => value !== null);
    const scale = scaleOf(numeric);
    return {
      id: overlayId,
      metric: declared.metric ?? overlayId,
      unit: declared.unit ?? '—',
      values: Object.fromEntries(entries),
      ...(scale === undefined ? {} : { scale }),
      states: Object.fromEntries(
        entries.map(([id, value]) => [
          id,
          value === null ? ('UNKNOWN' as const) : ('NORMAL' as const),
        ]),
      ),
    };
  }
  const thermal = runs.find((run) => run.moduleId === 'thermal')?.result;
  if (thermal === undefined) return undefined;
  const elements = rows(thermal.outputs.elements);
  if (elements.length === 0) return undefined;

  if (overlayId === 'thermal-missing') {
    const values = Object.fromEntries(
      elements.flatMap((element) => {
        const id = text(element.id);
        return id === undefined
          ? []
          : [[id, number(element.uValueWm2K) === undefined ? 1 : 0] as const];
      }),
    );
    return {
      id: 'thermal-missing',
      metric: 'MISSING_DATA',
      unit: '—',
      values,
      scale: { kind: 'CONTINUOUS', minimum: 0, maximum: 1, clamp: true },
      states: Object.fromEntries(
        Object.entries(values).map(([id, value]) => [
          id,
          value === 1 ? ('UNKNOWN' as const) : ('NORMAL' as const),
        ]),
      ),
    };
  }

  const heatLoss = overlayId === 'thermal-heat-loss';
  if (heatLoss && designTemperatureDifferenceK === undefined) return undefined;
  const deltaK = designTemperatureDifferenceK ?? 0;
  const entries = elements.flatMap((element) => {
    const id = text(element.id);
    if (id === undefined) return [];
    const uValue = number(element.uValueWm2K);
    const coefficient = number(element.heatTransferCoefficientWK);
    const value = heatLoss
      ? coefficient === undefined
        ? null
        : coefficient * deltaK
      : (uValue ?? null);
    return [[id, value] as const];
  });
  const numeric = entries
    .map(([, value]) => value)
    .filter((value): value is number => value !== null);
  const scale = scaleOf(numeric);
  return {
    id: heatLoss ? 'thermal-heat-loss' : 'thermal-u',
    metric: heatLoss ? 'HEAT_LOSS' : 'U_VALUE',
    unit: heatLoss ? 'W' : 'W/(m²·K)',
    values: Object.fromEntries(entries),
    ...(scale === undefined ? {} : { scale }),
  };
}

/** Design temperature difference the heating module resolved, when it ran. */
export function designTemperatureDifferenceK(
  runs: readonly ModuleRun[],
): number | undefined {
  return number(
    runs.find((run) => run.moduleId === 'heating')?.result?.outputs
      .designTemperatureDifferenceK,
  );
}
