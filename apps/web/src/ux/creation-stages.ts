/**
 * Ce que je suis en train de faire.
 *
 * Cinq espaces répondaient à « où je travaille » ; ils demandaient à
 * quelqu'un qui pose une prise de savoir d'avance qu'une prise se pose dans
 * « Systèmes ». Neuf étapes répondent à la question qu'on se pose vraiment en
 * dessinant une maison — je suis en train de faire le bâtiment, la structure,
 * les réseaux — et l'ordre dans lequel elles sont écrites est celui d'un
 * chantier.
 *
 * Une étape **filtre ce qui est proposé. Elle ne restreint jamais ce qui est
 * possible.** On peut revenir en arrière, sauter une étape, poser
 * l'électricité avant la toiture, reprendre un mur après avoir tracé les
 * réseaux. La recherche et la palette donnent accès à tout, depuis n'importe
 * où. Rien ici ne se « valide », rien ne se verrouille, et rien n'est écrit
 * dans le projet : l'étape active est un état d'écran.
 *
 * À ne pas confondre avec les dix `WorkflowGroup` de `workflow-steps.ts` :
 * ceux-là disent **ce qu'il reste à faire**, dérivé du modèle. Les deux sont
 * reliés par `groups`, et ne fusionnent pas.
 */
import type { DesignDomainId } from '@house-technical-designer/core-domain';

import type { WorkflowGroup } from './workflow-steps.js';
import type { LegacyWorkspaceTab } from './workspaces.js';

export const CREATION_STAGES = [
  'PROJECT',
  'SITE',
  'BUILDING',
  'STRUCTURE',
  'FITTING',
  'SYSTEMS',
  'ENERGY',
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
  readonly destinations: readonly [LegacyWorkspaceTab, ...LegacyWorkspaceTab[]];
  /**
   * Les bibliothèques que cette étape consulte.
   *
   * Ce ne sont pas des destinations : on ne « va » pas dans les matériaux, on
   * les ouvre parce qu'un mur en désigne un. Elles sont donc rangées avec le
   * reste de ce qu'on cherche — dans l'arborescence — et non en tête du
   * panneau, où elles prenaient quatre rangées à chaque séance.
   */
  readonly libraries?: readonly LegacyWorkspaceTab[];
}

