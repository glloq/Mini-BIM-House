/**
 * What is left to do, as a suggestion.
 *
 * The ten construction phases drive this and appear nowhere else: they are not
 * ten more destinations. « Cinq espaces = où je travaille. Les étapes = ce
 * qu'il reste éventuellement à faire. »
 *
 * It recommends, and that is all it does. Nothing here refuses an action,
 * greys one out or puts a step in anyone's way: a person who wants to draw the
 * electrics before naming the rooms is right about their own project.
 */
import type { Project } from '@house-technical-designer/core-domain';

import type { UiTarget } from '../ux/ui-target.js';
import {
  WORKFLOW_GROUPS,
  WORKFLOW_GROUP_LABELS,
  WORKFLOW_STEP_STATE_LABELS,
} from '../ux/workflow-steps.js';
import { workflowEntries, workflowProgress } from './workflow-registry.js';

export interface WorkflowGuideProps {
  readonly project: Project;
  readonly onNavigate: (target: UiTarget) => void;
}

export function WorkflowGuide({ project, onNavigate }: WorkflowGuideProps) {
  const entries = workflowEntries(project).filter(
    ({ state }) => state !== 'NOT_APPLICABLE',
  );
  const progress = workflowProgress(project);
  const current = entries.find(({ state }) => state === 'CURRENT');

  return (
    <section className="workflow-guide" aria-label="Progression">
      <p className="context-group-label">Progression</p>
      <p className="hint">
        {progress.done} sur {progress.applicable} — une suggestion, jamais une
        condition.
      </p>
      {current !== undefined && (
        <p className="workflow-current">
          <strong>Sans doute la suite :</strong> {current.label}
        </p>
      )}
      {WORKFLOW_GROUPS.map((group) => {
        const inGroup = entries.filter((entry) => entry.group === group);
        if (inGroup.length === 0) return null;
        const finished = inGroup.every(({ state }) => state === 'DONE');
        return (
          <details
            key={group}
            className="workflow-group"
            // A finished phase folds itself away; the one in hand opens.
            open={!finished && inGroup.some(({ state }) => state === 'CURRENT')}
          >
            <summary>
              {WORKFLOW_GROUP_LABELS[group]}
              <small>
                {inGroup.filter(({ state }) => state === 'DONE').length}/
                {inGroup.length}
              </small>
            </summary>
            <ul className="workflow-steps">
              {inGroup.map((entry) => (
                <li
                  key={entry.id}
                  className={`workflow-${entry.state.toLowerCase()}`}
                >
                  <span className="workflow-state">
                    {WORKFLOW_STEP_STATE_LABELS[entry.state]}
                  </span>
                  {entry.actions.length > 0 ? (
                    <button
                      type="button"
                      className="link"
                      onClick={() => onNavigate(entry.actions[0]!.target)}
                    >
                      {entry.label}
                    </button>
                  ) : (
                    <span>{entry.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
