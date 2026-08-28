/**
 * Les sept parties d'une maison.
 *
 * Cinq espaces répondaient à « où je travaille » ; neuf étapes ont répondu à
 * « ce que je suis en train de faire », et deux d'entre elles demandaient
 * encore de savoir d'avance où quelque chose se dessine : un poteau était dans
 * Structure et pas dans Bâtiment, un panneau dans Énergie et pas dans
 * Systèmes. Ce sont les deux qui ont fusionné.
 *
 * Sept, parce que sept est le nombre de parties qu'une maison a quand on la
 * décrit à quelqu'un : le projet, le terrain, le bâti, ce qu'on met dedans, ce
 * qui circule dans les murs, ce qu'on vérifie, ce qu'on sort. Aucun huitième
 * onglet ne sera ajouté ; une fonction nouvelle trouve sa sous-partie.
 *
 * Un espace **filtre ce qui est proposé, et décide de ce qui est modifiable.**
 * C'est la moitié qui manquait. On peut toujours revenir en arrière, en sauter
 * un, poser l'électricité avant la toiture, reprendre un mur après avoir tracé
 * les réseaux : aucun ordre n'est imposé, rien ne se « valide », rien n'est
 * écrit dans le projet — l'espace actif reste un état d'écran.
 *
 * Mais un objet appartient à un espace, et il ne se modifie que là. La
 * parcelle au Terrain, les murs au Bâtiment, le mobilier à l'Aménagement, les
 * réseaux aux Systèmes. Ailleurs il reste **visible**, parce qu'on route des
 * gaines contre des murs, et **consultable**, parce qu'un constat thermique
 * doit pouvoir mener au mur dont il parle. Il n'y est pas modifiable.
 *
 * La règle disait exactement l'inverse jusqu'ici — « il ne restreint jamais ce
 * qui est possible » — et elle a coûté ce qu'elle promettait : un clic un peu
 * large depuis l'onglet du bâtiment déplaçait la limite du terrain. Voir
 * `ownership.ts`, qui la porte, et `ProjectEditingSession.dispatch`, qui la
 * tient sur le seul passage qui écrit.
 *
 * La recherche et la palette continuent de donner accès à tout, depuis
 * n'importe où : trouver un outil n'est pas s'en servir.
 *
 * À ne pas confondre avec les dix `WorkflowGroup` de `workflow-steps.ts` :
 * ceux-là disent **ce qu'il reste à faire**, dérivé du modèle. Les deux sont
 * reliés par `groups`, et ne fusionnent pas.
 *
 * Voir `docs/UX_ARCHITECTURE_V4.md` §1.
 */
import type { DesignDomainId } from '@house-technical-designer/core-domain';

import type { WorkflowGroup } from './workflow-steps.js';
import type { DestinationId } from './destinations.js';

export const CREATION_STAGES = [
  'PROJECT',
  'SITE',
  'BUILDING',
  'FITTING',
  'SYSTEMS',
  'CHECKS',
  'DOCUMENTS',
] as const;
export type CreationStageId = (typeof CREATION_STAGES)[number];

export function isCreationStage(value: string): value is CreationStageId {
  return (CREATION_STAGES as readonly string[]).includes(value);
}

/**
 * Une sous-étape : ce qu'on fait à l'intérieur de l'étape.
 *
 * Dans Systèmes, une sous-étape **est** une discipline — la choisir change le
 * métier par lequel le plan se lit. Ailleurs c'est un groupe d'outils, et
 * `domain` reste vide. La distinction est portée ici, pas par le composant.
 *
 * Les outils que chaque sous-étape propose ne sont pas déclarés ici : ils
 * vivent dans la boîte à outils, qui parle des outils. Ce registre parle des
 * étapes.
 */
export interface StageSection {
  readonly id: string;
  readonly label: string;
  readonly domain?: DesignDomainId;
}