const STAGE_DEFINITIONS = {
  PROJECT: {
    id: 'PROJECT',
    label: 'Projet',
    shortcut: 'P',
    description: 'Ce que ce projet est : périmètre, niveaux, options.',
    groups: ['PROJECT'],
    domains: [],
    sections: [],
    destinations: ['project', 'building'],
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
  },
  BUILDING: {
    id: 'BUILDING',
    label: 'Bâtiment',
    shortcut: 'B',
    description: 'Les murs, les pièces, les ouvertures, la toiture.',
    groups: ['BUILDING', 'ARCHITECTURE'],
    domains: ['ARCHITECTURE'],
    sections: [
      { id: 'building.levels', label: 'Niveaux' },
      { id: 'building.walls', label: 'Murs' },
      { id: 'building.spaces', label: 'Pièces' },
      { id: 'building.openings', label: 'Ouvertures' },
      { id: 'building.slabs', label: 'Dalles' },
      { id: 'building.stairs', label: 'Escaliers' },
      { id: 'building.roof', label: 'Toiture' },
    ],
    destinations: ['plan'],
    libraries: ['materials', 'assemblies', 'openings'],
  },
  STRUCTURE: {
    id: 'STRUCTURE',
    label: 'Structure',
    shortcut: 'R',
    description: 'Ce qui porte : murs porteurs, poteaux, poutres, trémies.',
    groups: ['CONSTRUCTION'],
    domains: ['STRUCTURE'],
    sections: [
      { id: 'structure.bearing', label: 'Porteurs' },
      { id: 'structure.columns', label: 'Poteaux' },
      { id: 'structure.beams', label: 'Poutres' },
      { id: 'structure.holes', label: 'Trémies' },
    ],
    destinations: ['plan'],
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
  },
  SYSTEMS: {
    id: 'SYSTEMS',
    label: 'Systèmes',
    shortcut: 'S',
    description: 'Le même plan, lu par une discipline technique à la fois.',
    groups: ['TECHNICAL'],
    domains: [
      'PLUMBING',
      'WASTEWATER',
      'RAINWATER',
      'HEATING',
      'VENTILATION',
      'ELECTRICAL',
      'LIGHTING',
      'FLUE',
      'DATA',
      'SAFETY',
    ],
    sections: [
      { id: 'systems.water', label: 'Eau', domain: 'PLUMBING' },
      { id: 'systems.waste', label: 'Évacuation', domain: 'WASTEWATER' },
      { id: 'systems.rain', label: 'Eaux pluviales', domain: 'RAINWATER' },
      { id: 'systems.heating', label: 'Chauffage', domain: 'HEATING' },
      { id: 'systems.air', label: 'Ventilation', domain: 'VENTILATION' },
      { id: 'systems.power', label: 'Électricité', domain: 'ELECTRICAL' },
      { id: 'systems.light', label: 'Éclairage', domain: 'LIGHTING' },
      { id: 'systems.flue', label: 'Conduits de fumée', domain: 'FLUE' },
      { id: 'systems.data', label: 'Courants faibles', domain: 'DATA' },
      { id: 'systems.safety', label: 'Sécurité', domain: 'SAFETY' },
    ],
    destinations: ['plan', 'networks'],
  },
  ENERGY: {
    id: 'ENERGY',
    label: 'Énergie',
    shortcut: 'E',
    description: 'Le photovoltaïque, le stockage, le bilan.',
    groups: ['ENERGY'],
    domains: ['SOLAR', 'STORAGE'],
    sections: [
      { id: 'energy.solar', label: 'Solaire', domain: 'SOLAR' },
      { id: 'energy.storage', label: 'Stockage', domain: 'STORAGE' },
      { id: 'energy.balance', label: 'Bilan' },
    ],
    destinations: ['plan', 'calculations'],
  },
  CHECKS: {
    id: 'CHECKS',
    label: 'Vérifier',
    shortcut: 'V',
    description:
      'Ce que le bâtiment dessiné donne : calculs, quantités, écarts.',
    groups: ['CHECKS'],
    domains: [],
    sections: [],
    destinations: ['plan', 'checks', 'calculations', 'quantities', 'scenarios'],
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
export function stageOfTab(tab: LegacyWorkspaceTab): CreationStageId {
  const found = CREATION_STAGES.find((id) => tabsOfStage(id).includes(tab));
  return found ?? 'BUILDING';
}

/** Tout ce qu'une étape ouvre : ses destinations et ses bibliothèques. */
export function tabsOfStage(
  stage: CreationStageId,
): readonly LegacyWorkspaceTab[] {
  const stageDefinition = CREATION_STAGE_REGISTRY[stage];
  return [
    ...stageDefinition.destinations,
    ...(stageDefinition.libraries ?? []),
  ];
}

/** Les destinations d'une étape, dans l'ordre où le panneau les liste. */
export function destinationsOfStage(
  stage: CreationStageId,
): readonly LegacyWorkspaceTab[] {
  return CREATION_STAGE_REGISTRY[stage].destinations;
}

/** Les bibliothèques d'une étape, rangées avec ce qu'on cherche. */
export function librariesOfStage(
  stage: CreationStageId,
): readonly LegacyWorkspaceTab[] {
  return CREATION_STAGE_REGISTRY[stage].libraries ?? [];
}

/**
 * Ce sur quoi une étape s'ouvre la première fois.
 *
 * Sa première destination. Jamais rien : une étape qui s'ouvre sur du vide est
 * une étape qu'il faut expliquer.
 */
export function defaultTabOfStage(stage: CreationStageId): LegacyWorkspaceTab {
  return CREATION_STAGE_REGISTRY[stage].destinations[0];
}

/** La discipline qu'une étape propose d'abord, quand elle en propose une. */
export function defaultDomainOfStage(
  stage: CreationStageId,
): DesignDomainId | undefined {
  return CREATION_STAGE_REGISTRY[stage].domains[0];
}
