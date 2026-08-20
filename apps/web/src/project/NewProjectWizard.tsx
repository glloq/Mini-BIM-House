import { useState } from 'react';
import {
  DEFAULT_NEW_PROJECT,
  newProjectIssue,
  type NewProjectDraft,
} from '../project-workspace.js';
import { DraftField } from '../DraftField.js';

type DraftPatch = {
  readonly [K in keyof NewProjectDraft]?: NewProjectDraft[K] | undefined;
};

export interface NewProjectWizardProps {
  readonly onCreate: (draft: NewProjectDraft) => void;
  readonly onCancel: () => void;
}

function numberOrUndefined(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

/**
 * The few questions a project cannot be started without.
 *
 * A blank project used to appear with a name nobody chose, one level and no
 * site, and the user discovered the missing answers one calculation at a time.
 * The assistant asks them once, and asks nothing it could not use: a location
 * left empty stays empty rather than becoming a default city.
 */
export function NewProjectWizard({
  onCreate,
  onCancel,
}: NewProjectWizardProps) {
  const [draft, setDraft] = useState<NewProjectDraft>(DEFAULT_NEW_PROJECT);
  const issue = newProjectIssue(draft);

  /**
   * Applies one answer.
   *
   * An answer taken back is removed rather than stored as `undefined`: the
   * project file has no place for a key whose value is nothing.
   */
  function patch(next: DraftPatch): void {
    setDraft((current) => {
      const merged: Record<string, unknown> = { ...current, ...next };
      for (const [key, value] of Object.entries(next))
        if (value === undefined) delete merged[key];
      return merged as unknown as NewProjectDraft;
    });
  }

  return (
    <section
      className="panel new-project-wizard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-heading"
    >
      <h2 id="new-project-heading">Nouveau projet</h2>
      <p className="hint">
        Ces réponses ne peuvent être devinées ; tout le reste se modifie ensuite
        depuis les espaces de travail.
      </p>

      <fieldset>
        <legend>Identité</legend>
        <DraftField
          id="wizard-name"
          label="Nom du projet"
          kind="TEXT"
          value={draft.name}
          onCommit={(name) => patch({ name })}
        />
        <DraftField
          id="wizard-author"
          label="Auteur"
          kind="TEXT"
          value={draft.author ?? ''}
          placeholder="Facultatif"
          onCommit={(author) => patch({ author })}
        />
        <DraftField
          id="wizard-country"
          label="Pays"
          kind="TEXT"
          unit="code ISO"
          value={draft.country}
          hint="Décide des jeux de règles proposés aux vérifications."
          onCommit={(country) => patch({ country })}
        />
      </fieldset>

      <fieldset>
        <legend>Bâtiment</legend>
        <DraftField
          id="wizard-levels"
          label="Niveaux hors sol"
          kind="NUMBER"
          unit="niveaux"
          min={1}
          max={20}
          step={1}
          value={draft.levelCount}
          onCommit={(raw) => {
            const value = numberOrUndefined(raw);
            if (value !== undefined) patch({ levelCount: Math.round(value) });
          }}
        />
        <DraftField
          id="wizard-storey-height"
          label="Hauteur d’étage"
          kind="NUMBER"
          unit="mm"
          min={1}
          value={draft.storeyHeightMm}
          onCommit={(raw) => {
            const value = numberOrUndefined(raw);
            if (value !== undefined) patch({ storeyHeightMm: value });
          }}
        />
        <DraftField
          id="wizard-basement"
          label="Sous-sol"
          kind="BOOLEAN"
          value={draft.basement}
          onCommit={(value) => patch({ basement: value === 'true' })}
        />
      </fieldset>

      <fieldset>
        <legend>Terrain</legend>
        <DraftField
          id="wizard-north"
          label="Angle du nord"
          kind="NUMBER"
          unit="°"
          value={draft.northAngleDeg}
          hint="Angle entre le nord et l’axe vertical du plan."
          onCommit={(raw) => {
            const value = numberOrUndefined(raw);
            if (value !== undefined) patch({ northAngleDeg: value });
          }}
        />
        <DraftField
          id="wizard-latitude"
          label="Latitude"
          kind="NUMBER"
          unit="°"
          value={draft.latitudeDeg}
          placeholder="Inconnue"
          onCommit={(raw) => patch({ latitudeDeg: numberOrUndefined(raw) })}
        />
        <DraftField
          id="wizard-longitude"
          label="Longitude"
          kind="NUMBER"
          unit="°"
          value={draft.longitudeDeg}
          placeholder="Inconnue"
          onCommit={(raw) => patch({ longitudeDeg: numberOrUndefined(raw) })}
        />
        <DraftField
          id="wizard-altitude"
          label="Altitude"
          kind="NUMBER"
          unit="m"
          value={draft.altitudeM}
          placeholder="Inconnue"
          onCommit={(raw) => patch({ altitudeM: numberOrUndefined(raw) })}
        />
      </fieldset>

      <p className="notice">
        Une latitude et une longitude renseignées ensemble situent le projet ;
        laissées vides, elles restent inconnues et les modules qui en ont besoin
        le signaleront plutôt que de supposer un lieu.
      </p>

      {issue !== undefined && <p className="notice warning">{issue}</p>}

      <div className="actions">
        <button
          type="button"
          disabled={issue !== undefined}
          onClick={() => onCreate(draft)}
        >
          Créer le projet
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </section>
  );
}
