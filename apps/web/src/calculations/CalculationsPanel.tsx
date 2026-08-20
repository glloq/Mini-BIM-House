import { useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import type { CalculationJson } from '@house-technical-designer/calculation-core';
import {
  dashboardCards,
  runAlerts,
  type CalculationRun,
  type ModuleRun,
} from './calculation-runner.js';

const STATUS_LABELS: Readonly<Record<ModuleRun['status'], string>> = {
  OK: 'complet',
  PARTIAL: 'partiel',
  FAILED: 'échec',
  MISSING_INPUT: 'données manquantes',
  ERROR: 'erreur',
};

const ORIGIN_LABELS: Readonly<Record<string, string>> = {
  PROJECT: 'le projet',
  SCENARIO: 'le scénario',
  MODULE_SETTINGS: 'les réglages du module',
  CLIMATE_DATASET: 'le jeu de données climatiques',
  EQUIPMENT: 'un équipement',
  METHOD_DEFAULT: 'une constante de méthode',
};

function formatValue(value: CalculationJson): string {
  if (value === null) return 'inconnu';
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
  if (typeof value === 'boolean') return value ? 'oui' : 'non';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const entries: readonly CalculationJson[] = value;
    return entries.length <= 4
      ? entries.map((entry) => formatValue(entry)).join(' · ')
      : `${entries.length} valeurs`;
  }
  return `${Object.keys(value).length} champs`;
}

export interface CalculationsPanelProps {
  readonly project: Project;
  readonly climate: readonly ClimateDataset[];
  /** The run the application holds; the panel never starts its own. */
  readonly run?: CalculationRun;
  readonly running: boolean;
  readonly onRecompute: () => void;
  readonly onSelectObjects: (objectIds: readonly string[]) => void;
}

export function CalculationsPanel({
  project,
  climate,
  run,
  running,
  onRecompute,
  onSelectObjects,
}: CalculationsPanelProps) {
  const [expanded, setExpanded] = useState<string>();

  const cards = run === undefined ? [] : dashboardCards(project, run.runs);
  const alerts = run === undefined ? [] : runAlerts(run.runs);

  return (
    <section className="library-panel" aria-labelledby="calculations-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Calculs</p>
          <h2 id="calculations-heading">Tableau de bord technique</h2>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={onRecompute}>
            Recalculer
          </button>
        </div>
      </header>

      {climate.length === 0 && (
        <p className="notice warning">
          Aucun jeu de données climatiques n’est associé à ce projet. Les
          modules qui dépendent de la météo signaleront une donnée manquante
          plutôt que de supposer un climat.
        </p>
      )}

      <div className="dashboard-cards" role="list">
        {running && cards.length === 0 && (
          <p className="empty-state">Calcul en cours…</p>
        )}
        {cards.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="listitem"
            className="dashboard-card"
            onClick={() => setExpanded(entry.moduleId)}
          >
            <span className="dashboard-card-label">{entry.label}</span>
            <span className="dashboard-card-value">
              {entry.value ?? '—'}
              {entry.value !== undefined && entry.unit !== undefined && (
                <small> {entry.unit}</small>
              )}
            </span>
            {entry.hint !== undefined && (
              <span className="hint">{entry.hint}</span>
            )}
          </button>
        ))}
      </div>

      <h3>Modules</h3>
      <ul className="module-list">
        {(run?.runs ?? []).map((entry) => (
          <li key={entry.moduleId}>
            <button
              type="button"
              className="module-header"
              aria-expanded={expanded === entry.moduleId}
              onClick={() =>
                setExpanded(
                  expanded === entry.moduleId ? undefined : entry.moduleId,
                )
              }
            >
              <strong>{entry.label}</strong>
              <span
                className={`badge status-${entry.status.toLowerCase().replace('_', '-')}`}
              >
                {STATUS_LABELS[entry.status]}
              </span>
              {entry.result !== undefined && (
                <span className="hint">
                  {entry.result.methodId} · {entry.result.precision}
                </span>
              )}
            </button>

            {expanded === entry.moduleId && (
              <div className="module-body">
                {entry.message !== undefined && (
                  <p className="notice warning">{entry.message}</p>
                )}

                {entry.missing.length > 0 && (
                  <section>
                    <h4>Données manquantes</h4>
                    <ul>
                      {entry.missing.map((missing) => (
                        <li key={`${missing.moduleId}:${missing.key}`}>
                          <strong>{missing.key}</strong> — {missing.message}{' '}
                          <span className="hint">
                            attendu depuis{' '}
                            {ORIGIN_LABELS[missing.expectedOrigin] ??
                              missing.expectedOrigin}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {entry.result !== undefined && (
                  <>
                    <section>
                      <h4>Résultats</h4>
                      <dl className="inspector-fields">
                        {Object.entries(entry.result.outputs).map(
                          ([key, value]) => (
                            <div key={key}>
                              <dt>{key}</dt>
                              <dd>{formatValue(value)}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </section>

                    {entry.result.assumptions.length > 0 && (
                      <section>
                        <h4>Hypothèses</h4>
                        <ul>
                          {entry.result.assumptions.map((assumption) => (
                            <li key={assumption.id}>
                              <strong>{assumption.id}</strong> ={' '}
                              {formatValue(assumption.value)}
                              {assumption.source !== undefined && (
                                <span className="hint">
                                  {assumption.source}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {entry.result.warnings.length > 0 && (
                      <section>
                        <h4>Avertissements</h4>
                        <ul>
                          {entry.result.warnings.map((warning, index) => (
                            <li key={`${warning.code}:${index}`}>
                              <span
                                className={`badge severity-${warning.severity.toLowerCase()}`}
                              >
                                {warning.severity}
                              </span>{' '}
                              {warning.message}
                              {(warning.objectIds ?? []).length > 0 && (
                                <button
                                  type="button"
                                  className="link"
                                  onClick={() =>
                                    onSelectObjects(warning.objectIds ?? [])
                                  }
                                >
                                  Voir sur le plan
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {entry.result.references.length > 0 && (
                      <section>
                        <h4>Références</h4>
                        <ul>
                          {entry.result.references.map((reference) => (
                            <li key={reference.id}>{reference.title}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {alerts.length > 0 && (
        <section>
          <h3>Alertes ({alerts.length})</h3>
          <ul className="alert-list">
            {alerts.map((alert, index) => (
              <li key={`${alert.moduleId}:${alert.code}:${index}`}>
                <span
                  className={`badge severity-${alert.severity.toLowerCase()}`}
                >
                  {alert.severity}
                </span>
                <span>
                  <strong>{alert.moduleLabel}</strong> — {alert.message}
                </span>
                {alert.objectIds.length > 0 && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => onSelectObjects(alert.objectIds)}
                  >
                    Localiser
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="notice">
        Chaque module expose sa méthode, ses hypothèses et ses références. Aucun
        résultat n’est enregistré dans le projet : ils sont recalculés à partir
        des faits persistés.
      </p>
    </section>
  );
}
