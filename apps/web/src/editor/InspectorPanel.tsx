import type { Project } from '@house-technical-designer/core-domain';
import { inspectObject } from './inspector-model.js';

export interface InspectorPanelProps {
  readonly project: Project;
  readonly selection: readonly string[];
  readonly onClear: () => void;
}

export function InspectorPanel({
  project,
  selection,
  onClear,
}: InspectorPanelProps) {
  if (selection.length === 0)
    return (
      <p className="empty-state">
        Sélectionnez un objet du plan pour voir ses propriétés.
      </p>
    );

  if (selection.length > 1)
    return (
      <div>
        <p className="hint">{selection.length} objets sélectionnés</p>
        <ul className="selection-list">
          {selection.map((objectId) => (
            <li key={objectId}>{inspectObject(project, objectId).title}</li>
          ))}
        </ul>
        <button type="button" className="secondary" onClick={onClear}>
          Vider la sélection
        </button>
      </div>
    );

  const subject = inspectObject(project, selection[0]!);
  return (
    <article className="inspector-subject">
      <header>
        <h3>{subject.title}</h3>
        <button type="button" className="secondary" onClick={onClear}>
          Désélectionner
        </button>
      </header>
      {subject.sections.map((section) => (
        <section key={section.title}>
          <h4>{section.title}</h4>
          <dl className="inspector-fields">
            {section.fields.map((entry) => (
              <div key={`${section.title}:${entry.label}`}>
                <dt>{entry.label}</dt>
                <dd>
                  {entry.value ?? (
                    <span className="badge missing">inconnu</span>
                  )}
                  {entry.hint !== undefined && (
                    <small className="hint">{entry.hint}</small>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </article>
  );
}
