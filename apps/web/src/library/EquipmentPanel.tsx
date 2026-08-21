import { useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import {
  genericEquipmentCatalog,
  queryEquipment,
} from '@house-technical-designer/equipment-catalog';
import {
  AddEquipmentCommand,
  RemoveEquipmentCommand,
  UpdateEquipmentCommand,
  nodesUsingEquipment,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import { family } from '@house-technical-designer/catalog-registry';
import type { HostType } from '@house-technical-designer/core-domain';
import { isHostType } from '@house-technical-designer/core-domain';
import { projectEquipmentFromCatalog } from './library-model.js';
import { DraftField } from '../DraftField.js';
import {
  describeProperties,
  invariantIssues,
  propertyIssue,
  withProperty,
} from './property-schema.js';

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  HEAT_PUMP: 'Pompe à chaleur',
  BOILER: 'Chaudière',
  RADIATOR: 'Émetteur',
  UNDERFLOOR_HEATING: 'Plancher chauffant',
  DHW_TANK: 'Ballon ECS',
  VENTILATION_UNIT: 'Centrale de ventilation',
  AIR_TERMINAL: 'Bouche',
  FAN: 'Ventilateur',
  PUMP: 'Pompe',
  PV_MODULE: 'Module photovoltaïque',
  INVERTER: 'Onduleur',
  BATTERY: 'Batterie',
  LUMINAIRE: 'Luminaire',
  SOCKET: 'Prise',
  DISTRIBUTION_BOARD: 'Tableau',
  PROTECTION_DEVICE: 'Protection',
  SANITARY_FIXTURE: 'Appareil sanitaire',
  RAINWATER_TANK: 'Cuve de pluie',
  SENSOR: 'Capteur',
  OTHER: 'Autre',
};

export interface EquipmentPanelProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => void;
  readonly selectedId?: string;
  readonly onSelect: (equipmentId: string | undefined) => void;
  readonly onMessage: (message: string) => void;
}

/**
 * What the nomenclature says a thing of this family may be fixed to.
 *
 * Copied into the project with the entry rather than looked up later: the
 * editor, the importer and the checks all have to answer alike, and they can
 * only do that from something the file itself carries.
 */
function allowedHostsOfFamily(
  familyId: string,
): readonly HostType[] | undefined {
  const hosts = family(familyId)?.placement?.allowedHosts;
  return hosts === undefined ? undefined : hosts.filter(isHostType);
}

