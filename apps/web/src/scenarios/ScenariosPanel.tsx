import { useEffect, useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import {
  AddScenarioCommand,
  AddScenarioOverrideCommand,
  DuplicateScenarioCommand,
  RebaseScenarioCommand,
  RemoveScenarioCommand,
  RemoveScenarioOverrideCommand,
  RenameScenarioCommand,
  projectScenarios,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import { nextLibraryId } from '../library/library-model.js';
import { compareScenario, type ScenarioComparison } from './scenario-model.js';
import {
  scenarioChangeRows,
  scenarioOverride,
  scenarioTargets,
} from './scenario-changes.js';

export interface ScenariosPanelProps {
  readonly project: Project;
  readonly climate: readonly ClimateDataset[];
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  readonly onPromote: (scenarioId: string) => void;
}

export function ScenariosPanel({
  project,
  climate,
  onCommand,
  onMessage,
  onPromote,
}: ScenariosPanelProps) {
  const scenarios = projectScenarios(project);
  const [scenarioId, setScenarioId] = useState(() => scenarios[0]?.id ?? '');
  const [comparison, setComparison] = useState<ScenarioComparison>();
  const [running, setRunning] = useState(false);
  const [newName, setNewName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [targetValue, setTargetValue] = useState('');

  const targets = useMemo(() => scenarioTargets(project), [project]);
  const active = scenarios.find(({ id }) => id === scenarioId) ?? scenarios[0];
  // What the panel shows and what the comparison computes must be the same
  // scenario, including after a project is opened with a different set.
  const activeId = active?.id ?? '';
  if (scenarioId !== activeId) setScenarioId(activeId);
  const target = targets.find(({ path }) => path === targetPath);
  const changes = useMemo(
    () =>
      active === undefined ? [] : scenarioChangeRows(project, active.overrides),
    [active, project],
  );
  const groups = useMemo(
    () => [...new Set(targets.map(({ group }) => group))],
    [targets],
  );
  // A scenario recorded against no revision cannot be out of date: it never
  // claimed a version to begin with.
  const outdated =
    active !== undefined &&
    active.baseProjectRevision !== '' &&
    project.metadata.projectRevision !== undefined &&
    active.baseProjectRevision !== project.metadata.projectRevision;

  function createScenario(): void {
    const name = newName.trim();
    if (name === '') {
      onMessage('Un scénario demande un nom.');
      return;
    }
    const id = nextLibraryId(
      'scenario',
      name,
      scenarios.map((scenario) => scenario.id),
    );
    const created = onCommand(
      new AddScenarioCommand({
        id,
        name,
        // The command records the revision it produces; naming one here would
        // only be a guess about the project's state after the scenario is added.
        baseProjectRevision: '',
        overrides: [],
      }),
    );
    if (created) {
      setScenarioId(id);
      setNewName('');
    }
  }

  useEffect(() => {
    if (activeId === '') {
      setComparison(undefined);
      return;
    }
    let current = true;
    setRunning(true);
    void compareScenario(project, activeId, climate)
      .then((result) => {
        if (current) setComparison(result);
      })
      .finally(() => {
        if (current) setRunning(false);
      });
    return () => {
      current = false;
    };
  }, [climate, project, activeId]);

  return (
    <section className="library-panel" aria-labelledby="scenarios-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Variantes</p>
          <h2 id="scenarios-heading">Scénarios</h2>
        </div>
        {scenarios.length > 0 && (
          <div className="field">
            <label htmlFor="scenario-compared">Scénario comparé</label>
            <select
              id="scenario-compared"
              value={active?.id ?? ''}
              onChange={(event) => setScenarioId(event.target.value)}
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <div className="tool-group">
        <div className="field">
          <label htmlFor="scenario-name">Nouveau scénario</label>
          <input
            id="scenario-name"
            value={newName}
            placeholder="Isolation renforcée"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                createScenario();
              }
            }}
          />
        </div>
        <button type="button" onClick={createScenario}>
          Créer
        </button>
        {active !== undefined && (
          <>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const name = `${active.name} (copie)`;
                const id = nextLibraryId(
                  'scenario',
                  name,
                  scenarios.map((scenario) => scenario.id),
                );
                if (
                  onCommand(new DuplicateScenarioCommand(active.id, id, name))
                )
                  setScenarioId(id);
              }}
            >
              Dupliquer
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                const name = newName.trim();
                if (name === '') {
                  onMessage('Saisissez le nouveau nom avant de renommer.');
                  return;
                }
                if (onCommand(new RenameScenarioCommand(active.id, name)))
                  setNewName('');
              }}
            >
              Renommer
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => onPromote(active.id)}
            >
              Promouvoir en projet
            </button>
            <button
              type="button"
              className="secondary danger"
              onClick={() => {
                // Falling back to the empty string would leave the panel
                // showing the first remaining scenario while the comparison
                // effect believed nothing was selected.
                const remaining = scenarios.filter(
                  ({ id }) => id !== active.id,
                );
                if (onCommand(new RemoveScenarioCommand(active.id)))
                  setScenarioId(remaining[0]?.id ?? '');
              }}
            >
              Supprimer
            </button>
          </>
        )}
      </div>

      {scenarios.length === 0 && (
        <p className="empty-state">
          Ce projet ne déclare aucun scénario. Un scénario est une liste de
          modifications appliquées au projet à la lecture, sans le dupliquer.
        </p>
      )}

      {active !== undefined && (
        <section>
          <h3>Modifications de « {active.name} »</h3>
          <div className="table-scroll">
            <table className="library-table">
              <caption className="visually-hidden">
                Modifications déclarées par le scénario
              </caption>
              <thead>
                <tr>
                  <th scope="col">Valeur</th>
                  <th scope="col">Projet</th>
                  <th scope="col">Scénario</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((row) => (
                  <tr key={row.path}>
                    <th scope="row">{row.label}</th>
                    <td>
                      {row.from}
                      {row.unit !== undefined && ` ${row.unit}`}
                    </td>
                    <td>
                      {row.to}
                      {row.unit !== undefined && ` ${row.unit}`}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          onCommand(
                            new RemoveScenarioOverrideCommand(
                              active.id,
                              row.path,
                            ),
                          )
                        }
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
                {changes.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      Ce scénario ne modifie encore rien : il donne les mêmes
                      résultats que le projet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            className="tool-group"
            onSubmit={(event) => {
              event.preventDefault();
              if (target === undefined) {
                onMessage('Choisissez la valeur que le scénario fait varier.');
                return;
              }
              const override = scenarioOverride(target, targetValue);
              if (override === undefined) {
                onMessage('Valeur non reconnue pour ce changement.');
                return;
              }
              if (
                onCommand(new AddScenarioOverrideCommand(active.id, override))
              )
                setTargetValue('');
            }}
          >
            <div className="field">
              <label htmlFor="scenario-target">Valeur modifiée</label>
              <select
                id="scenario-target"
                value={targetPath}
                onChange={(event) => {
                  setTargetPath(event.target.value);
                  setTargetValue('');
                }}
              >
                <option value="">Choisir une valeur</option>
                {groups.map((group) => (
                  <optgroup key={group} label={group}>
                    {targets
                      .filter((entry) => entry.group === group)
                      .map((entry) => (
                        <option key={entry.path} value={entry.path}>
                          {entry.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="scenario-value">
                Nouvelle valeur
                {target?.unit !== undefined && <small> ({target.unit})</small>}
              </label>
              {target?.options === undefined ? (
                <input
                  id="scenario-value"
                  type={target?.numeric === true ? 'number' : 'text'}
                  step="any"
                  disabled={target === undefined}
                  {...(target === undefined
                    ? {
                        title:
                          'Désignez d’abord ce que le scénario fait varier.',
                      }
                    : {})}
                  placeholder={target?.currentValue ?? ''}
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                />
              ) : (
                // A reference is chosen among the objects the project holds; it
                // is not typed, so a scenario cannot name something absent.
                <select
                  id="scenario-value"
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                >
                  <option value="">Choisir</option>
                  {target.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              type="submit"
              disabled={target === undefined}
              {...(target === undefined
                ? { title: 'Désignez d’abord ce que le scénario fait varier.' }
                : {})}
            >
              Ajouter le changement
            </button>
          </form>
          <p className="notice">
            Un scénario ne fait varier que ce que le projet déclare déjà :
            renseignez d’abord la valeur de base, puis la variante.
          </p>
        </section>
      )}

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

      {outdated && (
        <p className="notice">
          Ce scénario a été écrit sur la révision {active?.baseProjectRevision}{' '}
          ; le projet est à la révision {project.metadata.projectRevision}.
          Vérifiez que ses changements ont toujours le sens voulu, puis
          rattachez-le.{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              if (active !== undefined)
                onCommand(new RebaseScenarioCommand(active.id));
            }}
          >
            Rattacher à la révision actuelle
          </button>
        </p>
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