export interface CreationStage {
  readonly id: CreationStageId;
  readonly label: string;
  /** Une lettre, pour la reconnaître et pour l'atteindre au clavier. */
  readonly shortcut: string;
  readonly description: string;
  /** Les groupes de progression que cette étape fait avancer. */
  readonly groups: readonly WorkflowGroup[];
  /** Les métiers qu'elle propose ; le premier est la discipline par défaut. */
  readonly domains: readonly DesignDomainId[];
  readonly sections: readonly StageSection[];
  /**
   * Ce que l'étape offre, dans l'ordre où le panneau les liste.
   *
   * Le plan y figure plusieurs fois, exprès : une étape n'est pas un endroit
   * où l'on va, c'est le même dessin avec d'autres outils devant soi.
   */
  readonly destinations: readonly [DestinationId, ...DestinationId[]];
  /**
   * Les bibliothèques que cette étape consulte.
   *
   * Ce ne sont pas des destinations : on ne « va » pas dans les matériaux, on
   * les ouvre parce qu'un mur en désigne un. Elles sont donc rangées avec le
   * reste de ce qu'on cherche — dans l'arborescence — et non en tête du
   * panneau, où elles prenaient quatre rangées à chaque séance.
   */
  readonly libraries?: readonly DestinationId[];
  /**
   * Les aides que le plan montre dans cet espace, et dans celui-là seulement.
   *
   * Les dégagements et les superpositions d'analyse étaient offerts partout :
   * cinq cases de dégagement et vingt analyses dans la colonne du terrain,
   * dans celle des documents, dans celle du projet. Un panneau qui répond à
   * une question qu'on ne se pose pas ici est du bruit permanent, et il
   * repousse sous la ligne de flottaison ce qu'on est venu chercher.
   *
   * Chaque aide est donc nommée là où elle sert : les dégagements quand on
   * pose des objets et des réseaux, l'analyse quand on vérifie, le nord quand
   * on s'occupe du terrain. Ailleurs, elles n'existent pas.
   */
  readonly planAids?: readonly PlanAid[];
}

/**
 * Ce que le plan peut montrer en plus du dessin.
 *
 * - `CLEARANCES` : les volumes qu'un objet réclame autour de lui.
 * - `ANALYSIS` : une superposition colorée, calculée par un module.
 * - `NORTH` : l'orientation du terrain, réglée contre le plan.
 * - `UNDERLAY` : un relevé posé sous le dessin, pour tracer par-dessus.
 */
export type PlanAid = 'CLEARANCES' | 'ANALYSIS' | 'NORTH' | 'UNDERLAY';

