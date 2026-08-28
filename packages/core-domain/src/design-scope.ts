/**
 * What the person has decided to design, and what the interface may therefore
 * leave out.
 *
 * This is a **work scope**, not a capability of the file. Switching
 * photovoltaics off means « ne m'encombre pas l'interface avec ça » ; it never
 * means « ce projet ne peut pas contenir de photovoltaïque ». Nothing here
 * removes, refuses or hides data: a project that already carries an electrical
 * network keeps it whether or not electricity is in the scope, and the scope
 * says so rather than pretending the network is not there.
 *
 * It travels with the project, because it is a decision about the project and
 * not a preference of the browser: opening the same file on another machine
 * has to find the same scope. Panel widths go the other way — they stay in the
 * browser and never enter the file.
 */
import {
  DATA_DOMAINS,
  DATA_DOMAIN_LABELS,
  type DataDomain,
} from '@house-technical-designer/technical-types';

import type { ComponentCategory } from './component.js';
import type { NetworkDiscipline } from './network.js';
import type { Project } from './types.js';

/**
 * A trade of the project, named once.
 *
 * These are the same sixteen trades the catalogue families are sorted by. A
 * second list of trades for the interface would drift from the first, and the
 * drift would show as a family nobody can reach because its trade is not in
 * the scope list.
 */
export type DesignDomainId = DataDomain;

export const DESIGN_DOMAIN_IDS: readonly DesignDomainId[] = DATA_DOMAINS;

export function isDesignDomainId(value: string): value is DesignDomainId {
  return (DATA_DOMAINS as readonly string[]).includes(value);
}

/** What a project is for, which is what decides the sensible starting scope. */
export const PROJECT_INTENTS = [
  'NEW_BUILD',
  'RENOVATION',
  'EXISTING_SURVEY',
  'STUDY',
] as const;
export type ProjectIntent = (typeof PROJECT_INTENTS)[number];

export function isProjectIntent(value: string): value is ProjectIntent {
  return (PROJECT_INTENTS as readonly string[]).includes(value);
}

export const PROJECT_INTENT_LABELS: Readonly<Record<ProjectIntent, string>> = {
  NEW_BUILD: 'Construction neuve',
  RENOVATION: 'Rénovation',
  EXISTING_SURVEY: 'Relevé de l’existant',
  STUDY: 'Étude',
};

export const PROJECT_INTENT_DESCRIPTIONS: Readonly<
  Record<ProjectIntent, string>
> = {
  NEW_BUILD: 'Une maison à construire, dessinée depuis le terrain.',
  RENOVATION: 'Un bâtiment existant à modifier.',
  EXISTING_SURVEY: 'Un bâtiment existant à décrire, sans le transformer.',
  STUDY: 'Une comparaison ou un chiffrage, sans permis à déposer.',
};

/**
 * How a domain is presented and what it needs to be useful.
 *
 * A registry rather than twenty checkboxes written in JSX: adding a trade is
 * one entry here, and every screen that lists trades follows.
 */
export type DesignDomainCategory =
  'ESSENTIAL' | 'TECHNICAL' | 'ENERGY' | 'OTHER';

export const DESIGN_DOMAIN_CATEGORY_LABELS: Readonly<
  Record<DesignDomainCategory, string>
> = {
  ESSENTIAL: 'Indispensable',
  TECHNICAL: 'Technique',
  ENERGY: 'Énergie',
  OTHER: 'Autre',
};

export interface DesignDomainDescriptor {
  readonly id: DesignDomainId;
  readonly label: string;
  readonly description: string;
  readonly category: DesignDomainCategory;
  /** Domains this one cannot be designed without. */
  readonly dependencies?: readonly DesignDomainId[];
  /** The intents that switch this domain on when a project is created. */
  readonly defaultFor?: readonly ProjectIntent[];
  /**
   * The calculation modules this domain brings with it.
   *
   * The interface uses it to stop offering a photovoltaic yield on a project
   * that has no solar in its scope. It never stops the module from running on
   * a project that does carry panels.
   */
  readonly calculationModules?: readonly string[];
}

const EVERY_INTENT: readonly ProjectIntent[] = PROJECT_INTENTS;
const BUILT: readonly ProjectIntent[] = ['NEW_BUILD', 'RENOVATION'];
const SITED: readonly ProjectIntent[] = [
  'NEW_BUILD',
  'RENOVATION',
  'EXISTING_SURVEY',
];

