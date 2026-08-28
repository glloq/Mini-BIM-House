/**
 * Ce que la maison est, lu à chaque fois qu'on le demande.
 *
 * L'interface se pilotait avec deux variables : l'étape et le métier. Cela
 * suffit à ranger les outils, pas à savoir lesquels servent. Une porte n'a pas
 * de sens sans mur, un escalier n'en a pas avec un seul niveau, une pièce n'en
 * a pas sans contour fermé — et rien dans la coque ne le savait, si bien que
 * les trois étaient proposés à un projet vide comme à une maison finie.
 *
 * Ce module répond aux questions que l'interface se pose sur l'état du
 * bâtiment, et à celles-là seulement. **Dérivé du modèle, jamais persisté** —
 * comme les étapes de `workflow-steps.ts`, et pour la même raison : un drapeau
 * dit que quelqu'un a cliqué, et ce qui compte est ce que la maison a. Un
 * projet qui perd ses murs perd ses contours avec eux.
 *
 * Ce n'est pas un second modèle : il ne porte aucune donnée que le projet
 * n'ait, il ne s'écrit nulle part, et il se recalcule plutôt que de se tenir à
 * jour.
 */
import type {
  DesignDomainId,
  Project,
} from '@house-technical-designer/core-domain';
import { domainOfDiscipline } from '@house-technical-designer/core-domain';
import { detectRooms } from '@house-technical-designer/editor-core';
import { allRoofPlanes } from '@house-technical-designer/core-domain';

/** Un contour fermé par les murs, et ce qu'il enferme. */
export interface ClosedContour {
  readonly areaM2: number;
  /** La pièce qui le couvre déjà, quand il y en a une. */
  readonly spaceId?: string;
}

export interface DesignState {
  readonly levelCount: number;
  /** Ce que le niveau dessiné porte, parce que c'est là qu'on travaille. */
  readonly wallCount: number;
  readonly exteriorWallCount: number;
  readonly closedContours: readonly ClosedContour[];
  /**
   * Les contours fermés qui ne portent pas encore de pièce.
   *
   * C'est le compte le plus utile de tous : il dit exactement où en est le
   * travail entre « les murs sont tracés » et « les pièces sont nommées ».
   */
  readonly contoursWithoutSpace: number;
  readonly spaceCount: number;
  readonly unnamedSpaceCount: number;
  readonly openingCount: number;
  readonly slabCount: number;
  readonly stairCount: number;
  readonly roofSurfaceCount: number;
  readonly structuralMemberCount: number;
  /** Ce que le niveau porte de posé, par ce à quoi cela sert. */
  readonly sanitaryFixtureCount: number;
  readonly distributionBoardCount: number;
  readonly pvModuleCount: number;
  /** Les réseaux du projet, qui n'appartiennent à aucun niveau. */
  readonly networkCount: number;
  /**
   * Les métiers qui ont **leur** réseau, et pas seulement un réseau.
   *
   * « Un réseau existe » suffisait à activer « Tracer un tronçon » dans les
   * douze disciplines : le bouton de la ventilation était vif sur un projet
   * qui n'a qu'un réseau d'eau, on cliquait, et le refus parlait de ports.
   * Ce qu'on veut savoir est si **ce** métier a de quoi tracer.
   */
  readonly networkDomains: readonly DesignDomainId[];
}

/** L'état d'un projet vide : tout à zéro, et aucun cas particulier ailleurs. */
export const EMPTY_DESIGN_STATE: DesignState = {
  levelCount: 0,
  wallCount: 0,
  exteriorWallCount: 0,
  closedContours: [],
  contoursWithoutSpace: 0,
  spaceCount: 0,
  unnamedSpaceCount: 0,
  openingCount: 0,
  slabCount: 0,
  stairCount: 0,
  roofSurfaceCount: 0,
  structuralMemberCount: 0,
  sanitaryFixtureCount: 0,
  distributionBoardCount: 0,
  pvModuleCount: 0,
  networkCount: 0,
  networkDomains: [],
};

/**
 * Combien de composants du niveau relèvent d'une catégorie.
 *
 * La catégorie est celle que l'objet posé déclare — pas celle de sa fiche :
 * un projet peut poser un composant sans modèle, et il compte quand même.
 */
function componentsOf(
  level: Project['building']['levels'][number],
  category: string,
): number {
  return (level.components ?? []).filter(
    (component) => component.category === category,
  ).length;
}

/**
 * Les métiers dont le projet tient un réseau.
 *
 * Le pont entre les deux vocabulaires — ce qu'un tronçon transporte, et le
 * métier sous lequel un dessin est classé — est écrit une fois dans le
 * domaine ; on le lit, on ne le refait pas.
 */
function networkDomainsOf(project: Project): readonly DesignDomainId[] {
  const domains = new Set<DesignDomainId>();
  for (const network of project.systems ?? []) {
    const domain = domainOfDiscipline(network.discipline);
    if (domain !== undefined) domains.add(domain);
  }
  return [...domains];
}

/**
 * L'état du bâtiment, tel que le niveau dessiné le montre.
 *
 * Le niveau compte : on ne pose pas une porte dans un mur d'un autre étage, et
 * proposer l'outil parce qu'un mur existe ailleurs serait le proposer pour
 * qu'il échoue. Ce qui ne dépend d'aucun niveau — les réseaux, la pile
 * d'étages — est compté sur le projet.
 */
export function designStateOf(
  project: Project,
  levelId: string | undefined,
): DesignState {
  const levels = project.building.levels;
  const level = levels.find(({ id }) => id === levelId) ?? levels[0];
  if (level === undefined)
    return {
      ...EMPTY_DESIGN_STATE,
      networkCount: (project.systems ?? []).length,
      networkDomains: networkDomainsOf(project),
    };

  const contours: readonly ClosedContour[] = detectRooms(project, level.id).map(
    (room) => ({
      areaM2: room.areaM2,
      ...(room.existingSpaceId === undefined
        ? {}
        : { spaceId: room.existingSpaceId }),
    }),
  );

  return {
    levelCount: levels.length,
    wallCount: level.walls.length,
    exteriorWallCount: level.walls.filter(({ role }) => role === 'EXTERIOR')
      .length,
    closedContours: contours,
    contoursWithoutSpace: contours.filter(
      ({ spaceId }) => spaceId === undefined,
    ).length,
    spaceCount: level.spaces.length,
    // Une pièce sans nom est une pièce dont personne n'a dit ce qu'elle est :
    // la géométrie est juste, le sens manque.
    unnamedSpaceCount: level.spaces.filter(
      (space) => (space.name ?? '').trim() === '',
    ).length,
    openingCount: level.openings.length,
    slabCount: level.slabs.length,
    stairCount: level.stairs.length,
    /*
     * Les pans qu'on peut percer, et non les seuls objets « pan » posés à la
     * main. Une toiture décrite par son contour rend ses pans par dérivation :
     * ne compter que `level.roofs` disait « aucune toiture » à quelqu'un qui
     * venait d'en dessiner une, et grisait la fenêtre de toit dans un projet
     * qui en attendait une.
     */
    roofSurfaceCount: allRoofPlanes(level).length,
    structuralMemberCount: (level.structure ?? []).length,
    sanitaryFixtureCount: componentsOf(level, 'SANITARY'),
    distributionBoardCount: componentsOf(level, 'ELECTRICAL'),
    pvModuleCount: componentsOf(level, 'PHOTOVOLTAIC'),
    networkCount: (project.systems ?? []).length,
    networkDomains: networkDomainsOf(project),
  };
}
