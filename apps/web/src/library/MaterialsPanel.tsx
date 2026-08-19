import { useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type {
  Material,
  MaterialKind,
} from '@house-technical-designer/materials';
import {
  createCustomMaterialFromDraft,
  genericMaterialCatalog,
  materialId as toMaterialId,
} from '@house-technical-designer/materials';
import {
  AddMaterialCommand,
  ImportMaterialsCommand,
  RemoveMaterialCommand,
  UpdateMaterialCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  MATERIAL_PROPERTY_FIELDS,
  duplicateMaterialDraft,
  materialCategories,
  materialRows,
  nextLibraryId,
} from './library-model.js';

const KINDS: readonly MaterialKind[] = ['GENERIC', 'PRODUCT', 'CUSTOM'];

const KIND_LABELS: Readonly<Record<MaterialKind, string>> = {
  GENERIC: 'Générique',
  PRODUCT: 'Produit',
  CUSTOM: 'Personnalisé',
};

export interface MaterialsPanelProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => void;
  readonly selectedId?: string;
  readonly onSelect: (materialId: string | undefined) => void;
}

export function MaterialsPanel({
  project,
  onCommand,
  selectedId,
  onSelect,
}: MaterialsPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState('');
  const [incompleteOnly, setIncompleteOnly] = useState(false);

  const rows = useMemo(
    () =>
      materialRows(project, {
        ...(search === '' ? {} : { search }),
        ...(category === '' ? {} : { categories: [category] }),
        ...(kind === '' ? {} : { kinds: [kind as MaterialKind] }),
        missingPropertiesOnly: incompleteOnly,
      }),
    [project, search, category, kind, incompleteOnly],
  );
  const categories = useMemo(() => materialCategories(project), [project]);
  const takenIds = useMemo(
    () => (project.materialLibrary?.materials ?? []).map(({ id }) => id),
    [project],
  );
  const selected = rows.find(({ material }) => material.id === selectedId);
  const catalogueMissing = useMemo(() => {
    const known = new Set(takenIds);
    return genericMaterialCatalog().filter(({ id }) => !known.has(id));
  }, [takenIds]);

  function createMaterial(): void {
    const name = 'Nouveau matériau';
    const draft = createCustomMaterialFromDraft({
      id: toMaterialId(nextLibraryId('material', name, takenIds)),
      name,
      category: 'CUSTOM',
      properties: {},
    });
    if (draft.status !== 'OK') return;
    onCommand(new AddMaterialCommand(draft.material));
    onSelect(draft.material.id);
  }

  function duplicate(material: Material): void {
    const copy = duplicateMaterialDraft(material, takenIds);
    onCommand(new AddMaterialCommand(copy));
    onSelect(copy.id);
  }

  return (
    <section className="library-panel" aria-labelledby="materials-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Bibliothèque</p>
          <h2 id="materials-heading">Matériaux</h2>
        </div>
        <div className="actions">
          {catalogueMissing.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() =>
                onCommand(new ImportMaterialsCommand(catalogueMissing))
              }
            >
              Importer le catalogue générique ({catalogueMissing.length})
            </button>
          )}
          <button type="button" onClick={createMaterial}>
            Nouveau matériau
          </button>
        </div>
      </header>

      <div className="filters" role="search">
        <label>
          Rechercher
          <input
            type="search"
            value={search}
            placeholder="Nom, identifiant, fabricant"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Catégorie
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Toutes</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="">Tous</option>
            {KINDS.map((entry) => (
              <option key={entry} value={entry}>
                {KIND_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={incompleteOnly}
            onChange={(event) => setIncompleteOnly(event.target.checked)}
          />
          Données manquantes uniquement
        </label>
      </div>

      <div className="library-split">
        <table className="library-table">
          <caption className="visually-hidden">
            {rows.length} matériau(x) dans la bibliothèque du projet
          </caption>
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Type</th>
              <th scope="col">λ (W/m·K)</th>
              <th scope="col">Manques</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ material, missingProperties }) => (
              <tr
                key={material.id}
                aria-selected={material.id === selectedId}
                className={material.id === selectedId ? 'selected' : undefined}
              >
                <th scope="row">
                  <button
                    type="button"
                    className="link"
                    onClick={() => onSelect(material.id)}
                  >
                    {material.name}
                  </button>
                  <span className="hint">{material.id}</span>
                </th>
                <td>
                  <span className={`badge kind-${material.kind.toLowerCase()}`}>
                    {KIND_LABELS[material.kind]}
                  </span>
                </td>
                <td>
                  {typeof material.properties.lambdaWmK === 'number'
                    ? material.properties.lambdaWmK.toFixed(3)
                    : '—'}
                </td>
                <td>
                  {missingProperties.length === 0 ? (
                    <span className="badge complete">complet</span>
                  ) : (
                    <span className="badge missing">
                      {missingProperties.length} propriété(s)
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>Aucun matériau ne correspond à ce filtre.</td>
              </tr>
            )}
          </tbody>
        </table>

        {selected === undefined ? (
          <p className="empty-state">
            Sélectionnez un matériau pour voir et modifier ses propriétés.
          </p>
        ) : (
          <MaterialDetail
            row={selected}
            onCommand={onCommand}
            onDuplicate={() => duplicate(selected.material)}
            onDelete={() => {
              onCommand(new RemoveMaterialCommand(selected.material.id));
              onSelect(undefined);
            }}
          />
        )}
      </div>
    </section>
  );
}

interface MaterialDetailProps {
  readonly row: ReturnType<typeof materialRows>[number];
  readonly onCommand: (command: ProjectCommand) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

function MaterialDetail({
  row,
  onCommand,
  onDuplicate,
  onDelete,
}: MaterialDetailProps) {
  const { material, missingProperties, usedBy, deletable } = row;
  const sourceByProperty = new Map(
    (material.sources ?? []).map((source) => [source.property, source]),
  );

  function update(next: Material): void {
    onCommand(new UpdateMaterialCommand(next));
  }

  const groups = [
    ...new Set(MATERIAL_PROPERTY_FIELDS.map(({ group }) => group)),
  ];

  return (
    <article className="library-detail">
      <header>
        <label className="detail-name">
          Nom
          <input
            value={material.name}
            onChange={(event) =>
              update({ ...material, name: event.target.value })
            }
          />
        </label>
        <div className="actions">
          <button type="button" className="secondary" onClick={onDuplicate}>
            Dupliquer
          </button>
          <button
            type="button"
            className="danger"
            onClick={onDelete}
            disabled={!deletable}
            title={
              deletable
                ? undefined
                : `Utilisé par : ${usedBy.map(({ name }) => name).join(', ')}`
            }
          >
            Supprimer
          </button>
        </div>
      </header>

      <div className="detail-grid">
        <label>
          Catégorie
          <input
            value={material.category ?? ''}
            onChange={(event) =>
              update({ ...material, category: event.target.value })
            }
          />
        </label>
        <label>
          Fabricant
          <input
            value={material.manufacturer ?? ''}
            placeholder="Aucun (donnée générique)"
            onChange={(event) =>
              update({ ...material, manufacturer: event.target.value })
            }
          />
        </label>
      </div>

      {usedBy.length > 0 && (
        <p className="notice">
          Utilisé par {usedBy.length} assemblage(s) :{' '}
          {usedBy.map(({ name }) => name).join(', ')}. La suppression est
          bloquée tant qu’une référence subsiste.
        </p>
      )}

      {groups.map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {MATERIAL_PROPERTY_FIELDS.filter(
            (field) => field.group === group,
          ).map((field) => {
            const value = material.properties[field.key];
            const source = sourceByProperty.get(field.key);
            return (
              <label key={field.key} className="property-row">
                <span>
                  {field.label} <em>{field.unit}</em>
                </span>
                <input
                  type="number"
                  step="any"
                  value={typeof value === 'number' ? value : ''}
                  placeholder="inconnu"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const properties = { ...material.properties };
                    if (raw === '') delete properties[field.key];
                    else properties[field.key] = Number(raw);
                    update({ ...material, properties });
                  }}
                />
                <small className="provenance">
                  {source === undefined
                    ? 'Sans provenance déclarée'
                    : `${source.sourceType} — ${source.reference ?? 'sans référence'}`}
                </small>
              </label>
            );
          })}
        </fieldset>
      ))}

      {missingProperties.length > 0 && (
        <p className="notice warning">
          Propriétés inconnues : {missingProperties.join(', ')}. Les modules qui
          en dépendent signaleront une donnée manquante plutôt que de supposer
          une valeur.
        </p>
      )}
    </article>
  );
}