/**
 * The sixteen descriptors, one per trade.
 *
 * `satisfies Record<DesignDomainId, …>` is what makes « chaque domain a un
 * descriptor » a fact the compiler checks rather than a test that has to be
 * remembered.
 */
export const DESIGN_DOMAINS = {
  ARCHITECTURE: {
    id: 'ARCHITECTURE',
    label: DATA_DOMAIN_LABELS.ARCHITECTURE,
    description: 'Murs, pièces, ouvertures, planchers, toiture.',
    category: 'ESSENTIAL',
    defaultFor: EVERY_INTENT,
    calculationModules: [
      'thermal',
      'hygrothermal',
      'energy-balance',
      'acoustics',
      'environmental',
      'cost',
    ],
  },
  STRUCTURE: {
    id: 'STRUCTURE',
    label: DATA_DOMAIN_LABELS.STRUCTURE,
    description: 'Porteurs, poutres, poteaux, fondations.',
    category: 'ESSENTIAL',
    defaultFor: BUILT,
  },
  SITE: {
    id: 'SITE',
    label: DATA_DOMAIN_LABELS.SITE,
    description: 'Parcelle, orientation, masques, accès.',
    category: 'ESSENTIAL',
    defaultFor: SITED,
  },
  PLUMBING: {
    id: 'PLUMBING',
    label: DATA_DOMAIN_LABELS.PLUMBING,
    description: 'Eau froide, eau chaude, points de puisage.',
    category: 'TECHNICAL',
    defaultFor: BUILT,
    calculationModules: ['water', 'dhw'],
  },
  WASTEWATER: {
    id: 'WASTEWATER',
    label: DATA_DOMAIN_LABELS.WASTEWATER,
    description: 'Évacuations, chutes, ventilation primaire.',
    category: 'TECHNICAL',
    dependencies: ['PLUMBING'],
    defaultFor: BUILT,
    calculationModules: ['wastewater'],
  },
  RAINWATER: {
    id: 'RAINWATER',
    label: DATA_DOMAIN_LABELS.RAINWATER,
    description: 'Gouttières, descentes, récupération.',
    category: 'TECHNICAL',
    calculationModules: ['rainwater'],
  },
  HEATING: {
    id: 'HEATING',
    label: DATA_DOMAIN_LABELS.HEATING,
    description: 'Émetteurs, générateur, distribution.',
    category: 'TECHNICAL',
    defaultFor: BUILT,
    calculationModules: ['heating'],
  },
  VENTILATION: {
    id: 'VENTILATION',
    label: DATA_DOMAIN_LABELS.VENTILATION,
    description: 'Bouches, gaines, caisson, qualité de l’air.',
    category: 'TECHNICAL',
    defaultFor: BUILT,
    calculationModules: ['ventilation', 'iaq'],
  },
  ELECTRICAL: {
    id: 'ELECTRICAL',
    label: DATA_DOMAIN_LABELS.ELECTRICAL,
    description: 'Tableau, circuits, prises, commandes.',
    category: 'TECHNICAL',
    defaultFor: BUILT,
    calculationModules: ['electrical'],
  },
  LIGHTING: {
    id: 'LIGHTING',
    label: DATA_DOMAIN_LABELS.LIGHTING,
    description: 'Points lumineux, niveaux d’éclairement.',
    category: 'TECHNICAL',
    dependencies: ['ELECTRICAL'],
    defaultFor: ['NEW_BUILD'],
    calculationModules: ['lighting'],
  },
  FLUE: {
    id: 'FLUE',
    label: DATA_DOMAIN_LABELS.FLUE,
    description: 'Conduits de fumée et sorties en toiture.',
    category: 'TECHNICAL',
    dependencies: ['HEATING'],
  },
  DATA: {
    id: 'DATA',
    label: DATA_DOMAIN_LABELS.DATA,
    description: 'Réseau informatique, télévision, domotique.',
    category: 'TECHNICAL',
    dependencies: ['ELECTRICAL'],
  },
  SAFETY: {
    id: 'SAFETY',
    label: DATA_DOMAIN_LABELS.SAFETY,
    description: 'Détection, alarme, issues.',
    category: 'TECHNICAL',
  },
  SOLAR: {
    id: 'SOLAR',
    label: DATA_DOMAIN_LABELS.SOLAR,
    description: 'Champ photovoltaïque, onduleur, production.',
    category: 'ENERGY',
    dependencies: ['ELECTRICAL'],
    calculationModules: ['photovoltaic'],
  },
  STORAGE: {
    id: 'STORAGE',
    label: DATA_DOMAIN_LABELS.STORAGE,
    description: 'Batteries et autoconsommation.',
    category: 'ENERGY',
    dependencies: ['ELECTRICAL'],
    calculationModules: ['battery'],
  },
  FURNITURE: {
    id: 'FURNITURE',
    label: DATA_DOMAIN_LABELS.FURNITURE,
    description: 'Mobilier et agencement.',
    category: 'OTHER',
  },
} as const satisfies Record<DesignDomainId, DesignDomainDescriptor>;

