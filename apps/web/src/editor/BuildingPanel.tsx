import { useMemo, useState } from 'react';
import type { Project, ZoneType } from '@house-technical-designer/core-domain';
import { ZONE_TYPES } from '@house-technical-designer/core-domain';
import {
  AddLevelCommand,
  AddRoofCommand,
  AddSlabCommand,
  AddSpaceCommand,
  AddZoneCommand,
  DuplicateLevelCommand,
  RemoveLevelCommand,
  RemoveRoofCommand,
  RemoveSlabCommand,
  RemoveSpaceCommand,
  RemoveZoneCommand,
  SetZoneMembershipCommand,
  UpdateLevelCommand,
  UpdateSpaceCommand,
  UpdateZoneCommand,
  detectRooms,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import { nextLibraryId } from '../library/library-model.js';
import { DraftField } from '../DraftField.js';

/** What each kind of zone groups rooms for. */
const ZONE_TYPE_LABELS: Readonly<Record<ZoneType, string>> = {
  THERMAL: 'Thermique',
  VENTILATION: 'Ventilation',
  ELECTRICAL: 'Électricité',
  ACOUSTIC: 'Acoustique',
  LIGHTING: 'Éclairage',
  FIRE: 'Incendie',
  WATER: 'Eau',
  SECURITY: 'Sécurité',
  CUSTOM: 'Autre',
};

/** Room categories offered when a detected boundary becomes a space. */
const SPACE_CATEGORIES = [
  'LIVING',
  'KITCHEN',
  'BEDROOM',
  'BATHROOM',
  'WC',
  'HALL',
  'CORRIDOR',
  'GARAGE',
  'STORAGE',
  'TECHNICAL',
  'OTHER',
] as const;

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  LIVING: 'Séjour',
  KITCHEN: 'Cuisine',
  BEDROOM: 'Chambre',
  BATHROOM: 'Salle de bains',
  WC: 'WC',
  HALL: 'Entrée',
  CORRIDOR: 'Dégagement',
  GARAGE: 'Garage',
  STORAGE: 'Cellier',
  TECHNICAL: 'Local technique',
  OTHER: 'Autre',
};

export interface BuildingPanelProps {
  readonly project: Project;
  readonly levelId: string | undefined;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onSelectLevel: (levelId: string) => void;
  /** Selects objects on the plan, where their handles can be dragged. */
  readonly onSelectObjects?: (objectIds: readonly string[]) => void;
}