const STAGE_DEFINITIONS = {
  PROJECT: {
    id: 'PROJECT',
    label: 'Projet',
    shortcut: 'P',
    description: 'Ce que ce projet est : périmètre, options, référentiels.',
    groups: ['PROJECT'],
    domains: [],
    sections: [],
    /*
     * Les réglages du projet, et rien d'autre.
     *
     * « Niveaux et pièces » était ici, et c'est le panneau qui pose les murs,
     * les dalles, les pièces, les escaliers, la toiture et la structure. On
     * modifiait donc le bâtiment depuis l'onglet des réglages, ce qui n'était
     * pas seulement mal rangé : depuis que chaque objet a un espace
     * propriétaire, tout ce que ce panneau fait y aurait été refusé, puisque
     * Projet ne possède aucun objet. Le panneau a rejoint le Bâtiment, qui est
     * ce dont il parle.
     */
    destinations: ['project'],
  },
  SITE: {
    id: 'SITE',
    label: 'Terrain',
    shortcut: 'T',
    description: 'La parcelle, le nord, ce qui entoure la maison.',
    groups: ['SITE'],
    domains: ['SITE'],
    sections: [],
    destinations: ['plan'],
    // Le nord se règle ici parce que c'est ici qu'il veut dire quelque chose :
    // l'ombre du voisin, l'orientation des pans, la course du soleil. Et le
    // relevé qu'on décalque : une parcelle se trace sur ce qu'on a reçu.
    planAids: ['NORTH', 'UNDERLAY'],
  },
  BUILDING: {
    id: 'BUILDING',
    label: 'Bâtiment',
    shortcut: 'B',
    description:
      'Les murs, les pièces, les ouvertures, la toiture, ce qui porte.',
    groups: ['BUILDING', 'ARCHITECTURE', 'CONSTRUCTION'],
    domains: ['ARCHITECTURE', 'STRUCTURE'],
    // Le même relevé sert ici : on trace les murs sur l'esquisse comme on a
    // tracé la parcelle sur le cadastre.
    planAids: ['UNDERLAY'],
    sections: [
      { id: 'building.levels', label: 'Niveaux' },
      { id: 'building.walls', label: 'Murs' },
      { id: 'building.spaces', label: 'Pièces' },
      { id: 'building.openings', label: 'Ouvertures' },
      { id: 'building.slabs', label: 'Dalles' },
      { id: 'building.stairs', label: 'Escaliers' },
      { id: 'building.roof', label: 'Toiture' },
      { id: 'structure.frame', label: 'Structure', domain: 'STRUCTURE' },
    ],
    destinations: ['plan', 'building'],
    libraries: ['materials', 'assemblies', 'openings'],
  },
  FITTING: {
    id: 'FITTING',
    label: 'Aménagement',
    shortcut: 'A',
    description: 'Ce qu’on pose dans les pièces : mobilier, appareils.',
    groups: ['FITTING'],
    domains: ['FURNITURE'],
    sections: [],
    destinations: ['plan'],
    libraries: ['equipment'],
    // Les dégagements sont la question de cet espace : un lave-linge sans son
    // mètre devant est un lave-linge qu'on n'ouvre pas.
    planAids: ['CLEARANCES'],
  },
  SYSTEMS: {
    id: 'SYSTEMS',
    label: 'Systèmes',
    shortcut: 'S',
    description: 'Le même plan, lu par une discipline technique à la fois.',
    groups: ['TECHNICAL', 'ENERGY'],
    domains: [
      'PLUMBING',
      'WASTEWATER',
      'RAINWATER',
      'HEATING',
      'VENTILATION',
      'ELECTRICAL',
      'LIGHTING',
      'DATA',
      'SAFETY',
      'FLUE',
      'SOLAR',
      'STORAGE',
    ],
    sections: [
      { id: 'systems.water', label: 'Eau', domain: 'PLUMBING' },
      { id: 'systems.waste', label: 'Évacuation', domain: 'WASTEWATER' },
      { id: 'systems.rain', label: 'Eaux pluviales', domain: 'RAINWATER' },
      { id: 'systems.heating', label: 'Chauffage', domain: 'HEATING' },
      { id: 'systems.air', label: 'Ventilation', domain: 'VENTILATION' },
      { id: 'systems.power', label: 'Électricité', domain: 'ELECTRICAL' },
      { id: 'systems.light', label: 'Éclairage', domain: 'LIGHTING' },
      { id: 'systems.data', label: 'Courants faibles', domain: 'DATA' },
      { id: 'systems.safety', label: 'Sécurité', domain: 'SAFETY' },
      { id: 'systems.flue', label: 'Conduits de fumée', domain: 'FLUE' },
      { id: 'systems.solar', label: 'Solaire', domain: 'SOLAR' },
      { id: 'systems.storage', label: 'Stockage', domain: 'STORAGE' },
    ],
    destinations: ['plan', 'networks'],
    // Un tronçon passe où il y a la place : les dégagements des appareils
    // qu'il dessert sont ce qui décide de son tracé.
    planAids: ['CLEARANCES'],
  },
  CHECKS: {
    id: 'CHECKS',
    label: 'Études',
    shortcut: 'E',
    description:
      'Ce que le bâtiment dessiné donne : vérifications, calculs, quantités.',
    groups: ['CHECKS'],
    domains: [],
    sections: [],
    // L'analyse **est** cet espace : une superposition colorée est une étude
    // qu'on lit sur le dessin plutôt que dans un tableau.
    planAids: ['ANALYSIS'],
    // La vue d'ensemble d'abord : cet onglet lit le bâtiment, il ne le dessine
    // pas. Le plan reste au bout, parce qu'un écart s'ouvre sur son objet.
    destinations: ['checks', 'calculations', 'quantities', 'scenarios', 'plan'],
  },
  DOCUMENTS: {
    id: 'DOCUMENTS',
    label: 'Documents',
    shortcut: 'D',
    description: 'Les vues enregistrées, les feuilles et les exports.',
    groups: ['DOCUMENTS'],
    domains: [],
    sections: [],
    destinations: ['documents', 'plan'],
  },
} as const satisfies Record<CreationStageId, CreationStage>;

