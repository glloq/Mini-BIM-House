import { useMemo, useState } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import type {
  Assembly,
  AssemblyCategory,
  LayerRole,
} from '@house-technical-designer/assemblies';
import { materialId as toMaterialId } from '@house-technical-designer/materials';
import {
  AddAssemblyCommand,
  RemoveAssemblyCommand,
  UpdateAssemblyCommand,
  addAssemblyLayerCommand,
  draftAssembly,
  draftAssemblyLayer,
  moveAssemblyLayerCommand,
  removeAssemblyLayerCommand,
  setAssemblyLayerMaterialCommand,
  setAssemblyLayerThicknessCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  PREVIEW_SURFACE_RESISTANCES,
  assemblyViews,
  nextLibraryId,
  type AssemblyView,
} from './library-model.js';
import { DraftField } from '../DraftField.js';

const CATEGORIES: readonly AssemblyCategory[] = [
  'WALL',
  'ROOF',
  'FLOOR',
  'CEILING',
  'PARTITION',
  'OTHER',
];

const CATEGORY_LABELS: Readonly<Record<AssemblyCategory, string>> = {
  WALL: 'Mur',
  ROOF: 'Toiture',
  FLOOR: 'Plancher',
  CEILING: 'Plafond',
  PARTITION: 'Cloison',
  OTHER: 'Autre',
};

const ROLES: readonly LayerRole[] = [
  'FINISH',
  'STRUCTURAL',
  'INSULATION',
  'MEMBRANE',
  'SERVICE_CAVITY',
  'AIR_GAP',
  'CLADDING',
  'WATERPROOFING',
  'OTHER',
];

const ROLE_LABELS: Readonly<Record<LayerRole, string>> = {
  FINISH: 'Finition',
  STRUCTURAL: 'Structure',
  INSULATION: 'Isolation',
  MEMBRANE: 'Membrane',
  SERVICE_CAVITY: 'Vide technique',
  AIR_GAP: 'Lame d’air',
  CLADDING: 'Bardage',
  WATERPROOFING: 'Étanchéité',
  OTHER: 'Autre',
};

/** Fill used by the layer preview, keyed by the layer's construction role. */
const ROLE_FILL: Readonly<Record<string, string>> = {
  FINISH: '#d9e2e6',
  STRUCTURAL: '#9fb0b8',
  INSULATION: '#f2d492',
  MEMBRANE: '#b9a7d6',
  SERVICE_CAVITY: '#e6e6e6',
  AIR_GAP: '#eef4f7',
  CLADDING: '#a4bfa1',
  WATERPROOFING: '#8fb3c9',
  OTHER: '#cfd6d9',
};

export interface AssembliesPanelProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => void;
  readonly selectedId?: string;
  readonly onSelect: (assemblyId: string | undefined) => void;
}

