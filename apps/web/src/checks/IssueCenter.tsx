/**
 * How many checks pass and how many do not, permanently, at the bottom edge.
 *
 * The findings existed and had a screen; the screen had to be gone to, which
 * meant they were read when somebody thought to read them. A count that is
 * always on screen turns « il y a peut-être un problème » into a number, and
 * the number into a place to go.
 *
 * It never blocks anything. A red count is information about the model, not a
 * refusal to let the model be what it is.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';

import type { CalculationRun } from '../calculations/calculation-runner.js';
import type { UiTarget } from '../ux/ui-target.js';
import { stageOfTab } from '../ux/creation-stages.js';
import { projectChecks, sourceLabel, summarize } from './checks-model.js';

export interface IssueCenterProps {
  readonly project: Project;
  readonly run?: CalculationRun;
  readonly onNavigate: (target: UiTarget) => void;
}

export function IssueCenter({ project, run, onNavigate }: IssueCenterProps) {
  const [open, setOpen] = useState(false);
  const checks = useMemo(() => projectChecks(project, run), [project, run]);
  const summary = summarize(checks);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  /*
   * Every check the application produces is a finding: it says what could not
   * be resolved, never « celui-ci est bon ». So the count says how many
   * remarks there are and not how many checks passed — a « ✓ 42 » would be a
   * number nobody could substantiate, which is the one thing this project
   * refuses to display.
   */
  const troubled = checks;

  return (
    <div className="issue-center">
      <button
        type="button"
        className="issue-summary"
        aria-expanded={open}
        // Neither « anomalies » nor « contrôles » : accessible names are
        // matched by substring, and those two hide « nom » and « rôle » — so
        // this button answered to a search for a name field and for a role
        // field, in two different screens.
        aria-label={`Vérifications : ${summary.failures} en échec, ${summary.unknowns} indéterminé(s)`}
        onClick={() => setOpen((shown) => !shown)}
      >
        {summary.total === 0 ? (
          <span className="issue-ok">✓ rien à signaler</span>
        ) : (
          <>
            {summary.failures > 0 && (
              <span className="issue-fail">✗ {summary.failures}</span>
            )}
            {summary.unknowns > 0 && (
              <span className="issue-unknown">⚠ {summary.unknowns}</span>
            )}
          </>
        )}
      </button>
      {open && (
        <div
          className="issue-drawer panel"
          role="dialog"
          aria-label="Anomalies"
        >
          <p className="panel-label">
            {troubled.length === 0
              ? 'Rien à signaler'
              : `${troubled.length} remarque(s)`}
          </p>
          <ul className="alert-list">
            {troubled.slice(0, 20).map((check) => (
              <li key={check.id}>
                <span
                  className={
                    check.status === 'FAIL' ? 'badge missing' : 'badge unknown'
                  }
                >
                  {check.status === 'FAIL' ? 'échec' : 'inconnu'}
                </span>
                <span>
                  <strong>{check.title}</strong>
                  <span className="hint">{sourceLabel(check.source)}</span>
                </span>
                {check.fix !== undefined && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => {
                      const objectId = check.fix?.objectIds?.[0];
                      const propertyPath = check.fix?.propertyPath;
                      onNavigate({
                        stage: stageOfTab(check.fix!.tab),
                        ...(objectId === undefined ? {} : { objectId }),
                        ...(propertyPath === undefined ? {} : { propertyPath }),
                      });
                      setOpen(false);
                    }}
                  >
                    {check.fix.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {troubled.length > 20 && (
            <p className="hint">
              et {troubled.length - 20} autre(s) — l’espace Analyser les montre
              toutes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