/**
 * The same sixteen descriptors, read as descriptors.
 *
 * `as const satisfies` above is what proves none is missing; it also narrows
 * each entry to exactly the keys it happens to have, so an absent
 * `dependencies` becomes a type error rather than `undefined`. Reading the
 * registry through its declared shape gives back the optional fields.
 */
export const DESIGN_DOMAIN_REGISTRY: Readonly<
  Record<DesignDomainId, DesignDomainDescriptor>
> = DESIGN_DOMAINS;

export function designDomain(id: DesignDomainId): DesignDomainDescriptor {
  return DESIGN_DOMAIN_REGISTRY[id];
}

export function designDomainLabel(id: string): string {
  return isDesignDomainId(id) ? DESIGN_DOMAIN_REGISTRY[id].label : id;
}

/**
 * The domain the interface may never switch off.
 *
 * A project without architecture is not a smaller project: it is a project
 * with no walls, and every other trade hangs from the walls.
 */
export const ALWAYS_ENABLED_DOMAIN: DesignDomainId = 'ARCHITECTURE';

export interface ProjectScope {
  readonly intent: ProjectIntent;
  readonly enabledDomains: readonly DesignDomainId[];
}

/** The domains an intent starts with, in registry order. */
export function defaultDomainsFor(
  intent: ProjectIntent,
): readonly DesignDomainId[] {
  return DESIGN_DOMAIN_IDS.filter((id) =>
    (DESIGN_DOMAIN_REGISTRY[id].defaultFor ?? []).includes(intent),
  );
}

export function defaultScopeFor(intent: ProjectIntent): ProjectScope {
  return { intent, enabledDomains: defaultDomainsFor(intent) };
}

/**
 * The scope of a project that never stated one.
 *
 * An older file made no choice, and the interface must not invent one for it:
 * narrowing the scope of a project that already carries an electrical network
 * would hide the person's own work behind a decision they never made. Every
 * domain is therefore offered until someone actually chooses.
 */
export function projectScopeOf(project: Project): ProjectScope {
  return (
    project.scope ?? { intent: 'NEW_BUILD', enabledDomains: DESIGN_DOMAIN_IDS }
  );
}

export function domainEnabled(
  scope: ProjectScope,
  id: DesignDomainId,
): boolean {
  return id === ALWAYS_ENABLED_DOMAIN || scope.enabledDomains.includes(id);
}

function ordered(ids: Iterable<DesignDomainId>): readonly DesignDomainId[] {
  const wanted = new Set(ids);
  return DESIGN_DOMAIN_IDS.filter((id) => wanted.has(id));
}

/**
 * The scope with one more domain, and whatever that domain needs.
 *
 * Switching lighting on without electricity would offer a luminaire that can
 * be drawn and never fed; the dependency is pulled in rather than reported.
 */
export function withDomainEnabled(
  scope: ProjectScope,
  id: DesignDomainId,
): ProjectScope {
  const wanted = new Set<DesignDomainId>(scope.enabledDomains);
  const queue: DesignDomainId[] = [id];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (wanted.has(next)) continue;
    wanted.add(next);
    for (const dependency of DESIGN_DOMAIN_REGISTRY[next].dependencies ?? [])
      queue.push(dependency);
  }
  return { ...scope, enabledDomains: ordered(wanted) };
}

/**
 * The scope with one domain fewer, and whatever depended on it.
 *
 * Nothing is deleted: the objects of that trade stay in the project, and the
 * interface simply stops proposing to add more of them.
 */
