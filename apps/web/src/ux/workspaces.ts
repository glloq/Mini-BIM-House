/**
 * The five places the application has.
 *
 * There were eleven destinations in one column, and eleven destinations read
 * as eleven unrelated applications: a person looking for « où je pose une
 * prise » had to already know that prises live under « Réseaux » and not under
 * « Équipements ». Five spaces answer a different question — *where am I
 * working* — and everything else becomes a context inside one of them.
 *
 * These are not the ten construction phases. The phases say what is left to
 * do; they are the engine of the guide and never appear as tabs. « Cinq
 * espaces = où je travaille. Les étapes = ce qu'il reste éventuellement à
 * faire. »
 */
import type { DesignDomainId } from '@house-technical-designer/core-domain';

export const PRIMARY_WORKSPACES = [
  'PROJECT',
  'BUILD',
  'SYSTEMS',
  'ANALYZE',
  'DOCUMENTS',
] as const;
export type PrimaryWorkspace = (typeof PRIMARY_WORKSPACES)[number];

export function isPrimaryWorkspace(value: string): value is PrimaryWorkspace {
  return (PRIMARY_WORKSPACES as readonly string[]).includes(value);
}

export interface PrimaryWorkspaceDescriptor {
  readonly id: PrimaryWorkspace;
  readonly label: string;
  /** The single letter of the rail, and the accelerator that reaches it. */
  readonly shortcut: string;
  readonly description: string;
  /**
   * Whether this space draws the model on the shared canvas.
   *
   * Four of the five do. « Analyser » is a context over the same canvas rather
   * than a way out of the model, and « Projet » is the only one that is a form.
   */
  readonly usesCanvas: boolean;
}

export const PRIMARY_WORKSPACE_DESCRIPTORS = {
  PROJECT: {
    id: 'PROJECT',
    label: 'Projet',
    shortcut: 'P',
    description: 'Ce que ce projet est : terrain, niveaux, périmètre, options.',
    usesCanvas: false,
  },
  BUILD: {
    id: 'BUILD',
    label: 'Construire',
    shortcut: 'B',
    description: 'Les murs, les pièces, les ouvertures et ce qu’on y pose.',
    usesCanvas: true,
  },
  SYSTEMS: {
    id: 'SYSTEMS',
    label: 'Systèmes',
    shortcut: 'S',
    description: 'Le même plan, lu par une discipline technique à la fois.',
    usesCanvas: true,
  },
  ANALYZE: {
    id: 'ANALYZE',
    label: 'Analyser',
    shortcut: 'A',
    description:
      'Ce que le bâtiment dessiné donne : calculs, quantités, écarts.',
    usesCanvas: true,
  },
  DOCUMENTS: {
    id: 'DOCUMENTS',
    label: 'Documents',
    shortcut: 'D',
    description: 'Les vues enregistrées, les feuilles et les exports.',
    usesCanvas: true,
  },
} as const satisfies Record<PrimaryWorkspace, PrimaryWorkspaceDescriptor>;

export const PRIMARY_WORKSPACE_REGISTRY: Readonly<
  Record<PrimaryWorkspace, PrimaryWorkspaceDescriptor>
> = PRIMARY_WORKSPACE_DESCRIPTORS;

export function primaryWorkspace(
  id: PrimaryWorkspace,
): PrimaryWorkspaceDescriptor {
  return PRIMARY_WORKSPACE_REGISTRY[id];
}

/**
 * The space a trade is designed in.
 *
 * Architecture, structure, site and furniture are drawn in the building; the
 * technical trades are drawn in Systèmes, on the same plan with a different
 * discipline switched on.
 */
export function workspaceOfDomain(domain: DesignDomainId): PrimaryWorkspace {
  switch (domain) {
    case 'ARCHITECTURE':
    case 'STRUCTURE':
    case 'FURNITURE':
      return 'BUILD';
    case 'SITE':
      return 'PROJECT';
    default:
      return 'SYSTEMS';
  }
}

/**
 * Where the old workspace went.
 *
 * The redesign is a remapping, not a demolition: every one of the eleven
 * destinations has to stay reachable, and this table is what proves it. Left
 * out of the primary rail on purpose — matériaux, assemblages, quantités,
 * scénarios and vérifications are tools and results, and a tool is not a
 * place. They reappear as contexts inside the space they belong to.
 */
