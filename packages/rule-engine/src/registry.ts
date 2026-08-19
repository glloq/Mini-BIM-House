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
    };

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

  select(packId: string, projectDate: string): RulePackSelectionResult {
    if (!isIsoDate(projectDate))
      throw new RangeError('projectDate must be a valid YYYY-MM-DD date');
    const versions = this.#packs.get(packId);
    if (versions === undefined)
      return {
        status: 'NOT_FOUND',
        explanation: `No registered rule pack has ID ${packId}.`,
      };
    const candidates = [...versions.values()]
      .filter((pack) => appliesOn(pack, projectDate))
      .sort((first, second) => first.version.localeCompare(second.version));
    if (candidates.length === 0)
      return {
        status: 'NOT_FOUND',
        explanation: `No version of ${packId} applies on ${projectDate}.`,
      };
    if (candidates.length > 1)
      return {
        status: 'CONFLICT',
        candidates,
        explanation: `${candidates.length} versions of ${packId} overlap on ${projectDate}; selection must be resolved explicitly.`,
      };
    const pack = candidates[0]!;
    return {
      status: 'SELECTED',
      selection: {
        pack: structuredClone(pack),
        projectDate,
        explanation: `${pack.id}@${pack.version} applies on ${projectDate} within ${formatValidity(pack)}.`,
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
  return `${pack.validity.from ?? 'open start'} to ${pack.validity.to ?? 'open end'}`;
}