export function EquipmentPanel({
  project,
  onMessage,
  onCommand,
  selectedId,
  onSelect,
}: EquipmentPanelProps) {
  const [search, setSearch] = useState('');
  const catalog = useMemo(() => genericEquipmentCatalog(), []);
  const matches = useMemo(
    () => queryEquipment(catalog, search === '' ? {} : { search }),
    [catalog, search],
  );
  const equipment = project.equipment ?? [];
  const takenIds = equipment.map(({ id }) => id);
  const selected = equipment.find(({ id }) => id === selectedId);

  return (
    <section className="library-panel" aria-labelledby="equipment-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Bibliothèque</p>
          <h2 id="equipment-heading">Équipements</h2>
        </div>
      </header>

      <div className="filters" role="search">
        <label>
          Rechercher dans le catalogue générique
          <input
            type="search"
            value={search}
            placeholder="Pompe, VMC, ballon, luminaire…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="library-split">
        <div>
          <h3>Catalogue générique</h3>
          <ul className="catalog-list">
            {matches.map((definition) => (
              <li key={definition.id}>
                <div>
                  <strong>{definition.name}</strong>
                  <span className="hint">
                    {CATEGORY_LABELS[definition.category] ??
                      definition.category}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const added = projectEquipmentFromCatalog(
                      definition,
                      takenIds,
                      allowedHostsOfFamily(definition.familyId),
                      family(definition.familyId)?.clearances,
                    );
                    onCommand(new AddEquipmentCommand(added));
                    onSelect(added.id);
                  }}
                >
                  Ajouter au projet
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="empty-state">
                Aucun équipement générique trouvé.
              </li>
            )}
          </ul>
          <p className="notice">
            Les valeurs du catalogue générique servent au dimensionnement
            préliminaire. Elles ne sont pas des données fabricant : un produit
            réel doit être saisi avec sa propre documentation.
          </p>
        </div>

        <div>
          <h3>Équipements du projet</h3>
          <ul className="catalog-list">
            {equipment.map((item) => {
              const usedBy = nodesUsingEquipment(project, item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`link${item.id === selectedId ? ' selected' : ''}`}
                    onClick={() => onSelect(item.id)}
                  >
                    {typeof item.properties.name === 'string'
                      ? item.properties.name
                      : item.id}
                  </button>
                  <button
                    type="button"
                    className="icon danger"
                    aria-label={`Supprimer ${item.id}`}
                    disabled={usedBy.length > 0}
                    title={
                      usedBy.length === 0
                        ? undefined
                        : `Posé sur : ${usedBy.map(({ name }) => name).join(', ')}`
                    }
                    onClick={() => {
                      onCommand(new RemoveEquipmentCommand(item.id));
                      if (item.id === selectedId) onSelect(undefined);
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
            {equipment.length === 0 && (
              <li className="empty-state">
                Aucun équipement dans ce projet pour l’instant.
              </li>
            )}
          </ul>

          {selected !== undefined && (
            <article className="library-detail">
              <h4>{selected.id}</h4>
              <p className="hint">
                Type {selected.kind} ·{' '}
                {selected.version === undefined
                  ? 'saisie manuelle'
                  : `catalogue ${selected.familyId ?? selected.kind}@${selected.version}`}
              </p>
              {describeProperties(
                Object.fromEntries(
                  Object.entries(selected.properties).filter(
                    ([key]) => !key.startsWith('catalogDefinition'),
                  ),
                ),
              ).map(({ group, entries }) => (
                <section key={group} className="property-group">
                  <h4>{group}</h4>
                  {entries.map(({ descriptor, value }) => (
                    <DraftField
                      key={descriptor.key}
                      id={`equipment-${selected.id}-${descriptor.key}`}
                      label={descriptor.label}
                      kind={descriptor.kind}
                      value={
                        typeof value === 'number' ||
                        typeof value === 'string' ||
                        typeof value === 'boolean'
                          ? value
                          : undefined
                      }
                      {...(descriptor.unit === undefined
                        ? {}
                        : { unit: descriptor.unit })}
                      {...(descriptor.hint === undefined
                        ? {}
                        : { hint: descriptor.hint })}
                      {...(descriptor.min === undefined
                        ? {}
                        : { min: descriptor.min })}
                      {...(descriptor.max === undefined
                        ? {}
                        : { max: descriptor.max })}
                      onCommit={(raw) => {
                        const properties = withProperty(
                          selected.properties,
                          descriptor,
                          raw,
                        );
                        if (properties === undefined) {
                          onMessage(
                            `${descriptor.label} : valeur non reconnue, la propriété n'a pas été modifiée.`,
                          );
                          return;
                        }
                        const issue = propertyIssue(
                          selected.properties,
                          descriptor,
                          properties,
                        );
                        if (issue !== undefined) {
                          onMessage(issue);
                          return;
                        }
                        onCommand(
                          new UpdateEquipmentCommand({
                            ...selected,
                            properties,
                          }),
                        );
                      }}
                    />
                  ))}
                </section>
              ))}
              {invariantIssues(selected.properties).map((issue) => (
                <p className="notice warning" key={issue}>
                  {issue}
                </p>
              ))}
              <p className="notice">
                Un champ vidé retire la propriété : le calcul signale alors une
                donnée manquante plutôt que de travailler avec une valeur que
                personne n'a choisie.
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
