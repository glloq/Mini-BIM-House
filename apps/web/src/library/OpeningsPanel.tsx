import { useMemo } from 'react';
import type {
  OpeningDefinition,
  Project,
} from '@house-technical-designer/core-domain';
import {
  AddOpeningTypeCommand,
  RemoveOpeningTypeCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  projectOpeningFromCatalog,
  type OpeningDefinition as CatalogOpening,
} from '@house-technical-designer/opening-catalog';
import { CatalogPicker } from '../catalog/CatalogPicker.js';

/**
 * The menuiseries a project holds.
 *
 * The models a window can be had no home. They came with a blank project —
 * all thirty-four of them — and the inspector's dropdown offered whatever
 * happened to be there. Then a project stopped being handed the shelf, and
 * three were left with no way to reach the other thirty-one: the basket had
 * taken options away without giving anything back.
 *
 * A third sibling of the materials and the build-ups, then, and not a fourth
 * level of density: the same shape, the same picker, the same rule that a
 * fiche enters a project because somebody chose it.
 */
export interface OpeningsPanelProps {
  readonly project: Project;
  readonly onCommand: (command: ProjectCommand) => void;
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  WINDOW: 'Fenêtre',
  DOOR: 'Porte',
  SOLAR_PROTECTION: 'Protection solaire',
};

/** What the list shows of a menuiserie, which is what decides a choice. */
function summaryOf(opening: OpeningDefinition): string {
  const held = opening.properties ?? {};
  const parts: string[] = [];
  const width = held['width'];
  const height = held['height'];
  if (typeof width === 'number' && typeof height === 'number')
    parts.push(`${width} × ${height} mm`);
  const uw = held['uw'];
  if (typeof uw === 'number') parts.push(`Uw ${uw} W/(m²·K)`);
  const solar = held['gValue'];
  if (typeof solar === 'number') parts.push(`g ${solar}`);
  const acoustic = held['rw'];
  if (typeof acoustic === 'number') parts.push(`Rw ${acoustic} dB`);
  // Nothing invented when nothing is stated: an empty line says « personne
  // ne l'a dit », a zero would say « c'est nul ».
  return parts.join(' · ');
}

export function OpeningsPanel({ project, onCommand }: OpeningsPanelProps) {
  const held = useMemo(() => project.openingTypes ?? [], [project]);
  const taken = useMemo(() => new Set(held.map(({ id }) => id)), [held]);
  const used = useMemo(() => {
    const seen = new Set<string>();
    for (const level of project.building.levels)
      for (const opening of level.openings)
        if (opening.definitionId !== undefined) seen.add(opening.definitionId);
    return seen;
  }, [project]);

  return (
    <section className="library-panel" aria-labelledby="openings-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Bibliothèque</p>
          <h2 id="openings-heading">Menuiseries</h2>
        </div>
        <div className="actions">
          <CatalogPicker
            registry="OPENING"
            taken={taken}
            label="Ajouter depuis le catalogue"
            onPick={(_summary, body) => {
              onCommand(
                new AddOpeningTypeCommand(
                  projectOpeningFromCatalog(body as CatalogOpening),
                ),
              );
            }}
          />
        </div>
      </header>

      <table className="library-table">
        <caption className="visually-hidden">
          Les menuiseries que ce projet porte
        </caption>
        <thead>
          <tr>
            <th scope="col">Modèle</th>
            <th scope="col">Catégorie</th>
            <th scope="col">Performances déclarées</th>
            <th scope="col">Posée</th>
            <th scope="col">
              <span className="visually-hidden">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {held.map((opening) => (
            <tr key={opening.id}>
              <td>{opening.name}</td>
              <td>{CATEGORY_LABELS[opening.category] ?? opening.category}</td>
              <td>{summaryOf(opening)}</td>
              <td>{used.has(opening.id) ? 'oui' : '—'}</td>
              <td>
                <button
                  type="button"
                  className="secondary"
                  // A model a window is drawn with cannot be removed: the
                  // command refuses it, and offering the button anyway would
                  // be offering a refusal.
                  disabled={used.has(opening.id)}
                  onClick={() => {
                    onCommand(new RemoveOpeningTypeCommand(opening.id));
                  }}
                >
                  Retirer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {held.length === 0 && (
        <p className="panel-empty">
          Aucune menuiserie. Ajoutez-en une depuis le catalogue pour pouvoir la
          poser dans un mur.
        </p>
      )}
    </section>
  );
}
