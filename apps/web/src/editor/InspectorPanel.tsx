import type { Project } from '@house-technical-designer/core-domain';
import type { ProjectCommand } from '@house-technical-designer/editor-core';
import { editsFor, inspectObject } from './object-editors.js';
import type { ReactNode } from 'react';

import type { CreationStageId } from '../ux/creation-stages.js';
import type { InspectorEdit } from './inspector-edits.js';
import { InspectorField } from './InspectorField.js';
import {
  canDeleteInStage,
  editsInStage,
  readOnlyNoticeFor,
  sharedEditsInStage,
  type ReadOnlyNotice,
} from './stage-editing.js';

export interface InspectorPanelProps {
  readonly project: Project;
  readonly selection: readonly string[];
  /**
   * L'espace depuis lequel on regarde.
   *
   * Le panneau ne le recevait pas, et c'est tout ce qui lui manquait pour
   * cesser de proposer ce qui allait être refusé : il offrait ses champs et
   * son bouton « Supprimer » sur une parcelle lue depuis Bâtiment, où aucune
   * des deux commandes n'a jamais pu aboutir. Un objet n'est pas modifiable
   * dans l'absolu — il l'est **d'ici**, ou d'ailleurs.
   */
  readonly stage: CreationStageId;
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
  /** Ouvrir la bibliothèque qu'un champ désigne, sans quitter le plan. */
  readonly onOpenLibrary?: (library: string) => void;
  /**
   * Aller dans l'espace qui possède la sélection, sans la perdre.
   *
   * Nommer le propriétaire ne suffit pas : « cet objet se modifie dans
   * Bâtiment » laisserait retrouver l'onglet, y aller, puis re-désigner
   * l'objet, c'est-à-dire trois gestes pour appliquer une règle que personne
   * n'a demandée. Le bouton fait le trajet et garde la sélection, si bien que
   * l'édition qu'on venait faire est disponible en arrivant.
   */
  readonly onEditInOwnerStage: (stage: CreationStageId) => void;
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

/**
 * La phrase qui nomme le propriétaire, et le bouton qui y mène.
 *
 * Elle prend la place exacte de ce qu'on retire — la section « Modifier » ou
 * le bouton « Supprimer » — pour que l'absence soit expliquée là où elle se
 * remarque, et non par un panneau qui aurait simplement l'air incomplet.
 */
function ReadOnlyReason({
  notice,
  onEditInOwnerStage,
}: {
  readonly notice: ReadOnlyNotice;
  readonly onEditInOwnerStage: (stage: CreationStageId) => void;
}) {
  const action = notice.action;
  return (
    <section className="inspector-readonly">
      <p className="notice">{notice.sentence}</p>
      {action !== undefined && (
        <button
          type="button"
          className="secondary"
          onClick={() => onEditInOwnerStage(action.stage)}
        >
          {action.label}
        </button>
      )}
    </section>
  );
}

export function InspectorPanel({
  project,
  selection,
  stage,
  expandProperty,
  atRest,
  onOpenLibrary,
  onEditInOwnerStage,
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

  /*
   * Ce qu'une modification change, ici et maintenant.
   *
   * En scénario, corriger un champ n'écrit pas dans la maison : cela dit ce
   * que cette variante fait autrement, et la commande écrite ne touche aucun
   * objet — le verrou central ne la refuse donc pas. Filtrer ces champs-là
   * fermerait l'étude entière, puisqu'une variante se construit dans Études
   * et ne parle que de murs, qui appartiennent au Bâtiment. La suppression,
   * elle, reste une vraie suppression et reste donc gouvernée.
   */
  const statesVariant = onEdit !== undefined;
  const deletable = canDeleteInStage(stage, project, selection);

  if (selection.length > 1) {
    const shared = sharedEditsInStage(stage, project, selection);
    // Une édition commune écrit dans le projet quel que soit le mode : elle
    // n'a pas de chemin de scénario, et se juge donc toujours sur l'espace.
    const notice = readOnlyNoticeFor(stage, project, selection);
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
                {...(onOpenLibrary === undefined ? {} : { onOpenLibrary })}
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
        ) : notice === undefined ? (
          <p className="notice">
            Ces objets n’ont aucune propriété commune modifiable ensemble.
          </p>
        ) : null}
        {notice !== undefined && (
          <ReadOnlyReason
            notice={notice}
            onEditInOwnerStage={onEditInOwnerStage}
          />
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
          {deletable && (
            <button
              type="button"
              className="secondary danger"
              onClick={onDelete}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    );
  }

  const objectId = selection[0]!;
  // Les faits ne sont jamais filtrés : un mur reste lisible depuis Systèmes,
  // c'est même la raison pour laquelle il y est visible.
  const subject = inspectObject(project, objectId);
  const edits = statesVariant
    ? editsFor(project, objectId)
    : editsInStage(stage, project, objectId);
  const notice = statesVariant
    ? undefined
    : readOnlyNoticeFor(stage, project, selection);

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
              {...(onOpenLibrary === undefined ? {} : { onOpenLibrary })}
              targeted={
                expandProperty !== undefined &&
                (matches(edit.id, expandProperty) ||
                  matches(edit.label, expandProperty))
              }
            />
          ))}
        </section>
      )}
      {notice !== undefined && (
        <ReadOnlyReason
          notice={notice}
          onEditInOwnerStage={onEditInOwnerStage}
        />
      )}
      {deletable && (
        <div className="actions">
          <button type="button" className="secondary danger" onClick={onDelete}>
            Supprimer
          </button>
        </div>
      )}
    </article>
  );
}
