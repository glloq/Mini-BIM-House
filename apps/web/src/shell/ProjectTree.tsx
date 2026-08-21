import type { Project } from '@house-technical-designer/core-domain';
import { openPorts } from '@house-technical-designer/editor-core';
import { listedFamilies } from '../editor/object-editors.js';

export interface ProjectTreeProps {
  readonly project: Project;
  /** The storey being drawn, whose objects are the ones that can be reached. */
  readonly levelId?: string;
  readonly selection: readonly string[];
  readonly onSelectLevel: (levelId: string) => void;
  readonly onSelectObject: (objectId: string) => void;
  /** Frames the object on the plan, when the user asks for it twice. */
  readonly onFrameObject: (objectId: string) => void;
}

/** How many objects of one family are listed before the count stands in. */
const LISTED_PER_FAMILY = 40;

/**
 * The project as a tree, which is how a building is thought about.
 *
 * The workspaces answer "what am I doing"; this answers "what is in there".
 * Only the storey being drawn is expanded: an object of another one cannot be
 * shown on the plan without changing the plan first, and a tree that walks the
 * whole project would list a thousand walls nobody asked for.
 */
export function ProjectTree({
  project,
  levelId,
  selection,
  onSelectLevel,
  onSelectObject,
  onFrameObject,
}: ProjectTreeProps) {
  const levels = project.building.levels;
  const active = levels.find(({ id }) => id === levelId) ?? levels[0];

  /**
   * The families of the storey, asked of the families themselves.
   *
   * This list used to be written here, and the command palette wrote its own:
   * nine families in one, five in the other, and everything added later
   * missing from both. What belongs to the project rather than to a floor —
   * the networks, the ground — has its own section further down.
   */
  const families =
    active === undefined
      ? []
      : listedFamilies(project, active.id).filter(
          ({ scope }) => scope === 'LEVEL',
        );

  return (
    <nav className="project-tree" aria-label="Arborescence du projet">
      <p className="panel-label">Projet</p>
      <details open>
        <summary>Site</summary>
        <ul>
          <li>
            <span className="tree-fact">
              Nord {project.site.northAngleDeg}°
            </span>
          </li>
          <li>
            <span className="tree-fact">
              {project.site.climateProfileId === undefined
                ? 'Aucun climat désigné'
                : `Climat ${project.site.climateProfileId}`}
            </span>
          </li>
        </ul>
      </details>
      <details open>
        <summary>Bâtiment</summary>
        <ul>
          {levels.map((level) => (
            <li key={level.id}>
              <button
                type="button"
                className={level.id === active?.id ? 'tree-active' : undefined}
                aria-current={level.id === active?.id ? 'true' : undefined}
                onClick={() => onSelectLevel(level.id)}
              >
                {level.name}
              </button>
              {level.id === active?.id && (
                <ul>
                  {families.map(({ label, objects }) => (
                    <li key={label}>
                      <details>
                        <summary>
                          {label} <small>({objects.length})</small>
                        </summary>
                        <ul>
                          {objects
                            .slice(0, LISTED_PER_FAMILY)
                            .map(({ objectId, label: name }) => (
                              <li key={objectId}>
                                <button
                                  type="button"
                                  className={
                                    selection.includes(objectId)
                                      ? 'tree-active'
                                      : undefined
                                  }
                                  onClick={() => onSelectObject(objectId)}
                                  onDoubleClick={() => onFrameObject(objectId)}
                                >
                                  {name}
                                </button>
                              </li>
                            ))}
                          {objects.length > LISTED_PER_FAMILY && (
                            <li>
                              <span className="tree-fact">
                                et {objects.length - LISTED_PER_FAMILY} autre(s)
                                — cherchez-les avec Ctrl+K
                              </span>
                            </li>
                          )}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Terrain</summary>
        <ul>
          <li>
            {project.site.parcelBoundary === undefined ? (
              <span className="tree-fact">Aucune parcelle tracée</span>
            ) : (
              <button
                type="button"
                className={
                  selection.includes('site:parcel') ? 'tree-active' : undefined
                }
                onClick={() => onSelectObject('site:parcel')}
                onDoubleClick={() => onFrameObject('site:parcel')}
              >
                Parcelle
              </button>
            )}
          </li>
          {(project.site.obstacles ?? []).map((obstacle) => (
            <li key={obstacle.id}>
              <button
                type="button"
                className={
                  selection.includes(obstacle.id) ? 'tree-active' : undefined
                }
                onClick={() => onSelectObject(obstacle.id)}
                onDoubleClick={() => onFrameObject(obstacle.id)}
              >
                {obstacle.name ?? obstacle.kind ?? obstacle.id}
              </button>
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Systèmes</summary>
        <ul>
          {(project.systems ?? []).length === 0 && (
            <li>
              <span className="tree-fact">Aucun réseau</span>
            </li>
          )}
          {(project.systems ?? []).map((network) => (
            <li key={network.id}>
              <details>
                <summary>
                  {network.id}{' '}
                  <small>
                    ({network.nodes.length} nœuds · {network.edges.length}{' '}
                    tronçons)
                  </small>
                </summary>
                <ul>
                  {network.nodes.slice(0, LISTED_PER_FAMILY).map((node) => (
                    <li key={node.id}>
                      <button
                        type="button"
                        className={
                          selection.includes(node.id)
                            ? 'tree-active'
                            : undefined
                        }
                        onClick={() => onSelectObject(node.id)}
                        onDoubleClick={() => onFrameObject(node.id)}
                      >
                        {node.kind} · {node.id}
                      </button>
                    </li>
                  ))}
                  {network.edges.slice(0, LISTED_PER_FAMILY).map((edge) => (
                    <li key={edge.id}>
                      <button
                        type="button"
                        className={
                          selection.includes(edge.id)
                            ? 'tree-active'
                            : undefined
                        }
                        onClick={() => onSelectObject(edge.id)}
                        onDoubleClick={() => onFrameObject(edge.id)}
                      >
                        {edge.kind} · {edge.id}
                      </button>
                    </li>
                  ))}
                  {/* A port no segment reaches is what an unfinished network
                      looks like, and it is worth seeing beside the rest. */}
                  {openPorts(network).map((port) => (
                    <li key={port.id}>
                      <span className="tree-fact">Port libre · {port.id}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
