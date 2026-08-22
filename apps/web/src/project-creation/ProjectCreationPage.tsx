/**
 * Creating a project, as a page.
 *
 * A modal is for a decision that blocks — « ce projet a des modifications non
 * exportées, on continue ? ». Starting a project is not that: it is the first
 * screen of the work, it deserves the whole window, and being sent back to a
 * previous answer must not feel like reopening a dialogue.
 *
 * Four steps, each of which can be left as it stands: the only one that has to
 * be answered is the name.
 */
import { useState } from 'react';
import {
  defaultDomainsFor,
  PROJECT_INTENTS,
  PROJECT_INTENT_DESCRIPTIONS,
  PROJECT_INTENT_LABELS,
  type ProjectIntent,
} from '@house-technical-designer/core-domain';

import {
  INITIAL_SHAPE_KINDS,
  INITIAL_SHAPE_LABELS,
  PROJECT_START_MODES,
  PROJECT_START_MODE_REGISTRY,
  type InitialShapeKind,
  type NewProjectDraft,
} from '../ux/new-project-draft.js';
import { DomainPicker } from './DomainPicker.js';
import { LevelStackEditor } from './LevelStackEditor.js';
import {
  DEFAULT_NEW_PROJECT_DRAFT,
  newProjectIssues,
  scopeOf,
} from './new-project.js';

export interface ProjectCreationPageProps {
  readonly onCreate: (draft: NewProjectDraft) => void;
  readonly onCancel: () => void;
}