export const LEGACY_WORKSPACE_TABS = [
  'project',
  'plan',
  'building',
  'materials',
  'assemblies',
  'openings',
  'equipment',
  'networks',
  'calculations',
  'quantities',
  'scenarios',
  'checks',
  'documents',
] as const;
export type LegacyWorkspaceTab = (typeof LEGACY_WORKSPACE_TABS)[number];

export const LEGACY_WORKSPACE_HOME = {
  project: 'PROJECT',
  plan: 'BUILD',
  building: 'BUILD',
  materials: 'BUILD',
  assemblies: 'BUILD',
  openings: 'BUILD',
  equipment: 'BUILD',
  networks: 'SYSTEMS',
  calculations: 'ANALYZE',
  quantities: 'ANALYZE',
  scenarios: 'ANALYZE',
  checks: 'ANALYZE',
  documents: 'DOCUMENTS',
} as const satisfies Record<LegacyWorkspaceTab, PrimaryWorkspace>;

export function workspaceOfLegacyTab(
  tab: LegacyWorkspaceTab,
): PrimaryWorkspace {
  return LEGACY_WORKSPACE_HOME[tab];
}

export const LEGACY_WORKSPACE_LABELS = {
  project: 'Projet',
  plan: 'Plan',
  building: 'Niveaux et pièces',
  materials: 'Matériaux',
  assemblies: 'Assemblages',
  openings: 'Menuiseries',
  equipment: 'Équipements',
  networks: 'Réseaux',
  calculations: 'Calculs',
  quantities: 'Quantités',
  scenarios: 'Scénarios',
  checks: 'Vérifications',
  documents: 'Vues et feuilles',
} as const satisfies Record<LegacyWorkspaceTab, string>;

/**
 * What the context panel calls its group of destinations, per space.
 *
 * Three levels of density and no more: the space, the group, the action. A
 * fourth level is where a person stops knowing where they are.
 */
export const CONTEXT_GROUP_LABELS = {
  PROJECT: 'Le projet',
  BUILD: 'Dessiner',
  SYSTEMS: 'Réseaux',
  ANALYZE: 'Résultats',
  DOCUMENTS: 'Sortir',
} as const satisfies Record<PrimaryWorkspace, string>;

/**
 * What each space offers, in the order the panel lists them.
 *
 * The plan appears twice on purpose. Systèmes is not another application: it
 * is the same drawing, the same inspector and the same tools with one
 * discipline switched on, and a space that took you away from the model to
 * show you its networks would be exactly the eleven-destination arrangement
 * again, wearing five names.
 *
 * `LEGACY_WORKSPACE_HOME` still says where a destination *belongs*, which is
 * what a command palette entry or a check needs; this says what a space
 * *offers*, which is what the panel needs.
 */
export const WORKSPACE_DESTINATIONS = {
  PROJECT: ['project'],
  BUILD: [
    'plan',
    'building',
    'materials',
    'assemblies',
    'openings',
    'equipment',
  ],
  SYSTEMS: ['plan', 'networks'],
  // Analyser opens on the plan too: a result is read against the building it
  // is about. A space that took you out of the model to show you a number
  // would make the number harder to believe, not easier.
  ANALYZE: ['plan', 'calculations', 'quantities', 'scenarios', 'checks'],
  DOCUMENTS: ['documents'],
} as const satisfies Record<
  PrimaryWorkspace,
  readonly [LegacyWorkspaceTab, ...LegacyWorkspaceTab[]]
>;

/** The destinations a space holds, in the order the panel lists them. */
export function legacyTabsOfWorkspace(
  workspace: PrimaryWorkspace,
): readonly LegacyWorkspaceTab[] {
  return WORKSPACE_DESTINATIONS[workspace];
}

/**
 * What a space opens on when it is entered for the first time.
 *
 * The first destination it offers. Never nothing: a space that opens on an
 * empty canvas is a space that has to be explained.
 */
export function defaultTabOfWorkspace(
  workspace: PrimaryWorkspace,
): LegacyWorkspaceTab {
  return WORKSPACE_DESTINATIONS[workspace][0];
}