export function withDomainDisabled(
  scope: ProjectScope,
  id: DesignDomainId,
): ProjectScope {
  if (id === ALWAYS_ENABLED_DOMAIN) return scope;
  const kept = new Set<DesignDomainId>(scope.enabledDomains);
  const queue: DesignDomainId[] = [id];
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (!kept.delete(next)) continue;
    for (const other of DESIGN_DOMAIN_IDS)
      if ((DESIGN_DOMAIN_REGISTRY[other].dependencies ?? []).includes(next))
        queue.push(other);
  }
  return { ...scope, enabledDomains: ordered(kept) };
}

export function withIntent(
  scope: ProjectScope,
  intent: ProjectIntent,
): ProjectScope {
  return { ...scope, intent };
}

/**
 * A named starting selection.
 *
 * A preset only writes into the selection and then steps out of the way: the
 * checkboxes stay visible and stay editable, so nobody has to guess what
 * « Maison complète » decided on their behalf.
 */
export interface ScopePreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly domains: readonly DesignDomainId[];
}

export const SCOPE_PRESETS = [
  {
    id: 'ARCHITECTURE_ONLY',
    label: 'Architecture seule',
    description: 'Les murs, les pièces et la toiture. Rien de technique.',
    domains: ['ARCHITECTURE', 'SITE', 'STRUCTURE'],
  },
  {
    id: 'COMPLETE_HOUSE',
    label: 'Maison complète',
    description: 'L’architecture et les réseaux courants d’une maison.',
    domains: [
      'ARCHITECTURE',
      'SITE',
      'STRUCTURE',
      'PLUMBING',
      'WASTEWATER',
      'HEATING',
      'VENTILATION',
      'ELECTRICAL',
      'LIGHTING',
    ],
  },
  {
    id: 'ENERGY_HOUSE',
    label: 'Maison à énergie',
    description: 'La maison complète, plus le solaire et le stockage.',
    domains: [
      'ARCHITECTURE',
      'SITE',
      'STRUCTURE',
      'PLUMBING',
      'WASTEWATER',
      'RAINWATER',
      'HEATING',
      'VENTILATION',
      'ELECTRICAL',
      'LIGHTING',
      'SOLAR',
      'STORAGE',
    ],
  },
  {
    id: 'EVERYTHING',
    label: 'Tout',
    description: 'Tous les domaines, y compris ceux rarement utilisés.',
    domains: DESIGN_DOMAIN_IDS,
  },
] as const satisfies readonly ScopePreset[];

export type ScopePresetId = (typeof SCOPE_PRESETS)[number]['id'];

export function applyPreset(
  scope: ProjectScope,
  presetId: ScopePresetId,
): ProjectScope {
  const preset = SCOPE_PRESETS.find(({ id }) => id === presetId);
  if (preset === undefined) return scope;
  return { ...scope, enabledDomains: ordered(preset.domains) };
}

/**
 * What is wrong with a scope, said rather than repaired.
 *
 * A hand-edited file that switched lighting on and electricity off is told so;
 * silently adding electricity back would change what the file says without
 * anyone asking.
 */
export function validateProjectScope(scope: ProjectScope): readonly string[] {
  const issues: string[] = [];
  if (!isProjectIntent(scope.intent))
    issues.push(`Intention de projet inconnue : ${String(scope.intent)}.`);
  const seen = new Set<string>();
  for (const id of scope.enabledDomains) {
    if (!isDesignDomainId(id)) {
      issues.push(`Domaine inconnu : ${String(id)}.`);
      continue;
    }
    if (seen.has(id)) issues.push(`Domaine répété : ${id}.`);
    seen.add(id);
  }
  if (!seen.has(ALWAYS_ENABLED_DOMAIN))
    issues.push(
      `Le domaine ${ALWAYS_ENABLED_DOMAIN} ne peut pas être désactivé.`,
    );
  for (const id of seen) {
    if (!isDesignDomainId(id)) continue;
    for (const dependency of DESIGN_DOMAIN_REGISTRY[id].dependencies ?? [])
      if (!seen.has(dependency))
        issues.push(`${id} demande ${dependency}, qui n’est pas activé.`);
  }
  return issues;
}

/**
 * Which trade a technical network belongs to.
 *
 * The two vocabularies were written for different jobs — one names what a run
 * carries, the other names what a drawing is filed under — so the bridge is
 * written once here rather than guessed at each screen.
 */