export const CREATION_STAGE_REGISTRY: Readonly<
  Record<CreationStageId, CreationStage>
> = STAGE_DEFINITIONS;

export function creationStage(id: CreationStageId): CreationStage {
  return CREATION_STAGE_REGISTRY[id];
}

/**
 * L'étape où se dessine un métier.
 *
 * Lue depuis le registre plutôt qu'écrite une seconde fois : ajouter une
 * discipline à une étape suffit, et la table inverse suit.
 */
export function stageOfDomain(domain: DesignDomainId): CreationStageId {
  const found = CREATION_STAGES.find((id) =>
    CREATION_STAGE_REGISTRY[id].domains.includes(domain),
  );
  // Un métier qu'aucune étape ne réclame se dessine dans le bâtiment : c'est
  // là que se trouve le plan, et mieux vaut un outil au mauvais endroit qu'un
  // outil nulle part.
  return found ?? 'BUILDING';
}

/**
 * L'étape où vit une destination, pour qui la nomme sans savoir où elle est.
 *
 * Les bibliothèques comptent : une entrée de palette qui dit « Matériaux » doit
 * mener quelque part, même si aucune étape ne s'ouvre dessus.
 */
export function stageOfTab(tab: DestinationId): CreationStageId {
  const found = CREATION_STAGES.find((id) => tabsOfStage(id).includes(tab));
  return found ?? 'BUILDING';
}

/** Tout ce qu'une étape ouvre : ses destinations et ses bibliothèques. */
export function tabsOfStage(stage: CreationStageId): readonly DestinationId[] {
  const stageDefinition = CREATION_STAGE_REGISTRY[stage];
  return [
    ...stageDefinition.destinations,
    ...(stageDefinition.libraries ?? []),
  ];
}

/** Les destinations d'une étape, dans l'ordre où le panneau les liste. */
export function destinationsOfStage(
  stage: CreationStageId,
): readonly DestinationId[] {
  return CREATION_STAGE_REGISTRY[stage].destinations;
}

/** Les bibliothèques d'une étape, rangées avec ce qu'on cherche. */
export function librariesOfStage(
  stage: CreationStageId,
): readonly DestinationId[] {
  return CREATION_STAGE_REGISTRY[stage].libraries ?? [];
}

/**
 * Ce sur quoi une étape s'ouvre la première fois.
 *
 * Sa première destination. Jamais rien : une étape qui s'ouvre sur du vide est
 * une étape qu'il faut expliquer.
 */
export function defaultTabOfStage(stage: CreationStageId): DestinationId {
  return CREATION_STAGE_REGISTRY[stage].destinations[0];
}

/** La discipline qu'une étape propose d'abord, quand elle en propose une. */
export function defaultDomainOfStage(
  stage: CreationStageId,
): DesignDomainId | undefined {
  return CREATION_STAGE_REGISTRY[stage].domains[0];
}
