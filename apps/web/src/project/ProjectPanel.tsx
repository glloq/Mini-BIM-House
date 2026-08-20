import { useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type { ClimateDataset } from '@house-technical-designer/climate';
import { validateClimateDataset } from '@house-technical-designer/climate';
import {
  UpdateModuleSettingsCommand,
  UpdateProjectMetadataCommand,
  UpdateRegulatoryContextCommand,
  SetEnabledRulePacksCommand,
  UpdateSiteCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  MODULE_SETTINGS,
  fieldValue,
  materialValue,
  moduleContract,
  chosenNumbers,
  moduleSettings,
  flagValue,
  withFlag,
  withField,
  withNumberChoice,
  withMaterialValue,
} from './settings-catalog.js';
import { coverageDetail, moduleCoverage } from './climate-coverage.js';
import {
  AVAILABLE_RULE_PACKS,
  assessmentContext,
  enabledRulePackIds,
} from '../checks/rule-packs.js';
import { jurisdictionApplies } from '@house-technical-designer/rule-engine';

export interface ProjectPanelProps {
  readonly project: Project;
  readonly climate: readonly ClimateDataset[];
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onClimateChange: (datasets: readonly ClimateDataset[]) => void;
  readonly onMessage: (message: string) => void;
}

/** A field committed on blur or Enter, never on each keystroke. */
function TextField({
  id,
  label,
  unit,
  hint,
  value,
  numeric,
  onCommit,
}: {
  readonly id: string;
  readonly label: string;
  readonly unit?: string;
  readonly hint?: string;
  readonly value: string;
  readonly numeric?: boolean;
  readonly onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const commit = (): void => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit !== undefined && <small> ({unit})</small>}
      </label>
      <input
        id={id}
        type={numeric === true ? 'number' : 'text'}
        step="any"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') setDraft(value);
        }}
      />
      {hint !== undefined && <small className="hint">{hint}</small>}
    </div>
  );
}

