import { createRulePack, isIsoDate, type RulePack } from './rule-pack.js';

export interface RulePackSelection {
  readonly pack: RulePack;
  readonly projectDate: string;
  readonly explanation: string;
}

export type RulePackSelectionResult =
  | { readonly status: 'SELECTED'; readonly selection: RulePackSelection }
  | { readonly status: 'NOT_FOUND'; readonly explanation: string }
  | {
      readonly status: 'CONFLICT';
      readonly candidates: readonly RulePack[];
      readonly explanation: string;
    }
  | {
      readonly status: 'NOT_APPLICABLE';
      readonly candidates: readonly RulePack[];
      readonly explanation: string;
    };

/**
 * Where and when a project is being assessed.
 *
 * A rule pack answers a question about a place and a date. Running one without
 * knowing them cannot produce a verdict — only the appearance of one — so the
 * context is required rather than defaulted.
 */
export interface RulePackContext {
  readonly country: string;
  readonly region?: string;
  readonly municipality?: string;
  /** ISO date the assessment is made against. */
  readonly referenceDate: string;
}

/**
 * Whether a pack's jurisdiction covers the project's.
 *
 * A pack with no region covers its whole country. A pack that names a region
 * only covers a project that names the same one: a project that declares no
 * region is not shown to be inside it, so the honest answer is that the pack
 * cannot be applied, not that it passes.
 */
export function jurisdictionApplies(
  pack: RulePack,
  context: RulePackContext,
): { readonly applies: boolean; readonly explanation: string } {
  const packCountry = pack.jurisdiction.country.trim().toUpperCase();
  const projectCountry = context.country.trim().toUpperCase();
  if (packCountry !== projectCountry)
    return {
      applies: false,
      explanation: `${pack.id} vise ${pack.jurisdiction.country} ; le projet déclare ${context.country}.`,
    };
  for (const [level, packValue, projectValue] of [
    ['la région', pack.jurisdiction.region, context.region],
    ['la commune', pack.jurisdiction.municipality, context.municipality],
  ] as const) {
    if (packValue === undefined) continue;
    if (projectValue === undefined)
      return {
        applies: false,
        explanation: `${pack.id} vise ${level} ${packValue} ; le projet n'en déclare aucune.`,
      };
    if (packValue.trim().toUpperCase() !== projectValue.trim().toUpperCase())
      return {
        applies: false,
        explanation: `${pack.id} vise ${level} ${packValue} ; le projet déclare ${projectValue}.`,
      };
  }
  return {
    applies: true,
    explanation: `${pack.id} couvre ${describeJurisdiction(pack)}.`,
  };
}

function describeJurisdiction(pack: RulePack): string {
  return [
    pack.jurisdiction.country,
    pack.jurisdiction.region,
    pack.jurisdiction.municipality,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' / ');
}

export class RulePackRegistry {
  readonly #packs = new Map<string, Map<string, RulePack>>();

  register(pack: RulePack): void {
    const snapshot = createRulePack(pack);
    const versions =
      this.#packs.get(snapshot.id) ?? new Map<string, RulePack>();
    if (versions.has(snapshot.version))
      throw new Error(
        `Rule pack ${snapshot.id}@${snapshot.version} is already registered`,
      );
    versions.set(snapshot.version, snapshot);
    this.#packs.set(snapshot.id, versions);
  }

  /**
   * The version of a pack that applies to a project, or why none does.
   *
   * Jurisdiction is checked before validity: a pack for another country is not
   * "out of date", it simply does not apply, and saying so is the answer the
   * user needs.
   */
  resolve(packId: string, context: RulePackContext): RulePackSelectionResult {
    const versions = this.#packs.get(packId);
    if (versions === undefined)
      return {
        status: 'NOT_FOUND',
        explanation: `Aucun référentiel enregistré ne porte l'identifiant ${packId}.`,
      };
    const all = [...versions.values()];
    const applicable = all.filter(
      (pack) => jurisdictionApplies(pack, context).applies,
    );
    if (applicable.length === 0)
      return {
        status: 'NOT_APPLICABLE',
        candidates: all.map((pack) => structuredClone(pack)),
        explanation:
          jurisdictionApplies(all[0]!, context).explanation ||
          `${packId} ne couvre pas la juridiction du projet.`,
      };
    return this.selectAmong(packId, applicable, context.referenceDate);
  }

  select(packId: string, projectDate: string): RulePackSelectionResult {
    if (!isIsoDate(projectDate))
      throw new RangeError('projectDate must be a valid YYYY-MM-DD date');
    const versions = this.#packs.get(packId);
    if (versions === undefined)
      return {
        status: 'NOT_FOUND',
        explanation: `Aucun référentiel enregistré ne porte l'identifiant ${packId}.`,
      };
    return this.selectAmong(packId, [...versions.values()], projectDate);
  }

  private selectAmong(
    packId: string,
    packs: readonly RulePack[],
    projectDate: string,
  ): RulePackSelectionResult {
    if (!isIsoDate(projectDate))
      throw new RangeError('projectDate must be a valid YYYY-MM-DD date');
    const candidates = packs
      .filter((pack) => appliesOn(pack, projectDate))
      .sort((first, second) => first.version.localeCompare(second.version));
    if (candidates.length === 0)
      return {
        status: 'NOT_FOUND',
        explanation: `Aucune version de ${packId} n'est en vigueur au ${projectDate} : ${describeValidities(packs)}.`,
      };
    if (candidates.length > 1)
      return {
        status: 'CONFLICT',
        candidates,
        explanation: `${candidates.length} versions de ${packId} se chevauchent au ${projectDate} (${candidates.map(({ version }) => version).join(', ')}) : la version applicable doit être choisie explicitement.`,
      };
    const pack = candidates[0]!;
    return {
      status: 'SELECTED',
      selection: {
        pack: structuredClone(pack),
        projectDate,
        explanation: `${pack.id}@${pack.version} s'applique au ${projectDate}, dans sa validité ${formatValidity(pack)}.`,
      },
    };
  }
}

function appliesOn(pack: RulePack, date: string): boolean {
  return (
    (pack.validity.from === undefined || pack.validity.from <= date) &&
    (pack.validity.to === undefined ||
      pack.validity.to === null ||
      date <= pack.validity.to)
  );
}

function formatValidity(pack: RulePack): string {
  return `${pack.validity.from ?? 'sans début déclaré'} → ${pack.validity.to ?? 'sans fin déclarée'}`;
}

function describeValidities(packs: readonly RulePack[]): string {
  return packs
    .map((pack) => `${pack.version} (${formatValidity(pack)})`)
    .join(', ');
}
