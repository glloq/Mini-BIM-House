import type {
  AnalysisOverlay,
  CalculationWarning,
} from '@house-technical-designer/calculation-core';
import { overlayLegend } from '@house-technical-designer/view-query';
import { OVERLAY_OPTIONS, type OverlayId } from './overlay-source.js';

const BAND_CLASS: Readonly<Record<string, string>> = {
  ANALYSIS_LOW: 'analysis-low',
  ANALYSIS_MEDIUM: 'analysis-medium',
  ANALYSIS_HIGH: 'analysis-high',
};

const METRIC_LABELS: Readonly<Record<string, string>> = {
  U_VALUE: 'Transmission U',
  HEAT_LOSS: 'Déperditions à ΔT de calcul',
  MISSING_DATA: 'Données manquantes',
  WATER_VELOCITY: 'Vitesse dans les canalisations',
  WATER_PRESSURE_LOSS: 'Pertes de charge',
  VENT_VELOCITY: 'Vitesse dans les gaines',
  VENT_PRESSURE_LOSS: 'Pertes de charge des gaines',
  WASTEWATER_SLOPE: 'Pente des collecteurs',
  VOLTAGE_DROP: 'Chute de tension par circuit',
  DESIGN_POWER: 'Puissance foisonnée par circuit',
};

export interface OverlayControlProps {
  readonly overlayId: OverlayId;
  readonly onChange: (overlayId: OverlayId) => void;
  readonly overlay?: AnalysisOverlay;
  readonly unavailableReason?: string;
  /**
   * What the module said it could not do, and about which objects.
   *
   * A colour tells where a value is high; it cannot say that a value is
   * missing because a pipe has no bore. The warning names the objects, and
   * pointing at them is what turns a remark into a correction.
   */
  readonly warnings?: readonly CalculationWarning[];
  readonly onSelectObjects?: (objectIds: readonly string[]) => void;
}

export function OverlayControl({
  overlayId,
  onChange,
  overlay,
  unavailableReason,
  warnings,
  onSelectObjects,
}: OverlayControlProps) {
  const legend = overlay === undefined ? undefined : overlayLegend(overlay);
  return (
    <section className="overlay-control" aria-labelledby="overlay-heading">
      <h3 id="overlay-heading">Analyse</h3>
      <label>
        Superposition
        <select
          value={overlayId}
          onChange={(event) => onChange(event.target.value as OverlayId)}
        >
          {OVERLAY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {overlayId !== 'none' && legend === undefined && (
        <p className="hint">
          {unavailableReason ??
            'Lancez les calculs pour afficher cette analyse.'}
        </p>
      )}

      {legend !== undefined && (
        <dl className="overlay-legend">
          <dt className="visually-hidden">Métrique</dt>
          <dd className="overlay-metric">
            {METRIC_LABELS[legend.metric] ?? legend.metric}
            {legend.unit !== '—' && <small> ({legend.unit})</small>}
          </dd>
          {legend.entries.map((entry) => (
            <div key={entry.role} className="overlay-band">
              <dt>
                <span
                  className={`overlay-swatch ${BAND_CLASS[entry.role] ?? ''}`}
                  aria-hidden="true"
                />
                {entry.label}
              </dt>
              <dd>
                {entry.minimum === undefined || entry.maximum === undefined
                  ? '—'
                  : `${entry.minimum.toPrecision(3)} – ${entry.maximum.toPrecision(3)}`}
                <small> · {entry.objectCount} objet(s)</small>
              </dd>
            </div>
          ))}
          {legend.unknownCount > 0 && (
            <div className="overlay-band">
              <dt>
                <span
                  className="overlay-swatch analysis-unknown"
                  aria-hidden="true"
                />
                Inconnu
              </dt>
              <dd>
                <small>{legend.unknownCount} objet(s)</small>
              </dd>
            </div>
          )}
        </dl>
      )}

      {(warnings ?? []).length > 0 && (
        <ul className="overlay-warnings">
          {(warnings ?? []).map((warning, index) => (
            <li key={`${warning.code}:${index}`}>
              <span className="badge missing">{warning.severity}</span>{' '}
              {warning.message}
              {(warning.objectIds ?? []).length > 0 &&
                onSelectObjects !== undefined && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSelectObjects(warning.objectIds ?? [])}
                  >
                    Corriger ({(warning.objectIds ?? []).length})
                  </button>
                )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
