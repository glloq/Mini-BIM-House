import { useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type { CalculationRun } from '../calculations/calculation-runner.js';
import {
  projectChecks,
  sourceLabel,
  summarize,
  type CheckFix,
  type CheckItem,
} from './checks-model.js';
import { evaluateRulePacks } from './rule-packs.js';
import { RuleReportPanel } from '../RuleReportPanel.js';

export interface ChecksPanelProps {
  readonly project: Project;
  readonly run?: CalculationRun;
  readonly running: boolean;
  readonly onFix: (fix: CheckFix) => void;
}

const STATUS_LABELS = {
  FAIL: 'Écart',
  UNKNOWN: 'Non vérifiable',
} as const;

export function ChecksPanel({
  project,
  run,
  running,
  onFix,
}: ChecksPanelProps) {
  const [onlyFailures, setOnlyFailures] = useState(false);
  const checks = useMemo(() => projectChecks(project, run), [project, run]);
  // Activated rule packs are run here rather than in a screen of their own:
  // a compliance verdict belongs beside the findings it has to be read with.
  const evaluations = useMemo(() => evaluateRulePacks(project), [project]);
  const summary = summarize(checks);
  const shown: readonly CheckItem[] = onlyFailures
    ? checks.filter(({ status }) => status === 'FAIL')
    : checks;

  return (
    <section className="library-panel" aria-labelledby="checks-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Vérifications</p>
          <h2 id="checks-heading">Ce que le projet ne résout pas</h2>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyFailures}
            onChange={(event) => setOnlyFailures(event.target.checked)}
          />
          Afficher uniquement les écarts
        </label>
      </header>

      <div className="dashboard-cards" role="list">
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Constats</span>
          <span className="dashboard-card-value">{summary.total}</span>
        </div>
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Écarts</span>
          <span className="dashboard-card-value">{summary.failures}</span>
        </div>
        <div className="dashboard-card" role="listitem">
          <span className="dashboard-card-label">Non vérifiables</span>
          <span className="dashboard-card-value">{summary.unknowns}</span>
        </div>
      </div>

      {running && <p className="hint">Calcul en cours…</p>}
      {run === undefined && !running && (
        <p className="notice">
          Les constats de calcul apparaissent une fois les modules exécutés :
          ouvrez le tableau de bord des calculs.
        </p>
      )}

      {evaluations.map((evaluation) =>
        evaluation.report === undefined ? (
          <p className="notice warning" key={evaluation.packId}>
            {evaluation.notice}
          </p>
        ) : (
          <RuleReportPanel
            key={evaluation.packId}
            report={evaluation.report}
            onLocate={(objectIds) =>
              onFix({ label: 'Localiser', tab: 'networks', objectIds })
            }
          />
        ),
      )}

      <ul className="alert-list">
        {shown.map((check) => (
          <li key={check.id} className={`check-${check.status.toLowerCase()}`}>
            <span
              className={
                check.status === 'FAIL' ? 'badge missing' : 'badge unknown'
              }
            >
              {STATUS_LABELS[check.status]}
            </span>
            <span>
              <strong>{check.title}</strong>
              <span className="hint">{sourceLabel(check.source)}</span>
              <span>{check.detail}</span>
            </span>
            {check.fix !== undefined && (
              <button
                type="button"
                className="link"
                onClick={() => onFix(check.fix!)}
              >
                Corriger
              </button>
            )}
          </li>
        ))}
        {shown.length === 0 && (
          <li className="empty-state">
            {onlyFailures
              ? 'Aucun écart : le modèle est cohérent et les quantités sont résolues.'
              : 'Rien à signaler sur ce projet.'}
          </li>
        )}
      </ul>

      <p className="notice">
        Ces contrôles portent sur la cohérence du modèle et sur ce que les
        calculs n’ont pas pu résoudre. Ils ne constatent aucune conformité
        réglementaire : seul un référentiel versionné, activé par le projet,
        peut le faire, et il dit alors ce qu’il vérifie et sur quel texte.
      </p>
    </section>
  );
}
