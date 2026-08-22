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
