import type { Project } from '@house-technical-designer/core-domain';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import { inspectObject } from './inspector-model.js';
import { editsFor, type InspectorEdit } from './inspector-edits.js';
import { InspectorField } from './InspectorField.js';

export interface InspectorPanelProps {
  readonly project: Project;
  readonly selection: readonly string[];
  readonly onClear: () => void;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  readonly onDelete: () => void;
}

export function InspectorPanel({
  project,
  selection,
  onClear,
  onCommand,
  onMessage,
  onDelete,
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

  const objectId = selection[0]!;
  const subject = inspectObject(project, objectId);
  const edits = editsFor(project, objectId);

  function applyEdit(edit: InspectorEdit, value: string): void {
    const command = edit.apply(value);
    if (command === undefined) {
      onMessage(`${edit.label} : valeur non reconnue.`);
      return;
    }
    onCommand(command);
  }

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
      {edits.length > 0 && (
        <section className="inspector-edits">
          <h4>Modifier</h4>
          {edits.map((edit) => (
            <InspectorField key={edit.id} edit={edit} onApply={applyEdit} />
          ))}
        </section>
      )}
      <div className="actions">
        <button type="button" className="secondary danger" onClick={onDelete}>
          Supprimer
        </button>
      </div>
    </article>
  );
}