const STEPS = [
  { id: 'IDENTITY', label: 'Le projet' },
  { id: 'BUILDING', label: 'Le bâtiment' },
  { id: 'LOCATION', label: 'Le lieu' },
  { id: 'SCOPE', label: 'Le périmètre' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

function numberOrUndefined(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

/** A draft with one key removed rather than set to nothing. */
function withLocation(
  draft: NewProjectDraft,
  key: 'latitudeDeg' | 'longitudeDeg' | 'altitudeM',
  value: number | undefined,
): NewProjectDraft {
  const location: Record<string, unknown> = { ...draft.location };
  if (value === undefined) delete location[key];
  else location[key] = value;
  return {
    ...draft,
    location,
  };
}

export function ProjectCreationPage({
  onCreate,
  onCancel,
}: ProjectCreationPageProps) {
  const [draft, setDraft] = useState<NewProjectDraft>(
    DEFAULT_NEW_PROJECT_DRAFT,
  );
  const [step, setStep] = useState<StepId>('IDENTITY');
  const issues = newProjectIssues(draft);
  const shape = draft.initialShape ?? { kind: 'NONE' as InitialShapeKind };
  const index = STEPS.findIndex(({ id }) => id === step);

  /**
   * Changing the intent re-suggests a scope, and says so.
   *
   * Only when the person has not touched the boxes themselves: silently
   * undoing someone's selection because they corrected a radio button above it
   * is how an interface becomes something to fight.
   */
  const [scopeTouched, setScopeTouched] = useState(false);
  function chooseIntent(intent: ProjectIntent): void {
    setDraft((current) => ({
      ...current,
      intent,
      ...(scopeTouched ? {} : { enabledDomains: defaultDomainsFor(intent) }),
    }));
  }

  return (
    <main className="creation-page" aria-labelledby="creation-heading">
      <header className="creation-header">
        <div>
          <p className="eyebrow">Nouveau projet</p>
          <h1 id="creation-heading">De quoi s’agit-il ?</h1>
        </div>
        <button type="button" className="secondary" onClick={onCancel}>
          Annuler
        </button>
      </header>

      <nav className="creation-steps" aria-label="Étapes de la création">
        {STEPS.map((entry, position) => (
          <button
            key={entry.id}
            type="button"
            className={entry.id === step ? 'active' : undefined}
            aria-current={entry.id === step ? 'step' : undefined}
            onClick={() => setStep(entry.id)}
          >
            <span className="creation-step-number">{position + 1}</span>
            {entry.label}
          </button>
        ))}
      </nav>

      <section className="creation-body panel">
        {step === 'IDENTITY' && (
          <>
            <label className="creation-field">
              Nom du projet
              <input
                type="text"
                value={draft.metadata.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    metadata: { ...current.metadata, name: event.target.value },
                  }))
                }
              />
            </label>
            <label className="creation-field">
              Auteur
              <input
                type="text"
                placeholder="Facultatif"
                value={draft.metadata.author ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    metadata: {
                      ...current.metadata,
                      author: event.target.value,
                    },
                  }))
                }
              />
            </label>

            <fieldset className="creation-choices">
              <legend>Ce que vous faites</legend>
              {PROJECT_INTENTS.map((intent) => (
                <label key={intent} className="creation-choice">
                  <input
                    type="radio"
                    name="intent"
                    checked={draft.intent === intent}
                    onChange={() => chooseIntent(intent)}
                  />
                  <span>
                    <strong>{PROJECT_INTENT_LABELS[intent]}</strong>
                    <small>{PROJECT_INTENT_DESCRIPTIONS[intent]}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="creation-choices">
              <legend>Comment vous commencez</legend>
              {PROJECT_START_MODES.map((mode) => {
                const descriptor = PROJECT_START_MODE_REGISTRY[mode];
                // A mode that needs something the application cannot yet give
                // is not offered. A button that does nothing is worse than an
                // absent one: it is a promise.
                const available = descriptor.needs === undefined;
                if (!available) return null;
                return (
                  <label key={mode} className="creation-choice">
                    <input
                      type="radio"
                      name="start-mode"
                      checked={draft.startMode === mode}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          startMode: mode,
                        }))
                      }
                    />
                    <span>
                      <strong>{descriptor.label}</strong>
                      <small>{descriptor.description}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </>
        )}

        {step === 'BUILDING' && (
          <>
            <h2>Les niveaux</h2>
            <p className="hint">
              Chaque niveau a sa hauteur. Les altitudes se déduisent de la pile
              et se corrigent ensuite depuis « Niveaux et pièces ».
            </p>
            <LevelStackEditor
              stack={draft.levels}
              onChange={(levels) =>
                setDraft((current) => ({ ...current, levels }))
              }
            />

            <h2>Une emprise pour commencer</h2>
            <fieldset className="creation-choices">
              <legend>Forme de départ</legend>
              {INITIAL_SHAPE_KINDS.map((kind) => (
                <label key={kind} className="creation-choice compact">
                  <input
                    type="radio"
                    name="shape"
                    checked={shape.kind === kind}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        initialShape:
                          kind === 'NONE'
                            ? { kind }
                            : {
                                kind,
                                widthMm: shape.widthMm ?? 10000,
                                depthMm: shape.depthMm ?? 8000,
                                wingMm: shape.wingMm ?? 4000,
                              },
                      }))
                    }
                  />
                  <span>{INITIAL_SHAPE_LABELS[kind]}</span>
                </label>
              ))}
            </fieldset>
            {shape.kind !== 'NONE' && (
              <div className="creation-shape-size">
                <label className="creation-field">
                  Largeur (mm)
                  <input
                    type="number"
                    min={1000}
                    step={100}
                    value={shape.widthMm ?? 0}
                    onChange={(event) => {
                      const widthMm = numberOrUndefined(event.target.value);
                      if (widthMm !== undefined)
                        setDraft((current) => ({
                          ...current,
                          initialShape: { ...shape, widthMm },
                        }));
                    }}
                  />
                </label>
                <label className="creation-field">
                  Profondeur (mm)
                  <input
                    type="number"
                    min={1000}
                    step={100}
                    value={shape.depthMm ?? 0}
                    onChange={(event) => {
                      const depthMm = numberOrUndefined(event.target.value);
                      if (depthMm !== undefined)
                        setDraft((current) => ({
                          ...current,
                          initialShape: { ...shape, depthMm },
                        }));
                    }}
                  />
                </label>
                {shape.kind !== 'RECTANGLE' && (
                  <label className="creation-field">
                    Aile (mm)
                    <input
                      type="number"
                      min={500}
                      step={100}
                      value={shape.wingMm ?? 0}
                      onChange={(event) => {
                        const wingMm = numberOrUndefined(event.target.value);
                        if (wingMm !== undefined)
                          setDraft((current) => ({
                            ...current,
                            initialShape: { ...shape, wingMm },
                          }));
                      }}
                    />
                  </label>
                )}
              </div>
            )}
            <p className="notice">
              L’emprise produit de vrais murs et une vraie dalle : ils se
              déplacent, se coupent et se suppriment comme tous les autres.
            </p>
          </>
        )}

        {step === 'LOCATION' && (
          <>
            <label className="creation-field">
              Adresse
              <input
                type="text"
                placeholder="Facultative"
                value={draft.location.address ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: {
                      ...current.location,
                      address: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label className="creation-field">
              Pays
              <input
                type="text"
                placeholder="FR"
                value={draft.location.countryCode ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: {
                      ...current.location,
                      countryCode: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <p className="hint">
              Le nord démarre à « ↑ écran » et se règle sur le plan, dans
              Projet, où il se voit contre le dessin.
            </p>
            <details className="creation-technical">
              <summary>Coordonnées précises</summary>
              <p className="hint">
                « À déterminer » est une réponse. Laissées vides, elles restent
                inconnues et les modules qui en ont besoin le diront plutôt que
                de supposer un lieu.
              </p>
              <label className="creation-field">
                Latitude (°)
                <input
                  type="number"
                  step="0.0001"
                  placeholder="À déterminer"
                  value={draft.location.latitudeDeg ?? ''}
                  onChange={(event) =>
                    setDraft((current) =>
                      withLocation(
                        current,
                        'latitudeDeg',
                        numberOrUndefined(event.target.value),
                      ),
                    )
                  }
                />
              </label>
              <label className="creation-field">
                Longitude (°)
                <input
                  type="number"
                  step="0.0001"
                  placeholder="À déterminer"
                  value={draft.location.longitudeDeg ?? ''}
                  onChange={(event) =>
                    setDraft((current) =>
                      withLocation(
                        current,
                        'longitudeDeg',
                        numberOrUndefined(event.target.value),
                      ),
                    )
                  }
                />
              </label>
              <label className="creation-field">
                Altitude (m)
                <input
                  type="number"
                  step="1"
                  placeholder="À déterminer"
                  value={draft.location.altitudeM ?? ''}
                  onChange={(event) =>
                    setDraft((current) =>
                      withLocation(
                        current,
                        'altitudeM',
                        numberOrUndefined(event.target.value),
                      ),
                    )
                  }
                />
              </label>
            </details>
          </>
        )}

        {step === 'SCOPE' && (
          <>
            <h2>Ce que vous allez concevoir</h2>
            <p className="hint">
              Un périmètre de travail, pas une limite du fichier : ce qui est
              décoché n’encombre plus l’interface, et rien n’empêche de
              l’activer plus tard.
            </p>
            <DomainPicker
              scope={scopeOf(draft)}
              onChange={(scope) => {
                setScopeTouched(true);
                setDraft((current) => ({
                  ...current,
                  intent: scope.intent,
                  enabledDomains: scope.enabledDomains,
                }));
              }}
            />
          </>
        )}
      </section>

      {issues.length > 0 && (
        <ul className="alert-list" aria-label="À corriger">
          {issues.map((issue) => (
            <li key={issue}>
              <span className="badge missing">à corriger</span>
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="creation-footer">
        <button
          type="button"
          className="secondary"
          disabled={index <= 0}
          onClick={() => setStep(STEPS[Math.max(0, index - 1)]!.id)}
        >
          Précédent
        </button>
        <button
          type="button"
          className="secondary"
          disabled={index >= STEPS.length - 1}
          onClick={() =>
            setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]!.id)
          }
        >
          Suivant
        </button>
        <button
          type="button"
          disabled={issues.length > 0}
          onClick={() => onCreate(draft)}
        >
          Créer le projet
        </button>
      </footer>
    </main>
  );
}
