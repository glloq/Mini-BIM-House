/**
 * Ce qu'une commande a réellement changé, lu sur le modèle.
 *
 * La question paraît résolue : une commande rend un `ChangeSet` avec un champ
 * `objectIds`. Il ne contient pas les objets. `BuildingCommand.execute` — la
 * classe de base des trente-quatre commandes du bâtiment — y écrit
 * `[this.id]`, c'est-à-dire l'identifiant **de la commande** :
 *
 *     Supprimer une dalle  → ["slab:remove:slab-ground"]
 *     Supprimer un tronçon → ["network:edge:remove:water:water:trunk"]
 *     Supprimer une ouverture → ["opening-entry", "wall-south"]   ← le seul juste
 *
 * Personne ne s'en était aperçu parce que **rien ne lisait ce champ**. Il est
 * rendu par chaque commande, agrégé, et jeté.
 *
 * ## Pourquoi comparer plutôt que déclarer
 *
 * Faire déclarer à chaque commande ce qu'elle touche demanderait trente-quatre
 * corrections, dont une oubliée serait un trou silencieux dans la règle
 * d'édition — et une commande écrite l'an prochain sans ce champ en serait un
 * autre. Or c'est très exactement la classe de trou qu'on est en train de
 * fermer.
 *
 * Comparer l'inventaire avant et après est juste pour les trente-quatre, pour
 * celles des autres fichiers, et pour celles qui n'existent pas encore. Le prix
 * est un parcours du modèle par geste, sur des listes qui comptent des
 * centaines d'objets et pas des millions.
 *
 * ## Ce que ce module ne fait pas
 *
 * Il ne dit pas ce qui a changé **dans** un objet, seulement lequel a changé.
 * La règle d'édition n'a pas besoin de plus : un mur qu'on déplace et un mur
 * qu'on renomme sont tous les deux un mur qu'on modifie.
 */
import type { Project } from '@house-technical-designer/core-domain';

/** Un objet du projet, réduit à ce qui permet de dire qu'il a bougé. */
type Inventory = ReadonlyMap<string, string>;

/**
 * Tout ce qui porte un identifiant et se pose dans un projet.
 *
 * Écrit à la main, et c'est voulu : une collection oubliée ici est un objet
 * que la règle laisse passer, donc la liste doit se lire d'un coup d'œil et
 * être comparable au type `Level`. Le test de ce module la confronte à la
 * maison de référence, où chacune de ces collections est peuplée.
 */
function inventory(project: Project): Inventory {
  const found = new Map<string, string>();
  const note = (id: string, value: unknown): void => {
    found.set(id, JSON.stringify(value));
  };

  if (project.site.parcelBoundary !== undefined)
    note('site:parcel', project.site.parcelBoundary);
  for (const obstacle of project.site.obstacles ?? [])
    note(obstacle.id, obstacle);
  if (project.site.underlay !== undefined)
    note('site:underlay', project.site.underlay);

  for (const level of project.building.levels) {
    for (const wall of level.walls) note(wall.id, wall);
    for (const slab of level.slabs) note(slab.id, slab);
    for (const roof of level.roofs) note(roof.id, roof);
    for (const opening of level.openings) note(opening.id, opening);
    for (const stair of level.stairs) note(stair.id, stair);
    for (const space of level.spaces) note(space.id, space);
    for (const annotation of level.annotations) note(annotation.id, annotation);
    for (const component of level.components ?? [])
      note(component.id, component);
    for (const roofStructure of level.roofStructures ?? [])
      note(roofStructure.id, roofStructure);
    for (const member of level.structure ?? []) note(member.id, member);
  }

  for (const network of project.systems ?? []) {
    for (const node of network.nodes) note(node.id, node);
    for (const edge of network.edges) note(edge.id, edge);
    for (const port of network.ports) note(port.id, port);
  }

  return found;
}

/**
 * Les objets qui ne sont plus les mêmes d'un projet à l'autre.
 *
 * Posé, retiré, corrigé : les trois comptent, et c'est ce que « modifier »
 * veut dire. Un objet retiré n'existe que dans le premier projet et un objet
 * posé que dans le second — l'appelant qui veut savoir à qui il appartient
 * doit donc le chercher dans celui des deux qui le porte.
 */
export function changedObjects(
  before: Project,
  after: Project,
): readonly string[] {
  const first = inventory(before);
  const second = inventory(after);
  const changed: string[] = [];
  for (const [id, value] of first)
    if (second.get(id) !== value) changed.push(id);
  for (const id of second.keys()) if (!first.has(id)) changed.push(id);
  return changed;
}
