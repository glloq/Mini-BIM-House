import type { Project } from '@house-technical-designer/core-domain';
import { openPorts } from '@house-technical-designer/editor-core';
import { listedFamilies } from '../editor/object-editors.js';

export interface ProjectTreeProps {
  readonly project: Project;
  /** The storey being drawn, whose objects are the ones that can be reached. */
  readonly levelId?: string;
  readonly selection: readonly string[];
  readonly onSelectObject: (objectId: string) => void;
  /** Frames the object on the plan, when the user asks for it twice. */
  readonly onFrameObject: (objectId: string) => void;
  /** Opens a saved view or a sheet, by the destination that holds it. */
  readonly onOpenDocuments: () => void;
  /** Les bibliothèques que l'étape consulte, et comment on les ouvre. */
  readonly libraries: readonly {
    readonly id: string;
    readonly label: string;
  }[];
  readonly onOpenLibrary: (library: string) => void;
  /**
   * Cherche dans le projet, avec ce qu'on cherche déjà écrit.
   *
   * Les listes s'arrêtent à quarante objets, et le reste était renvoyé à
   * `Ctrl+K` — une phrase qui suppose qu'on connaît le raccourci, qu'on a un
   * clavier, et qu'on a lu la ligne. C'est un bouton.
   */
  readonly onSearch: (query: string) => void;
}

/** How many objects of one family are listed before the count stands in. */
const LISTED_PER_FAMILY = 40;

/**
 * Le bâtiment comme un arbre, qui est la façon dont on pense un bâtiment.
 *
 * L'étape répond à « ce que je fais » ; ceci répond à « où je suis et ce qu'il
 * y a dedans ». C'était derrière un dépliage nommé `☰ Modèle`, c'est-à-dire
 * caché : une question qu'on se pose en permanence ne se range pas.
 *
 * Les niveaux sont une rangée de boutons, et c'est **le seul** endroit où l'on
 * change d'étage — il y avait aussi une liste déroulante « Niveau » juste
 * au-dessus, deux commandes pour une décision. Seul le niveau dessiné est
 * déplié : un objet d'un autre étage ne peut pas s'afficher sur le plan sans
 * changer le plan d'abord, et un arbre qui parcourrait tout le projet
 * listerait mille murs que personne n'a demandés.
 */
export function ProjectTree({
  project,
  levelId,
  selection,
  onSelectObject,
  onFrameObject,
  onOpenDocuments,
  libraries,
  onOpenLibrary,
  onSearch,
}: ProjectTreeProps) {
  const active =
    project.building.levels.find(({ id }) => id === levelId) ??
    project.building.levels[0];

  /**
   * The families of the storey, asked of the families themselves.
   *
   * This list used to be written here, and the command palette wrote its own:
   * nine families in one, five in the other, and everything added later
   * missing from both. What belongs to the project rather than to a floor —
   * the networks, the ground — has its own section further down.
   */
  /*
   * Les familles vides ne sont pas listées.
   *
   * « Toitures (0) », « Cotes (0) », « Annotations (0) » : cinq rangées pour
   * dire que rien n'existe, au-dessus des outils qu'elles repoussaient sous la
   * ligne de flottaison. Un arbre dit ce que le bâtiment a ; ce qu'il n'a pas
   * se voit à ce qu'on ne le trouve pas, et se crée avec un outil.
   */
  const families =
    active === undefined
      ? []
      : listedFamilies(project, active.id).filter(
          ({ scope, objects }) => scope === 'LEVEL' && objects.length > 0,
        );
  const views = project.drawingViews ?? [];
  const sheets = project.sheets ?? [];

  return (
    <nav className="project-tree" aria-label="Arborescence du projet">
      <ul className="tree-families">
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
                    <button
                      type="button"
                      className="link"
                      onClick={() => onSearch(label)}
                    >
                      et {objects.length - LISTED_PER_FAMILY} autre(s) —
                      chercher
                    </button>
                  </li>
                )}
              </ul>
            </details>
          </li>
        ))}
      </ul>
      <details className="tree-section">
        <summary>
          Terrain{' '}
          <small>
            (nord {project.site.northAngleDeg}°
            {project.site.climateProfileId === undefined ? ', sans climat' : ''}
            )
          </small>
        </summary>
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
      <details className="tree-section">
        <summary>
          Systèmes <small>({(project.systems ?? []).length})</small>
        </summary>
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
      {libraries.length > 0 && (
        <details className="tree-section">
          <summary>
            Bibliothèques <small>({libraries.length})</small>
          </summary>
          <ul>
            {libraries.map(({ id, label }) => (
              <li key={id}>
                <button type="button" onClick={() => onOpenLibrary(id)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {/*
       * Ce que le projet produit est dans le projet, et se trouve là où l'on
       * cherche le reste. Une vue enregistrée était atteignable par une
       * destination et par rien d'autre : il fallait savoir qu'elle existait.
       */}
      <details className="tree-section">
        <summary>
          Vues et feuilles{' '}
          <small>
            ({views.length} vue(s) · {sheets.length} feuille(s))
          </small>
        </summary>
        <ul>
          {views.length === 0 && sheets.length === 0 && (
            <li>
              <span className="tree-fact">Rien d’enregistré</span>
            </li>
          )}
          {views.map((view) => (
            <li key={view.id}>
              <span className="tree-fact">
                {view.name} <small>1:{view.scaleDenominator}</small>
              </span>
            </li>
          ))}
          {sheets.map((sheet) => (
            <li key={sheet.id}>
              <span className="tree-fact">
                {sheet.number} · {sheet.title}
              </span>
            </li>
          ))}
          <li>
            <button type="button" className="link" onClick={onOpenDocuments}>
              Ouvrir les vues et les feuilles
            </button>
          </li>
        </ul>
      </details>
    </nav>
  );
}
