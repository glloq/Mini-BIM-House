/**
 * Poser ce qu'une entrée propose, sans la main de personne.
 *
 * Une boîte à outils qui offre deux cent quarante boutons ne dit pas lesquels
 * marchent. On les a essayés un par un, à la main, et on n'a pas essayé les
 * deux cent quarante ; c'est ainsi qu'une entrée pouvait rester des semaines à
 * refuser tout ce qu'on lui demandait — « ce modèle se fixe à : Dalle, Mur ».
 *
 * Ce module rejoue **exactement** ce que fait l'application quand on prend une
 * entrée et qu'on clique : les mêmes options pré-remplies, la même fabrique de
 * commande, le même répartiteur. Il n'y a pas de second chemin, donc rien ne
 * peut marcher ici et échouer à l'écran.
 *
 * Il vit dans le dossier plutôt que dans un test parce que ce qu'il calcule —
 * « cette entrée pose-t-elle quelque chose, et quoi » — est aussi la réponse
 * dont l'écran a besoin pour savoir quel espace laisse désigner quoi.
 */
import type {
  Project,
  ProjectFile,
} from '@house-technical-designer/core-domain';
import { ProjectCommandDispatcher } from '@house-technical-designer/editor-core';
import type { Point2D } from '@house-technical-designer/geometry';

import { familyOf, listedFamilies, type ObjectKind } from './object-editors.js';
import { optionValue, type ToolDrafts } from './tool-options.js';
import {
  editorToolId,
  optionsOf,
  requiredPoints,
  toolById,
  type ToolCommandContext,
} from './tool-registry.js';
import { draftsForEntry, type ToolboxEntry } from './toolbox.js';

/**
 * Ce qu'on vise, quand viser demande de connaître ce qu'on a réglé.
 *
 * Un tracé de réseau part d'un port et arrive sur un port — mais **de quel
 * réseau** dépend de ce que l'entrée a pré-rempli. Les `picks` peuvent donc
 * être une fonction des options résolues : c'est le même enchaînement qu'à
 * l'écran, où l'on choisit l'entrée d'abord et où l'on vise ensuite.
 */
export interface EntryAim {
  readonly points?: readonly Point2D[];
  readonly picks?:
    | readonly (string | undefined)[]
    | ((option: (key: string) => string) => readonly (string | undefined)[]);
  readonly selection?: readonly string[];
  /** Ce qu'on aurait tapé dans les options avant de cliquer. */
  readonly drafts?: Readonly<Record<string, string>>;
}

export interface EntryPlacement {
  readonly entry: ToolboxEntry;
  /** Ce que le projet a gagné, par famille d'objet. Vide si rien. */
  readonly created: readonly ObjectKind[];
  /**
   * Si le projet n'est plus le même.
   *
   * Poser n'est pas toujours ajouter : pivoter déplace ce qui existe, et
   * retracer la parcelle remplace celle d'avant. Ce qu'on refuse est un bouton
   * qui, accepté, ne change rien.
   */
  readonly changed: boolean;
  /** Ce qui a empêché, quand rien n'a été posé. */
  readonly refusal?: string;
}

/**
 * Où cliquer pour poser ce que l'entrée pose.
 *
 * Les points sont pris **dans** la maison plutôt qu'au hasard : un composant
 * se fixe à ce qu'il y a dessous, une trémie perce la dalle qu'elle traverse,
 * une ouverture s'accroche au mur qu'on vise. Cliquer dans le vide éprouverait
 * le refus, pas la pose.
 */
function pointsInside(
  project: Project,
  levelId: string,
  count: number,
): readonly Point2D[] {
  const level = project.building.levels.find(({ id }) => id === levelId);
  const outer = level?.slabs[0]?.polygon.outer ?? [];
  const centre =
    outer.length === 0
      ? { x: 0, y: 0 }
      : outer.reduce(
          (total, point) => ({
            x: total.x + point.x / outer.length,
            y: total.y + point.y / outer.length,
          }),
          { x: 0, y: 0 },
        );
  // Une petite figure autour du centre : assez grande pour faire une surface,
  // assez petite pour rester à l'intérieur de ce qu'elle perce.
  const around: readonly Point2D[] = [
    { x: centre.x - 600, y: centre.y - 600 },
    { x: centre.x + 600, y: centre.y - 600 },
    { x: centre.x + 600, y: centre.y + 600 },
    { x: centre.x - 600, y: centre.y + 600 },
    { x: centre.x - 300, y: centre.y + 900 },
  ];
  return Array.from(
    { length: count },
    (_unused, index) => around[index % around.length]!,
  );
}

