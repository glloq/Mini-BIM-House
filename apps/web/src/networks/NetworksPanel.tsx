import { useMemo, useState } from 'react';
import type {
  NetworkDiscipline,
  Project,
} from '@house-technical-designer/core-domain';
import {
  NETWORK_DISCIPLINE_LABELS,
  RemoveNetworkCommand,
  RemoveNetworkEdgeCommand,
  RemoveNetworkNodeCommand,
  UpdateNetworkNodeCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import { nextLibraryId } from '../library/library-model.js';
import {
  NETWORK_DISCIPLINES,
  addBranchPortCommand,
  connectCommand,
  createNetworkCommand,
  edgeRows,
  endPorts,
  networkRows,
  nodeRows,
  nodeTemplatesFor,
  portLabel,
  spaceOptions,
  startPorts,
  type NetworkCommandResult,
} from './network-model.js';

export interface NetworksPanelProps {
  readonly project: Project;
  readonly levelId: string | undefined;
  readonly selectedNetworkId: string | undefined;
  readonly onSelectNetwork: (networkId: string) => void;
  readonly onCommand: (command: ProjectCommand) => boolean;
  readonly onSelectObjects: (objectIds: readonly string[]) => void;
  readonly onMessage: (message: string) => void;
}

function metres(millimetres: number): string {
  return (millimetres / 1000).toFixed(2);
}

export function NetworksPanel({
  project,
  levelId,
  selectedNetworkId,
  onSelectNetwork,
  onCommand,
  onSelectObjects,
  onMessage,
}: NetworksPanelProps) {
  const rows = useMemo(() => networkRows(project), [project]);
  const selected =
    rows.find(({ network }) => network.id === selectedNetworkId) ?? rows[0];
  const spaces = useMemo(() => spaceOptions(project), [project]);
  const level =
    project.building.levels.find(({ id }) => id === levelId) ??
    project.building.levels[0];

  const [discipline, setDiscipline] = useState<NetworkDiscipline>('WATER');
  const [systemType, setSystemType] = useState('');
  const [fromPortId, setFromPortId] = useState('');
  const [toPortId, setToPortId] = useState('');

  function run(result: NetworkCommandResult): void {
    if (result.status === 'ERROR') {
      onMessage(result.message);
      return;
    }
    onCommand(result.command);
  }

  const network = selected?.network;
  const nodes = useMemo(
    () => (network === undefined ? [] : nodeRows(network, project)),
    [network, project],
  );
  const edges = useMemo(
    () => (network === undefined ? [] : edgeRows(network)),
    [network],
  );
  const departures = network === undefined ? [] : startPorts(network);
  const arrivals =
    network === undefined || fromPortId === ''
      ? []
      : endPorts(network, fromPortId);

  return (
    <section className="library-panel" aria-labelledby="networks-heading">
      <header className="panel-heading">
        <div>
          <p className="panel-label">Réseaux techniques</p>
          <h2 id="networks-heading">Distribution et terminaux</h2>
        </div>
      </header>

      <div className="network-layout">
        <div>
          <h3>Réseaux du projet</h3>
          <div className="table-scroll">
            <table className="library-table">
              <caption className="visually-hidden">
                Réseaux techniques, par discipline
              </caption>
              <thead>
                <tr>
                  <th scope="col">Discipline</th>
                  <th scope="col">Système</th>
                  <th scope="col">Contenu</th>
                  <th scope="col">Longueur</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.network.id}
                    className={
                      row.network.id === selected?.network.id
                        ? 'selected'
                        : undefined
                    }
                  >
                    <th scope="row">
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          onSelectNetwork(row.network.id);
                          setFromPortId('');
                          setToPortId('');
                        }}
                      >
                        {row.disciplineLabel}
                      </button>
                    </th>
                    <td>{row.network.systemType}</td>
                    <td>
                      {row.summary.nodeCount} nœuds · {row.summary.edgeCount}{' '}
                      tronçons
                      {row.summary.openPortCount > 0 && (
                        <span className="badge missing">
                          {row.summary.openPortCount} port(s) libre(s)
                        </span>
                      )}
                    </td>
                    <td>{metres(row.summary.routeLengthMm)} m</td>
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          onCommand(new RemoveNetworkCommand(row.network.id))
                        }
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      Ce projet ne contient aucun réseau technique.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form
            className="tool-group"
            onSubmit={(event) => {
              event.preventDefault();
              if (level === undefined) {
                onMessage('Créez un niveau avant un réseau.');
                return;
              }
              run(
                createNetworkCommand(project, {
                  id: nextLibraryId(
                    'network',
                    `${discipline}-${systemType}`,
                    (project.systems ?? []).map(({ id }) => id),
                  ),
                  discipline,
                  systemType,
                  position: { x: 0, y: 0, z: level.elevationMm },
                }),
              );
              setSystemType('');
            }}
          >
            <div className="field">
              <label htmlFor="network-discipline">Discipline</label>
              <select
                id="network-discipline"
                value={discipline}
                onChange={(event) =>
                  setDiscipline(event.target.value as NetworkDiscipline)
                }
              >
                {NETWORK_DISCIPLINES.map((entry) => (
                  <option key={entry} value={entry}>
                    {NETWORK_DISCIPLINE_LABELS[entry]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="network-system-type">Type de système</label>
              <input
                id="network-system-type"
                value={systemType}
                placeholder="POTABLE_COLD"
                onChange={(event) => setSystemType(event.target.value)}
              />
            </div>
            <button type="submit">Créer le réseau</button>
          </form>
          <p className="notice">
            Le réseau est créé avec sa source, à l’origine du niveau actif.
            Placez ensuite ses nœuds sur le plan avec l’outil « Réseau », puis
            reliez leurs ports ici.
          </p>
        </div>

        <div>
          {network === undefined ? (
            <p className="notice">
              Sélectionnez un réseau pour en détailler les nœuds et les
              tronçons.
            </p>
          ) : (
            <>
              <h3>
                {NETWORK_DISCIPLINE_LABELS[network.discipline]} ·{' '}
                {network.systemType}
              </h3>

              {selected!.summary.issues.length > 0 && (
                <ul className="alert-list">
                  {selected!.summary.issues.map((issue, index) => (
                    <li key={`${issue.code}:${index}`}>
                      <span className="badge missing">{issue.code}</span>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h4>Nœuds</h4>
              <div className="table-scroll">
                <table className="library-table">
                  <caption className="visually-hidden">
                    Nœuds du réseau sélectionné
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Type</th>
                      <th scope="col">Position (m)</th>
                      <th scope="col">Pièce</th>
                      <th scope="col">Ports</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((row) => (
                      <tr key={row.node.id}>
                        <th scope="row">
                          {row.kindLabel}
                          <span className="hint">{row.node.id}</span>
                        </th>
                        <td>
                          {metres(row.node.position.x)} ;{' '}
                          {metres(row.node.position.y)} ;{' '}
                          {metres(row.node.position.z)}
                        </td>
                        <td>
                          <select
                            aria-label={`Pièce desservie par ${row.node.id}`}
                            value={row.node.spaceId ?? ''}
                            onChange={(event) =>
                              onCommand(
                                new UpdateNetworkNodeCommand(
                                  network.id,
                                  row.node.id,
                                  {
                                    spaceId:
                                      event.target.value === ''
                                        ? null
                                        : event.target.value,
                                  },
                                ),
                              )
                            }
                          >
                            <option value="">Non renseignée</option>
                            {spaces.map((space) => (
                              <option key={space.id} value={space.id}>
                                {space.name} · {space.levelName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {row.connectedPortCount} / {row.ports.length}
                        </td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="link"
                            onClick={() => onSelectObjects([row.node.id])}
                          >
                            Localiser
                          </button>
                          <button
                            type="button"
                            className="link"
                            onClick={() =>
                              run(
                                addBranchPortCommand(
                                  project,
                                  network.id,
                                  row.node.id,
                                  nextLibraryId(
                                    `${row.node.id}-out`,
                                    'depart',
                                    network.ports.map(({ id }) => id),
                                  ),
                                ),
                              )
                            }
                          >
                            Ajouter un départ
                          </button>
                          <button
                            type="button"
                            className="link"
                            onClick={() =>
                              onCommand(
                                new RemoveNetworkNodeCommand(
                                  network.id,
                                  row.node.id,
                                ),
                              )
                            }
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                    {nodes.length === 0 && (
                      <tr>
                        <td colSpan={5}>Ce réseau ne contient aucun nœud.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <h4>Tronçons</h4>
              <div className="table-scroll">
                <table className="library-table">
                  <caption className="visually-hidden">
                    Tronçons du réseau sélectionné
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Nature</th>
                      <th scope="col">Départ</th>
                      <th scope="col">Arrivée</th>
                      <th scope="col">Longueur</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.map((row) => (
                      <tr key={row.edge.id}>
                        <th scope="row">{row.edge.kind}</th>
                        <td>{row.fromLabel}</td>
                        <td>{row.toLabel}</td>
                        <td>{metres(row.lengthMm)} m</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="link"
                            onClick={() => onSelectObjects([row.edge.id])}
                          >
                            Localiser
                          </button>
                          <button
                            type="button"
                            className="link"
                            onClick={() =>
                              onCommand(
                                new RemoveNetworkEdgeCommand(
                                  network.id,
                                  row.edge.id,
                                ),
                              )
                            }
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                    {edges.length === 0 && (
                      <tr>
                        <td colSpan={5}>Ce réseau n’est pas encore relié.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form
                className="tool-group"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(
                    connectCommand(
                      project,
                      network.id,
                      fromPortId,
                      toPortId,
                      nextLibraryId(
                        `${network.id}:run`,
                        'troncon',
                        network.edges.map(({ id }) => id),
                      ),
                    ),
                  );
                  setFromPortId('');
                  setToPortId('');
                }}
              >
                <div className="field">
                  <label htmlFor="network-from-port">Départ</label>
                  <select
                    id="network-from-port"
                    value={fromPortId}
                    onChange={(event) => {
                      setFromPortId(event.target.value);
                      setToPortId('');
                    }}
                  >
                    <option value="">Choisir un port</option>
                    {departures.map((port) => (
                      <option key={port.id} value={port.id}>
                        {portLabel(network, port.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="network-to-port">Arrivée</label>
                  <select
                    id="network-to-port"
                    value={toPortId}
                    disabled={fromPortId === ''}
                    onChange={(event) => setToPortId(event.target.value)}
                  >
                    <option value="">Choisir un port</option>
                    {arrivals.map((port) => (
                      <option key={port.id} value={port.id}>
                        {portLabel(network, port.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={fromPortId === '' || toPortId === ''}
                >
                  Relier
                </button>
              </form>
              <p className="notice">
                Un port ne porte qu’un tronçon : pour desservir plusieurs
                terminaux depuis une nourrice, ajoutez-lui autant de départs. Le
                tracé suit les axes du bâtiment ; il est dessiné, pas
                dimensionné : ni diamètre ni débit ne sont supposés.
              </p>
              <p className="notice">
                Types de nœuds disponibles pour cette discipline :{' '}
                {nodeTemplatesFor(network)
                  .map(({ label }) => label)
                  .join(', ')}
                .
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