export function AssembliesPanel({
  project,
  onCommand,
  selectedId,
  onSelect,
}: AssembliesPanelProps) {
  const [category, setCategory] = useState('');
  const views = useMemo(() => assemblyViews(project), [project]);
  const filtered = views.filter(
    ({ assembly }) => category === '' || assembly.category === category,
  );
  const selected = views.find(({ assembly }) => assembly.id === selectedId);
  const takenIds = (project.assemblies ?? []).map(({ id }) => id);
  const materials = project.materialLibrary?.materials ?? [];

  function createAssembly(): void {
    const name = 'Nouvel assemblage';
    const firstMaterial = materials[0];
    if (firstMaterial === undefined) return;
    const id = nextLibraryId('assembly', name, takenIds);
    const assembly = draftAssembly(id, name, 'WALL', [
      draftAssemblyLayer(`${id}-layer-1`, firstMaterial.id, 100, 'STRUCTURAL'),
    ]);
    onCommand(new AddAssemblyCommand(assembly));
    onSelect(assembly.id);
  }

  function duplicate(assembly: Assembly): void {
    const name = `${assembly.name} (copie)`;
    const id = nextLibraryId('assembly', name, takenIds);
    const copy = draftAssembly(
      id,
      name,
      assembly.category,
      assembly.layers.map((layer, index) => ({
        ...layer,
        id: `${id}-layer-${index + 1}` as typeof layer.id,
      })),
    );
    onCommand(new AddAssemblyCommand(copy));
    onSelect(copy.id);
  }

  return (
    <section className="library-panel" aria-labelledby="assemblies-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Bibliothèque</p>
          <h2 id="assemblies-heading">Assemblages</h2>
        </div>
        <div className="actions">
          <button
            type="button"
            onClick={createAssembly}
            disabled={materials.length === 0}
            title={
              materials.length === 0
                ? 'Ajoutez d’abord un matériau à la bibliothèque.'
                : undefined
            }
          >
            Nouvel assemblage
          </button>
        </div>
      </header>

      <div className="filters">
        <label>
          Catégorie
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Toutes</option>
            {CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {CATEGORY_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="library-split">
        <ul className="assembly-list">
          {filtered.map((view) => (
            <li key={view.assembly.id}>
              <button
                type="button"
                className={`assembly-card${view.assembly.id === selectedId ? ' selected' : ''}`}
                aria-pressed={view.assembly.id === selectedId}
                onClick={() => onSelect(view.assembly.id)}
              >
                <strong>{view.assembly.name}</strong>
                <span className="hint">
                  {CATEGORY_LABELS[view.assembly.category]} ·{' '}
                  {view.totalThicknessMm} mm
                </span>
                <AssemblyPreview view={view} />
                <span className="hint">
                  {view.thermalResistanceM2KW === undefined
                    ? 'R inconnu'
                    : `R ${view.thermalResistanceM2KW.toFixed(2)} m²·K/W`}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="empty-state">
              Aucun assemblage dans cette catégorie.
            </li>
          )}
        </ul>

        {selected === undefined ? (
          <p className="empty-state">
            Sélectionnez un assemblage pour composer ses couches.
          </p>
        ) : (
          <AssemblyDetail
            view={selected}
            project={project}
            onCommand={onCommand}
            onDuplicate={() => duplicate(selected.assembly)}
            onDelete={() => {
              onCommand(new RemoveAssemblyCommand(selected.assembly.id));
              onSelect(undefined);
            }}
          />
        )}
      </div>
    </section>
  );
}

function AssemblyPreview({ view }: { readonly view: AssemblyView }) {
  return (
    <span
      className="assembly-preview"
      role="img"
      aria-label={`Coupe : ${view.layers
        .map(
          ({ materialName, thicknessMm }) =>
            `${materialName} ${thicknessMm} mm`,
        )
        .join(', ')}`}
    >
      {view.layers.map((layer) => (
        <span
          key={layer.layer.id}
          className="assembly-preview-layer"
          style={{
            flexGrow: layer.thicknessRatio,
            backgroundColor: ROLE_FILL[layer.layer.role ?? 'OTHER'],
          }}
        />
      ))}
    </span>
  );
}

interface AssemblyDetailProps {
  readonly view: AssemblyView;
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => void;
  readonly onDuplicate: () => void;
  readonly onDelete: () => void;
}

function AssemblyDetail({
  view,
  project,
  onCommand,
  onDuplicate,
  onDelete,
}: AssemblyDetailProps) {
  const { assembly, layers, usedBy, deletable } = view;
  const materials = project.materialLibrary?.materials ?? [];

  function addLayer(): void {
    const material = materials[0];
    if (material === undefined) return;
    onCommand(
      addAssemblyLayerCommand(
        assembly.id,
        draftAssemblyLayer(
          `${assembly.id}-layer-${assembly.layers.length + 1}-${assembly.layers.length}`,
          material.id,
          50,
          'OTHER',
        ),
      ),
    );
  }

  return (
    <article className="library-detail">
      <header>
        <div className="detail-name">
          <DraftField
            id={`assembly-${assembly.id}-name`}
            label="Nom"
            kind="TEXT"
            value={assembly.name}
            onCommit={(name) =>
              name.trim() === ''
                ? undefined
                : onCommand(new UpdateAssemblyCommand({ ...assembly, name }))
            }
          />
        </div>
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
          <select
            value={assembly.category}
            onChange={(event) =>
              onCommand(
                new UpdateAssemblyCommand({
                  ...assembly,
                  category: event.target.value as AssemblyCategory,
                }),
              )
            }
          >
            {CATEGORIES.map((entry) => (
              <option key={entry} value={entry}>
                {CATEGORY_LABELS[entry]}
              </option>
            ))}
          </select>
        </label>
        <dl className="metrics compact">
          <div>
            <dt>Épaisseur totale</dt>
            <dd>{view.totalThicknessMm} mm</dd>
          </div>
          <div>
            <dt>Résistance R</dt>
            <dd>
              {view.thermalResistanceM2KW === undefined
                ? 'inconnue'
                : `${view.thermalResistanceM2KW.toFixed(2)} m²·K/W`}
            </dd>
          </div>
          <div>
            <dt>Transmission U</dt>
            <dd>
              {view.uValueWm2K === undefined
                ? 'inconnue'
                : `${view.uValueWm2K.toFixed(3)} W/(m²·K)`}
            </dd>
          </div>
        </dl>
      </div>

      <p className="hint">
        Aperçu calculé avec Rsi{' '}
        {PREVIEW_SURFACE_RESISTANCES.insideSurfaceResistanceM2KW} et Rse{' '}
        {PREVIEW_SURFACE_RESISTANCES.outsideSurfaceResistanceM2KW} m²·K/W (
        {PREVIEW_SURFACE_RESISTANCES.reference}). Le calcul d’enveloppe utilise
        les réglages du module thermique du projet.
      </p>

      <table className="library-table">
        <caption className="visually-hidden">
          Couches de l’assemblage, de l’extérieur vers l’intérieur
        </caption>
        <thead>
          <tr>
            <th scope="col">Matériau</th>
            <th scope="col">Épaisseur (mm)</th>
            <th scope="col">Rôle</th>
            <th scope="col">R (m²·K/W)</th>
            <th scope="col">Ordre</th>
          </tr>
        </thead>
        <tbody>
          {layers.map((layer, index) => (
            <tr key={layer.layer.id}>
              <td>
                <select
                  aria-label={`Matériau de la couche ${index + 1}`}
                  value={layer.layer.materialId}
                  onChange={(event) =>
                    onCommand(
                      setAssemblyLayerMaterialCommand(
                        assembly.id,
                        layer.layer.id,
                        toMaterialId(event.target.value),
                      ),
                    )
                  }
                >
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <DraftField
                  id={`assembly-${assembly.id}-layer-${layer.layer.id}`}
                  label={`Épaisseur de la couche ${index + 1}`}
                  unit="mm"
                  kind="NUMBER"
                  min={1}
                  value={layer.thicknessMm}
                  onCommit={(raw) => {
                    const thicknessMm = Number(raw.replace(',', '.'));
                    if (!Number.isFinite(thicknessMm)) return;
                    onCommand(
                      setAssemblyLayerThicknessCommand(
                        assembly.id,
                        layer.layer.id,
                        thicknessMm,
                      ),
                    );
                  }}
                />
              </td>
              <td>
                <select
                  aria-label={`Rôle de la couche ${index + 1}`}
                  value={layer.layer.role ?? 'OTHER'}
                  onChange={(event) =>
                    onCommand(
                      new UpdateAssemblyCommand({
                        ...assembly,
                        layers: assembly.layers.map((entry) =>
                          entry.id === layer.layer.id
                            ? {
                                ...entry,
                                role: event.target.value as LayerRole,
                              }
                            : entry,
                        ),
                      }),
                    )
                  }
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {layer.resistanceM2KW === undefined ? (
                  <span className="badge missing">λ inconnu</span>
                ) : (
                  layer.resistanceM2KW.toFixed(2)
                )}
              </td>
              <td className="row-actions">
                <button
                  type="button"
                  className="icon"
                  aria-label={`Monter la couche ${index + 1}`}
                  disabled={index === 0}
                  onClick={() =>
                    onCommand(
                      moveAssemblyLayerCommand(assembly.id, layer.layer.id, -1),
                    )
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon"
                  aria-label={`Descendre la couche ${index + 1}`}
                  disabled={index === layers.length - 1}
                  onClick={() =>
                    onCommand(
                      moveAssemblyLayerCommand(assembly.id, layer.layer.id, 1),
                    )
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Retirer la couche ${index + 1}`}
                  disabled={layers.length === 1}
                  onClick={() =>
                    onCommand(
                      removeAssemblyLayerCommand(assembly.id, layer.layer.id),
                    )
                  }
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" className="secondary" onClick={addLayer}>
        Ajouter une couche
      </button>

      {view.missingConductivityLayerIds.length > 0 && (
        <p className="notice warning">
          {view.missingConductivityLayerIds.length} couche(s) sans conductivité
          déclarée : R et U restent inconnus tant que le matériau ne porte pas
          de valeur λ.
        </p>
      )}
    </article>
  );
}