export function domainOfDiscipline(
  discipline: NetworkDiscipline,
): DesignDomainId | undefined {
  switch (discipline) {
    case 'WATER':
      return 'PLUMBING';
    case 'WASTEWATER':
      return 'WASTEWATER';
    case 'RAINWATER':
      return 'RAINWATER';
    case 'VENTILATION':
      return 'VENTILATION';
    case 'HEATING':
      return 'HEATING';
    case 'ELECTRICAL':
      return 'ELECTRICAL';
    // `OTHER` says the trade was not stated. Filing it under one anyway would
    // invent a discipline the file never claimed.
    case 'OTHER':
      return undefined;
  }
}

/**
 * Which trade a placed component belongs to.
 *
 * The category is what the project already says about the thing; asking the
 * catalogue again would give the same answer for the entries that have one and
 * no answer at all for the entries that do not.
 */
export function domainOfComponentCategory(
  category: ComponentCategory,
): DesignDomainId | undefined {
  switch (category) {
    case 'HEATING':
      return 'HEATING';
    case 'SANITARY':
      return 'PLUMBING';
    case 'VENTILATION':
      return 'VENTILATION';
    case 'ELECTRICAL':
      return 'ELECTRICAL';
    case 'LIGHTING':
      return 'LIGHTING';
    case 'PHOTOVOLTAIC':
      return 'SOLAR';
    case 'FURNITURE':
      return 'FURNITURE';
    // An appliance and an « autre » say nothing about a trade, and filing them
    // under one would invent a discipline the project never claimed.
    case 'APPLIANCE':
    case 'OTHER':
      return undefined;
  }
}

/**
 * Which trade a calculation module answers for.
 *
 * L'inverse de `calculationModules`, construit une fois. Il fallait bien le
 * construire : un constat de calcul porte un identifiant de module — `heating`,
 * `dhw`, `iaq` — et rien d'autre ne dit à quel métier il parle. Le déduire du
 * nom marcherait pour `heating` et échouerait pour `iaq`, ce qui est la pire
 * des deux issues : ça marche assez pour qu'on ne vérifie pas.
 *
 * Un module qu'aucun domaine ne réclame n'a pas de métier, et c'est une
 * réponse : `undefined` plutôt qu'un domaine choisi par défaut.
 */
const DOMAIN_OF_MODULE: ReadonlyMap<string, DesignDomainId> = new Map(
  DESIGN_DOMAIN_IDS.flatMap((id) =>
    (designDomain(id).calculationModules ?? []).map(
      (moduleId) => [moduleId, id] as const,
    ),
  ),
);

export function domainOfCalculationModule(
  moduleId: string,
): DesignDomainId | undefined {
  return DOMAIN_OF_MODULE.get(moduleId);
}

/**
 * The trades this project actually holds something of.
 *
 * The scope is a decision about what to work on; this is a fact about what is
 * in the file. Keeping them apart is what lets the interface say « ce domaine
 * est hors périmètre mais contient déjà 14 objets » instead of quietly hiding
 * fourteen objects.
 */
export function domainsPresentIn(project: Project): readonly DesignDomainId[] {
  const present = new Set<DesignDomainId>();
  const site = project.site;
  if (
    site.parcelBoundary !== undefined ||
    (site.obstacles ?? []).length > 0 ||
    site.location !== undefined
  )
    present.add('SITE');
  for (const level of project.building.levels) {
    if (
      level.walls.length > 0 ||
      level.spaces.length > 0 ||
      level.slabs.length > 0 ||
      level.roofs.length > 0 ||
      level.openings.length > 0
    )
      present.add('ARCHITECTURE');
    if ((level.structure ?? []).length > 0) present.add('STRUCTURE');
    for (const component of level.components ?? []) {
      const domain = domainOfComponentCategory(component.category);
      if (domain !== undefined) present.add(domain);
    }
  }
  for (const network of project.systems ?? []) {
    const domain = domainOfDiscipline(network.discipline);
    if (domain !== undefined) present.add(domain);
  }
  return ordered(present);
}

/**
 * The domains left out of the scope that the project nonetheless contains.
 *
 * Never an error and never a reason to refuse anything: it is what the
 * interface has to be able to say out loud when someone narrows their scope.
 */
export function domainsOutsideScope(
  project: Project,
  scope: ProjectScope,
): readonly DesignDomainId[] {
  return domainsPresentIn(project).filter((id) => !domainEnabled(scope, id));
}
