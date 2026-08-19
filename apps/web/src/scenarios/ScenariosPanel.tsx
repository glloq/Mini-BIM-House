import { useEffect, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  compareScenario,
  projectScenarios,
  type ScenarioComparison,
} from './scenario-model.js';

export interface ScenariosPanelProps {
  readonly project: Project;
  readonly climate: readonly ClimateDataset[];
}

export function ScenariosPanel({ project, climate }: ScenariosPanelProps) {
  const scenarios = projectScenarios(project);
  const [scenarioId, setScenarioId] = useState(() => scenarios[0]?.id ?? '');
  const [comparison, setComparison] = useState<ScenarioComparison>();
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (scenarioId === '') {
      setComparison(undefined);
      return;
    }
    let current = true;
    setRunning(true);
    void compareScenario(project, scenarioId, climate)
      .then((result) => {
        if (current) setComparison(result);
      })
      .finally(() => {
        if (current) setRunning(false);
      });
    return () => {
      current = false;
    };
  }, [climate, project, scenarioId]);

  if (scenarios.length === 0)
    return (
      <section className="library-panel">
        <header className="panel-heading">
          <div>
            <p className="panel-label">Variantes</p>
            <h2>Scénarios</h2>
          </div>
        </header>
        <p className="empty-state">
          Ce projet ne déclare aucun scénario. Un scénario est une liste de
          modifications appliquées au projet, sans le dupliquer.
        </p>
      </section>
    );

  return (
    <section className="library-panel" aria-labelledby="scenarios-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Variantes</p>
          <h2 id="scenarios-heading">Scénarios</h2>
        </div>
        <label>
          Scénario comparé
          <select
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {running && <p className="hint">Calcul de la variante…</p>}

      {comparison !== undefined && comparison.issues.length > 0 && (
        <ul className="alert-list">
          {comparison.issues.map((issue) => (
            <li key={issue}>
              <span className="badge missing">scénario</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      )}

      {comparison !== undefined && comparison.rows.length > 0 && (
        <table className="library-table">
          <caption className="visually-hidden">
            Comparaison entre le projet et la variante {comparison.scenarioName}
          </caption>
          <thead>
            <tr>
              <th scope="col">Indicateur</th>
              <th scope="col">Projet</th>
              <th scope="col">{comparison.scenarioName}</th>
              <th scope="col">Écart</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  {row.label}
                  {row.unit !== undefined && (
                    <span className="hint">{row.unit}</span>
                  )}
                </th>
                <td>
                  {row.baseValue === undefined ? (
                    <span className="badge missing">inconnu</span>
                  ) : (
                    row.baseValue
                  )}
                </td>
                <td>
                  {row.variantValue === undefined ? (
                    <span className="badge missing">inconnu</span>
                  ) : (
                    row.variantValue
                  )}
                </td>
                <td>
                  {row.delta === undefined ? (
                    '—'
                  ) : (
                    <span
                      className={`delta ${row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : ''}`}
                    >
                      {row.delta > 0 ? '+' : ''}
                      {row.delta.toFixed(2)}
                      {row.deltaRatio !== undefined && (
                        <small>
                          {' '}
                          ({row.deltaRatio > 0 ? '+' : ''}
                          {(row.deltaRatio * 100).toFixed(1)} %)
                        </small>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="notice">
        Une variante est dérivée à la lecture depuis le projet et ses
        modifications déclarées : la maison n’est jamais dupliquée, et le projet
        ouvert n’est pas modifié par la comparaison.
      </p>
    </section>
  );
}