function coordinate(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function ProjectPanel({
  project,
  climate,
  onCommand,
  onClimateChange,
  onMessage,
}: ProjectPanelProps) {
  const [moduleId, setModuleId] = useState('heating');
  // Latitude and longitude travel together: the domain refuses half a
  // location, so the pair is committed as one edit however it was typed.
  const [latitude, setLatitude] = useState(() =>
    coordinate(project.site.location?.latitudeDeg),
  );
  const [longitude, setLongitude] = useState(() =>
    coordinate(project.site.location?.longitudeDeg),
  );
  // The drafts follow the project. Without this, opening another project while
  // this panel stays mounted would leave the previous one's coordinates in the
  // fields, and committing either would write them onto the new project.
  const storedLocation = `${coordinate(project.site.location?.latitudeDeg)}|${coordinate(project.site.location?.longitudeDeg)}`;
  const [shownLocation, setShownLocation] = useState(storedLocation);
  if (shownLocation !== storedLocation) {
    setShownLocation(storedLocation);
    setLatitude(coordinate(project.site.location?.latitudeDeg));
    setLongitude(coordinate(project.site.location?.longitudeDeg));
  }
  const materials = project.materialLibrary?.materials ?? [];
  const descriptor =
    MODULE_SETTINGS.find((entry) => entry.moduleId === moduleId) ??
    MODULE_SETTINGS[0]!;
  const settings = moduleSettings(project, descriptor.moduleId);
  // Where and when the project is assessed; undefined until it says both.
  const assessment = assessmentContext(project);

  // There is no single "complete": a file of temperatures serves the heating
  // load and not the rainwater balance, so coverage is stated per module.
  const coverage = useMemo(
    () =>
      climate.map((dataset) => ({
        dataset,
        modules: moduleCoverage(dataset),
      })),
    [climate],
  );

  function commitLocation(nextLatitude: string, nextLongitude: string): void {
    // An empty field is absent, not zero: half a location has to stay half a
    // location, so the domain can refuse it instead of inventing a meridian.
    const coordinateOf = (raw: string): number | null =>
      raw.trim() === '' ? null : Number(raw.replace(',', '.'));
    onCommand(
      new UpdateSiteCommand({
        latitudeDeg: coordinateOf(nextLatitude),
        longitudeDeg: coordinateOf(nextLongitude),
      }),
    );
  }

  function writeSettings(
    next: Readonly<Record<string, unknown>> | undefined,
  ): void {
    if (next === undefined) {
      onMessage('Valeur non reconnue : le réglage n’a pas été modifié.');
      return;
    }
    const contract = moduleContract(descriptor.moduleId);
    if (contract === undefined) {
      onMessage(`Le module ${descriptor.moduleId} est introuvable.`);
      return;
    }
    onCommand(
      new UpdateModuleSettingsCommand(
        descriptor.moduleId,
        contract.version,
        project.calculationSettings?.[descriptor.moduleId]?.methodId ??
          contract.methodId,
        next as Readonly<Record<string, never>>,
      ),
    );
  }

  async function importClimate(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      onMessage(
        `Jeu climatique illisible — ${error instanceof Error ? error.message : 'JSON invalide'}.`,
      );
      return;
    }
    const issues = validateClimateDataset(parsed as ClimateDataset);
    if (issues.length > 0) {
      onMessage(`Jeu climatique refusé — ${issues[0]!.message}`);
      return;
    }
    const dataset = parsed as ClimateDataset;
    onClimateChange([
      ...climate.filter(({ id }) => id !== dataset.id),
      dataset,
    ]);
    onCommand(new UpdateSiteCommand({ climateProfileId: dataset.id }));
    onMessage(`Jeu climatique ${dataset.id} associé au projet.`);
  }

  return (
    <section className="library-panel" aria-labelledby="project-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Projet</p>
          <h2 id="project-heading">Informations, site et réglages</h2>
        </div>
      </header>

      <div className="network-layout">
        <section>
          <h3>Identité</h3>
          <div className="tool-group">
            <TextField
              id="project-name"
              label="Nom du projet"
              value={project.metadata.name}
              hint="Il nomme aussi les fichiers exportés."
              onCommit={(name) =>
                onCommand(new UpdateProjectMetadataCommand({ name }))
              }
            />
            <TextField
              id="project-author"
              label="Auteur"
              value={project.metadata.author ?? ''}
              onCommit={(author) =>
                onCommand(new UpdateProjectMetadataCommand({ author }))
              }
            />
            <div className="field">
              <span className="field-label">Révision</span>
              <p id="project-revision" className="readout">
                {project.metadata.projectRevision ?? 'aucune'}
                {' — modifié le '}
                {project.metadata.updatedAt}
              </p>
              <small className="hint">
                La révision change à chaque modification, y compris une
                annulation : elle identifie une édition, pas un état. Les
                scénarios s’y réfèrent, elle n’est donc pas saisie à la main.
              </small>
            </div>
            <TextField
              id="project-description"
              label="Description"
              value={project.metadata.description ?? ''}
              onCommit={(description) =>
                onCommand(new UpdateProjectMetadataCommand({ description }))
              }
            />
          </div>
        </section>

        <section>
          <h3>Site</h3>
          <div className="tool-group">
            <TextField
              id="site-north"
              label="Orientation du nord"
              unit="°"
              numeric
              value={String(project.site.northAngleDeg)}
              hint="Angle du nord par rapport à l’axe Y du plan."
              onCommit={(value) =>
                onCommand(
                  new UpdateSiteCommand({ northAngleDeg: Number(value) }),
                )
              }
            />
            <TextField
              id="site-altitude"
              label="Altitude"
              unit="m"
              numeric
              value={coordinate(project.site.altitudeM)}
              onCommit={(value) =>
                onCommand(
                  new UpdateSiteCommand({
                    altitudeM: value.trim() === '' ? null : Number(value),
                  }),
                )
              }
            />
            <TextField
              id="site-latitude"
              label="Latitude"
              unit="°"
              numeric
              value={latitude}
              onCommit={(value) => {
                setLatitude(value);
                commitLocation(value, longitude);
              }}
            />
            <TextField
              id="site-longitude"
              label="Longitude"
              unit="°"
              numeric
              value={longitude}
              onCommit={(value) => {
                setLongitude(value);
                commitLocation(latitude, value);
              }}
            />
          </div>
          <p className="notice">
            Une localisation demande la latitude et la longitude : l’une sans
            l’autre est refusée plutôt que complétée par un zéro.
          </p>
        </section>

        <section>
          <h3>Climat</h3>
          {climate.length === 0 ? (
            <p className="notice warning">
              Aucun jeu de données climatiques. Les modules qui dépendent de la
              météo signaleront une donnée manquante plutôt que de supposer un
              climat.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="library-table">
                <caption className="visually-hidden">
                  Jeux de données climatiques associés au projet
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Jeu</th>
                    <th scope="col">Lieu</th>
                    <th scope="col">Pas de temps</th>
                    <th scope="col">Ce que le jeu permet</th>
                    <th scope="col">Source</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map(({ dataset, modules }) => (
                    <tr key={dataset.id}>
                      <th scope="row">
                        {dataset.id}
                        {project.site.climateProfileId === dataset.id && (
                          <span className="hint">référence du projet</span>
                        )}
                      </th>
                      <td>
                        {dataset.location.latitude.toFixed(3)} ;{' '}
                        {dataset.location.longitude.toFixed(3)}
                      </td>
                      <td>{dataset.resolution}</td>
                      <td>
                        <ul className="coverage-list">
                          {modules.map((entry) => (
                            <li key={entry.moduleId}>
                              <span
                                className={
                                  entry.verdict === 'COVERED'
                                    ? 'badge'
                                    : 'badge missing'
                                }
                              >
                                {entry.verdict === 'COVERED' ? '✓' : '✕'}
                              </span>
                              <span>
                                {entry.label} — {coverageDetail(entry, dataset)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{dataset.source.provider}</td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="link"
                          onClick={() =>
                            onCommand(
                              new UpdateSiteCommand({
                                climateProfileId: dataset.id,
                              }),
                            )
                          }
                        >
                          Prendre comme référence
                        </button>
                        <button
                          type="button"
                          className="link"
                          onClick={() => {
                            onClimateChange(
                              climate.filter(({ id }) => id !== dataset.id),
                            );
                            if (project.site.climateProfileId === dataset.id)
                              onCommand(
                                new UpdateSiteCommand({
                                  climateProfileId: null,
                                }),
                              );
                          }}
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="tool-group">
            <div className="field">
              <label htmlFor="climate-file">Ajouter un jeu de données</label>
              <input
                id="climate-file"
                type="file"
                accept=".json"
                onChange={(event) => {
                  void importClimate(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </div>
          </div>
          <p className="notice">
            Le jeu est validé avant d’être accepté : lacunes et valeurs
            manquantes restent déclarées, elles ne sont jamais comblées. Un jeu
            n’est jamais « complet » dans l’absolu : il l’est pour les modules
            dont il porte les grandeurs, et le tableau le dit module par module.
            Le projet enregistre l’identifiant du jeu qu’il attend ; les mesures
            elles-mêmes restent dans leur fichier et doivent être rechargées à
            la réouverture.
          </p>
        </section>

        <section>
          <h3>Contexte réglementaire</h3>
          <div className="tool-group">
            <TextField
              id="regulatory-country"
              label="Pays"
              value={project.regulatoryContext?.country ?? 'FR'}
              onCommit={(country) =>
                onCommand(new UpdateRegulatoryContextCommand({ country }))
              }
            />
            <TextField
              id="regulatory-region"
              label="Région"
              value={project.regulatoryContext?.region ?? ''}
              onCommit={(region) =>
                onCommand(new UpdateRegulatoryContextCommand({ region }))
              }
            />
            <TextField
              id="regulatory-date"
              label="Date de référence"
              unit="AAAA-MM-JJ"
              value={project.regulatoryContext?.referenceDate ?? ''}
              onCommit={(referenceDate) =>
                onCommand(new UpdateRegulatoryContextCommand({ referenceDate }))
              }
            />
          </div>
        </section>

        <section>
          <h3>Référentiels réglementaires</h3>
          <ul className="catalog-list">
            {AVAILABLE_RULE_PACKS.map((pack) => {
              const enabled = enabledRulePackIds(project).includes(pack.id);
              // Whether a pack applies is stated here, in front of the user,
              // rather than discovered later as an absence of verdict.
              const applicability =
                assessment === undefined
                  ? 'Renseignez le pays et la date de référence pour savoir si ce référentiel s’applique.'
                  : jurisdictionApplies(pack, assessment).explanation;
              return (
                <li key={pack.id}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() =>
                        onCommand(
                          new SetEnabledRulePacksCommand(
                            enabled
                              ? enabledRulePackIds(project).filter(
                                  (id) => id !== pack.id,
                                )
                              : [...enabledRulePackIds(project), pack.id],
                          ),
                        )
                      }
                    />
                    <span>
                      {pack.id} · version {pack.version}
                      <span className="hint">
                        {pack.jurisdiction.country}
                        {pack.jurisdiction.domain === undefined
                          ? ''
                          : ` · ${pack.jurisdiction.domain}`}{' '}
                        · {pack.rules.length} règle(s)
                      </span>
                      <span className="hint">{applicability}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="notice">
            Un référentiel dit ce qu’il vérifie et sur quel texte. Activer un
            référentiel exécute ses règles ; cela ne délivre aucune attestation
            de conformité, et une règle dont la preuve manque au projet répond «
            non vérifiable » plutôt que « conforme ».
          </p>
        </section>

        <section>
          <h3>Réglages de calcul</h3>
          <div className="tool-group">
            <div className="field">
              <label htmlFor="settings-module">Module</label>
              <select
                id="settings-module"
                value={descriptor.moduleId}
                onChange={(event) => setModuleId(event.target.value)}
              >
                {MODULE_SETTINGS.map((entry) => (
                  <option key={entry.moduleId} value={entry.moduleId}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="hint">
              Méthode :{' '}
              {project.calculationSettings?.[descriptor.moduleId]?.methodId ??
                moduleContract(descriptor.moduleId)?.methodId ??
                'non déclarée'}
            </p>
          </div>

          {descriptor.fields.length === 0 && (
            <p className="notice">
              {descriptor.note ??
                'Ce module ne lit aucun réglage : ses entrées viennent entièrement du projet.'}
            </p>
          )}
          <div className="tool-group">
            {descriptor.fields.map((field) =>
              field.kind === 'BOOLEAN' ? (
                <div className="field" key={field.key}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={flagValue(settings, field.key)}
                      onChange={(event) =>
                        writeSettings(
                          withFlag(settings, field.key, event.target.checked),
                        )
                      }
                    />
                    <span>{field.label}</span>
                  </label>
                  {field.hint !== undefined && (
                    <p className="hint">{field.hint}</p>
                  )}
                </div>
              ) : (
                <TextField
                  key={field.key}
                  id={`setting-${field.key}`}
                  label={field.label}
                  {...(field.unit === undefined ? {} : { unit: field.unit })}
                  {...(field.hint === undefined ? {} : { hint: field.hint })}
                  numeric={field.kind === 'NUMBER'}
                  value={fieldValue(settings, field.key)}
                  onCommit={(value) =>
                    writeSettings(
                      withField(
                        settings,
                        field.key,
                        value,
                        field.kind === 'NUMBER',
                      ),
                    )
                  }
                />
              ),
            )}
          </div>

          {(descriptor.numberChoices ?? []).map((choice) => (
            <fieldset className="tool-group choice-group" key={choice.key}>
              <legend>
                {choice.label} <small>({choice.unit})</small>
              </legend>
              {choice.options.map((option) => (
                <label className="checkbox" key={option}>
                  <input
                    type="checkbox"
                    checked={chosenNumbers(settings, choice.key).includes(
                      option,
                    )}
                    onChange={(event) =>
                      writeSettings(
                        withNumberChoice(
                          settings,
                          choice.key,
                          option,
                          event.target.checked,
                        ),
                      )
                    }
                  />
                  {option} {choice.unit}
                </label>
              ))}
              {choice.hint !== undefined && (
                <p className="hint">{choice.hint}</p>
              )}
            </fieldset>
          ))}

          {(descriptor.keyedTables ?? []).map((table) => (
            <div className="tool-group" key={table.key}>
              <p className="hint">
                {table.label} <small>({table.unit})</small>
              </p>
              {table.rows.map((row) => (
                <TextField
                  key={row.key}
                  id={`setting-${table.key}-${row.key}`}
                  label={row.label}
                  numeric
                  value={materialValue(settings, table.key, row.key)}
                  onCommit={(value) =>
                    writeSettings(
                      withMaterialValue(settings, table.key, row.key, value),
                    )
                  }
                />
              ))}
            </div>
          ))}

          {descriptor.materialTables !== undefined && (
            <div className="table-scroll">
              <table className="library-table">
                <caption className="visually-hidden">
                  Réglages saisis matériau par matériau
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Matériau</th>
                    {descriptor.materialTables.map((table) => (
                      <th key={table.key} scope="col">
                        {table.label} <small>({table.unit})</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => (
                    <tr key={material.id}>
                      <th scope="row">{material.name}</th>
                      {descriptor.materialTables!.map((table) => (
                        <td key={table.key}>
                          <TextField
                            id={`setting-${table.key}-${material.id}`}
                            label={`${table.label} — ${material.name}`}
                            numeric
                            value={materialValue(
                              settings,
                              table.key,
                              material.id,
                            )}
                            onCommit={(value) =>
                              writeSettings(
                                withMaterialValue(
                                  settings,
                                  table.key,
                                  material.id,
                                  value,
                                ),
                              )
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {materials.length === 0 && (
                    <tr>
                      <td colSpan={1 + descriptor.materialTables.length}>
                        Ce projet ne contient aucun matériau.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="notice">
            Un champ vidé est retiré des réglages : le module signale alors une
            entrée manquante, plutôt que de calculer avec une valeur que
            personne n’a choisie.
          </p>
        </section>
      </div>
    </section>
  );
}
