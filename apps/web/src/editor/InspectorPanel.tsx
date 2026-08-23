import type { Project } from '@house-technical-designer/core-domain';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import { editsFor, inspectObject, sharedEditsFor } from './object-editors.js';
import type { ReactNode } from 'react';

import type { InspectorEdit } from './inspector-edits.js';
import { InspectorField } from './InspectorField.js';

export interface InspectorPanelProps {
  readonly project: Project;
  readonly selection: readonly string[];
  /**
   * The property someone was sent here to look at, when they were sent.
   *
   * A check that says « la hauteur de ce mur n'est pas résolue » has to be
   * able to open that field, not just this panel: an espace n'est pas une
   * réponse, un champ en est une. Matched against a field label or an edit
   * identifier, so a target can name either.
   */
  readonly expandProperty?: string;
  /**
   * Ce que le panneau montre quand rien n'est désigné.
   *
   * Un objet a des propriétés ; une vue aussi. « Sélectionnez un objet »
   * n'apprend rien à qui vient de cliquer dans le vide, et prenait la place
   * d'un panneau entier pour le dire.
   */
  readonly atRest?: ReactNode;
  readonly onClear: () => void;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onMessage: (message: string) => void;
  readonly onDelete: () => void;
  /**
   * What an edit means while a variant is being built.
   *
   * In scenario mode, changing a property does not change the project: it
   * states what this variant does differently. The panel does not know which
   * mode it is in — it asks, and what comes back decides.
   */
  readonly onEdit?: (
    objectId: string,
    edit: InspectorEdit,
    value: string,
  ) => boolean;
}

/**
 * Whether a label or an identifier is the one being pointed at.
 *
 * Compared without accents or case, because a target is written by a check and
 * read by a panel, and the two spell « Hauteur (mm) » differently.
 */
function matches(candidate: string, wanted: string): boolean {
  const plain = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/gu, '')
      .toLowerCase();
  return plain(candidate).includes(plain(wanted));
}

export function InspectorPanel({
  project,
  selection,
  expandProperty,
  atRest,
  onClear,
  onCommand,
  onMessage,
  onDelete,
  onEdit,
}: InspectorPanelProps) {
  if (selection.length === 0)
    return (
      atRest ?? (
        <p className="empty-state">
          Sélectionnez un objet du plan pour voir ses propriétés.
        </p>
      )
    );

  if (selection.length > 1) {
    const shared = sharedEditsFor(project, selection);
    return (
      <div className="inspector-multiple">
        <p className="hint">{selection.length} objets sélectionnés</p>
        {shared.length > 0 ? (
          <section className="inspector-edits">
            <h4>Modifier les {selection.length} objets</h4>
            {shared.map((edit) => (
              <InspectorField
                key={edit.id}
                edit={edit}
                mixed={!edit.uniform}
                onApply={(applied, value) => {
                  const command = applied.apply(value);
                  if (command === undefined) {
                    onMessage(
                      `${applied.label} : la valeur n'a pas pu être appliquée à toute la sélection.`,
                    );
                    return;
                  }
                  onCommand(command);
                }}
              />
            ))}
          </section>
        ) : (
          <p className="notice">
            Ces objets n’ont aucune propriété commune modifiable ensemble.
          </p>
        )}
        <ul className="selection-list">
          {selection.map((objectId) => (
            <li key={objectId}>{inspectObject(project, objectId).title}</li>
          ))}
        </ul>
        <div className="actions">
          <button type="button" className="secondary" onClick={onClear}>
            Vider la sélection
          </button>
          <button type="button" className="secondary danger" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      </div>
    );
  }

  const objectId = selection[0]!;
  const subject = inspectObject(project, objectId);
  const edits = editsFor(project, objectId);

  function applyEdit(edit: InspectorEdit, value: string): void {
    if (onEdit !== undefined) {
      onEdit(objectId, edit, value);
      return;
    }
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
      {subject.sections.map((section) => {
        const holdsTarget =
          expandProperty !== undefined &&
          section.fields.some(({ label }) => matches(label, expandProperty));
        const body = (
          <dl className="inspector-fields">
            {section.fields.map((entry) => (
              <div
                key={`${section.title}:${entry.label}`}
                className={
                  expandProperty !== undefined &&
                  matches(entry.label, expandProperty)
                    ? 'targeted'
                    : undefined
                }
              >
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
        );
        // What the object is stays open; where it lives in the file folds
        // away — unless someone was sent to a field inside it.
        return section.advanced === true ? (
          <details key={section.title} open={holdsTarget}>
            <summary>{section.title}</summary>
            {body}
          </details>
        ) : (
          <section key={section.title}>
            <h4>{section.title}</h4>
            {body}
          </section>
        );
      })}
      {edits.length > 0 && (
        <section className="inspector-edits">
          <h4>Modifier</h4>
          {edits.map((edit) => (
            <InspectorField
              key={edit.id}
              edit={edit}
              onApply={applyEdit}
              targeted={
                expandProperty !== undefined &&
                (matches(edit.id, expandProperty) ||
                  matches(edit.label, expandProperty))
              }
            />
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