/**
 * Tout ce que le projet tient, par identifiant.
 *
 * Les familles se listent elles-mêmes — c'est la même réponse que l'arbre et
 * la palette lisent — de sorte qu'une famille ajoutée demain est comptée sans
 * qu'on touche à ces lignes.
 */
function objectsOf(project: Project, levelId: string): ReadonlySet<string> {
  return new Set(
    listedFamilies(project, levelId).flatMap(({ objects }) =>
      objects.map(({ objectId }) => objectId),
    ),
  );
}

/**
 * Ce qu'une entrée pose sur cette maison-là.
 *
 * `points` et `picks` peuvent être imposés : un outil qui joint deux murs a
 * besoin qu'on lui désigne deux murs, et le plan est ce qui le sait.
 */
export function placeEntry(
  file: ProjectFile,
  levelId: string,
  entry: ToolboxEntry,
  aim: EntryAim = {},
): EntryPlacement {
  const tool = toolById(entry.toolId);
  const toolId = editorToolId(entry.toolId);
  if (tool === undefined || toolId === undefined)
    return {
      entry,
      created: [],
      changed: false,
      refusal: `outil inconnu : ${entry.toolId}`,
    };
  if (tool.createCommand === undefined)
    return { entry, created: [], changed: false, refusal: 'aucune commande' };

  const drafts: ToolDrafts = {
    ...draftsForEntry(file.project, entry),
    ...aim.drafts,
  };
  const resolved = (key: string): string =>
    optionValue(file.project, toolId, optionsOf(toolId), drafts, key);
  const wanted = Math.max(requiredPoints(toolId), 1);
  const points = aim.points ?? pointsInside(file.project, levelId, wanted);
  let made = 0;
  const context: ToolCommandContext = {
    file,
    levelId,
    points,
    picks:
      typeof aim.picks === 'function'
        ? aim.picks(resolved)
        : (aim.picks ?? points.map(() => undefined)),
    selection: aim.selection ?? [],
    option: resolved,
    optionNumber: (key) => {
      const raw = resolved(key);
      const parsed = Number(raw);
      return raw === '' || !Number.isFinite(parsed) ? undefined : parsed;
    },
    newId: (prefix) =>
      prefix === '' ? `made-${(made += 1)}` : `${prefix}-made-${(made += 1)}`,
  };

  const result = tool.createCommand(context);
  if (result === undefined)
    return {
      entry,
      created: [],
      changed: false,
      refusal: 'aucune commande rendue',
    };
  if (result.status === 'ERROR')
    return { entry, created: [], changed: false, refusal: result.message };

  const before = objectsOf(file.project, levelId);
  const commands = new ProjectCommandDispatcher(file.project);
  const applied = commands.dispatch(result.command);
  if (applied.status !== 'APPLIED')
    return {
      entry,
      created: [],
      changed: false,
      refusal:
        applied.status === 'REJECTED'
          ? applied.errors.join(' ')
          : applied.status,
    };

  const kinds = new Set<ObjectKind>();
  for (const objectId of objectsOf(commands.project, levelId))
    if (!before.has(objectId)) {
      const family = familyOf(commands.project, objectId);
      if (family !== undefined)
        for (const kind of family.kinds) kinds.add(kind);
    }
  return {
    entry,
    created: [...kinds],
    // Le projet n'est plus le même : c'est la seule preuve qui vaille pour un
    // outil qui modifie au lieu d'ajouter.
    changed:
      JSON.stringify([
        commands.project.site,
        commands.project.building,
        commands.project.systems,
      ]) !==
      JSON.stringify([
        file.project.site,
        file.project.building,
        file.project.systems,
      ]),
  };
}