export function BuildingPanel({
  project,
  levelId,
  onCommand,
  onSelectLevel,
  onSelectObjects,
}: BuildingPanelProps) {
  const levels = project.building.levels;
  const level = levels.find(({ id }) => id === levelId) ?? levels[0];
  const [category, setCategory] = useState<string>('LIVING');
  const [zoneName, setZoneName] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('THERMAL');
  const zones = project.building.zones;
  // A zone groups rooms wherever they are: a heated volume rarely stops at one
  // storey.
  const allSpaces = project.building.levels.flatMap(({ spaces }) => spaces);
  const rooms = useMemo(
    () => (level === undefined ? [] : detectRooms(project, level.id)),
    [project, level],
  );
  const assemblies = project.assemblies ?? [];
  const floorAssemblies = assemblies.filter(
    ({ category: entry }) => entry === 'FLOOR' || entry === 'CEILING',
  );
  const roofAssemblies = assemblies.filter(
    ({ category: entry }) => entry === 'ROOF' || entry === 'FLOOR',
  );
  const [slabAssemblyId, setSlabAssemblyId] = useState(
    () => floorAssemblies[0]?.id ?? '',
  );
  const [roofAssemblyId, setRoofAssemblyId] = useState(
    () => roofAssemblies[0]?.id ?? '',
  );
  const [roofSlopeDeg, setRoofSlopeDeg] = useState(30);
  const [contourIndex, setContourIndex] = useState(0);
  const [roofAzimuthDeg, setRoofAzimuthDeg] = useState(180);

  if (level === undefined)
    return <p className="empty-state">Ce projet ne contient aucun niveau.</p>;

  const takenLevelIds = levels.map(({ id }) => id);
  const takenSpaceIds = levels.flatMap(({ spaces }) =>
    spaces.map(({ id }) => id),
  );
  const nextElevationMm = level.elevationMm + level.defaultStoreyHeightMm;
  // Which closed contour a slab or a roof is built from. With several rooms on
  // a level, taking the first one silently would build the ouvrage somewhere
  // the user did not choose.
  const contour = rooms[contourIndex] ?? rooms[0];
  const contourLabel = (index: number): string => {
    const room = rooms[index]!;
    return `Contour ${index + 1} — ${room.areaM2.toFixed(2)} m² · ${room.sourceWallIds.length} murs`;
  };

  return (
    <section className="library-panel" aria-labelledby="building-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Bâtiment</p>
          <h2 id="building-heading">Niveaux, pièces et ouvrages</h2>
        </div>
      </header>

      <div className="library-split">
        <div>
          <h3>Niveaux</h3>
          <table className="library-table">
            <caption className="visually-hidden">
              Niveaux du bâtiment, du plus bas au plus haut
            </caption>
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Altitude (mm)</th>
                <th scope="col">Hauteur (mm)</th>
                <th scope="col">Contenu</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((entry) => (
                <tr
                  key={entry.id}
                  className={entry.id === level.id ? 'selected' : undefined}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="link"
                      onClick={() => onSelectLevel(entry.id)}
                    >
                      Ouvrir
                    </button>
                    <DraftField
                      id={`level-${entry.id}-name`}
                      label={`Nom du niveau ${entry.name}`}
                      kind="TEXT"
                      value={entry.name}
                      onCommit={(name) =>
                        name.trim() === ''
                          ? undefined
                          : onCommand(
                              new UpdateLevelCommand(entry.id, { name }),
                            )
                      }
                    />
                  </th>
                  <td>
                    <DraftField
                      id={`level-${entry.id}-elevation`}
                      label={`Altitude du niveau ${entry.name}`}
                      unit="mm"
                      kind="NUMBER"
                      step={10}
                      value={entry.elevationMm}
                      onCommit={(raw) => {
                        const elevationMm = Number(raw.replace(',', '.'));
                        if (!Number.isFinite(elevationMm)) return;
                        onCommand(
                          new UpdateLevelCommand(entry.id, { elevationMm }),
                        );
                      }}
                    />
                  </td>
                  <td>
                    <DraftField
                      id={`level-${entry.id}-height`}
                      label={`Hauteur d’étage du niveau ${entry.name}`}
                      unit="mm"
                      kind="NUMBER"
                      min={1}
                      step={10}
                      value={entry.defaultStoreyHeightMm}
                      onCommit={(raw) => {
                        const defaultStoreyHeightMm = Number(
                          raw.replace(',', '.'),
                        );
                        if (!Number.isFinite(defaultStoreyHeightMm)) return;
                        onCommand(
                          new UpdateLevelCommand(entry.id, {
                            defaultStoreyHeightMm,
                          }),
                        );
                      }}
                    />
                  </td>
                  <td>
                    {entry.walls.length} murs · {entry.spaces.length} pièces
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="icon"
                      aria-label={`Dupliquer le niveau ${entry.name}`}
                      onClick={() => {
                        const name = `${entry.name} (copie)`;
                        onCommand(
                          new DuplicateLevelCommand(entry.id, {
                            id: nextLibraryId('level', name, takenLevelIds),
                            name,
                            elevationMm:
                              entry.elevationMm + entry.defaultStoreyHeightMm,
                            defaultStoreyHeightMm: entry.defaultStoreyHeightMm,
                          }),
                        );
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      className="icon danger"
                      aria-label={`Supprimer le niveau ${entry.name}`}
                      onClick={() =>
                        onCommand(new RemoveLevelCommand(entry.id))
                      }
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const name = `Niveau ${levels.length + 1}`;
              onCommand(
                new AddLevelCommand({
                  id: nextLibraryId('level', name, takenLevelIds),
                  name,
                  elevationMm: nextElevationMm,
                  defaultStoreyHeightMm: level.defaultStoreyHeightMm,
                }),
              );
            }}
          >
            Ajouter un niveau
          </button>

          <h3>Ouvrages horizontaux</h3>
          <div className="tool-group">
            <div className="field">
              <label htmlFor="building-contour">Contour</label>
              <select
                id="building-contour"
                value={rooms.length === 0 ? '' : String(contourIndex)}
                disabled={rooms.length === 0}
                {...(rooms.length === 0
                  ? {
                      title:
                        'Les murs de ce niveau ne délimitent pas encore de contour fermé.',
                    }
                  : {})}
                onChange={(event) =>
                  setContourIndex(Number(event.target.value))
                }
              >
                {rooms.length === 0 && (
                  <option value="">Aucun contour détecté</option>
                )}
                {rooms.map((room, index) => (
                  <option key={`${room.areaM2}:${index}`} value={String(index)}>
                    {contourLabel(index)}
                  </option>
                ))}
              </select>
            </div>
            <label>
              Assemblage de dalle
              <select
                value={slabAssemblyId}
                onChange={(event) => setSlabAssemblyId(event.target.value)}
              >
                {floorAssemblies.map((assembly) => (
                  <option key={assembly.id} value={assembly.id}>
                    {assembly.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={contour === undefined || slabAssemblyId === ''}
              title={
                rooms.length === 0
                  ? 'Aucun contour fermé détecté sur ce niveau.'
                  : undefined
              }
              onClick={() => {
                const room = contour;
                if (room === undefined) return;
                onCommand(
                  new AddSlabCommand(level.id, {
                    id: nextLibraryId(
                      'slab',
                      `${level.name} dalle`,
                      level.slabs.map(({ id }) => id),
                    ),
                    polygon: room.polygon,
                    assemblyId: slabAssemblyId,
                    role: 'FLOOR',
                    elevationOffsetMm: 0,
                  }),
                );
              }}
            >
              Dalle depuis le contour
            </button>
          </div>
          <ul className="catalog-list">
            {level.slabs.map((slab) => (
              <li key={slab.id}>
                <span>
                  {slab.id}
                  <span className="hint">{slab.role}</span>
                </span>
                {onSelectObjects !== undefined && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => onSelectObjects([slab.id])}
                  >
                    Modifier le contour
                  </button>
                )}
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Supprimer la dalle ${slab.id}`}
                  onClick={() =>
                    onCommand(new RemoveSlabCommand(level.id, slab.id))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="tool-group">
            <label>
              Assemblage de toiture
              <select
                value={roofAssemblyId}
                onChange={(event) => setRoofAssemblyId(event.target.value)}
              >
                {roofAssemblies.map((assembly) => (
                  <option key={assembly.id} value={assembly.id}>
                    {assembly.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pente (°)
              <input
                type="number"
                min="0"
                max="89"
                step="1"
                value={roofSlopeDeg}
                onChange={(event) =>
                  setRoofSlopeDeg(event.target.valueAsNumber)
                }
              />
            </label>
            <label>
              Azimut (°)
              <input
                type="number"
                min="0"
                max="359"
                step="1"
                value={roofAzimuthDeg}
                onChange={(event) =>
                  setRoofAzimuthDeg(event.target.valueAsNumber)
                }
              />
            </label>
            {/*
             * Deux raisons de refuser, donc deux phrases : dire « il manque
             * quelque chose » sans dire quoi laisse chercher dans les deux.
             */}
            <button
              type="button"
              className="secondary"
              disabled={contour === undefined || roofAssemblyId === ''}
              {...(contour === undefined
                ? {
                    title:
                      'Un pan se pose sur une empreinte : les murs de ce niveau ne délimitent pas encore de contour fermé.',
                  }
                : roofAssemblyId === ''
                  ? { title: 'Choisissez la composition du pan.' }
                  : {})}
              onClick={() => {
                const room = contour;
                if (room === undefined) return;
                onCommand(
                  new AddRoofCommand(level.id, {
                    id: nextLibraryId(
                      'roof',
                      `${level.name} toiture`,
                      level.roofs.map(({ id }) => id),
                    ),
                    footprint: room.polygon,
                    assemblyId: roofAssemblyId,
                    slopeDeg: roofSlopeDeg,
                    azimuthDeg: roofAzimuthDeg,
                    baseElevationMm:
                      level.elevationMm + level.defaultStoreyHeightMm,
                  }),
                );
              }}
            >
              Pan de toiture depuis l’empreinte
            </button>
          </div>
          <ul className="catalog-list">
            {level.roofs.map((roof) => (
              <li key={roof.id}>
                <span>
                  {roof.id}
                  <span className="hint">
                    {roof.slopeDeg}° · azimut {roof.azimuthDeg}°
                  </span>
                </span>
                {onSelectObjects !== undefined && (
                  <button
                    type="button"
                    className="link"
                    onClick={() => onSelectObjects([roof.id])}
                  >
                    Modifier le contour
                  </button>
                )}
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Supprimer le pan ${roof.id}`}
                  onClick={() =>
                    onCommand(new RemoveRoofCommand(level.id, roof.id))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <p className="notice">
            « Modifier le contour » sélectionne l’ouvrage sur le plan : chaque
            sommet y devient une poignée, le milieu de chaque côté en ajoute un,
            et alt-clic sur un sommet le retire.
          </p>
        </div>

        <div>
          <h3>Pièces de {level.name}</h3>
          <ul className="catalog-list">
            {level.spaces.map((space) => (
              <li key={space.id}>
                <div className="detail-name">
                  <DraftField
                    id={`space-${space.id}-name`}
                    label={`Nom de la pièce ${space.name}`}
                    kind="TEXT"
                    value={space.name}
                    onCommit={(name) =>
                      name.trim() === ''
                        ? undefined
                        : onCommand(
                            new UpdateSpaceCommand(level.id, space.id, {
                              name,
                            }),
                          )
                    }
                  />
                </div>
                <select
                  aria-label={`Type de la pièce ${space.name}`}
                  value={space.category}
                  onChange={(event) =>
                    onCommand(
                      new UpdateSpaceCommand(level.id, space.id, {
                        category: event.target.value,
                      }),
                    )
                  }
                >
                  {SPACE_CATEGORIES.map((entry) => (
                    <option key={entry} value={entry}>
                      {CATEGORY_LABELS[entry]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Supprimer la pièce ${space.name}`}
                  onClick={() =>
                    onCommand(new RemoveSpaceCommand(level.id, space.id))
                  }
                >
                  ×
                </button>
              </li>
            ))}
            {level.spaces.length === 0 && (
              <li className="empty-state">
                Aucune pièce déclarée sur ce niveau.
              </li>
            )}
          </ul>

          <h3>Contours détectés</h3>
          <label>
            Type par défaut
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {SPACE_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {CATEGORY_LABELS[entry]}
                </option>
              ))}
            </select>
          </label>
          <ul className="catalog-list">
            {rooms.map((room, index) => (
              <li
                key={`${room.areaM2}:${index}`}
                className={index === contourIndex ? 'selected' : undefined}
              >
                <span>
                  {room.areaM2.toFixed(2)} m²
                  <span className="hint">
                    {room.sourceWallIds.length} murs
                    {room.existingSpaceId === undefined
                      ? ''
                      : ` · déjà couvert par ${room.existingSpaceId}`}
                  </span>
                </span>
                <button
                  type="button"
                  className="link"
                  aria-pressed={index === contourIndex}
                  onClick={() => setContourIndex(index)}
                >
                  Choisir ce contour
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={room.existingSpaceId !== undefined}
                  {...(room.existingSpaceId === undefined
                    ? {}
                    : {
                        title:
                          'Ce contour porte déjà une pièce : elle se modifie sur le plan.',
                      })}
                  onClick={() => {
                    const name = `${CATEGORY_LABELS[category]} ${level.spaces.length + 1}`;
                    onCommand(
                      new AddSpaceCommand(level.id, {
                        id: nextLibraryId('space', name, takenSpaceIds),
                        name,
                        category,
                        polygon: room.polygon,
                      }),
                    );
                  }}
                >
                  Créer la pièce
                </button>
              </li>
            ))}
            {rooms.length === 0 && (
              <li className="empty-state">
                Aucun contour fermé : les murs de ce niveau ne délimitent pas
                encore de pièce.
              </li>
            )}
          </ul>
          <p className="notice">
            Les contours sont détectés à la lecture et ne sont jamais
            enregistrés : ils deviennent des pièces, des dalles ou des pans de
            toiture seulement quand vous les créez, et toujours à partir du
            contour choisi ci-dessus.
          </p>

          <h3>Zones du bâtiment</h3>
          <form
            className="tool-group"
            onSubmit={(event) => {
              event.preventDefault();
              const name = zoneName.trim();
              if (name === '') return;
              onCommand(
                new AddZoneCommand({
                  id: nextLibraryId(
                    'zone',
                    name,
                    zones.map(({ id }) => id),
                  ),
                  name,
                  type: zoneType,
                }),
              );
              setZoneName('');
            }}
          >
            <div className="field">
              <label htmlFor="zone-name">Nouvelle zone</label>
              <input
                id="zone-name"
                value={zoneName}
                placeholder="Volume chauffé"
                onChange={(event) => setZoneName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="zone-type">Type</label>
              <select
                id="zone-type"
                value={zoneType}
                onChange={(event) =>
                  setZoneType(event.target.value as ZoneType)
                }
              >
                {ZONE_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {ZONE_TYPE_LABELS[entry]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit">Créer la zone</button>
          </form>

          <ul className="catalog-list">
            {zones.map((zone) => (
              <li key={zone.id} className="zone-entry">
                <div className="detail-name">
                  <DraftField
                    id={`zone-${zone.id}-name`}
                    label={`Nom de la zone ${zone.name}`}
                    kind="TEXT"
                    value={zone.name}
                    onCommit={(name) =>
                      name.trim() === ''
                        ? undefined
                        : onCommand(new UpdateZoneCommand(zone.id, { name }))
                    }
                  />
                </div>
                <select
                  aria-label={`Type de la zone ${zone.name}`}
                  value={zone.type}
                  onChange={(event) =>
                    onCommand(
                      new UpdateZoneCommand(zone.id, {
                        type: event.target.value as ZoneType,
                      }),
                    )
                  }
                >
                  {ZONE_TYPES.map((entry) => (
                    <option key={entry} value={entry}>
                      {ZONE_TYPE_LABELS[entry]}
                    </option>
                  ))}
                </select>
                <fieldset className="tool-group choice-group">
                  <legend>Pièces</legend>
                  {allSpaces.map((space) => (
                    <label className="checkbox" key={space.id}>
                      <input
                        type="checkbox"
                        checked={zone.spaceIds.includes(space.id)}
                        onChange={(event) =>
                          onCommand(
                            new SetZoneMembershipCommand(
                              zone.id,
                              space.id,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                      {space.name}
                    </label>
                  ))}
                  {allSpaces.length === 0 && (
                    <p className="hint">
                      Ce projet ne déclare encore aucune pièce.
                    </p>
                  )}
                </fieldset>
                <button
                  type="button"
                  className="icon danger"
                  aria-label={`Supprimer la zone ${zone.name}`}
                  onClick={() => onCommand(new RemoveZoneCommand(zone.id))}
                >
                  ×
                </button>
              </li>
            ))}
            {zones.length === 0 && (
              <li className="empty-state">
                Aucune zone : les pièces sont considérées une à une.
              </li>
            )}
          </ul>
          <p className="notice">
            Une zone regroupe des pièces pour un usage — volume chauffé, groupe
            de ventilation, compartiment. Une pièce appartenant à une zone ne
            peut pas être supprimée tant qu’elle en fait partie ; c’est ici
            qu’on l’en retire.
          </p>
        </div>
      </div>
    </section>
  );
}
