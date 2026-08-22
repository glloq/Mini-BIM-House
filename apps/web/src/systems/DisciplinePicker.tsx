/**
 * Which trade the plan is being read through, in Systèmes.
 *
 * Systèmes is not another application: it is the same drawing, the same
 * inspector and the same tools, with one discipline switched on. Choosing one
 * is therefore a context, not a destination — and the plan under it never
 * changes.
 *
 * A trade the project has switched off is not offered, unless the project
 * already holds objects of it: a scope narrows what is proposed, never what
 * exists.
 */
import {
  designDomain,
  type DesignDomainId,
  type Project,
} from '@house-technical-designer/core-domain';

import { networksOfDomain, technicalDomains } from './discipline-scope.js';

export interface DisciplinePickerProps {
  readonly project: Project;
  readonly activeDomain?: DesignDomainId;
  readonly onSelect: (domain: DesignDomainId) => void;
}

export function DisciplinePicker({
  project,
  activeDomain,
  onSelect,
}: DisciplinePickerProps) {
  const domains = technicalDomains(project);
  return (
    <section className="context-group" aria-label="Disciplines">
      <p className="context-group-label">Discipline</p>
      {domains.map((id) => {
        const descriptor = designDomain(id);
        const held = networksOfDomain(project, id);
        return (
          <button
            key={id}
            type="button"
            className={id === activeDomain ? 'active' : undefined}
            aria-pressed={id === activeDomain}
            title={descriptor.description}
            onClick={() => onSelect(id)}
          >
            {descriptor.label}
            {/* A count of nothing is worth saying: it is the difference
                between « rien à voir » and « rien de tracé ». */}
            <small className="discipline-count">
              {held === 0 ? 'aucun réseau' : `${held} réseau(x)`}
            </small>
          </button>
        );
      })}
      {domains.length === 0 && (
        <p className="hint">
          Aucune discipline technique dans le périmètre de ce projet.
        </p>
      )}
    </section>
  );
}
